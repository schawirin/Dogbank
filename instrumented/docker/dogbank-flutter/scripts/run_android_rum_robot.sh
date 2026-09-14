#!/usr/bin/env bash
set -euo pipefail

APP_ID="${DOGBANK_ANDROID_APP_ID:-com.dogbank.dogbank_flutter}"
ACTIVITY="${DOGBANK_ANDROID_ACTIVITY:-.MainActivity}"
ADB="${ADB:-adb}"
DEVICE="${ANDROID_SERIAL:-}"
LOOPS="${DOGBANK_ROBOT_LOOPS:-20}"
MODE="${DOGBANK_ROBOT_MODE:-mix}"
SESSION_PAUSE_SECONDS="${DOGBANK_ROBOT_SESSION_PAUSE_SECONDS:-22}"
STARTUP_SECONDS="${DOGBANK_ROBOT_STARTUP_SECONDS:-2}"
LOGIN_WAIT_SECONDS="${DOGBANK_ROBOT_LOGIN_WAIT_SECONDS:-5}"
PIX_WAIT_SECONDS="${DOGBANK_ROBOT_PIX_WAIT_SECONDS:-6}"
DEMO_CPF="${DOGBANK_ROBOT_CPF:-12345678915}"
DEMO_PASSWORD="${DOGBANK_ROBOT_PASSWORD:-123456}"
BAD_PASSWORD="${DOGBANK_ROBOT_BAD_PASSWORD:-000000}"
LOG_PREFIX="[dogbank-rum-robot]"

usage() {
  cat <<EOF
Usage: $0 [--loops N] [--mode demo|pix|invest|mix|success|fail|browse]

Environment:
  ADB                                  adb binary path (default: adb)
  ANDROID_SERIAL                       target emulator/device id
  DOGBANK_ROBOT_LOOPS                  number of sessions (default: 20)
  DOGBANK_ROBOT_MODE                   demo, pix, invest, mix, success, fail, browse (default: mix)
  DOGBANK_ROBOT_SESSION_PAUSE_SECONDS  pause after each journey for RUM/replay upload (default: 22)
  DOGBANK_ROBOT_PASSWORD               demo password (default: 123456)
  DOGBANK_ROBOT_BAD_PASSWORD           wrong password for failure journeys (default: 000000)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loops)
      LOOPS="$2"
      shift 2
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "$LOG_PREFIX unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

adb_cmd() {
  if [[ -n "$DEVICE" ]]; then
    "$ADB" -s "$DEVICE" "$@"
  else
    "$ADB" "$@"
  fi
}

require_device() {
  if ! command -v "$ADB" >/dev/null 2>&1; then
    echo "$LOG_PREFIX adb not found. Set ADB=/path/to/adb." >&2
    exit 1
  fi
  adb_cmd get-state >/dev/null
}

read_screen_size() {
  local size
  size="$(adb_cmd shell wm size | tr -d '\r' | awk -F': ' '/Physical size/ {print $2}')"
  WIDTH="${size%x*}"
  HEIGHT="${size#*x}"
  if [[ -z "${WIDTH:-}" || -z "${HEIGHT:-}" || "$WIDTH" == "$HEIGHT" ]]; then
    WIDTH=1080
    HEIGHT=2400
  fi
}

tap_pct() {
  local x_per_mille="$1"
  local y_per_mille="$2"
  local x=$(( WIDTH * x_per_mille / 1000 ))
  local y=$(( HEIGHT * y_per_mille / 1000 ))
  adb_cmd shell input tap "$x" "$y"
}

ui_xml() {
  adb_cmd shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1
  adb_cmd shell cat /sdcard/window.xml | tr -d '\r\n'
}

find_label_bounds() {
  local label="$1"
  local clickable_only="${2:-false}"
  local xml
  command -v python3 >/dev/null 2>&1 || return 1
  xml="$(ui_xml 2>/dev/null || true)"
  [[ -n "$xml" ]] || return 1
  printf '%s' "$xml" | LABEL="$label" CLICKABLE_ONLY="$clickable_only" python3 -c '
import html
import os
import re
import sys
import unicodedata

def norm(value):
    value = html.unescape(value or "")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return value.lower()

label = norm(os.environ["LABEL"])
clickable_only = os.environ.get("CLICKABLE_ONLY") == "true"
xml = sys.stdin.read()
best = None
for node in re.findall(r"<node\b[^>]*>", xml):
    labels = []
    for attr in ("text", "content-desc", "hint"):
        match = re.search(attr + r"=\"([^\"]*)\"", node)
        if match:
            labels.append(html.unescape(match.group(1)))
    haystack = norm("\n".join(labels))
    if label not in haystack:
        continue
    clickable = "clickable=\"true\"" in node
    if clickable_only and not clickable:
        continue
    bounds = re.search(r"bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", node)
    if not bounds:
        continue
    lines = [norm(line.strip()) for value in labels for line in value.splitlines()]
    exact = label in lines
    score = (4 if clickable else 0) + (2 if exact else 0)
    candidate = (score, " ".join(bounds.groups()))
    if best is None or candidate[0] > best[0]:
        best = candidate
if best:
    print(best[1])
    raise SystemExit(0)
raise SystemExit(1)
'
}

has_label() {
  find_label_bounds "$1" >/dev/null 2>&1
}

tap_label() {
  local label="$1"
  local bounds
  bounds="$(find_label_bounds "$label" true 2>/dev/null || true)"
  if [[ -z "$bounds" ]]; then
    bounds="$(find_label_bounds "$label" false 2>/dev/null || true)"
  fi
  [[ -n "$bounds" ]] || return 1
  read -r x1 y1 x2 y2 <<< "$bounds"
  adb_cmd shell input tap $(((x1 + x2) / 2)) $(((y1 + y2) / 2))
}

tap_label_or_pct() {
  local label="$1"
  local x_per_mille="$2"
  local y_per_mille="$3"
  tap_label "$label" || tap_pct "$x_per_mille" "$y_per_mille"
}

swipe_pct() {
  local x1=$(( WIDTH * $1 / 1000 ))
  local y1=$(( HEIGHT * $2 / 1000 ))
  local x2=$(( WIDTH * $3 / 1000 ))
  local y2=$(( HEIGHT * $4 / 1000 ))
  local duration="${5:-320}"
  adb_cmd shell input swipe "$x1" "$y1" "$x2" "$y2" "$duration"
}

input_text() {
  local text="$1"
  adb_cmd shell input text "$text"
}

delete_chars() {
  local count="$1"
  for _ in $(seq 1 "$count"); do
    adb_cmd shell input keyevent 67
    sleep 0.03
  done
}

hide_keyboard() {
  adb_cmd shell input keyevent BACK || true
  sleep 0.25
}

start_app() {
  adb_cmd shell am force-stop "$APP_ID" || true
  sleep 1
  adb_cmd shell am start -n "$APP_ID/$ACTIVITY" >/dev/null
  sleep "$STARTUP_SECONDS"
}

login_demo_user() {
  for _ in $(seq 1 12); do
    if has_label "Acoes rapidas" || has_label "Saldo disponivel" || has_label "Ultimas transacoes"; then
      return
    fi
    sleep 0.5
  done

  # Login screen, step 1: fill/select CPF and continue.
  if tap_label "Usar CPF demo"; then
    sleep 0.4
  else
    tap_pct 500 665
    sleep 0.2
    input_text "$DEMO_CPF" || true
  fi
  sleep 0.4
  tap_label_or_pct "Continuar" 500 817
  sleep 1.1

  # Login screen, step 2: enter password and submit.
  tap_pct 500 725
  sleep 0.2
  input_text "$DEMO_PASSWORD"
  sleep 0.2
  hide_keyboard
  tap_label_or_pct "Entrar" 500 808
  sleep "$LOGIN_WAIT_SECONDS"
}

visit_tabs() {
  tap_label_or_pct "Extrato" 500 944
  sleep 1.2
  tap_label_or_pct "Invest" 704 944
  sleep 1.6
  tap_label_or_pct "Início" 102 944
  sleep 0.8
}

pix_recipient_for_index() {
  local index="$1"
  if (( index % 2 == 0 )); then
    echo "Joao Santos"
  else
    echo "Pedro Silva"
  fi
}

pix_amount_for_index() {
  local index="$1"
  local amounts=(10 25 50 100 200)
  echo "${amounts[$(((index - 1) % ${#amounts[@]}))]}"
}

open_pix_form() {
  local index="$1"
  local recipient amount
  recipient="$(pix_recipient_for_index "$index")"
  amount="$(pix_amount_for_index "$index")"

  tap_pct 296 944
  sleep 1.2
  if ! tap_label "$recipient"; then
    if [[ "$recipient" == "Joao Santos" ]]; then
      tap_pct 720 305
    else
      tap_pct 260 305
    fi
  fi
  sleep 0.8
  tap_label "R$ $amount" || true
  sleep 0.4
  swipe_pct 500 820 500 560 280
  sleep 0.5
  tap_label "Continuar" || tap_pct 500 855
  sleep 1
  if ! has_label "Autorizar PIX"; then
    tap_pct 500 885
  fi
  sleep 1
}

authorize_pix() {
  local outcome="$1"
  if [[ "$outcome" == "fail" ]]; then
    # The PIX password is demo-prefilled. Replace it to force a validation/backend error.
    tap_label "Senha" || tap_pct 210 850
    sleep 0.2
    delete_chars 8
    input_text "$BAD_PASSWORD"
    sleep 0.2
  fi
  tap_label "Autorizar PIX" || tap_pct 500 933
  sleep "$PIX_WAIT_SECONDS"
}

close_error_modal_if_any() {
  # Safe to tap even when no modal is present; on the receipt it usually does nothing important.
  tap_pct 500 580
  sleep 0.4
}

open_investment_flow() {
  local outcome="$1"
  local product="CDI"
  if [[ "$outcome" == "invest-btc" ]]; then
    product="BTC"
  fi

  tap_pct 704 944
  sleep 2

  if [[ "$product" == "BTC" ]]; then
    tap_label "Aplicar R$ 50 mil" || {
      swipe_pct 500 800 500 520 250
      sleep 0.4
      tap_label "Aplicar R$ 50 mil" || tap_pct 500 835
    }
  else
    tap_label "Aplicar R$ 1 mi" || tap_pct 500 610
  fi

  sleep 1
  tap_label "Validar e aplicar" || tap_pct 500 930
  sleep 7
}

journey_outcome() {
  local index="$1"
  case "$MODE" in
    demo)
      case $(((index - 1) % 6)) in
        0|1) echo "pix-success" ;;
        2) echo "pix-fail" ;;
        3) echo "invest-cdi" ;;
        4) echo "invest-btc" ;;
        *) echo "browse" ;;
      esac
      ;;
    pix)
      if (( index % 4 == 0 )); then
        echo "pix-fail"
      else
        echo "pix-success"
      fi
      ;;
    invest)
      if (( index % 2 == 0 )); then
        echo "invest-btc"
      else
        echo "invest-cdi"
      fi
      ;;
    success) echo "success" ;;
    fail) echo "fail" ;;
    browse) echo "browse" ;;
    mix)
      if (( index % 3 == 0 )); then
        echo "fail"
      else
        echo "success"
      fi
      ;;
    *)
      echo "$LOG_PREFIX invalid mode: $MODE" >&2
      exit 2
      ;;
  esac
}

run_journey() {
  local index="$1"
  local outcome
  outcome="$(journey_outcome "$index")"
  echo "$LOG_PREFIX session=$index outcome=$outcome start $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  start_app
  login_demo_user
  visit_tabs

  if [[ "$outcome" == "pix-success" || "$outcome" == "success" ]]; then
    open_pix_form "$index"
    authorize_pix "success"
    close_error_modal_if_any
  elif [[ "$outcome" == "pix-fail" || "$outcome" == "fail" ]]; then
    open_pix_form "$index"
    authorize_pix "fail"
    close_error_modal_if_any
  elif [[ "$outcome" == "invest-cdi" || "$outcome" == "invest-btc" ]]; then
    open_investment_flow "$outcome"
  fi

  echo "$LOG_PREFIX session=$index outcome=$outcome waiting ${SESSION_PAUSE_SECONDS}s for RUM/replay flush"
  sleep "$SESSION_PAUSE_SECONDS"
  adb_cmd shell am force-stop "$APP_ID" || true
}

require_device
read_screen_size
echo "$LOG_PREFIX target=${DEVICE:-default} app=$APP_ID screen=${WIDTH}x${HEIGHT} loops=$LOOPS mode=$MODE"

for i in $(seq 1 "$LOOPS"); do
  run_journey "$i" || {
    echo "$LOG_PREFIX session=$i failed, continuing" >&2
    adb_cmd shell am force-stop "$APP_ID" || true
    sleep 2
  }
done

echo "$LOG_PREFIX done $(date -u +%Y-%m-%dT%H:%M:%SZ)"
