/* Loyer de référence SCHL d'une ville : le loyer médian quand on l'a, sinon le loyer moyen.
   Médiane : d'abord celle saisie dans l'Espace admin (table loyers_reference, colonne mediane),
   sinon celle d'octobre 2025 intégrée au code (medianes-schl.json). Sert au budget, au verdict,
   à la recherche et à « Comparer le prix ». */
import MEDIANES from "./medianes-schl.json";
import { etat } from "../etat.js";

/* Nombre de chambres → case des tableaux [studio, 1 ch., 2 ch., 3 ch. et plus]. « 0 » = studio ; vide ou inconnu = 1. */
export function indiceCh(ch) {
  const n = parseInt(ch, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 3) : 1;
}
const indice = indiceCh;

/* « studio », « 1 chambre », « 2 chambres », « 3 chambres et plus ». */
export function libelleCh(ch) {
  const n = indiceCh(ch);
  return n === 0 ? "studio" : n === 3 ? "3 chambres et plus" : `${n} chambre${n > 1 ? "s" : ""}`;
}

/* Version courte : « Studio », « 2 ch. », « 3 ch. et plus » ; « ? ch. » si inconnu. */
export function courtCh(ch) {
  if (ch == null || ch === "" || !Number.isFinite(parseInt(ch, 10))) return "? ch.";
  const n = indiceCh(ch);
  return n === 0 ? "Studio" : n === 3 ? "3 ch. et plus" : `${n} ch.`;
}

/* Options d'un choix du nombre de chambres : [valeur, libellé]. */
export const CHOIX_CH = [
  ["0", "Studio"],
  ["1", "1"],
  ["2", "2"],
  ["3", "3 et plus"],
];

/* { loyer, periode, qualite } ou null. La cote de fiabilité n'existe que pour les valeurs du fichier. */
export function medianeSchl(ville, ch, medianes = MEDIANES) {
  const i = indice(ch);
  const db = etat.medianes && etat.medianes[ville] && etat.medianes[ville][i];
  const fic = medianes.villes && medianes.villes[ville] && medianes.villes[ville][i];
  if (db && db.loyer) {
    const memePeriode = fic && fic.loyer === db.loyer && (!db.periode || db.periode === medianes.periode);
    return { loyer: db.loyer, periode: db.periode || medianes.periode, qualite: memePeriode ? fic.qualite : null };
  }
  return fic && fic.loyer ? { loyer: fic.loyer, periode: medianes.periode, qualite: fic.qualite } : null;
}

/* { loyer, stat: "médian" | "moyen", periode } ou null. ch : 0 (studio), 1, 2 ou 3 (3 et plus). */
export function loyerSchl(ville, ch, loyers = etat.loyers, medianes = MEDIANES) {
  const md = medianeSchl(ville, ch, medianes);
  if (md) return { loyer: md.loyer, stat: "médian", periode: md.periode };
  const moy = loyers[ville] && loyers[ville][indice(ch)];
  const info = (etat.loyersInfo || {})[ville] || {};
  return moy ? { loyer: moy, stat: "moyen", periode: info.periode || "octobre 2025" } : null;
}
