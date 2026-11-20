// Tests de structure : ce qui casse sans bruit si on l'oublie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { optionsApp, FICHIERS_SITE } from "../outils/construire.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(RACINE, f), "utf8").replace(/\r/g, "");
const { buildSync } = createRequire(new URL("../outils/package.json", import.meta.url))("esbuild");
const modulesApp = readdirSync(join(RACINE, "src"), { recursive: true })
  .map((f) => String(f).replace(/\\/g, "/"))
  .filter((f) => f.endsWith(".js"));
const LIGNES_MAX = 300;

test("l'app se construit sans erreur ni avertissement", () => {
  const r = buildSync(optionsApp({ write: false, outfile: "app.js", logLevel: "silent" }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.warnings.map((w) => w.text),
    [],
  );
  assert.ok(r.outputFiles[0].text.length > 50000);
});

test(`aucun module de l'app ne dépasse ${LIGNES_MAX} lignes`, () => {
  for (const f of modulesApp) {
    const n = lire(`src/${f}`).split("\n").length;
    assert.ok(n <= LIGNES_MAX, `src/${f} fait ${n} lignes : à découper par responsabilité`);
  }
});

test("chaque module est importé (pas de fichier oublié)", () => {
  const r = buildSync(optionsApp({ write: false, outfile: "app.js", metafile: true, logLevel: "silent" }));
  const inclus = new Set(Object.keys(r.metafile.inputs).map((f) => f.replace(/\\/g, "/").replace(/^.*?src\//, "")));
  for (const f of modulesApp) assert.ok(inclus.has(f), `src/${f} n'est importé par aucun module`);
});

test("les fichiers construits ne sont pas dans le dépôt", () => {
  let suivis = "";
  try {
    suivis = execFileSync("git", ["ls-files", "app.js", "public"], { cwd: RACINE, encoding: "utf8" });
  } catch {
    return; // pas de dépôt git (copie du projet) : rien à vérifier
  }
  assert.equal(suivis.trim(), "", "app.js et public/ sont construits par outils/construire.mjs, pas ajoutés au dépôt");
});

test("chaque fichier du site à publier existe", () => {
  for (const f of FICHIERS_SITE) assert.ok(existsSync(join(RACINE, f)), `${f} manque`);
});

test("le cache hors ligne (sw.js) contient chaque script de l'app", () => {
  const scripts = [...lire("app.html").matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => m[1])
    .filter((s) => !/^https?:/.test(s));
  const sw = lire("sw.js");
  for (const s of scripts) assert.ok(sw.includes(`"./${s}"`), `${s} manque dans la liste FILES de sw.js`);
});

test("l'app mobile copie chaque script de l'app", () => {
  const scripts = [...lire("app.html").matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((m) => m[1])
    .filter((s) => !/^https?:/.test(s) && s !== "app.js");
  const preparer = lire("app-native/preparer-www.mjs");
  for (const s of scripts)
    assert.ok(preparer.includes(`"${s}"`), `${s} n'est pas copié par app-native/preparer-www.mjs`);
});

test("chaque fonction serveur de Supabase est dans le dépôt et utilise le module commun", () => {
  const dossier = join(RACINE, "supabase", "functions");
  const fonctions = readdirSync(dossier).filter((d) => !d.startsWith("_") && existsSync(join(dossier, d, "index.ts")));
  assert.ok(fonctions.length >= 9, `fonctions trouvées : ${fonctions.join(", ")}`);
  for (const f of fonctions) {
    const code = lire(`supabase/functions/${f}/index.ts`);
    assert.ok(code.includes('from "../_shared/commun.ts"'), `${f} n'utilise pas ../_shared/commun.ts`);
    assert.ok(!/"Access-Control-Allow-Origin":\s*"\*"/.test(code), `${f} autorise encore toutes les origines`);
  }
});

test("aucune clé secrète dans le code", () => {
  const fichiers = [
    "admin.html",
    "index.html",
    "md.js",
    "theme.js",
    "supabase/schema.sql",
    ...modulesApp.map((f) => `src/${f}`),
    ...readdirSync(join(RACINE, "supabase", "functions"), { recursive: true })
      .filter((f) => String(f).endsWith(".ts"))
      .map((f) => `supabase/functions/${f}`.replace(/\\/g, "/")),
  ];
  const MOTIFS = [
    [/sk-ant-[A-Za-z0-9_-]{20,}/, "clé Anthropic"],
    [/tvly-[A-Za-z0-9_-]{10,}/, "clé Tavily"],
    [/AIza[0-9A-Za-z_-]{30,}/, "clé Google"],
    [/sb_secret_[A-Za-z0-9_-]{10,}/, "clé secrète Supabase"],
    [/whsec_[A-Za-z0-9]{10,}/, "secret Stripe"],
    [/sk_live_[A-Za-z0-9]{10,}/, "clé Stripe"],
    [/"role"\s*:\s*"service_role"/, "jeton service_role"],
  ];
  for (const f of fichiers) for (const [re, nom] of MOTIFS) assert.ok(!re.test(lire(f)), `${nom} trouvée dans ${f}`);
});
