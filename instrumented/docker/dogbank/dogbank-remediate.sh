#!/usr/bin/env bash
# =============================================================================
# Auto-remediação do DogBank por script — alternativa ao Datadog Workflow.
# =============================================================================
# POR QUE ISTO EXISTE
# O workflow "Block Dogbank User no MFA" roda na nuvem da Datadog e, para
# alcançar o app rodando LOCALMENTE, exige um Private Action Runner + uma
# connection HTTP amarrada a ele -- e esse binding só pode ser feito na UI
# (testado: a API cria a connection mas não persiste o vínculo com o runner).
#
# Este script faz a MESMA remediação, chamando os mesmos endpoints, sem
# depender de nada disso. Dois modos:
#
#   block / unblock  -> dispara na hora (para demo controlada, você no comando)
#   watch            -> observa os signals de segurança na Datadog e remedia
#                       sozinho quando um ataque novo aparece (mesmo efeito
#                       visível do workflow: sinal -> bloqueio automático)
#
# O QUE ELE NÃO FAZ
# Não demonstra o produto "Workflow Automation" em si. Se a conversa com o
# cliente for sobre Workflows, use o workflow de verdade. Se for sobre
# "a Datadog detecta e o ambiente se auto-remedia", isto entrega igual.
#
#   ./dogbank-remediate.sh block
#   ./dogbank-remediate.sh unblock
#   ./dogbank-remediate.sh status
#   ./dogbank-remediate.sh watch              # mantém bloqueado até reset explícito
#   ./dogbank-remediate.sh watch 60           # poll de 60s, mantém bloqueado
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")"

# shellcheck disable=SC1091
set -a; . ./.env; set +a

BASE="${DOGBANK_BASE:-https://lab.dogbank.dog}"
TOKEN="${DOGBANK_ADMIN_BLOCK_TOKEN:-}"
DD="https://api.datadoghq.com"

hdr=(-H "Content-Type: application/json" -H "X-Admin-Token: $TOKEN")
ddh=(-H "DD-API-KEY: ${DD_API_KEY:-}" -H "DD-APPLICATION-KEY: ${DD_APP_KEY:-}")

say() { printf '%s %s\n' "$(date -u +%H:%M:%SZ)" "$*"; }
require_token() { : "${TOKEN:?DOGBANK_ADMIN_BLOCK_TOKEN ausente no ambiente}"; }

# Bloqueia TODO o segmento sem MFA (o que o ATO por senha roubada compromete).
block() {
  local reason="${1:-auto-remediation via script}"
  require_token
  curl -fsS -m 30 "${hdr[@]}" -X POST "$BASE/api/auth/admin/block-no-mfa" \
    -d "{\"reason\":\"$reason\"}" \
  | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('  resposta inesperada'); raise SystemExit(1)
if 'count' in d: print('  BLOQUEADAS %d conta(s) sem MFA -> %s' % (d['count'], d.get('userIds')))
else: print('  ', json.dumps(d)[:160])
"
}

unblock() {
  require_token
  curl -fsS -m 30 -H "X-Admin-Token: $TOKEN" -X POST "$BASE/api/auth/admin/unblock-no-mfa" \
  | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('  resposta inesperada'); raise SystemExit(1)
print('  DESBLOQUEADAS %s conta(s)' % d.get('count'))
"
}

status() {
  podman exec dogbank-postgres psql -U dogbank -d dogbank -t -A -F' | ' -c \
    "SELECT count(*) FILTER (WHERE blocked) AS bloqueados, count(*) AS total FROM usuarios;" 2>/dev/null \
    | sed 's/^/  bloqueados | total: /'
}

# Último signal de segurança do alvo (id + título), para detectar ataque novo.
latest_signal() {
  local from; from=$(date -u -v-15M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '15 min ago' +%Y-%m-%dT%H:%M:%SZ)
  curl -sS -m 25 "${ddh[@]}" -G "$DD/api/v2/security_monitoring/signals" \
    --data-urlencode "filter[query]=${SIGNAL_QUERY:-service:transaction-service}" \
    --data-urlencode "filter[from]=$from" \
    --data-urlencode "filter[to]=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --data-urlencode "page[limit]=1" --data-urlencode "sort=-timestamp" 2>/dev/null \
  | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: raise SystemExit
its=d.get('data') or []
if not its: raise SystemExit
a=its[0]['attributes']
msg=(a.get('message') or '').replace(chr(10),' ').strip('% ')[:70]
print('%s\t%s' % (its[0]['id'], msg))
"
}

# Observa a Datadog e remedia quando um signal NOVO aparece.
watch() {
  local poll="${1:-30}" last="" cur id msg
  : "${DD_API_KEY:?DD_API_KEY ausente no .env}"
  : "${DD_APP_KEY:?DD_APP_KEY ausente no .env}"
  say "observando signals (poll ${poll}s, bloqueio permanece até reset explícito). Ctrl-C para sair."
  # Ignora o que já existe: só reage a ataque novo a partir de agora.
  last=$(latest_signal | cut -f1)
  [ -n "$last" ] && say "baseline: ignorando signal já existente"
  while true; do
    cur=$(latest_signal)
    id=$(printf '%s' "$cur" | cut -f1)
    msg=$(printf '%s' "$cur" | cut -f2)
    if [ -n "$id" ] && [ "$id" != "$last" ]; then
      last="$id"
      say "SIGNAL NOVO: $msg"
      say "remediando..."
      block "ATO auto-remediation (signal $id)"
    fi
    sleep "$poll"
  done
}

case "${1:-status}" in
  block)   block "${2:-manual via script}" ;;
  unblock) unblock ;;
  status)  status ;;
  watch)   watch "${2:-30}" ;;
  *) echo "uso: $0 {block [motivo]|unblock|status|watch [poll_s]}" >&2; exit 2 ;;
esac
