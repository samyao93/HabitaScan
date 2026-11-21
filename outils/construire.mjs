// Construit le site dans public/ : l'app (src/main.js et ses modules) assemblée en un seul public/app.js par esbuild,
// et les fichiers du site copiés tels quels. C'est ce dossier que Vercel met en ligne (vercel.json).
//
// Usage (à la racine du projet) :
//   node outils/construire.mjs          → construit public/
//   node outils/construire.mjs --dev    → construit, puis reconstruit à chaque modification et sert le site
//                                         sur http://localhost:8000 (ouvrir /app.html)
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
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
  "en.html",
  "confidentialite.html",
  "conditions.html",
  "site.css",
  "app.css",
  "theme.js",
  "langue.js",
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

/** Langues de l'app : le français est le texte du code (src/), les autres sont des traductions (traductions/<langue>.mjs). */
export const LANGUES = ["fr", "en"];
export const fichierApp = (langue) => (langue === "fr" ? "app.js" : `app-${langue}.js`);

/**
 * Plugin esbuild qui remplace, dans chaque module de src/, les textes français par leur traduction.
 * La table : { "src/dossier/module.js": [["texte français exact", "traduction"], …] }.
 * Les textes introuvables (texte français modifié depuis la traduction) sont notés dans `absents`.
 */
export function pluginTraduction(table, absents = []) {
  return {
    name: "traduction",
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/].*\.js$/ }, (args) => {
        const rel = args.path.slice(RACINE.length + 1).replace(/\\/g, "/");
        let code = readFileSync(args.path, "utf8");
        for (const [fr, trad] of table[rel] || []) {
          if (!code.includes(fr)) absents.push({ fichier: rel, texte: fr });
          else code = code.split(fr).join(trad);
        }
        return { contents: code, loader: "js" };
      });
    },
  };
}

/**
 * Lit traductions/<langue>.txt. Format : « == src/dossier/module.js » ouvre un module, puis des paires de lignes
 * (texte français exact tel qu'écrit dans le code, puis sa traduction) séparées par une ligne vide.
 * Les lignes qui commencent par « # » sont des commentaires.
 */
export function lireTraductions(texte) {
  const table = {};
  let fichier = null,
    paire = [];
  const fin = () => {
    if (paire.length === 2 && fichier) (table[fichier] ||= []).push(paire);
    else if (paire.length) throw new Error(`Traduction incomplète (${fichier}) : ${paire.join(" / ")}`);
    paire = [];
  };
  for (const ligne of texte.split(/\r?\n/)) {
    if (ligne.startsWith("#")) continue;
    if (ligne.startsWith("== ")) {
      fin();
      fichier = ligne.slice(3).trim();
    } else if (!ligne.trim()) fin();
    else paire.push(ligne);
    if (paire.length > 2) throw new Error(`Ligne vide manquante (${fichier}) : ${paire.join(" / ")}`);
  }
  fin();
  return table;
}

/** Table de traduction d'une langue (null pour le français). */
export async function tableTraduction(langue) {
  if (langue === "fr") return null;
  return lireTraductions(readFileSync(join(RACINE, "traductions", `${langue}.txt`), "utf8"));
}

/** Options d'esbuild pour une langue : `absents` reçoit les textes à retraduire. */
export async function optionsLangue(langue, surcharges = {}, absents = []) {
  const table = await tableTraduction(langue);
  return optionsApp({ ...surcharges, ...(table ? { plugins: [pluginTraduction(table, absents)] } : {}) });
}

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
export async function texteApp(langue = "fr") {
  const r = await build(await optionsLangue(langue, { minify: true, write: false, outfile: fichierApp(langue) }));
  return r.outputFiles[0].text;
}

/** Construit public/ (une app par langue). Renvoie les avertissements d'esbuild et les textes à retraduire. */
export async function construire() {
  copierSite();
  const avertissements = [],
    absents = [];
  for (const langue of LANGUES) {
    const r = await build(
      await optionsLangue(
        langue,
        { outfile: join(SORTIE, fichierApp(langue)), minify: true, sourcemap: "linked" },
        absents,
      ),
    );
    avertissements.push(...r.warnings);
  }
  return { warnings: avertissements, absents };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--dev")) {
    copierSite();
    const ctx = await context(optionsApp({ outfile: join(SORTIE, "app.js"), sourcemap: "inline" }));
    await ctx.watch();
    // Version anglaise (?lang=en) : traduite une fois au démarrage du serveur de développement.
    await build(await optionsLangue("en", { outfile: join(SORTIE, fichierApp("en")), sourcemap: "inline" }));
    const { port } = await ctx.serve({ servedir: SORTIE, port: 8000 });
    console.log(`App : http://localhost:${port}/app.html (reconstruite à chaque modification de src/)`);
  } else {
    const r = await construire();
    for (const a of r.absents)
      console.warn(
        `Traduction à mettre à jour (texte français introuvable) : ${a.fichier} : « ${a.texte.slice(0, 80)} »`,
      );
    if (r.warnings.length) {
      console.error(`${r.warnings.length} avertissement(s) d'esbuild : à corriger.`);
      process.exit(1);
    }
    console.log("public/ construit.");
  }
}
