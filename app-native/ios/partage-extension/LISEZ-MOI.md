# Extension de partage iPhone (« Partager » > HabitaScan)

Sur iPhone, une app ne peut apparaître dans le menu « Partager » de Facebook, Kijiji, Safari ou Photos
qu'avec une **extension de partage**, une petite cible Xcode à part. Elle se crée une fois, sur le Mac.
Le code est prêt dans ce dossier ; le reste (module `Partage` de l'app, adresse `habitascan://`) est déjà dans `ios/App`.

## Étapes dans Xcode (10 minutes, une seule fois)

1. `cd app-native && npm run ios` pour ouvrir le projet.
2. **File > New > Target… > Share Extension**. Nom : `PartageExtension`. Langage : Swift. « Activate scheme » : Cancel.
3. Dans le dossier `PartageExtension` créé par Xcode :
   - remplace le contenu de `ShareViewController.swift` par celui de `partage-extension/ShareViewController.swift` ;
   - supprime `MainInterface.storyboard` (Move to Trash) ;
   - dans `Info.plist`, remplace le dictionnaire `NSExtension` par celui de `partage-extension/Info.plist`
     (il retire `NSExtensionMainStoryboard` et ajoute `NSExtensionPrincipalClass`).
4. **Groupe d'apps** (pour que l'extension passe l'annonce à l'app) :
   cible **App** > Signing & Capabilities > **+ Capability > App Groups** > `+` > `group.ca.habitascan.app`.
   Puis la même chose sur la cible **PartageExtension**, avec le même groupe coché.
5. Cible **PartageExtension** > General > Minimum Deployments : iOS 15 (comme l'app).
6. Product > Run sur un iPhone, puis dans Facebook : Partager > Plus > HabitaScan.

Si iOS n'ouvre pas l'app automatiquement après le partage, l'annonce est quand même gardée :
elle s'affiche dès que la personne ouvre HabitaScan.
