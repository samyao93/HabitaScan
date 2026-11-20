/* Liaisons des écrans de la pièce d'identité. */
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { envoyerPiece } from "./identite.js";
import { go } from "../navigation/routeur.js";
import { $, busy, err } from "../utils/dom.js";
import { reduireImage } from "../utils/images.js";

/* Écran « identite » */
export function lierIdentite(v) {
  $("#doc").value = etat.fiche.doc || "permis";
  $("#doc").onchange = (e) => {
    etat.fiche.doc = e.target.value;
    if (etat.fiche.doc === "passeport") {
      etat.fiche.verso = null;
      etat.fiche.versoUrl = null;
    }
    go("identite");
  };
  $("#f-id").onsubmit = async (e) => {
    e.preventDefault();
    err("");
    const doc = etat.fiche.doc || "permis";
    if (!etat.fiche.recto) return err("Ajoute la photo du recto.");
    if (doc !== "passeport" && !etat.fiche.verso) return err("Ajoute la photo du verso.");
    if (!$("#ok").checked) return err("Coche la case pour continuer.");
    busy(true, "Lecture de la pièce…");
    etat.fiche.doc = doc;
    try {
      const images = [await reduireImage(etat.fiche.recto)];
      if (etat.fiche.verso) images.push(await reduireImage(etat.fiche.verso));
      const { data, error } = await sb.functions.invoke("lire-identite", { body: { images, doc_type: doc } });
      if (!error && data && !data.error) {
        etat.fiche.lecture = data;
        return go("identiteLecture");
      }
    } catch (x) {}
    /* Lecture indisponible (IA désactivée, quota, réseau) : vérification entièrement manuelle. */
    return envoyerPiece();
  };
}

/* Écran « identiteLecture » */
export function lierIdentiteLecture(v) {
  $("#go").onclick = () => envoyerPiece();
  $("#reprendre").onclick = () => {
    etat.fiche.recto = etat.fiche.verso = etat.fiche.rectoUrl = etat.fiche.versoUrl = etat.fiche.lecture = null;
    go("identite");
  };
}
