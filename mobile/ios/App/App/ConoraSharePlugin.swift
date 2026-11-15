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
        let fileName = suite?.string(forKey: "pendingShareFileName") ?? "recibo.jpg"
        let mimeType = suite?.string(forKey: "pendingShareMimeType") ?? "image/jpeg"
        suite?.removeObject(forKey: "pendingShareImage")
        suite?.removeObject(forKey: "pendingShareFileName")
        suite?.removeObject(forKey: "pendingShareMimeType")
        let base64 = data.base64EncodedString()
        call.resolve([
            "found": true,
            "fileName": fileName,
            "mimeType": mimeType,
            "dataUrl": "data:\(mimeType);base64,\(base64)"
        ])
    }
}
