/* Loyer de référence SCHL d'une ville : le loyer médian (octobre 2025) quand la SCHL le publie,
   sinon le loyer moyen de la table loyers_reference. Sert au budget, au verdict et à la recherche. */
import MEDIANES from "./medianes-schl.json";
import { etat } from "../etat.js";

/* { loyer, stat: "médian" | "moyen", periode } ou null. ch : 1, 2 ou 3 (3 et plus). */
export function loyerSchl(ville, ch, loyers = etat.loyers, medianes = MEDIANES) {
  const i = Math.min(Math.max(+ch || 1, 1), 3) - 1;
  const md = medianes.villes && medianes.villes[ville] && medianes.villes[ville][i];
  if (md && md.loyer) return { loyer: md.loyer, stat: "médian", periode: medianes.periode };
  const moy = loyers[ville] && loyers[ville][i];
  const info = (etat.loyersInfo || {})[ville] || {};
  return moy ? { loyer: moy, stat: "moyen", periode: info.periode || "octobre 2025" } : null;
}
