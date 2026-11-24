/* Chargement des données de référence : loyers moyens et liste des licences RBQ. */
import { sb } from "./config.js";
import { etat } from "./etat.js";

export async function chargerRegistre() {
  try {
    const { count, error } = await sb.from("licences_rbq").select("numero", { count: "exact", head: true });
    etat.registrePret = !error && count > 0;
  } catch (e) {
    etat.registrePret = false;
  }
}

export async function chargerLoyers() {
  // Les colonnes mediane et mediane_periode arrivent avec la migration 20261124b : sans elles, on relit sans.
  let { data, error } = await sb
    .from("loyers_reference")
    .select("ville,chambres,loyer,periode,source,mediane,mediane_periode");
  if (error) ({ data } = await sb.from("loyers_reference").select("ville,chambres,loyer,periode,source"));
  etat.loyers = {};
  etat.loyersInfo = {};
  etat.medianes = {};
  (data || []).forEach((r) => {
    (etat.loyers[r.ville] = etat.loyers[r.ville] || [0, 0, 0])[r.chambres - 1] = r.loyer;
    if (r.periode || r.source) etat.loyersInfo[r.ville] = { periode: r.periode, source: r.source };
    if (r.mediane)
      (etat.medianes[r.ville] = etat.medianes[r.ville] || [null, null, null])[r.chambres - 1] = {
        loyer: r.mediane,
        periode: r.mediane_periode || "",
      };
  });
  const ordre = Object.entries(etat.loyers).sort((a, b) => b[1][1] - a[1][1]);
  etat.loyers = Object.fromEntries(ordre);
}
