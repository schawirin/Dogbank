import UIKit
import DatadogCore
import DatadogRUM
import DatadogSessionReplay
import DatadogLogs

var dogbankLogger: LoggerProtocol!

private let dogbankCPFRegex = try? NSRegularExpression(
    pattern: #"(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{3})[.\s-]?(\d{2})"#
)

private func dogbankMaskCPFInText(_ text: String) -> String {
    guard let regex = dogbankCPFRegex else {
        return text
    }

    let range = NSRange(text.startIndex..., in: text)
    return regex.stringByReplacingMatches(
        in: text,
        range: range,
        withTemplate: "***.$2.$3-$4"
    )
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    private let datadogApplicationID = "b97ad5a9-fb41-4c63-953c-df416edcf998"
    private let datadogClientToken = "pub015e2826963e706aca9f77d22b0a08b3"
    private let datadogEnvironment = "prod-mobile"

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        Datadog.verbosityLevel = .debug
        Datadog.initialize(
            with: Datadog.Configuration(
                clientToken: datadogClientToken,
                env: datadogEnvironment,
                site: .us1,
                service: "dogbank-ios-native"
            ),
            trackingConsent: .granted
        )

        let urlSessionTracking = RUM.Configuration.URLSessionTracking(
            firstPartyHostsTracing: .traceWithHeaders(
                hostsWithHeaders: [
                    "127.0.0.1": [.datadog, .tracecontext],
                    "localhost": [.datadog, .tracecontext],
                    "lab.dogbank.dog": [.datadog, .tracecontext]
                ],
                sampleRate: 100
            )
        )

        RUM.enable(
            with: RUM.Configuration(
                applicationID: datadogApplicationID,
                sessionSampleRate: 100,
                uiKitViewsPredicate: DefaultUIKitRUMViewsPredicate(),
                uiKitActionsPredicate: DefaultUIKitRUMActionsPredicate(),
                urlSessionTracking: urlSessionTracking,
                trackBackgroundEvents: true,
                viewEventMapper: { event in
                    var event = event
                    event.view.url = dogbankMaskCPFInText(event.view.url)
                    event.view.name = event.view.name.map(dogbankMaskCPFInText)
                    if var context = event.context {
                        context.contextInfo = context.contextInfo.mapValues { value in
                            if let string = value as? String {
                                return dogbankMaskCPFInText(string)
                            }
                            return value
                        }
                        event.context = context
                    }
                    return event
                },
                resourceEventMapper: { event in
                    var event = event
                    event.resource.url = dogbankMaskCPFInText(event.resource.url)
                    if var context = event.context {
                        context.contextInfo = context.contextInfo.mapValues { value in
                            if let string = value as? String {
                                return dogbankMaskCPFInText(string)
                            }
                            return value
                        }
                        event.context = context
                    }
                    return event
                },
                actionEventMapper: { event in
                    var event = event
                    if var target = event.action.target {
                        target.name = dogbankMaskCPFInText(target.name)
                        event.action.target = target
                    }
                    if var context = event.context {
                        context.contextInfo = context.contextInfo.mapValues { value in
                            if let string = value as? String {
                                return dogbankMaskCPFInText(string)
                            }
                            return value
                        }
                        event.context = context
                    }
                    return event
                },
                errorEventMapper: { event in
                    var event = event
                    event.error.message = dogbankMaskCPFInText(event.error.message)
                    event.error.stack = event.error.stack.map(dogbankMaskCPFInText)
                    if var context = event.context {
                        context.contextInfo = context.contextInfo.mapValues { value in
                            if let string = value as? String {
                                return dogbankMaskCPFInText(string)
                            }
                            return value
                        }
                        event.context = context
                    }
                    return event
                }
            )
        )

        URLSessionInstrumentation.enable(
            with: URLSessionInstrumentation.Configuration(
                delegateClass: DogBankURLSessionDelegate.self,
                firstPartyHostsTracing: .traceWithHeaders(
                    hostsWithHeaders: [
                        "127.0.0.1": [.datadog, .tracecontext],
                        "localhost": [.datadog, .tracecontext]
                    ]
                )
            )
        )

        SessionReplay.enable(
            with: SessionReplay.Configuration(
                replaySampleRate: 100,
                textAndInputPrivacyLevel: .maskSensitiveInputs,
                imagePrivacyLevel: .maskNone,
                touchPrivacyLevel: .show
            )
        )

        Logs.enable(with: Logs.Configuration(
            customEndpoint: nil
        ))

        dogbankLogger = Logger.create(
            with: Logger.Configuration(
                service: "dogbank-ios-native",
                networkInfoEnabled: true,
                bundleWithRumEnabled: true,
                bundleWithTraceEnabled: true
            )
        )

        return true
    }
}
