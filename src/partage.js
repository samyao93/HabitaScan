/* Annonce reçue par « Partager » : adresse ?url= / ?text= (app web installée sur Android)
   ou app native iPhone/Android (texte, lien ou capture d'écran partagés depuis Facebook, Kijiji…). */
import { normaliser } from "./annonce/regles.js";
import { etat } from "./etat.js";
import { fichierDepuisBase64, pluginPartage } from "./natif.js";
import { go } from "./navigation/routeur.js";

let pret = false; // l'app a fini de démarrer : un partage reçu ouvre tout de suite l'écran « Vérifier »

export function lirePartageDansAdresse() {
  /* Lien reçu par « Partager » depuis une autre app (Android) ou par l'adresse ?url= */
  try {
    const q = new URLSearchParams(location.search),
      tout = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
    if (tout) {
      const l = normaliser(tout);
      if (l) etat.fiche.lien = l;
      etat.fiche.annonce = tout;
      etat.fiche.partage = true;
      const reste = new URLSearchParams(location.search);
      ["title", "text", "url"].forEach((k) => reste.delete(k));
      history.replaceState(null, "", location.pathname + (reste.toString() ? "?" + reste : ""));
    }
  } catch (e) {}
}

/** Remplit la vérification avec ce qui a été partagé : { texte, image (base64 JPEG) }. */
export function recevoirPartage(d) {
  if (!d) return false;
  if (typeof d === "string") d = { texte: d };
  const texte = String(d.texte || "").slice(0, 5000);
  if (!texte && !d.image) return false;
  const f = { partage: true };
  if (texte) {
    f.annonce = texte;
    const l = normaliser(texte);
    if (l) f.lien = l;
  }
  if (d.image) {
    try {
      const fichier = fichierDepuisBase64(d.image);
      Object.assign(f, {
        captures: [fichier],
        capture: fichier,
        vignettes: [URL.createObjectURL(fichier)],
        ocr: true,
      });
      if (!texte) f.partage = false; // rien à lire dans le texte : la lecture de la capture s'en charge
    } catch (e) {}
  }
  for (const k in etat.fiche) delete etat.fiche[k];
  Object.assign(etat.fiche, f);
  if (pret) go("verifier");
  return true;
}

export function ecouterPartageNatif() {
  /* Ancien point d'entrée, gardé pour compatibilité. */
  window.recevoirPartage = recevoirPartage;
  const P = pluginPartage();
  if (P && P.addListener) P.addListener("partage", recevoirPartage);
}

/** Au démarrage : récupère un partage qui a ouvert l'app. Renvoie true s'il y en avait un. */
export async function lirePartageNatif() {
  const P = pluginPartage();
  if (!P || !P.lire) return false;
  try {
    return recevoirPartage(await P.lire());
  } catch (e) {
    return false;
  }
}

/** L'app a fini de démarrer. */
export function partagePret() {
  pret = true;
}
