/* Loyer de référence SCHL d'une ville : le loyer médian quand on l'a, sinon le loyer moyen.
   Médiane : d'abord celle saisie dans l'Espace admin (table loyers_reference, colonne mediane),
   sinon celle d'octobre 2025 intégrée au code (medianes-schl.json). Sert au budget, au verdict,
   à la recherche et à « Comparer le prix ». */
import MEDIANES from "./medianes-schl.json";
import { etat } from "../etat.js";

const indice = (ch) => Math.min(Math.max(+ch || 1, 1), 3) - 1;

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

/* { loyer, stat: "médian" | "moyen", periode } ou null. ch : 1, 2 ou 3 (3 et plus). */
export function loyerSchl(ville, ch, loyers = etat.loyers, medianes = MEDIANES) {
  const md = medianeSchl(ville, ch, medianes);
  if (md) return { loyer: md.loyer, stat: "médian", periode: md.periode };
  const moy = loyers[ville] && loyers[ville][indice(ch)];
  const info = (etat.loyersInfo || {})[ville] || {};
  return moy ? { loyer: moy, stat: "moyen", periode: info.periode || "octobre 2025" } : null;
}
