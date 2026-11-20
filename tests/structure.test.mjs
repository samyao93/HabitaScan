// Tests de structure : ce qui casse sans bruit si on l'oublie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(join(RACINE, f), "utf8").replace(/\r/g, "");
// espree est installé avec les outils (outils/node_modules)
const espree = createRequire(join(RACINE, "outils", "package.json"))("espree");

test("app.js est bien l'assemblage à jour de src/app/", async () => {
  const { assembler } = await import(new URL("../outils/assembler-app.mjs", import.meta.url));
  assert.equal(lire("app.js"), assembler(), "lance « node outils/assembler-app.mjs » et ajoute app.js au commit");
});

test("aucun nom n'est déclaré deux fois dans les morceaux de l'app", () => {
  // Dans le bloc commun, une seconde fonction du même nom remplace la première sans prévenir
  // (c'est arrivé : memeNom de la rénovation était remplacé par celui du module propriétaire).
  const vus = new Map();
  for (const f of readdirSync(join(RACINE, "src", "app")).sort()) {
    const arbre = espree.parse(lire(`src/app/${f}`), { ecmaVersion: "latest", loc: true });
    for (const n of arbre.body) {
      const noms =
        n.type === "FunctionDeclaration" || n.type === "ClassDeclaration"
          ? [n.id.name]
          : n.type === "VariableDeclaration"
            ? n.declarations.filter((d) => d.id.type === "Identifier").map((d) => d.id.name)
            : [];
      for (const nom of noms) {
        const ici = `${f}:${n.loc.start.line}`;
        assert.ok(!vus.has(nom), `« ${nom} » est déclaré deux fois : ${vus.get(nom)} et ${ici}`);
        vus.set(nom, ici);
      }
    }
  }
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
    "app.js",
    "admin.html",
    "index.html",
    "md.js",
    "theme.js",
    "supabase/schema.sql",
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
