import 'package:datadog_flutter_plugin/datadog_flutter_plugin.dart';
import 'package:datadog_session_replay/datadog_session_replay.dart';
import 'package:datadog_tracking_http_client/datadog_tracking_http_client.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/login_screen.dart';
import 'theme.dart';

const kBaseUrl = 'https://lab.dogbank.dog';

void main() async {
  final config =
      DatadogConfiguration(
          clientToken: 'pubc08975cc79c3fc81235129319adcaab1',
          env: 'prod-mobile',
          service: 'dogbank-flutter-android',
          version: '2.1.0',
          site: DatadogSite.us1,
          nativeCrashReportEnabled: true,
          firstPartyHosts: ['lab.dogbank.dog'],
          loggingConfiguration: DatadogLoggingConfiguration(),
          rumConfiguration: DatadogRumConfiguration(
            applicationId: '947748ab-22e8-4ca9-9dcf-f8b450f6da72',
            sessionSamplingRate: 100,
            traceSampleRate: 100,
            detectLongTasks: true,
            reportFlutterPerformance: true,
          ),
        )
        ..enableHttpTracking()
        ..enableSessionReplay(
          DatadogSessionReplayConfiguration(
            replaySampleRate: 100,
            textAndInputPrivacyLevel:
                TextAndInputPrivacyLevel.maskSensitiveInputs,
            imagePrivacyLevel: ImagePrivacyLevel.maskNone,
            touchPrivacyLevel: TouchPrivacyLevel.show,
          ),
        );

  await DatadogSdk.runApp(config, TrackingConsent.granted, () async {
    await initializeDateFormatting('pt_BR');
    DatadogSdk.instance.sdkVerbosity = CoreLoggerLevel.debug;
    DatadogSdk.instance.rum?.addAttribute('app.platform', 'flutter-android');
    DatadogSdk.instance.rum?.addAttribute('app.version', '2.1.0');
    runApp(const DogBankApp());
  });
}

class DogBankApp extends StatefulWidget {
  const DogBankApp({super.key});

  @override
  State<DogBankApp> createState() => _DogBankAppState();
}

class _DogBankAppState extends State<DogBankApp> {
  final _sessionReplayCaptureKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    return SessionReplayCapture(
      key: _sessionReplayCaptureKey,
      rum: DatadogSdk.instance.rum!,
      sessionReplay: DatadogSessionReplay.instance!,
      child: MaterialApp(
        title: 'DogBank',
        debugShowCheckedModeBanner: false,
        navigatorObservers: [
          DatadogNavigationObserver(datadogSdk: DatadogSdk.instance),
        ],
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: DT.purple,
            primary: DT.purple,
          ),
          useMaterial3: true,
          fontFamily: 'SF Pro Display',
          navigationBarTheme: NavigationBarThemeData(
            backgroundColor: Colors.white,
            indicatorColor: DT.purple.withOpacity(0.12),
            labelTextStyle: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: DT.purple,
                );
              }
              return const TextStyle(fontSize: 12, color: DT.muted);
            }),
            iconTheme: WidgetStateProperty.resolveWith((states) {
              if (states.contains(WidgetState.selected)) {
                return const IconThemeData(color: DT.purple, size: 24);
              }
              return const IconThemeData(color: DT.muted, size: 24);
            }),
          ),
        ),
        home: const LoginScreen(),
      ),
    );
  }
}
