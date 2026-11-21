// Construit le site dans public/ : l'app (src/main.js et ses modules) assemblée en un seul public/app.js par esbuild,
// et les fichiers du site copiés tels quels. C'est ce dossier que Vercel met en ligne (vercel.json).
//
// Usage (à la racine du projet) :
//   node outils/construire.mjs          → construit public/
//   node outils/construire.mjs --dev    → construit, puis reconstruit à chaque modification et sert le site
//                                         sur http://localhost:8000 (ouvrir /app.html)
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SORTIE = join(RACINE, "public");

/** Fichiers et dossiers du site publiés tels quels. */
export const FICHIERS_SITE = [
  "index.html",
  "app.html",
  "admin.html",
  "a-propos.html",
  "carte.html",
  "carte.js",
  "carte-secteurs.json",
  "en.html",
  "confidentialite.html",
  "conditions.html",
  "site.css",
  "app.css",
  "theme.js",
  "md.js",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "robots.txt",
  "sitemap.xml",
  "img",
  "guides",
  "textes",
];

/** Réglages d'esbuild pour l'app. `entree` : fichier d'entrée (par défaut src/main.js). */
export function optionsApp(surcharges = {}) {
  return {
    entryPoints: [join(RACINE, "src", "main.js")],
    bundle: true,
    format: "iife", // un seul script classique : aucune variable de l'app ne devient globale
    target: "es2020", // navigateurs de 2020 et plus récents (comme le code d'origine, servi sans conversion)
    charset: "utf8",
    legalComments: "none",
    logLevel: "warning",
    ...surcharges,
  };
}

function copierSite() {
  rmSync(SORTIE, { recursive: true, force: true });
  mkdirSync(SORTIE, { recursive: true });
  for (const f of FICHIERS_SITE) {
    if (!existsSync(join(RACINE, f))) throw new Error(`Fichier du site introuvable : ${f}`);
    cpSync(join(RACINE, f), join(SORTIE, f), { recursive: true });
  }
}

/** Texte de l'app construite (minifiée, sans carte des sources) : pour l'app native. */
export async function texteApp() {
  const r = await build(optionsApp({ minify: true, write: false, outfile: "app.js" }));
  return r.outputFiles[0].text;
}

/** Construit public/. Renvoie le résultat d'esbuild (avertissements compris). */
export async function construire() {
  copierSite();
  return build(optionsApp({ outfile: join(SORTIE, "app.js"), minify: true, sourcemap: "linked" }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--dev")) {
    copierSite();
    const ctx = await context(optionsApp({ outfile: join(SORTIE, "app.js"), sourcemap: "inline" }));
    await ctx.watch();
    const { port } = await ctx.serve({ servedir: SORTIE, port: 8000 });
    console.log(`App : http://localhost:${port}/app.html (reconstruite à chaque modification de src/)`);
  } else {
    const r = await construire();
    if (r.warnings.length) {
      console.error(`${r.warnings.length} avertissement(s) d'esbuild : à corriger.`);
      process.exit(1);
    }
    console.log("public/ construit.");
  }
}
