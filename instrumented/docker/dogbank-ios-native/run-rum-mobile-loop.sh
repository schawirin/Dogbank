#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ID="${DOGBANK_RUM_BUNDLE_ID:-com.dogbank.mobile.demo}"
INTERVAL_SECONDS="${DOGBANK_RUM_INTERVAL_SECONDS:-45}"
JOURNEY_SECONDS="${DOGBANK_RUM_JOURNEY_SECONDS:-28}"
ITERATIONS="${DOGBANK_RUM_ITERATIONS:-0}"
SIMULATOR_NAME="${DOGBANK_IOS_SIMULATOR:-iPhone 17 Pro}"
# SPI failure ratio: 1 in N sessions is a failure (default: 1 in 3)
SPI_FAILURE_EVERY="${DOGBANK_SPI_FAILURE_EVERY:-3}"
DEFAULT_USERS="12345678915:123456,98765432101:123456,45678912302:123456,78912345603:123456,32165498704:123456,65498732105:123456,15975385206:123456,66666666666:123456"
IFS=',' read -r -a DEMO_USERS <<< "${DOGBANK_RUM_USERS:-${DEFAULT_USERS}}"
COUNT=0

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "DogBank native RUM loop requires macOS with Xcode/Simulator. It cannot run inside a Podman Linux container." >&2
  exit 78
fi

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun not found. Install/select Xcode before starting the iOS RUM loop." >&2
  exit 78
fi

if ! xcrun simctl list devices booted | grep -q '(Booted)'; then
  echo "Booting simulator: ${SIMULATOR_NAME}"
  xcrun simctl boot "${SIMULATOR_NAME}" || true
  open -a Simulator || true
  xcrun simctl bootstatus "${SIMULATOR_NAME}" -b || true
fi

echo "Starting DogBank native RUM loop"
echo "bundle_id=${BUNDLE_ID} interval_seconds=${INTERVAL_SECONDS} journey_seconds=${JOURNEY_SECONDS} iterations=${ITERATIONS} users=${#DEMO_USERS[@]} spi_failure_every=${SPI_FAILURE_EVERY}"

while true; do
  COUNT=$((COUNT + 1))
  USER_INDEX=$(( (COUNT - 1) % ${#DEMO_USERS[@]} ))
  USER_ENTRY="${DEMO_USERS[${USER_INDEX}]}"
  USER_CPF="${USER_ENTRY%%:*}"
  USER_PASSWORD="${USER_ENTRY#*:}"
  if [[ "${USER_PASSWORD}" == "${USER_CPF}" ]]; then
    USER_PASSWORD="123456"
  fi

  # Alterna entre cenário de sucesso e falha SPI (1 em cada N sessões é falha)
  if (( COUNT % SPI_FAILURE_EVERY == 0 )); then
    SCENARIO="spi_failure"
    EXTRA_ARGS="--dogbank-spi-failure"
  else
    SCENARIO="success"
    EXTRA_ARGS=""
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] journey #${COUNT} user=${USER_CPF} scenario=${SCENARIO}"

  # Garante que o app anterior foi encerrado (fecha a sessão RUM do processo anterior)
  xcrun simctl terminate booted "${BUNDLE_ID}" >/dev/null 2>&1 || true

  # Pequena pausa para garantir que o terminate foi processado antes do novo launch
  sleep 2

  # Novo launch = nova sessão RUM (processo novo, session ID novo)
  xcrun simctl launch booted "${BUNDLE_ID}" \
    --dogbank-auto-login \
    --dogbank-demo-journey \
    ${EXTRA_ARGS} \
    "--dogbank-cpf=${USER_CPF}" \
    "--dogbank-password=${USER_PASSWORD}" || true

  # Aguarda a jornada completar (inclui stopSession() + flush do SDK)
  sleep "${JOURNEY_SECONDS}"

  # Encerra o processo (stopSession já foi chamado internamente ~23s antes)
  xcrun simctl terminate booted "${BUNDLE_ID}" >/dev/null 2>&1 || true

  if [[ "${ITERATIONS}" != "0" && "${COUNT}" -ge "${ITERATIONS}" ]]; then
    echo "Completed ${COUNT} DogBank native RUM journeys"
    exit 0
  fi

  sleep "${INTERVAL_SECONDS}"
done
