# DogBank Local Mobile Demo

This setup keeps the DogBank backend, mobile web variant, Datadog Agent, and PIX load generator inside Podman containers.

The native iOS RUM loop cannot run inside Podman because it uses `xcrun simctl` and the Apple iOS Simulator, which are macOS/Xcode host tools.

Start everything from the DogBank compose directory:

```bash
cd instrumented/docker/dogbank
./run-local-mobile-demo.sh
```

What runs in containers:

- Backend services
- Mobile frontend variant on `http://127.0.0.1:8080`
- Datadog Agent
- PIX load generator with success and expected-error scenarios

What runs on the macOS host:

- iOS Simulator
- Native Swift app launch loop for RUM, Product Analytics, Session Replay, and backend correlation

Useful knobs:

```bash
DOGBANK_RUM_INTERVAL_SECONDS=45
DOGBANK_RUM_JOURNEY_SECONDS=28
DOGBANK_RUM_ITERATIONS=0
DOGBANK_RUM_USERS=12345678915:123456,98765432101:123456,45678912302:123456
DOGBANK_LOAD_BURST_COUNT=80
DOGBANK_LOAD_MIN_INTERVAL=1
DOGBANK_LOAD_MAX_INTERVAL=3
DOGBANK_LOAD_FORCE_COVERAGE=1
DOGBANK_START_IOS_RUM_LOOP=0
DOGBANK_BUILD_IOS_APP=0
```

Compose-only start without the iOS host loop:

```bash
cd instrumented/docker/dogbank
DOGBANK_START_IOS_RUM_LOOP=0 ./run-local-mobile-demo.sh
```

Manual Compose command:

```bash
podman-compose -f docker-compose.full.yml -f docker-compose.local-demo.yml --profile local-demo up -d --build
```
