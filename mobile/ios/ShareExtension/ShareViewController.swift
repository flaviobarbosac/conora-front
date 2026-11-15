import Social
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: SLComposeServiceViewController {
    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first else {
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { data, _ in
                if let url = data as? URL, let imageData = try? Data(contentsOf: url) {
                    self.persist(imageData, fileName: url.lastPathComponent, mimeType: "image/jpeg")
                } else if let image = data as? UIImage, let imageData = image.jpegData(compressionQuality: 0.8) {
                    self.persist(imageData, fileName: "recibo.jpg", mimeType: "image/jpeg")
                }
                self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            }
            return
        }

        let fileTypes = [UTType.pdf.identifier, UTType.commaSeparatedText.identifier, "com.adobe.pdf", "public.data"]
        for typeId in fileTypes where provider.hasItemConformingToTypeIdentifier(typeId) {
            provider.loadItem(forTypeIdentifier: typeId, options: nil) { data, _ in
                if let url = data as? URL, let fileData = try? Data(contentsOf: url) {
                    let name = url.lastPathComponent
                    let mime = Self.mimeType(for: name)
                    self.persist(fileData, fileName: name, mimeType: mime)
                } else if let fileData = data as? Data {
                    self.persist(fileData, fileName: "extrato.pdf", mimeType: "application/pdf")
                }
                self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            }
            return
        }

        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func persist(_ data: Data, fileName: String, mimeType: String) {
        let defaults = UserDefaults(suiteName: "group.br.com.conora.app")
        defaults?.set(data, forKey: "pendingShareImage")
        defaults?.set(fileName, forKey: "pendingShareFileName")
        defaults?.set(mimeType, forKey: "pendingShareMimeType")
        if let url = URL(string: "conora://compartilhar") {
            _ = openHost(url)
        }
    }

    private static func mimeType(for fileName: String) -> String {
        let lower = fileName.lowercased()
        if lower.hasSuffix(".pdf") { return "application/pdf" }
        if lower.hasSuffix(".csv") { return "text/csv" }
        if lower.hasSuffix(".ofx") || lower.hasSuffix(".qfx") { return "application/x-ofx" }
        return "application/octet-stream"
    }

    @discardableResult
    private func openHost(_ url: URL) -> Bool {
        var responder: UIResponder? = self
        while let current = responder {
            if let application = current as? UIApplication {
                application.open(url)
                return true
            }
            responder = current.next
        }
        return false
    }
}
