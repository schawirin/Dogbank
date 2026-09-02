#!/usr/bin/env bash
# =============================================================================
# Liga/desliga a regra de bloqueio da AAP usada na demo do EvilDog.
# =============================================================================
# A demo precisa mostrar as duas metades: primeiro o ataque PASSANDO (sem
# proteção) e depois o MESMO ataque BARRADO. Como a regra vive na org do
# Datadog e chega nos tracers por Remote Configuration, alternar o `enabled`
# é o jeito de encenar isso sem recriar nada.
#
# A regra bloqueia por PADRÃO DE ATAQUE (SQLi UNION no validate-pix-key), não
# por IP -- então o "Trocar IP" e o "Escalar agentes" do EvilDog continuam
# sendo barrados, que é o ponto forte da narrativa.
#
#   ./evildog-block.sh on      # protege  -> ataque vira HTTP 403
#   ./evildog-block.sh off     # expõe    -> ataque volta a vazar dados
#   ./evildog-block.sh status
#
# A propagação por Remote Config leva de segundos a ~1 min. Use `status` e/ou
# ./evildog-block.sh probe para confirmar antes de apresentar.
# =============================================================================
set -euo pipefail

RULE_ID="${EVILDOG_RULE_ID:-5eaf88fd-85d5-44de-9629-a82aa3acf376}"
API="https://api.datadoghq.com/api/v2/remote_config/products/asm/waf/custom_rules"
cd "$(dirname "$0")"

# shellcheck disable=SC1091
set -a; . ./.env; set +a
: "${DD_API_KEY:?DD_API_KEY ausente no .env}"
: "${DD_APP_KEY:?DD_APP_KEY ausente no .env}"

dd() { curl -sS -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
             -H "Content-Type: application/json" "$@"; }

# A API não tem PATCH parcial (retorna 404): o PUT precisa do objeto completo.
put_enabled() {
  dd -o /dev/null -w "" -X PUT "$API/$RULE_ID" -d '{"data":{"id":"'"$RULE_ID"'","type":"custom_rule","attributes":{
    "name":"DogBank - BLOCK SQLi UNION on validate-pix-key (EvilDog lab)",
    "enabled":'"$1"',"blocking":true,
    "path_glob":"*/api/transactions/validate-pix-key",
    "scope":[{"env":"dogbank","service":"transaction-service"}],
    "conditions":[{"operator":"match_regex","parameters":{
      "inputs":[{"address":"server.request.query"}],"regex":"(?i)union\\s+(all\\s+)?select"}}],
    "tags":{"category":"attack_attempt","type":"sql_injection"}}}}'
}

status() {
  dd "$API" | python3 -c "
import json,sys
rid='$RULE_ID'
for r in json.load(sys.stdin)['data']:
    if r['id']==rid:
        a=r['attributes']
        print('regra   :',a['name'])
        print('enabled :',a['enabled'],' blocking:',a['blocking'])
        sys.exit(0)
print('regra',rid,'NAO ENCONTRADA na org'); sys.exit(1)"
}

# Dispara o SQLi real de dentro da rede, a partir do IP informado, e mostra a resposta.
# 403/406 = barrado (pode ser a regra de padrão OU a denylist do Automated Attacker
# Blocking -- os dois devolvem 403; use `status` para saber se a regra está ligada).
probe() {
  local pay="' UNION SELECT u.nome,u.email,u.cpf,c.saldo,c.banco,u.chave_pix FROM usuarios u JOIN contas c ON u.id=c.usuario_id--"
  local ip="${1:-198.51.100.99}"
  podman exec evildog-api python -c "
import requests,sys
r=requests.get('http://transaction-service:8084/api/transactions/validate-pix-key',
               params={'pixKey':sys.argv[1]},headers={'X-Forwarded-For':sys.argv[2]},timeout=10)
print('HTTP',r.status_code,'->','BLOQUEADO' if r.status_code in (403,406) else 'passou (dados vazando)')" "$pay" "$ip"
}

# Testa somente uma denylist ativa, sem emitir SQLi nem usar User-Agent de
# ferramenta ofensiva. É o check seguro para executar antes do primeiro ato.
readiness() {
  local ip="${1:-$(current_ip)}"
  podman exec evildog-api python -c "
import requests,sys
r=requests.get('http://transaction-service:8084/api/transactions/validate-pix-key',
               params={'pixKey':'evildog@dogbank.com'},
               headers={'X-Forwarded-For':sys.argv[1],
                        'User-Agent':'Mozilla/5.0 (DogBank demo readiness check)'},timeout=5)
print('IP:',sys.argv[1])
print('HTTP',r.status_code,'->','AINDA BLOQUEADO' if r.status_code in (403,406) else 'PRONTO')" "$ip"
}

# O IP de origem que o EvilDog está usando AGORA.
current_ip() {
  curl -sS https://lab.dogbank.dog/api/evildog/source-ip \
    | python3 -c "import json,sys;print(json.load(sys.stdin)['source_ip'])"
}

# Checa se o IP ATUAL do atacante já caiu na denylist do Automated Attacker Blocking.
# Vale rodar antes de apresentar: se der BLOQUEADO, rotacione o IP antes do Ato 1,
# senão o "ataque bem-sucedido" começa barrado e a demo perde o primeiro ato.
check() {
  local ip="${1:-$(current_ip)}"
  readiness "$ip"
}

case "${1:-status}" in
  on)     put_enabled true;  echo "regra LIGADA (protegido)";  status ;;
  off)    put_enabled false; echo "regra DESLIGADA (exposto)"; status ;;
  status) status ;;
  probe)  probe "${2:-198.51.100.99}" ;;
  readiness) readiness "${2:-}" ;;
  check)  check "${2:-}" ;;
  ip)     current_ip ;;
  rotate) curl -sS -X POST https://lab.dogbank.dog/api/evildog/rotate-ip; echo ;;
  *) echo "uso: $0 {on|off|status|probe [ip]|readiness [ip]|check [ip]|ip|rotate}" >&2; exit 2 ;;
esac
