# DogBank Mobile iOS Native

Swift/UIKit iOS app for the DogBank demo.

This project does not embed the React/PWA UI and does not use `WKWebView`.
It calls the DogBank backend directly through `URLSession`:

```text
http://127.0.0.1:8080/api/...
```

Run the Podman stack first:

```bash
cd ../dogbank
podman-compose -f docker-compose.full.yml -f docker-compose.mobile.yml up -d --build
```

Then open:

```bash
open DogBankMobile.xcodeproj
```

Select an iPhone simulator and press Run in Xcode.

To generate RUM/Product Analytics demo traffic from the native app, use:

```bash
xcrun simctl launch booted com.dogbank.mobile.demo --dogbank-auto-login --dogbank-demo-journey
```

That path performs a native login, opens the PIX tab, sends one successful PIX, validates one invalid PIX key as an expected error, then returns to the dashboard.

You can choose the demo user for that launch:

```bash
xcrun simctl launch booted com.dogbank.mobile.demo \
  --dogbank-auto-login \
  --dogbank-demo-journey \
  --dogbank-cpf=98765432101 \
  --dogbank-password=123456
```

To keep generating native RUM sessions during the demo:

```bash
DOGBANK_RUM_INTERVAL_SECONDS=45 ./run-rum-mobile-loop.sh
```

The loop rotates through the README demo users and explicitly ends each RUM session before launching the next user. Override the users with:

```bash
DOGBANK_RUM_USERS="12345678915:123456,98765432101:123456" ./run-rum-mobile-loop.sh
```

Demo login:

```text
CPF: 12345678915
Senha: 123456
```
