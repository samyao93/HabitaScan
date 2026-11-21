/* Pont vers l'app native (Capacitor) : le module « Partage » écrit dans app-native
   (Android : PartagePlugin.java, iPhone : PartagePlugin.swift). Absent dans le navigateur. */

/** Le module natif de partage, ou null dans un navigateur ordinaire.
    Appelé par le pont de Capacitor (nativePromise, addListener) : l'app web n'embarque pas @capacitor/core. */
export function pluginPartage() {
  try {
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform() || !C.nativePromise) return null;
    if (C.PluginHeaders && !C.PluginHeaders.some((h) => h.name === "Partage")) return null;
    return {
      lire: () => C.nativePromise("Partage", "lire", {}),
      partagerImage: (o) => C.nativePromise("Partage", "partagerImage", o),
      addListener: (evenement, rappel) => C.addListener("Partage", evenement, rappel),
    };
  } catch (e) {
    return null;
  }
}

/** Ouvre la feuille de partage du téléphone avec une image (data URL PNG). Renvoie false hors de l'app native. */
export async function partagerImageNative(dataUrl, texte) {
  const P = pluginPartage();
  if (!P || !P.partagerImage) return false;
  try {
    await P.partagerImage({ image: String(dataUrl).split(",")[1], texte });
    return true;
  } catch (e) {
    return false;
  }
}

/** Convertit une image reçue en base64 (sans préfixe) en fichier, comme une capture choisie dans la galerie. */
export function fichierDepuisBase64(b64, type = "image/jpeg", nom = "partage.jpg") {
  const bin = atob(b64);
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return new File([octets], nom, { type });
}
