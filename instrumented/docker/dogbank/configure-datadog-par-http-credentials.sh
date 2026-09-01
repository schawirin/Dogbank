#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
CREDENTIAL_FILE="$SCRIPT_DIR/datadog/private-action-runner/config/credentials/http_token.json"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Erro: arquivo %s não encontrado.\n' "$ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DOGBANK_ADMIN_BLOCK_TOKEN:?Defina DOGBANK_ADMIN_BLOCK_TOKEN em $ENV_FILE}"
command -v jq >/dev/null 2>&1 || {
  printf 'Erro: jq é obrigatório para gerar a credencial do runner.\n' >&2
  exit 1
}

mkdir -p "$(dirname -- "$CREDENTIAL_FILE")"
umask 077
TEMP_CREDENTIAL_FILE="$(mktemp "${CREDENTIAL_FILE}.tmp.XXXXXX")"
trap 'rm -f -- "$TEMP_CREDENTIAL_FILE"' EXIT

jq -n --arg token "$DOGBANK_ADMIN_BLOCK_TOKEN" '{
  auth_type: "Token Auth",
  credentials: [
    {
      tokenName: "adminBlockToken",
      tokenValue: $token
    }
  ]
}' >"$TEMP_CREDENTIAL_FILE"

chmod 600 "$TEMP_CREDENTIAL_FILE"
mv -- "$TEMP_CREDENTIAL_FILE" "$CREDENTIAL_FILE"
trap - EXIT

printf 'Credencial HTTP do Private Action Runner atualizada em %s (modo 0600).\n' "$CREDENTIAL_FILE"
