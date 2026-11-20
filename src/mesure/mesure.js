/* Mesure d'usage anonyme et journal des erreurs. */
import { rpc } from "../admin/api.js";
import { remplirMesure } from "../admin/remplissage.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";

const VUES_MESUREES = [
  "bienvenue",
  "inscription",
  "accueil",
  "verifier",
  "resultat",
  "proprio",
  "budget",
  "trouver",
  "approfondie",
  "reno",
  "renoResultat",
  "victime",
  "conditions",
  "confidentialite",
];

let derniereVue = "";

export function mesurerVue(v) {
  derniereVue = v;
  if (VUES_MESUREES.includes(v))
    try {
      MES.noter("vue_" + v);
    } catch (e) {}
  if (v === "admin" && (etat.fiche.onglet || "chiffres") === "chiffres") remplirMesure();
}

/* Erreurs techniques : 5 par session au maximum, message court, sans données de l'utilisateur */
let nbErreurs = 0;

function noterErreur(m) {
  if (++nbErreurs > 5) return;
  try {
    MES.erreur(String(m || "").slice(0, 300), derniereVue);
  } catch (e) {}
}

export function ecouterErreurs() {
  window.addEventListener("error", (e) =>
    noterErreur((e.message || "erreur") + (e.filename ? ` @${String(e.filename).split("/").pop()}:${e.lineno}` : "")),
  );
  window.addEventListener("unhandledrejection", (e) =>
    noterErreur("promesse : " + ((e.reason && e.reason.message) || e.reason || "")),
  );
}

/* Adaptateur mesure (Supabase : fonctions noter, noter_erreur, admin_mesure) */
export const MES = {
  noter(t) {
    sb.rpc("noter", { p_type: t }).then(
      () => {},
      () => {},
    );
  },
  erreur(m, v) {
    sb.rpc("noter_erreur", { p_message: m, p_vue: v || null, p_agent: navigator.userAgent.slice(0, 160) }).then(
      () => {},
      () => {},
    );
  },
  admin: () => rpc("admin_mesure"),
};
