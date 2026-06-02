#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="${SCRIPT_DIR}/../dogbank-ios-native"
SIMULATOR_NAME="${DOGBANK_IOS_SIMULATOR:-iPhone 17 Pro}"
RUM_INTERVAL_SECONDS="${DOGBANK_RUM_INTERVAL_SECONDS:-45}"

export DOGBANK_LOAD_RUN_ID="${DOGBANK_LOAD_RUN_ID:-local-demo}"
export DOGBANK_LOAD_BURST_COUNT="${DOGBANK_LOAD_BURST_COUNT:-80}"
export DOGBANK_LOAD_BURST_INTERVAL="${DOGBANK_LOAD_BURST_INTERVAL:-0.25}"
export DOGBANK_LOAD_MIN_INTERVAL="${DOGBANK_LOAD_MIN_INTERVAL:-1}"
export DOGBANK_LOAD_MAX_INTERVAL="${DOGBANK_LOAD_MAX_INTERVAL:-3}"

cd "${SCRIPT_DIR}"

echo "Starting DogBank local demo stack with Podman Compose"
podman-compose \
  -f docker-compose.full.yml \
  -f docker-compose.local-demo.yml \
  --profile local-demo \
  up -d --build

echo "Refreshing nginx upstreams"
podman restart dogbank-nginx >/dev/null || true

echo "Waiting for DogBank gateway on http://127.0.0.1:8080"
for attempt in $(seq 1 60); do
  status="$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST http://127.0.0.1:8080/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"cpf":"12345678915","senha":"123456"}' || true)"

  if [[ "${status}" == "200" ]]; then
    echo "DogBank gateway is ready"
    break
  fi

  if [[ "${attempt}" == "60" ]]; then
    echo "DogBank gateway did not become ready. Last HTTP status: ${status}" >&2
    exit 1
  fi

  sleep 2
done

if [[ "${DOGBANK_START_IOS_RUM_LOOP:-1}" == "0" ]]; then
  echo "Skipping iOS RUM loop because DOGBANK_START_IOS_RUM_LOOP=0"
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "The iOS RUM loop must run on macOS with Xcode/Simulator; Podman containers cannot run xcrun simctl." >&2
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

if [[ "${DOGBANK_BUILD_IOS_APP:-1}" != "0" ]]; then
  echo "Building native iOS app for ${SIMULATOR_NAME}"
  xcodebuild \
    -project "${IOS_DIR}/DogBankMobile.xcodeproj" \
    -scheme DogBankMobile \
    -destination "platform=iOS Simulator,name=${SIMULATOR_NAME}" \
    build

  app_path="$(find "${HOME}/Library/Developer/Xcode/DerivedData" \
    -path '*Build/Products/Debug-iphonesimulator/DogBank Mobile.app' \
    -type d \
    -maxdepth 6 \
    | tail -1)"

  if [[ -z "${app_path}" ]]; then
    echo "Could not find built DogBank Mobile.app in DerivedData." >&2
    exit 1
  fi

  echo "Installing native iOS app"
  xcrun simctl install booted "${app_path}"
fi

echo "Starting native iOS RUM loop on the macOS host"
cd "${IOS_DIR}"
DOGBANK_RUM_INTERVAL_SECONDS="${RUM_INTERVAL_SECONDS}" ./run-rum-mobile-loop.sh
