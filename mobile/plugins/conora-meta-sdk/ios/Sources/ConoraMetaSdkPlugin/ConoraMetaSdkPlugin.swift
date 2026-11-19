import Foundation
import UIKit
import Capacitor
import FacebookCore

/// Starts the Meta SDK when the Capacitor bridge loads (during app launch) and
/// exposes `logEvent` so the web layer can log funnel App Events.
///
/// With auto-logging enabled the SDK records install, app activation and
/// StoreKit purchase/subscription events, which Meta Ads uses to measure iOS 14+
/// app campaigns through Aggregated Event Measurement. No IDFA is collected and
/// no App Tracking Transparency prompt is shown.
@objc(ConoraMetaSdkPlugin)
public class ConoraMetaSdkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ConoraMetaSdkPlugin"
    public let jsName = "ConoraMetaSdk"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise)
    ]

    /// Set on the main queue once `initializeSDK` ran; read on the main queue only.
    private static var sdkStarted = false

    override public func load() {
        // The SDK raises at startup without FacebookAppID and FacebookClientToken.
        // Local builds without the token run without Meta measurement.
        guard Self.hasInfoValue("FacebookAppID"), Self.hasInfoValue("FacebookClientToken") else {
            CAPLog.print("[ConoraMetaSdk] FacebookAppID/FacebookClientToken missing in Info.plist; Meta SDK disabled.")
            return
        }

        DispatchQueue.main.async {
            Settings.shared.isAutoLogAppEventsEnabled = true
            Settings.shared.isAdvertiserIDCollectionEnabled = false
            ApplicationDelegate.shared.initializeSDK()
            Self.sdkStarted = true
            // The SDK logs activation on didBecomeActive; if that already fired
            // before initialization, log this first activation explicitly.
            if UIApplication.shared.applicationState == .active {
                AppEvents.shared.activateApp()
            }
        }
    }

    /// Logs one App Event. Params accept strings and numbers only; never send PII.
    /// Resolves `{ logged: false }` when the SDK is not running (no client token).
    @objc func logEvent(_ call: CAPPluginCall) {
        let name = (call.getString("name") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            call.reject("name is required")
            return
        }

        var parameters: [AppEvents.ParameterName: Any] = [:]
        for (key, value) in call.getObject("params") ?? [:] {
            if let text = value as? String {
                parameters[AppEvents.ParameterName(rawValue: key)] = text
            } else if let number = value as? NSNumber {
                parameters[AppEvents.ParameterName(rawValue: key)] = number
            }
        }
        let valueToSum = call.getDouble("valueToSum")

        DispatchQueue.main.async {
            guard Self.sdkStarted else {
                call.resolve(["logged": false])
                return
            }
            let eventName = AppEvents.Name(rawValue: name)
            if let valueToSum {
                AppEvents.shared.logEvent(eventName, valueToSum: valueToSum, parameters: parameters)
            } else {
                AppEvents.shared.logEvent(eventName, parameters: parameters)
            }
            call.resolve(["logged": true])
        }
    }

    private static func hasInfoValue(_ key: String) -> Bool {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return false }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && !trimmed.hasPrefix("$(")
    }
}
