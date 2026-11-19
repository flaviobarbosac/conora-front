import Foundation
import UIKit
import Capacitor
import FacebookCore

/// Starts the Meta SDK when the Capacitor bridge loads (during app launch).
///
/// With auto-logging enabled the SDK records install and app activation events
/// on every foreground, which Meta Ads uses to measure iOS 14+ app install
/// campaigns through Aggregated Event Measurement. No IDFA is collected and no
/// App Tracking Transparency prompt is shown.
@objc(ConoraMetaSdkPlugin)
public class ConoraMetaSdkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ConoraMetaSdkPlugin"
    public let jsName = "ConoraMetaSdk"
    public let pluginMethods: [CAPPluginMethod] = []

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
            // The SDK logs activation on didBecomeActive; if that already fired
            // before initialization, log this first activation explicitly.
            if UIApplication.shared.applicationState == .active {
                AppEvents.shared.activateApp()
            }
        }
    }

    private static func hasInfoValue(_ key: String) -> Bool {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return false }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && !trimmed.hasPrefix("$(")
    }
}
