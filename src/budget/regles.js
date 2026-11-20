/* Budget : postes de dépenses, montants de référence et calcul. */
import { etat } from "../etat.js";

export const villeDefaut = () => (etat.loyers["Montréal"] ? "Montréal" : Object.keys(etat.loyers)[0]);

export const TRANSIT = {
  // laissez-passer mensuel régulier, tarif 2026
  Montréal: {
    p: 110,
    s: "STM, mensuel tous modes A, juillet 2026",
    u: "https://www.narcity.com/fr/montreal/augmentation-stm-artm-tarifs-2026",
  },
  Québec: {
    p: 115,
    s: "Métropolitain régulier RTC/STLévis, 1er février 2026",
    u: "https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf",
  },
  Lévis: {
    p: 115,
    s: "Métropolitain régulier RTC/STLévis, 1er février 2026",
    u: "https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf",
  },
  Gatineau: { p: 116.5, s: "STO, mensuel régulier 2026", u: "https://sto.ca/en/fares/echo-program/" },
};

export const ASSURANCE = {
  p: 31,
  s: "moyenne citée par la Chambre de l'assurance de dommages (Protégez-vous)",
  u: "https://www.protegez-vous.ca/partenaires/chambre-de-l-assurance/assurance-locataire-quoi-savoir-pour-prendre-une-decision-eclairee",
};

export const EPICERIE = {
  p: 366,
  s: "Rapport sur les prix alimentaires 2026 : 17 571,79 $ par an pour une famille de quatre, divisé par 4 et par 12",
  u: "https://www.dal.ca/news/2025/12/04/canada-food-price-report-2026.html",
};

export const GARDE = {
  jour: 9.65,
  jours: 21,
  s: "tarif 2026 en service de garde subventionné : 9,65 $ par jour",
  u: "https://www.quebec.ca/famille-et-soutien-aux-personnes/enfance/garderies-et-services-de-garde/soutien-financier-frais-garde",
};

export const POSTES = [
  ["loyer", "Loyer"],
  ["elec", "Électricité"],
  ["epicerie", "Épicerie"],
  ["transport", "Transport"],
  ["internet", "Internet et cellulaire"],
  ["garde", "Garde d'enfants"],
  ["assurance", "Assurance locataire"],
  ["abonnements", "Abonnements"],
];

export const gardeDefaut = (B) => String(Math.round(GARDE.jour * GARDE.jours * (+B.garderie || 0)));

export function budgetDefaut(F) {
  const B = F.B || (F.B = {});
  if (!B.ville) B.ville = F.ville && etat.loyers[F.ville] ? F.ville : villeDefaut();
  if (!B.ch) B.ch = F.ch || "1";
  if (!B.unite) B.unite = "an";
  if (!B.netUnite) B.netUnite = "mois";
  if (!B.adultes) B.adultes = "1";
  if (!B.enfants) B.enfants = "0";
  if (!B.garderie) B.garderie = "0";
  if (!B.mois) B.mois = "3";
  if (+B.garderie > +B.enfants) B.garderie = B.enfants;
  if (B.transport == null) {
    const t = TRANSIT[B.ville];
    B.transport = t ? String(Math.round(t.p * (+B.adultes || 1) * 100) / 100).replace(".", ",") : "";
  }
  if (B.assurance == null) B.assurance = String(ASSURANCE.p);
  if (B.epicerie == null) B.epicerie = String(EPICERIE.p * ((+B.adultes || 1) + (+B.enfants || 0)));
  if (B.garde == null) B.garde = gardeDefaut(B);
  if (B.loyer == null) {
    const l = etat.loyers[B.ville];
    B.loyer = l ? String(l[Math.min(+B.ch, 3) - 1]) : "";
  }
  return B;
}

export const montant = (v) => {
  const n = parseFloat(
    String(v || "")
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  return isNaN(n) ? 0 : n;
};

export function calculerBudget(B) {
  const rev = montant(B.revenu),
    revMois = B.unite === "an" ? rev / 12 : rev;
  const net = montant(B.net),
    netMois = B.netUnite === "an" ? net / 12 : B.netUnite === "2sem" ? (net * 26) / 12 : net;
  const loyer = montant(B.loyer),
    elec = montant(B.elec);
  const postes = POSTES.map(([k, n]) => ({ k, n, v: montant(B[k]) })).filter((p) => p.v > 0);
  const mensuel = postes.reduce((a, p) => a + p.v, 0);
  const uniques = montant(B.demenagement) + montant(B.meubles);
  const mois = +B.mois || 3;
  const max = revMois ? Math.max(0, Math.floor(revMois * 0.3 - elec)) : 0;
  const ratio = revMois ? (loyer + elec) / revMois : 0;
  const l = etat.loyers[B.ville],
    moy = l && l[Math.min(+B.ch, 3) - 1];
  const base = netMois || revMois,
    total = uniques + mensuel * mois;
  return {
    revMois,
    netMois,
    base,
    baseNet: !!netMois,
    reste: base ? base - mensuel : 0,
    revPeriode: base * mois,
    restePeriode: base ? base * mois - total : 0,
    mensuel,
    postes,
    uniques,
    mois,
    total,
    max,
    ratio,
    moy,
    loyer,
    elec,
  };
}
