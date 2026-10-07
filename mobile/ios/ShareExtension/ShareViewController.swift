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
                    self.persist(imageData)
                } else if let image = data as? UIImage, let imageData = image.jpegData(compressionQuality: 0.8) {
                    self.persist(imageData)
                }
                self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            }
            return
        }

        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    private func persist(_ data: Data) {
        let defaults = UserDefaults(suiteName: "group.br.com.conora.app")
        defaults?.set(data, forKey: "pendingShareImage")
        if let url = URL(string: "conora://compartilhar") {
            _ = openHost(url)
        }
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
