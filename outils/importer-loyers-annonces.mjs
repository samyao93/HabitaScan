// Construit src/prix/loyers-annonces.json : le loyer demandé dans les annonces récentes, par ville et nombre
// de chambres, pour comparer le loyer d'une annonce vérifiée (rapport « Comparer le prix »).
//
// Source : Statistique Canada, tableau 46-10-0092-01 (Statistiques trimestrielles sur les loyers, estimations
// expérimentales : loyers demandés et loyers payés, par type de logement et nombre de chambres, par région
// métropolitaine de recensement). Données ouvertes, Licence du gouvernement ouvert – Canada.
// https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=4610009201
//
// Usage (à la racine du projet) :
//   node outils/importer-loyers-annonces.mjs                → télécharge le tableau et écrit le fichier
//   node outils/importer-loyers-annonces.mjs 46100092-eng.zip → même chose à partir d'un fichier déjà téléchargé
//   node outils/importer-loyers-annonces.mjs --apercu       → affiche le résultat sans rien écrire
// À relancer chaque trimestre (le workflow « Loyers des annonces » le fait tout seul et ouvre une PR).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE } from "./construire.mjs";
import { extraireZip } from "./importer-secteurs.mjs";

export const URL_TABLEAU = "https://www150.statcan.gc.ca/n1/tbl/csv/46100092-eng.zip";
export const URL_PAGE = "https://www150.statcan.gc.ca/t1/tbl1/fr/tv.action?pid=4610009201";
export const SORTIE = join(RACINE, "src", "prix", "loyers-annonces.json");

/** Villes de l'app → reconnaissance du nom de la région métropolitaine (RMR) dans la colonne GEO. */
const VILLES = [
  ["Montréal", (g) => /^montreal\b/.test(g)],
  ["Québec", (g) => /^quebec\s*,/.test(g)],
  ["Gatineau", (g) => /gatineau/.test(g) && /quebec part|partie du quebec/.test(g)],
  ["Sherbrooke", (g) => /^sherbrooke\b/.test(g)],
  ["Trois-Rivières", (g) => /^trois-rivieres\b/.test(g)],
  ["Saguenay", (g) => /^saguenay\b/.test(g)],
  ["Drummondville", (g) => /^drummondville\b/.test(g)],
  ["Rimouski", (g) => /^rimouski\b/.test(g)],
  ["Rivière-du-Loup", (g) => /^riviere-du-loup\b/.test(g)],
];

const sansAccents = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Analyse un CSV (guillemets, virgules et retours à la ligne dans les champs). */
export function lireCsv(texte) {
  const lignes = [];
  let ligne = [],
    champ = "",
    guil = false;
  const t = texte.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (guil) {
      if (c === '"' && t[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') guil = false;
      else champ += c;
    } else if (c === '"') guil = true;
    else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  return lignes.filter((l) => l.length > 1);
}

/** Nombre de chambres d'un libellé (« 2 bedrooms », « 3 bedrooms and more »…) : 0 = studio, null = aucun. */
export function chambresDe(libelle) {
  const s = sansAccents(libelle);
  if (/studio|bachelor|0 bedroom/.test(s)) return 0;
  const m = s.match(/\b(\d)\s*(?:\+\s*)?bedrooms?\b/) || s.match(/\b(\d)\s*(?:\+\s*)?chambres?\b/);
  return m ? +m[1] : null;
}
const troisEtPlus = (libelle) => /(\d)\s*\+|or more|and more|and over|et plus|ou plus/.test(sansAccents(libelle));

/** « 2026Q2 », « 2026-04 » ou « 2026-04-01 » → « 2e trimestre 2026 ». */
export function periodeFr(ref) {
  const s = String(ref);
  let m = s.match(/^(\d{4})\s*-?\s*Q([1-4])$/i);
  let a, q;
  if (m) [a, q] = [m[1], +m[2]];
  else if ((m = s.match(/^(\d{4})-(\d{2})/))) [a, q] = [m[1], Math.ceil(+m[2] / 3)];
  else return s;
  return `${q === 1 ? "1er" : q + "e"} trimestre ${a}`;
}
const cleTri = (ref) => {
  const s = String(ref);
  const m = s.match(/^(\d{4})\s*-?\s*Q([1-4])$/i);
  return m ? `${m[1]}-${String(+m[2] * 3).padStart(2, "0")}` : s;
};

/** Description française du type de loyer retenu, à partir des libellés anglais du tableau. */
export function descriptionFr(libelles) {
  const s = sansAccents(libelles.join(" | "));
  const morceaux = [];
  morceaux.push(/asking/.test(s) ? "Loyer demandé dans les annonces" : /paid/.test(s) ? "Loyer payé" : "Loyer");
  if (/median/.test(s)) morceaux[0] += " (médiane)";
  else if (/average|mean/.test(s)) morceaux[0] += " (moyenne)";
  if (/apartment/.test(s) && !/total|all /.test(s)) morceaux.push("appartements");
  else if (/condo/.test(s)) morceaux.push("condos");
  else if (/house/.test(s) && !/total|all /.test(s)) morceaux.push("maisons");
  else morceaux.push("tous les types de logements");
  return morceaux.join(", ");
}

/**
 * Lignes du CSV → { periode, ref, description, libelles, villes: { Ville: [1 ch., 2 ch., 3 ch. et plus] } }.
 * Choix : loyer demandé (et non payé), médiane si le tableau la donne, tous les types de logement si possible,
 * sinon les appartements ; dernière période où la ville a une valeur.
 */
export function loyersDe(lignes) {
  const [entete, ...corps] = lignes;
  const col = (nom) => entete.findIndex((h) => sansAccents(h) === sansAccents(nom));
  const iRef = col("REF_DATE"),
    iGeo = col("GEO"),
    iVal = col("VALUE"),
    iDguid = col("DGUID"),
    iUom = col("UOM");
  if (iRef < 0 || iGeo < 0 || iVal < 0) throw new Error("Colonnes REF_DATE, GEO ou VALUE absentes : fichier inattendu");
  const dims = [];
  for (let i = (iDguid >= 0 ? iDguid : iGeo) + 1; i < (iUom >= 0 ? iUom : iVal); i++) dims.push(i);
  const tous = sansAccents(corps.map((l) => dims.map((i) => l[i]).join("|")).join("\n"));
  const exigeDemande = /asking/.test(tous),
    exigeMediane = /median/.test(tous);
  const score = (s) => (/total|all /.test(s) ? 3 : /apartment/.test(s) ? 2 : 1);
  const choix = {}; // ville → ch → { ref, val, s, libelles }
  for (const l of corps) {
    const val = parseFloat(l[iVal]);
    if (!Number.isFinite(val) || val <= 0) continue;
    const geo = sansAccents(l[iGeo]);
    const ville = (VILLES.find(([, ok]) => ok(geo)) || [])[0];
    if (!ville) continue;
    const libelles = dims.map((i) => l[i]);
    const s = sansAccents(libelles.join(" | "));
    if (exigeDemande && !/asking/.test(s)) continue;
    if (exigeMediane && !/median/.test(s)) continue;
    const lc = libelles.find((x) => chambresDe(x) != null);
    if (!lc) continue;
    let ch = chambresDe(lc);
    if (ch < 1) continue;
    if (ch > 3 || (ch === 3 && !troisEtPlus(lc) && /3\s*\+|3 bedrooms (and|or) more/.test(tous))) continue;
    ch = Math.min(ch, 3);
    const k = cleTri(l[iRef]),
      sc = score(s);
    const prec = ((choix[ville] = choix[ville] || {})[ch] = choix[ville][ch] || null);
    if (!prec || k > prec.k || (k === prec.k && sc > prec.sc))
      choix[ville][ch] = { k, ref: l[iRef], val: Math.round(val), sc, libelles };
  }
  const villes = {};
  let ref = null,
    libelles = null;
  for (const [ville] of VILLES) {
    const c = choix[ville];
    if (!c) continue;
    villes[ville] = [1, 2, 3].map((n) => (c[n] ? c[n].val : 0));
    for (const n of [1, 2, 3])
      if (c[n] && (!ref || cleTri(c[n].ref) > cleTri(ref))) [ref, libelles] = [c[n].ref, c[n].libelles];
  }
  // Une ville dont la dernière valeur est plus ancienne que la période la plus récente garde la sienne, notée à part.
  const periodes = {};
  for (const [ville, c] of Object.entries(choix))
    for (const n of [1, 2, 3]) if (c[n] && c[n].ref !== ref) periodes[ville] = periodeFr(c[n].ref);
  return {
    source: "Statistique Canada, tableau 46-10-0092-01 (estimations expérimentales)",
    url: URL_PAGE,
    ref,
    periode: ref ? periodeFr(ref) : null,
    description: libelles ? descriptionFr(libelles) : null,
    libelles,
    villes,
    ...(Object.keys(periodes).length ? { periodesParVille: periodes } : {}),
  };
}

/** Résumé du tableau pour le journal : colonnes, membres des dimensions, régions du Québec, dernière période. */
function apercu(lignes) {
  const [entete, ...corps] = lignes;
  console.log("Colonnes :", entete.join(" | "));
  const iGeo = entete.indexOf("GEO"),
    iDguid = entete.indexOf("DGUID"),
    iUom = entete.indexOf("UOM"),
    iRef = entete.indexOf("REF_DATE");
  for (let i = (iDguid >= 0 ? iDguid : iGeo) + 1; i < iUom; i++)
    console.log(`Dimension « ${entete[i]} » :`, [...new Set(corps.map((l) => l[i]))].join(" ; "));
  console.log(
    "Régions du Québec :",
    [...new Set(corps.map((l) => l[iGeo]).filter((g) => /quebec|québec/i.test(g)))].join(" ; "),
  );
  console.log("Périodes :", [...new Set(corps.map((l) => l[iRef]))].slice(-6).join(" ; "));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const args = process.argv.slice(2);
  const seulement = args.includes("--apercu");
  const source = args.find((a) => !a.startsWith("--"));
  let brut;
  if (source) brut = readFileSync(source);
  else {
    const rep = await fetch(URL_TABLEAU);
    if (!rep.ok) throw new Error(`Téléchargement impossible (${rep.status}) : ${URL_TABLEAU}`);
    brut = Buffer.from(await rep.arrayBuffer());
  }
  const texte = (brut.readUInt32LE(0) === 0x04034b50 ? extraireZip(brut, "46100092.csv") : brut).toString("utf8");
  const lignes = lireCsv(texte);
  apercu(lignes);
  const r = loyersDe(lignes);
  const n = Object.keys(r.villes).length;
  console.log(JSON.stringify(r, null, 2));
  if (!n || !r.villes["Montréal"])
    throw new Error("Montréal absent du résultat : fichier inattendu, rien n'est écrit.");
  if (!seulement) {
    writeFileSync(SORTIE, JSON.stringify(r, null, 2) + "\n");
    console.log(`${SORTIE} : ${n} villes, ${r.periode}.`);
  }
}
