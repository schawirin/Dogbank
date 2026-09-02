#!/usr/bin/env bash
# =============================================================================
# Deterministic preflight/reset for the DogBank EvilDog security demo.
#
#   ./evildog-demo-preflight.sh check
#   ./evildog-demo-preflight.sh reset
#
# `check` is read-only. `reset` deliberately makes the initial demo state:
# WAF pattern rule OFF, all no-MFA users unblocked, one fresh attacker IP, and
# then verifies that the IP remains stable. It never prints credentials.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
fi

# The local profile deliberately publishes TLS on 8443 so it can coexist with
# other developer services. Deployments can still override DOGBANK_BASE.
BASE="${DOGBANK_BASE:-https://lab.dogbank.dog:8443}"
EVILDOG_API="${EVILDOG_API_BASE:-${BASE}/api/evildog}"
DD_SITE="${DD_SITE:-datadoghq.com}"
DD_API="https://api.${DD_SITE}"
WORKFLOW_ID="${DOGBANK_SECURITY_WORKFLOW_ID:-}"
RUNNER_CONTAINER="${DOGBANK_ACTION_RUNNER_CONTAINER:-dogbank-action-runner}"
REQUIRE_PAR="${DOGBANK_REQUIRE_PAR:-0}"
MAX_CLOCK_DRIFT_SECONDS="${DOGBANK_MAX_CLOCK_DRIFT_SECONDS:-5}"
COOKIE_JAR=""
failures=0

ok()   { printf '  [ok] %s\n' "$*"; }
warn() { printf '  [!!] %s\n' "$*"; }
bad()  { printf '  [xx] %s\n' "$*"; failures=$((failures + 1)); }

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || { printf '%s is required for reset\n' "$name" >&2; exit 2; }
}

http_json() {
  curl -fsS --connect-timeout 5 --max-time 15 "$@"
}

cleanup() {
  [[ -z "$COOKIE_JAR" ]] || rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

authenticate_evildog() {
  if [[ -z "${EVILDOG_CONTROL_TOKEN:-}" ]]; then
    bad 'EVILDOG_CONTROL_TOKEN is missing (run ./setup-demo-secrets.sh)'
    return 1
  fi
  cleanup
  COOKIE_JAR="$(mktemp "${TMPDIR:-/tmp}/dogbank-evildog-cookie.XXXXXX")"
  local body
  body="$(EVILDOG_CONTROL_TOKEN="$EVILDOG_CONTROL_TOKEN" python3 -c 'import json, os; print(json.dumps({"token": os.environ["EVILDOG_CONTROL_TOKEN"]}))')"
  if curl -fsS --connect-timeout 5 --max-time 15 -c "$COOKIE_JAR" \
      -H 'Content-Type: application/json' -X POST "$EVILDOG_API/session" --data "$body" >/dev/null; then
    ok 'EvilDog operator session authenticated'
  else
    bad 'could not authenticate the EvilDog operator session'
    return 1
  fi
}

evildog_json() {
  [[ -n "$COOKIE_JAR" ]] || { echo 'EvilDog session is not initialized' >&2; return 1; }
  curl -fsS --connect-timeout 5 --max-time 15 -b "$COOKIE_JAR" "$@"
}

json_field() {
  local field="$1"
  python3 -c "import json,sys; print(json.load(sys.stdin)$field)"
}

check_http() {
  local label="$1" url="$2"
  if http_json "$url" >/dev/null; then ok "$label"; else bad "$label is unavailable ($url)"; fi
}

check_evildog_http() {
  local label="$1" url="$2"
  if evildog_json "$url" >/dev/null; then ok "$label"; else bad "$label is unavailable ($url)"; fi
}

check_sse() {
  local headers
  # A live SSE response intentionally does not finish. curl exits 28 after the
  # short timeout; the headers are sufficient to validate the endpoint.
  headers="$(curl -sS -D - -o /dev/null --connect-timeout 5 --max-time 2 -b "$COOKIE_JAR" \
    -H 'Accept: text/event-stream' "$EVILDOG_API/stream" 2>/dev/null || true)"
  if printf '%s' "$headers" | tr -d '\r' | grep -qi '^content-type: text/event-stream'; then
    ok 'EvilDog SSE endpoint is reachable'
  else
    bad 'EvilDog SSE endpoint did not return text/event-stream'
  fi
}

source_ip() {
  evildog_json "$EVILDOG_API/source-ip" | json_field "['source_ip']"
}

check_container_health() {
  local name="$1" state
  if ! command -v podman >/dev/null 2>&1; then
    warn "podman unavailable; cannot inspect $name"
    return 1
  fi
  if ! podman container exists "$name" 2>/dev/null; then
    bad "$name is not found"
    return 1
  fi
  state="$(podman inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$name")"
  if [[ "$state" == healthy || "$state" == running ]]; then
    ok "$name is $state"
  else
    bad "$name is ${state:-not found}"
    return 1
  fi
}

podman_clock_drift() {
  local host_epoch vm_epoch drift
  host_epoch="$(date -u +%s)"
  vm_epoch="$(podman machine ssh date -u +%s 2>/dev/null | tail -1)" || return 1
  [[ "$host_epoch" =~ ^[0-9]+$ && "$vm_epoch" =~ ^[0-9]+$ ]] || return 1
  drift=$((host_epoch - vm_epoch))
  (( drift < 0 )) && drift=$((-drift))
  printf '%s\n' "$drift"
}

check_podman_clock() {
  local drift
  if ! command -v podman >/dev/null 2>&1; then
    bad 'podman unavailable; clock synchronization was not checked'
    return
  fi
  if ! drift="$(podman_clock_drift)"; then
    warn 'Podman VM clock could not be compared (non-machine Podman is allowed)'
    return
  fi
  if (( drift <= MAX_CLOCK_DRIFT_SECONDS )); then
    ok "Podman VM clock is synchronized (${drift}s drift)"
  else
    bad "Podman VM clock is ${drift}s out of sync; Datadog signals can disappear from the active time window"
  fi
}

sync_podman_clock() {
  local drift host_epoch attempt
  if ! command -v podman >/dev/null 2>&1; then
    return
  fi
  if ! drift="$(podman_clock_drift)"; then
    return
  fi
  if (( drift <= MAX_CLOCK_DRIFT_SECONDS )); then
    return
  fi

  printf 'Synchronizing Podman VM clock (%ss drift)...\n' "$drift"
  host_epoch="$(date -u +%s)"
  podman machine ssh sudo date -u -s "@$host_epoch" >/dev/null

  # The trace-agent keeps retry/backoff state. Restarting only this container
  # clears that state without interrupting the DogBank application services.
  if podman container exists datadog-agent 2>/dev/null; then
    podman restart datadog-agent >/dev/null
    for attempt in {1..15}; do
      if podman exec datadog-agent agent health >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi
}

check_datadog_transport() {
  local result totals successes
  if ! podman container exists datadog-agent 2>/dev/null; then
    bad 'datadog-agent is not found'
    return
  fi
  if ! result="$(podman exec datadog-agent agent diagnose --include connectivity-datadog-core-endpoints 2>&1)"; then
    bad 'Datadog Agent connectivity diagnosis failed'
    return
  fi
  totals="$(printf '%s\n' "$result" | sed -n 's/^[[:space:]]*Total:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | tail -1)"
  successes="$(printf '%s\n' "$result" | sed -n 's/^[[:space:]]*Total:[[:space:]]*[0-9][0-9]*,[[:space:]]*Success:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | tail -1)"
  if [[ -n "$totals" && "$totals" == "$successes" ]]; then
    ok "Datadog Agent intake connectivity passed (${successes}/${totals})"
  else
    bad 'Datadog Agent cannot reach every required intake endpoint'
  fi
}

check_waf_off() {
  if [[ -z "${DD_API_KEY:-}" || -z "${DD_APP_KEY:-}" ]]; then
    warn 'Datadog credentials absent; WAF rule state was not verified'
    return
  fi
  local output
  output="$(./evildog-block.sh status 2>&1 || true)"
  if printf '%s\n' "$output" | grep -Eq 'enabled[[:space:]]*:[[:space:]]*False'; then
    ok 'SQLi pattern WAF rule is OFF (baseline permits Act 1)'
  elif printf '%s\n' "$output" | grep -qiE 'regra .*NAO ENCONTRADA|curl:|error|forbidden|unauthori[sz]ed'; then
    bad 'could not read SQLi pattern WAF rule state from Datadog'
  else
    bad 'SQLi pattern WAF rule must be OFF before Act 1'
  fi
}

check_users_unblocked() {
  if ! command -v podman >/dev/null 2>&1; then
    warn 'podman unavailable; user block state was not verified'
    return
  fi
  local count
  count="$(podman exec dogbank-postgres psql -U dogbank -d dogbank -t -A \
    -c 'SELECT count(*) FROM usuarios WHERE blocked' 2>/dev/null || true)"
  if [[ "$count" == 0 ]]; then ok 'all users are unblocked'; else bad "expected zero blocked users, got ${count:-unknown}"; fi
}

check_runner() {
  local state issue
  issue() { if [[ "$REQUIRE_PAR" == 1 ]]; then bad "$1"; else warn "$1"; fi; }
  if ! command -v podman >/dev/null 2>&1; then
    issue 'podman unavailable; Private Action Runner was not checked'
    return
  fi
  if ! podman container exists "$RUNNER_CONTAINER" 2>/dev/null; then
    issue "Private Action Runner $RUNNER_CONTAINER is not running (not required for a public HTTP connection)"
    return
  fi
  state="$(podman inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$RUNNER_CONTAINER")"
  if [[ "$state" != healthy && "$state" != running ]]; then
    issue "Private Action Runner is $state"
    return
  fi
  if podman logs --since 5m "$RUNNER_CONTAINER" 2>&1 | grep -Eqi 'DNS resolution failure|failed to dequeue task|error validating JWT'; then
    issue 'Private Action Runner has transport/authentication errors in the last 5 minutes'
  else
    ok 'Private Action Runner is healthy (optional unless DOGBANK_REQUIRE_PAR=1)'
  fi
}

check_workflow() {
  if [[ -z "$WORKFLOW_ID" ]]; then
    bad 'DOGBANK_SECURITY_WORKFLOW_ID is not configured'
    return
  fi
  if [[ -z "${DD_API_KEY:-}" || -z "${DD_APP_KEY:-}" ]]; then
    bad 'Datadog credentials absent; security workflow cannot be verified'
    return
  fi

  local payload summary latest
  if ! payload="$(curl -fsS --connect-timeout 5 --max-time 20 \
      -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
      "$DD_API/api/v2/workflows/$WORKFLOW_ID")"; then
    bad 'security workflow is not readable from the Datadog API'
    return
  fi
  summary="$(printf '%s' "$payload" | python3 -c '
import json, sys
spec = json.load(sys.stdin).get("data", {}).get("attributes", {}).get("spec", {})
text = json.dumps(spec, sort_keys=True)
checks = {
  "segment": "/admin/block-no-mfa" in text,
  "connection": "INTEGRATION_HTTP_DOGBANK" in text,
  "legacy_user_block": "/admin/block-user" in text,
  "auto_unblock": "/admin/unblock" in text or "unblock-no-mfa" in text,
}
print(" ".join(f"{key}={str(value).lower()}" for key, value in checks.items()))
')"
  if [[ "$summary" == *'segment=true'* && "$summary" == *'connection=true'* && "$summary" == *'legacy_user_block=false'* && "$summary" == *'auto_unblock=false'* ]]; then
    ok 'security workflow blocks the no-MFA segment through its secret-backed connection'
  else
    bad "security workflow contract invalid ($summary)"
  fi
  if ! latest="$(curl -fsS --connect-timeout 5 --max-time 20 \
      -H "DD-API-KEY: $DD_API_KEY" -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
      "$DD_API/api/v2/workflows/$WORKFLOW_ID/instances?page%5Bsize%5D=1")"; then
    bad 'security workflow history is not readable from the Datadog API'
    return
  fi
  latest="$(printf '%s' "$latest" | python3 -c '
import json, sys
items = json.load(sys.stdin).get("data") or []
if not items:
    print("missing")
else:
    attrs = items[0].get("attributes", {})
    state = (
        attrs.get("status")
        or attrs.get("state")
        or attrs.get("instanceStatus", {}).get("detailsKind")
        or "missing"
    )
    normalized = str(state).lower()
    print("success" if normalized in {"success", "succeeded", "instance_success"} else normalized)
')"
  if [[ "$(printf '%s' "$latest" | tr '[:upper:]' '[:lower:]')" == success ]]; then
    ok 'latest security workflow execution succeeded'
  else
    bad "latest security workflow execution is ${latest}; run a safe smoke test before the demo"
  fi
}

check_ip_stability() {
  local first second
  first="$(source_ip 2>/dev/null || true)"
  sleep 1
  second="$(source_ip 2>/dev/null || true)"
  if [[ -z "$first" || -z "$second" ]]; then
    bad 'attacker IP could not be read from EvilDog'
  elif [[ "$first" == "$second" ]]; then
    ok "attacker IP is frozen for the demo: $first"
  else
    bad "attacker IP changed during preflight (${first:-missing} -> ${second:-missing})"
  fi
}

check_all() {
  printf 'DogBank EvilDog demo preflight (%s)\n' "$BASE"
  authenticate_evildog || true
  check_http 'edge health endpoint' "$BASE/health"
  check_evildog_http 'EvilDog health endpoint' "$EVILDOG_API/health"
  check_evildog_http 'EvilDog pipeline state endpoint' "$EVILDOG_API/pipeline/state"
  check_sse
  check_container_health dogbank-frontend || true
  check_container_health dogbank-nginx || true
  check_container_health datadog-agent || true
  check_podman_clock
  check_datadog_transport
  check_waf_off
  check_users_unblocked
  check_ip_stability
  check_runner
  check_workflow
  if (( failures > 0 )); then
    printf '\nPreflight FAILED: %d check(s) need attention. Do not start the demo.\n' "$failures" >&2
    return 1
  fi
  printf '\nPreflight PASSED. Start Act 1 with the displayed frozen attacker IP.\n'
}

reset() {
  require_env DD_API_KEY
  require_env DD_APP_KEY
  require_env DOGBANK_ADMIN_BLOCK_TOKEN
  require_env EVILDOG_CONTROL_TOKEN
  printf 'Resetting deterministic EvilDog demo state...\n'
  sync_podman_clock
  ./evildog-block.sh off >/dev/null
  DOGBANK_BASE="$BASE" DOGBANK_ADMIN_BLOCK_TOKEN="$DOGBANK_ADMIN_BLOCK_TOKEN" ./dogbank-remediate.sh unblock >/dev/null
  authenticate_evildog
  # Reset clears accumulated loot/stats/pipeline state. It returns 409 while a
  # pipeline is active, so a reset can never mutate a live demonstration run.
  evildog_json -X POST "$EVILDOG_API/reset" >/dev/null
  # This is the sole intentional rotation after the state reset.
  evildog_json -X POST "$EVILDOG_API/rotate-ip" >/dev/null
  check_all
}

case "${1:-check}" in
  check) check_all ;;
  reset) reset ;;
  *) echo "usage: $0 {check|reset}" >&2; exit 2 ;;
esac
