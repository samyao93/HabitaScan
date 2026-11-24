/* Navigation : affichage d'un écran et liaison de ses boutons. */
import { ADM } from "../admin/api.js";
import { lierAdmin } from "../admin/ecran.js";
import { lierAlertes } from "../alertes/liaisons.js";
import { lierCapturesVerifier, lierFormulaireVerifier, lierResultat } from "../annonce/liaisons.js";
import { lierApprofondies } from "../approfondie/liaisons.js";
import { lierBudget } from "../budget/liaisons.js";
import { lierCode, lierDeconnexion, lierInscription } from "../compte/liaisons.js";
import { lierSupprimer } from "../compte/suppression.js";
import { etat } from "../etat.js";
import { lierMessageFiltre } from "../filtre/liaisons.js";
import { lierHistoriqueCompteLieu } from "../historique/liaisons.js";
import { lierAnalyseIA } from "../ia/liaisons.js";
import { lierIdentite, lierIdentiteLecture } from "../identite/liaisons.js";
import { mesurerVue } from "../mesure/mesure.js";
import { V } from "./ecrans.js";
import { lierProprio } from "../proprietaire/liaisons.js";
import { lierEcranReno, lierEcranRenoResultat, lireReno } from "../renovation/liaisons.js";
import { lierBoutonSignaler, lierSignalement } from "../signalements/liaisons.js";
import { lierTrouver } from "../trouver/liaisons.js";
import { $, app, keep } from "../utils/dom.js";
import { LS } from "../utils/stockage.js";

const PUBLIQUES = ["bienvenue", "inscription", "code", "victime", "erreur", "confidentialite", "conditions"];

export function go(v) {
  if (!etat.session && !PUBLIQUES.includes(v)) {
    if (etat.fiche.partage) LS.set("vl_partage", { annonce: etat.fiche.annonce, lien: etat.fiche.lien });
    v = "bienvenue";
  }
  if (v === "admin" && !ADM.estAdmin()) v = "accueil";
  app.dataset.v = v;
  app.innerHTML = V[v]();
  try {
    window.hsTheme && hsTheme.appliquer();
  } catch (e) {}
  window.scrollTo(0, 0);
  lierEcran(v);
}

/* Liaisons communes à tous les écrans : boutons de navigation, questions oui/non, captures. */
function lierCommun(v) {
  app.querySelectorAll("[data-go]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.id === "nouvR") etat.fiche = {};
        go(b.dataset.go);
      }),
  );
  app.querySelectorAll("[data-langue]").forEach(
    (b) =>
      (b.onclick = () => {
        try {
          localStorage.setItem("hs_langue", b.dataset.langue); // lu par langue.js, avant le chargement de l'app
        } catch (e) {}
        location.reload();
      }),
  );
  app.querySelectorAll("[data-canal]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche.canal = b.dataset.canal;
        etat.fiche.ident = "";
        go("inscription");
      }),
  );
  app.querySelectorAll("[data-yn]").forEach(
    (b) =>
      (b.onclick = () => {
        etat.fiche[b.dataset.yn] = b.dataset.v;
        b.parentNode.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        if (b.dataset.yn === "cession") $("#q-accord").hidden = b.dataset.v !== "oui";
      }),
  );
  {
    const pl = $("#photos-log");
    if (pl)
      pl.onchange = () => {
        const fs = [...pl.files].slice(0, 4);
        if (!fs.length) return;
        keep();
        etat.fiche.photosLog = fs;
        go("verifier");
      };
  }
  app.querySelectorAll("input[data-captures]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const fs = [...inp.files].slice(0, 4);
        if (!fs.length) return;
        keep();
        etat.fiche.captures = fs;
        etat.fiche.vignettes = fs.map((f) => URL.createObjectURL(f));
        etat.fiche.capture = fs[0];
        etat.fiche.ocr = true;
        etat.fiche.iaOff = false;
        etat.fiche.ia = null;
        go(v);
      }),
  );
  app.querySelectorAll("input[type=file][data-side]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        const s = inp.dataset.side;
        etat.fiche[s] = f;
        etat.fiche[s + "Url"] = URL.createObjectURL(f);
        keep();
        lireReno(etat.fiche);
        if (v === "verifier" && s === "capture") etat.fiche.ocr = true;
        go(v);
      }),
  );
}

/* Liaisons propres à un écran, dans l'ordre où elles s'appliquent. */
const LIAISONS = {
  proprio: [() => lierProprio(etat.fiche)],
  budget: [() => lierBudget(etat.fiche)],
  trouver: [() => lierTrouver(etat.fiche)],
  supprimer: [lierSupprimer],
  admin: [lierAdmin],
  inscription: [lierInscription],
  code: [lierCode],
  identite: [lierIdentite],
  identiteLecture: [lierIdentiteLecture],
  compte: [lierDeconnexion],
  resultat: [lierBoutonSignaler, lierResultat],
  signaler: [lierSignalement],
  verifier: [lierFormulaireVerifier, lierCapturesVerifier],
  reno: [lierEcranReno],
  renoResultat: [lierEcranRenoResultat],
};
/* Liaisons par thème : chacune vérifie elle-même l'écran affiché. */
const LIAISONS_THEMES = [
  lierApprofondies,
  mesurerVue,
  lierAnalyseIA,
  lierHistoriqueCompteLieu,
  lierMessageFiltre,
  lierAlertes,
];

/* Lie les boutons et champs de l'écran qui vient d'être affiché. */
export function lierEcran(v) {
  lierCommun(v);
  for (const lier of LIAISONS[v] || []) lier(v);
  for (const lier of LIAISONS_THEMES) lier(v);
}
