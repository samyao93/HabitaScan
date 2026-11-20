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
  const { data } = await sb.from("loyers_reference").select("ville,chambres,loyer");
  etat.loyers = {};
  (data || []).forEach((r) => {
    (etat.loyers[r.ville] = etat.loyers[r.ville] || [0, 0, 0])[r.chambres - 1] = r.loyer;
  });
  const ordre = Object.entries(etat.loyers).sort((a, b) => b[1][1] - a[1][1]);
  etat.loyers = Object.fromEntries(ordre);
}
