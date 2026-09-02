#!/usr/bin/env bash
# =============================================================================
# Creates missing local-only secrets required by the DogBank security demo.
#
#   ./setup-demo-secrets.sh
#
# It only updates .env, never prints generated values, and preserves existing
# non-empty values so it is safe to run before each local demo rebuild.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"
ENV_FILE="${DOGBANK_ENV_FILE:-.env}"

command -v openssl >/dev/null 2>&1 || {
  echo "openssl is required to generate local demo secrets" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || : > "$ENV_FILE"
chmod 600 "$ENV_FILE"

set_value() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ ("^" key "=") {
      if (!found) print key "=" value
      found = 1
      next
    }
    { print }
    END { if (!found) print key "=" value }
  ' "$ENV_FILE" > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$ENV_FILE"
}

ensure_secret() {
  local key="$1" current
  current="$(awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$ENV_FILE")"
  if [[ -z "$current" || "$current" == defina-* || "$current" == YOUR_* ]]; then
    set_value "$key" "$(openssl rand -hex 32)"
    printf 'generated %s in %s\n' "$key" "$ENV_FILE"
  else
    printf 'kept existing %s in %s\n' "$key" "$ENV_FILE"
  fi
}

ensure_secret DOGBANK_ADMIN_BLOCK_TOKEN
ensure_secret EVILDOG_CONTROL_TOKEN
ensure_secret EVILDOG_AGENT_TOKEN

printf 'Local demo secrets are ready. Values were not printed.\n'
