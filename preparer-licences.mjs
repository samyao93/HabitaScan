// Prépare la liste des licences actives de la RBQ pour l'import dans Supabase.
// Usage : node preparer-licences.mjs fichier-telecharge.csv
// Produit licences_rbq.csv, à importer dans Table Editor > licences_rbq > Insert > Import data from CSV.
// Les noms des colonnes du fichier source sont reconnus par mots-clés ; si une colonne n'est pas
// reconnue, le script affiche la liste des colonnes pour ajuster les mots-clés ci-dessous.
import fs from "node:fs";

const src = process.argv[2];
if (!src) { console.error("Usage : node preparer-licences.mjs fichier.csv"); process.exit(1); }

const sansAccent = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function lireCsv(texte) {
  const sep = (texte.split("\n")[0].match(/;/g) || []).length > (texte.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  const lignes = []; let ligne = [], champ = "", guill = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guill) { if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; } else if (c === '"') guill = false; else champ += c; }
    else if (c === '"') guill = true;
    else if (c === sep) { ligne.push(champ); champ = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && texte[i + 1] === "\n") i++; ligne.push(champ); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes.filter(l => l.some(x => x.trim()));
}
const csvChamp = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const [entete, ...rangees] = lireCsv(fs.readFileSync(src, "utf8").replace(/^﻿/, ""));
const h = entete.map(sansAccent);
const trouve = (...mots) => h.findIndex(x => mots.every(m => x.includes(m)));
const col = {
  numero: trouve("numero", "licence"),
  nom: h.findIndex(x => x.includes("nom") && !x.includes("autre") && !x.includes("nombre")),
  autres_noms: trouve("autre", "nom"),
  sous_categories: h.findIndex(x => x.includes("categorie") && !x.includes("nombre")),
  mandataire: trouve("mandataire"),
  region: trouve("region"),
};
const manquent = Object.entries(col).filter(([k, i]) => i < 0 && ["numero", "nom", "sous_categories"].includes(k)).map(([k]) => k);
if (manquent.length) {
  console.error("Colonnes non reconnues : " + manquent.join(", ") + "\nColonnes du fichier :\n- " + entete.join("\n- "));
  process.exit(1);
}
const vus = new Set(), sortie = ["numero,nom,autres_noms,sous_categories,mandataire,region"];
for (const r of rangees) {
  const numero = String(r[col.numero] || "").replace(/\D/g, "");
  if (numero.length < 8 || numero.length > 10 || vus.has(numero)) continue;
  vus.add(numero);
  const v = k => col[k] >= 0 ? String(r[col[k]] || "").trim() : "";
  sortie.push([numero, v("nom"), v("autres_noms"), v("sous_categories"), v("mandataire"), v("region")].map(csvChamp).join(","));
}
fs.writeFileSync("licences_rbq.csv", sortie.join("\n") + "\n");
console.log(`${sortie.length - 1} licences écrites dans licences_rbq.csv`);
