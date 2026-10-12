import Foundation
import Capacitor

@objc(ConoraSharePlugin)
public class ConoraSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ConoraSharePlugin"
    public let jsName = "ConoraShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "consumePendingShare", returnType: CAPPluginReturnPromise)
    ]

    @objc func consumePendingShare(_ call: CAPPluginCall) {
        let suite = UserDefaults(suiteName: "group.br.com.conora.app")
        guard let data = suite?.data(forKey: "pendingShareImage"), !data.isEmpty else {
            call.resolve(["found": false])
            return
        }
        suite?.removeObject(forKey: "pendingShareImage")
        let base64 = data.base64EncodedString()
        call.resolve([
            "found": true,
            "fileName": "recibo.jpg",
            "mimeType": "image/jpeg",
            "dataUrl": "data:image/jpeg;base64,\(base64)"
        ])
    }
}
