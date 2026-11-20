/* Annonce reçue par « Partager » (adresse ?url= ou app native). */
import { normaliser } from "./annonce/regles.js";
import { etat } from "./etat.js";
import { go } from "./navigation/routeur.js";

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
      history.replaceState(null, "", location.pathname);
    }
  } catch (e) {}
}

export function ecouterPartageNatif() {
  /* Partage reçu dans l'app native (iPhone/Android), voir app-native/partage-natif.js. */
  window.recevoirPartage = (t) => {
    if (!t) return;
    etat.fiche = { annonce: String(t).slice(0, 5000), partage: true };
    const l = normaliser(t);
    if (l) etat.fiche.lien = l;
    go("verifier");
  };
}
