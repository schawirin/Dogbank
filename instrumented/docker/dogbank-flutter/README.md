# DogBank Flutter Android

Flutter implementation used only for the Android demo.

The iPhone demo remains the native Swift/UIKit app in:

```text
../dogbank-ios-native/DogBankMobile.xcodeproj
```

Run this Flutter app only on Android:

```bash
flutter run -d emulator-5554
```

Generate Android RUM / Session Replay traffic:

```bash
ADB=/opt/homebrew/share/android-commandlinetools/platform-tools/adb \
ANDROID_SERIAL=emulator-5554 \
./scripts/run_android_rum_robot.sh --loops 1 --mode browse
```

The Flutter iOS target is intentionally not used so the iPhone flow stays on
the Swift app.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
