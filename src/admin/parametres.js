/* Espace admin : réglages modifiables (prix, quotas, fonctions activées). */
import { ASSURANCE, EPICERIE, GARDE, TRANSIT } from "../budget/regles.js";
import { sb } from "../config.js";

export const PARAMS = [
  // clé en base → où l'app l'utilise
  {
    cle: "transit_montreal",
    n: "Laissez-passer Montréal",
    get: () => TRANSIT["Montréal"].p,
    set: (v) => (TRANSIT["Montréal"].p = v),
  },
  {
    cle: "transit_quebec",
    n: "Laissez-passer Québec / Lévis",
    get: () => TRANSIT["Québec"].p,
    set: (v) => {
      TRANSIT["Québec"].p = v;
      TRANSIT["Lévis"].p = v;
    },
  },
  {
    cle: "transit_gatineau",
    n: "Laissez-passer Gatineau",
    get: () => TRANSIT["Gatineau"].p,
    set: (v) => (TRANSIT["Gatineau"].p = v),
  },
  { cle: "assurance", n: "Assurance locataire par mois", get: () => ASSURANCE.p, set: (v) => (ASSURANCE.p = v) },
  { cle: "epicerie", n: "Épicerie par personne par mois", get: () => EPICERIE.p, set: (v) => (EPICERIE.p = v) },
  { cle: "garde_jour", n: "Garderie subventionnée par jour", get: () => GARDE.jour, set: (v) => (GARDE.jour = v) },
];

/* Réglages modifiables dans la console d'administration */
export const CFG = { ia: true, recherche: true, approfondie: true, sms: false, message: "", support: "" };

const DRAPEAUX = {
  ia_active: "ia",
  recherche_active: "recherche",
  approfondie_active: "approfondie",
  sms_actif: "sms",
};

function appliquerParametres(rows) {
  (rows || []).forEach((r) => {
    const p = PARAMS.find((x) => x.cle === r.cle);
    const v = +r.valeur;
    if (p && v > 0) p.set(v);
    if (DRAPEAUX[r.cle]) CFG[DRAPEAUX[r.cle]] = v !== 0;
  });
}

export const nb = (v) => Number(v || 0).toLocaleString("fr-CA");

export async function chargerParametres() {
  try {
    const { data } = await sb.from("parametres").select("cle,valeur");
    appliquerParametres(data);
  } catch (e) {}
}
