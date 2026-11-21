// Carte des arnaques par quartier : positions des secteurs (outils/importer-secteurs.mjs, carte-secteurs.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { extraireZip, secteursDe } from "../outils/importer-secteurs.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

const LIGNES = [
  "CA\tH2X\tMontreal (Plateau Mont-Royal South)\tQuebec\tQC\t\t\t\t\t45.5124\t-73.5689\t",
  "CA\tG1R\tQuebec City (Vieux-Quebec)\tQuebec\tQC\t\t\t\t\t46.8123\t-71.2145\t",
  "CA\tK1A\tOttawa\tOntario\tON\t\t\t\t\t45.4215\t-75.6972\t",
  "CA\tH9X\tSainte-Anne-de-Bellevue\tQuebec\tQC\t\t\t\t\tx\ty\t",
].join("\n");

test("secteursDe : garde les secteurs du Québec avec une position valide", () => {
  assert.deepEqual(secteursDe(LIGNES), {
    G1R: [46.812, -71.214, "Quebec City (Vieux-Quebec)"],
    H2X: [45.512, -73.569, "Montreal (Plateau Mont-Royal South)"],
  });
});

test("extraireZip : lit un fichier compressé d'une archive zip", () => {
  const nom = Buffer.from("CA.txt"),
    brut = Buffer.from(LIGNES),
    comp = deflateRawSync(brut);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(brut.length, 22);
  local.writeUInt16LE(nom.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(brut.length, 24);
  central.writeUInt16LE(nom.length, 28);
  central.writeUInt32LE(0, 42);
  const debutCentral = local.length + nom.length + comp.length;
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(1, 8);
  fin.writeUInt16LE(1, 10);
  fin.writeUInt32LE(central.length + nom.length, 12);
  fin.writeUInt32LE(debutCentral, 16);
  const zip = Buffer.concat([local, nom, comp, central, nom, fin]);
  assert.equal(extraireZip(zip, "CA.txt").toString("utf8"), LIGNES);
});

test("carte-secteurs.json : objet { RTA: [lat, lng, nom] } valide", () => {
  const s = JSON.parse(readFileSync(join(RACINE, "carte-secteurs.json"), "utf8"));
  for (const [rta, p] of Object.entries(s)) {
    assert.match(rta, /^[GHJ][0-9][A-Z]$/);
    assert.ok(p[0] > 44 && p[0] < 63 && p[1] > -80 && p[1] < -57, `${rta} hors du Québec`);
  }
});
