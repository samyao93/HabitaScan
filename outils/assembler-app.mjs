// Assemble app.js à partir des morceaux de src/app/ (dans l'ordre de leur nom : 01-…, 02-…).
// Usage (à la racine du projet) :  node outils/assembler-app.mjs          → écrit app.js
//                                  node outils/assembler-app.mjs --verifier → échoue si app.js n'est pas à jour
//
// Pourquoi un assemblage plutôt que plusieurs <script> : tout le code de l'app vit dans un seul bloc { … },
// pour que ses noms (top, open, name…) ne se mélangent pas aux variables globales du navigateur
// (window.top, par exemple, ne peut pas être remplacé). Les morceaux partagent donc ce bloc : une fonction
// d'un morceau est visible dans tous les autres, comme avant le découpage.
// Pas d'outil de construction : app.js reste un fichier ordinaire, servi tel quel par Vercel et copié dans l'app native.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOSSIER = join(RACINE, "src", "app");

export function morceaux() {
  return readdirSync(DOSSIER)
    .filter((f) => /^\d\d-[a-z0-9-]+\.js$/.test(f))
    .sort();
}

export function assembler() {
  const parties = morceaux().map((f) => {
    const s = readFileSync(join(DOSSIER, f), "utf8").replace(/\r/g, "");
    return s.endsWith("\n") ? s : s + "\n";
  });
  return "{\n" + parties.join("") + "}\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const attendu = assembler();
  const cible = join(RACINE, "app.js");
  if (process.argv.includes("--verifier")) {
    const actuel = readFileSync(cible, "utf8").replace(/\r/g, "");
    if (actuel !== attendu) {
      console.error("app.js n'est pas à jour : lance « node outils/assembler-app.mjs » et ajoute app.js au commit.");
      process.exit(1);
    }
    console.log("app.js est à jour.");
  } else {
    writeFileSync(cible, attendu);
    console.log(`app.js assemblé à partir de ${morceaux().length} morceaux.`);
  }
}
