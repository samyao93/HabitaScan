import UIKit
import UniformTypeIdentifiers

/*
 Extension de partage « HabitaScan » : Facebook, Kijiji, Safari ou Photos > Partager > HabitaScan.
 Elle dépose le texte, le lien ou la capture dans le groupe d'apps, puis ouvre l'app (habitascan://partage),
 qui lance la vérification. Rien n'est envoyé sur Internet ici.
 */
class ShareViewController: UIViewController {
    let groupe = "group.ca.habitascan.app"
    let coteMax: CGFloat = 1600

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        recueillir { d in
            self.deposer(d)
            self.ouvrirApp()
            self.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    /// Lit le texte, les liens et la première image partagés.
    func recueillir(_ fini: @escaping ([String: Any]) -> Void) {
        var textes: [String] = []
        var image: String?
        let g = DispatchGroup()
        let verrou = NSLock()
        let items = (extensionContext?.inputItems as? [NSExtensionItem]) ?? []
        for item in items {
            if let t = item.attributedContentText?.string, !t.isEmpty { textes.append(t) }
            for p in item.attachments ?? [] {
                if p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    g.enter()
                    p.loadItem(forTypeIdentifier: UTType.url.identifier) { v, _ in
                        if let u = v as? URL { verrou.lock(); textes.append(u.absoluteString); verrou.unlock() }
                        g.leave()
                    }
                } else if p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    g.enter()
                    p.loadItem(forTypeIdentifier: UTType.plainText.identifier) { v, _ in
                        if let t = v as? String { verrou.lock(); textes.append(t); verrou.unlock() }
                        g.leave()
                    }
                } else if p.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    g.enter()
                    p.loadItem(forTypeIdentifier: UTType.image.identifier) { v, _ in
                        var img: UIImage?
                        if let u = v as? URL, let d = try? Data(contentsOf: u) { img = UIImage(data: d) }
                        else if let d = v as? Data { img = UIImage(data: d) }
                        else if let i = v as? UIImage { img = i }
                        if let i = img, let jpeg = self.reduire(i).jpegData(compressionQuality: 0.85) {
                            verrou.lock()
                            if image == nil { image = jpeg.base64EncodedString() }
                            verrou.unlock()
                        }
                        g.leave()
                    }
                }
            }
        }
        g.notify(queue: .main) {
            var vus = Set<String>()
            let texte = textes.filter { vus.insert($0).inserted }.joined(separator: "\n")
            var d: [String: Any] = [:]
            if !texte.isEmpty { d["texte"] = String(texte.prefix(5000)) }
            if let i = image { d["image"] = i }
            fini(d)
        }
    }

    func reduire(_ i: UIImage) -> UIImage {
        let k = min(1, coteMax / max(i.size.width, i.size.height))
        if k >= 1 { return i }
        let taille = CGSize(width: i.size.width * k, height: i.size.height * k)
        return UIGraphicsImageRenderer(size: taille).image { _ in i.draw(in: CGRect(origin: .zero, size: taille)) }
    }

    func deposer(_ d: [String: Any]) {
        guard !d.isEmpty,
              let dossier = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupe),
              let data = try? JSONSerialization.data(withJSONObject: d) else { return }
        try? data.write(to: dossier.appendingPathComponent("partage.json"), options: .atomic)
    }

    /// Ouvre l'app principale. Si iOS refuse, l'app lira le partage à sa prochaine ouverture.
    func ouvrirApp() {
        guard let url = URL(string: "habitascan://partage") else { return }
        var r: UIResponder? = self
        while let suivant = r {
            if let app = suivant as? UIApplication {
                app.open(url, options: [:], completionHandler: nil)
                return
            }
            r = suivant.next
        }
    }
}
