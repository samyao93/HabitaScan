// Construit carte-secteurs.json : la position approximative (centre) de chaque secteur postal du Québec,
// c'est-à-dire chaque région de tri d'acheminement (RTA, 3 premiers caractères du code postal : G, H ou J).
// La page /carte s'en sert pour placer les secteurs signalés. Aucune donnée personnelle.
//
// Source : GeoNames, fichier des codes postaux du Canada (CA.zip, une ligne par RTA), licence CC BY 4.0
// (https://www.geonames.org). L'attribution figure sur la page /carte.
//
// Usage (à la racine du projet) :
//   node outils/importer-secteurs.mjs              → télécharge CA.zip et écrit carte-secteurs.json
//   node outils/importer-secteurs.mjs CA.zip       → même chose à partir d'un CA.zip (ou CA.txt) déjà téléchargé
// À relancer rarement (les RTA changent peu). Le fichier produit est ajouté au dépôt.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { join } from "node:path";
import { RACINE } from "./construire.mjs";

const URL_CA = "https://download.geonames.org/export/zip/CA.zip";

/** Extrait un fichier d'une archive zip (sans dépendance). */
export function extraireZip(zip, nom) {
  let fin = zip.length - 22;
  while (fin >= 0 && zip.readUInt32LE(fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error("Archive zip illisible");
  let p = zip.readUInt32LE(fin + 16);
  const n = zip.readUInt16LE(fin + 10);
  for (let i = 0; i < n; i++) {
    const methode = zip.readUInt16LE(p + 10),
      taille = zip.readUInt32LE(p + 20),
      lNom = zip.readUInt16LE(p + 28),
      lExtra = zip.readUInt16LE(p + 30),
      lCom = zip.readUInt16LE(p + 32),
      local = zip.readUInt32LE(p + 42);
    const fichier = zip.toString("utf8", p + 46, p + 46 + lNom);
    if (fichier === nom) {
      const debut = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const donnees = zip.subarray(debut, debut + taille);
      return methode === 0 ? donnees : inflateRawSync(donnees);
    }
    p += 46 + lNom + lExtra + lCom;
  }
  throw new Error(`${nom} absent de l'archive`);
}

/** Lignes GeoNames (séparées par des tabulations) → { RTA: [latitude, longitude, nom du lieu] }, Québec seulement. */
export function secteursDe(texte) {
  const r = {};
  for (const ligne of texte.split(/\r?\n/)) {
    const c = ligne.split("\t");
    const rta = (c[1] || "").trim().toUpperCase();
    const lat = +c[9],
      lng = +c[10];
    if (!/^[GHJ][0-9][A-Z]$/.test(rta) || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    r[rta] = [Math.round(lat * 1000) / 1000, Math.round(lng * 1000) / 1000, (c[2] || "").trim()];
  }
  return Object.fromEntries(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const source = process.argv[2];
  let brut;
  if (source) brut = readFileSync(source);
  else {
    const rep = await fetch(URL_CA);
    if (!rep.ok) throw new Error(`Téléchargement impossible (${rep.status}) : ${URL_CA}`);
    brut = Buffer.from(await rep.arrayBuffer());
  }
  const texte = (brut.readUInt32LE(0) === 0x04034b50 ? extraireZip(brut, "CA.txt") : brut).toString("utf8");
  const secteurs = secteursDe(texte);
  const n = Object.keys(secteurs).length;
  if (n < 300) throw new Error(`Seulement ${n} secteurs du Québec trouvés : fichier inattendu, rien n'est écrit.`);
  writeFileSync(join(RACINE, "carte-secteurs.json"), JSON.stringify(secteurs) + "\n");
  console.log(`carte-secteurs.json : ${n} secteurs du Québec.`);
}
