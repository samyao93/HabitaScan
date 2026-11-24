/* Analyse intelligente (IA) : consentement, appel, intégration au verdict. */
import { CFG } from "../admin/parametres.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { esc } from "../utils/dom.js";
import { reduireImage } from "../utils/images.js";

export const CLE_IA = "hs_ia";

export const iaActif = () => {
  try {
    return localStorage.getItem(CLE_IA) === "1" && IA_ADAPT.dispo;
  } catch (e) {
    return false;
  }
};

export const SIGNAUX_IA = {
  argent_avant_bail: "Argent demandé avant la signature du bail",
  depot: "Dépôt ou frais de réservation",
  paiement_suspect: "Moyen de paiement typique des fraudes",
  proprietaire_absent: "Propriétaire « à l'étranger » ou absent",
  refus_visite: "Visite refusée ou repoussée",
  urgence: "Pression pour décider vite",
  changement_plateforme: "Demande de continuer sur une autre messagerie",
  pieces_identite_demandees: "Documents personnels demandés trop tôt",
  prix_anormal_annonce: "Prix présenté comme exceptionnellement bas",
  refus_bail: "Refus de signer un bail",
  paiement_autre_personne: "Paiement demandé au nom d'une autre personne",
  histoire_incoherente: "Histoire qui change ou se contredit",
  autre: "Autre élément inhabituel",
};

export async function analyserIA(captures, texte) {
  const images = [];
  for (const c of (captures || []).slice(0, 4)) images.push(await reduireImage(c));
  return IA_ADAPT.analyser({ images, texte: String(texte || "").slice(0, 8000) });
}

export function appliquerIA(r) {
  etat.fiche.ia = r;
  const villes = Object.keys(etat.loyers);
  if (r.prix) etat.fiche.prix = String(r.prix);
  if (r.chambres != null) etat.fiche.ch = String(Math.min(r.chambres, 3));
  if (r.ville) {
    const v = villes.find(
      (x) =>
        x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() ===
        r.ville.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    );
    etat.fiche.ville = v || "Autre";
  }
  if (r.cession != null) etat.fiche.cession = r.cession ? "oui" : "non";
  if (r.adresse && !etat.fiche.adr) etat.fiche.adr = r.adresse;
  const lus = [
    r.prix ? `${r.prix} $` : "",
    r.ville || "",
    r.chambres === 0 ? "studio" : r.chambres ? `${r.chambres} ch.` : "",
    r.cession ? "cession de bail" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const n = (r.signaux || []).length;
  etat.fiche.lu = `<b>Lu par l'IA :</b> ${esc((lus || "aucune information claire").replace(/\.$/, ""))}. ${n ? `<b>${n > 1 ? n + " signaux repérés" : "1 signal repéré"}</b> : tu les verras dans le résultat.` : "Aucun signal d'arnaque repéré dans le texte."} Vérifie les champs et réponds aux questions.`;
}

export function itemsIA(F) {
  const r = F.ia;
  if (!r) return [];
  const it = (r.signaux || []).map((s) => ({
    c: "y",
    t: `<b>${esc(SIGNAUX_IA[s.type] || "Élément inhabituel")}</b> : « ${esc(s.extrait)} »${s.explication ? ` ${esc(s.explication)}` : ""}`,
    law: "Repéré par l'analyse intelligente. Vérifie dans l'annonce.",
  }));
  if (r.resume) it.push({ c: "i", t: `<b>Résumé de l'IA :</b> ${esc(r.resume)}` });
  return it;
}

/* styles déplacés dans app.css */

/* Adaptateur IA (Supabase : fonction analyser-annonce → Claude Haiku 5.5) */
export const IA_ADAPT = {
  get dispo() {
    return CFG.ia;
  },
  async analyser(p) {
    const { data, error } = await sb.functions.invoke("analyser-annonce", { body: p });
    if (error) {
      if (error.context && error.context.status === 429) throw new Error("quota");
      throw error;
    }
    if (!data || data.error) throw new Error((data && data.error) || "ia");
    return data;
  },
};
