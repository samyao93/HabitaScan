import UIKit
import Capacitor

/*
 Module « Partage », appelé par l'app web (src/natif.js, src/partage.js) :
 - reçoit ce que l'extension de partage (PartageExtension) a déposé dans le groupe d'apps :
   lire() au démarrage, événement « partage » ensuite ;
 - partagerImage() ouvre la feuille de partage d'iOS avec la carte du verdict.
 Le groupe d'apps doit être activé sur l'app ET sur l'extension (voir app-native/STORES.md, section « Partager vers l'app »).
 */
@objc(PartagePlugin)
public class PartagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PartagePlugin"
    public let jsName = "Partage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lire", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "partagerImage", returnType: CAPPluginReturnPromise)
    ]

    static let groupe = "group.ca.habitascan.app"
    static let fichier = "partage.json"
    static weak var instance: PartagePlugin?
    static var enAttente: [String: Any]?

    override public func load() {
        PartagePlugin.instance = self
        PartagePlugin.recevoir()
    }

    /// Lit (puis efface) le partage déposé par l'extension, s'il y en a un.
    static func recevoir() {
        guard let dossier = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupe) else { return }
        let url = dossier.appendingPathComponent(fichier)
        guard let data = try? Data(contentsOf: url) else { return }
        try? FileManager.default.removeItem(at: url)
        guard let d = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], !d.isEmpty else { return }
        if let p = instance, p.hasListeners("partage") {
            p.notifyListeners("partage", data: d)
        } else {
            enAttente = d
        }
    }

    @objc func lire(_ call: CAPPluginCall) {
        PartagePlugin.recevoir()
        let d = PartagePlugin.enAttente ?? [:]
        PartagePlugin.enAttente = nil
        call.resolve(d)
    }

    @objc func partagerImage(_ call: CAPPluginCall) {
        guard let b64 = call.getString("image"), let data = Data(base64Encoded: b64), let image = UIImage(data: data) else {
            call.reject("image manquante")
            return
        }
        var elements: [Any] = [image]
        if let texte = call.getString("texte") { elements.append(texte) }
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else {
                call.reject("vue introuvable")
                return
            }
            let feuille = UIActivityViewController(activityItems: elements, applicationActivities: nil)
            if let pop = feuille.popoverPresentationController { // iPad
                pop.sourceView = vc.view
                pop.sourceRect = CGRect(x: vc.view.bounds.midX, y: vc.view.bounds.midY, width: 0, height: 0)
                pop.permittedArrowDirections = []
            }
            vc.present(feuille, animated: true)
            call.resolve()
        }
    }
}

/// Vue principale de l'app : celle de Capacitor, avec le module « Partage » en plus.
class HabitaScanViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PartagePlugin())
    }
}
