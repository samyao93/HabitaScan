// Charge les modules de l'app dans Node, avec un navigateur et un Supabase simulés, pour tester leurs fonctions.
// Renvoie `hs(nom)` : n'importe quel export d'un module de src/ (par exemple hs("calculerBudget")).
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import vm from "node:vm";
import { optionsApp } from "../outils/construire.mjs";

// esbuild est installé avec les outils (outils/node_modules)
const { buildSync } = createRequire(new URL("../outils/package.json", import.meta.url))("esbuild");

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Objet « attrape-tout » : chaque propriété est une fonction qui renvoie un autre attrape-tout. */
function attrapeTout() {
  const f = function () {};
  return new Proxy(f, {
    get(_, p) {
      if (p === "then") return undefined; // n'est pas une promesse
      if (p === Symbol.toPrimitive) return () => "";
      return attrapeTout();
    },
    set() {
      return true;
    },
    apply() {
      return attrapeTout();
    },
  });
}

/** Supabase simulé : toute requête réussit et renvoie { data: null }. */
function supabaseSimule() {
  const mk = () => {
    const f = function () {};
    return new Proxy(f, {
      get(_, p) {
        if (p === "then") return (r) => r({ data: null, error: null, count: 0 });
        return mk();
      },
      apply() {
        return mk();
      },
    });
  };
  return { createClient: () => mk() };
}

export function chargerApp() {
  const stockage = new Map();
  const element = attrapeTout();
  const document = {
    querySelector: () => element,
    querySelectorAll: () => [],
    getElementById: () => element,
    createElement: () => element,
    addEventListener() {},
    head: { insertAdjacentHTML() {}, appendChild() {} },
    body: element,
    documentElement: { dataset: {}, lang: "fr" },
  };
  const window = {
    document,
    location: {
      search: "",
      pathname: "/app",
      hash: "",
      href: "https://habitascan.vercel.app/app",
      origin: "https://habitascan.vercel.app",
    },
    history: { replaceState() {}, pushState() {} },
    navigator: { language: "fr-CA", userAgent: "node", onLine: true },
    localStorage: {
      getItem: (k) => (stockage.has(k) ? stockage.get(k) : null),
      setItem: (k, v) => stockage.set(k, String(v)),
      removeItem: (k) => stockage.delete(k),
    },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    supabase: supabaseSimule(),
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    scrollTo() {},
    setTimeout,
    URL,
    URLSearchParams,
    TextEncoder,
    Intl,
    clearTimeout,
    fetch: async () => ({ ok: false, json: async () => ({}) }),
    hsMarkdown: (s) => String(s),
  };
  window.window = window;
  window.self = window;
  const contexte = vm.createContext(window);
  vm.runInContext(paquetDeTest(), contexte, { filename: "modules-app.js" });
  const modules = contexte.__HS_MODULES;
  return (nom) => {
    if (!(nom in modules)) throw new Error(`« ${nom} » n'est exporté par aucun module de src/`);
    return modules[nom];
  };
}

/** Tous les exports des modules de src/ (sauf main.js, qui démarre l'app), en un seul script. */
function paquetDeTest() {
  const src = join(RACINE, "src");
  const modules = readdirSync(src, { recursive: true })
    .map((f) => String(f).replace(/\\/g, "/"))
    .filter((f) => f.endsWith(".js") && f !== "main.js")
    .sort();
  const r = buildSync(
    optionsApp({
      entryPoints: undefined,
      stdin: {
        contents: modules.map((f) => `export * from "./${f}";`).join("\n"),
        resolveDir: src,
        sourcefile: "tests.js",
      },
      globalName: "__HS_MODULES",
      write: false,
    }),
  );
  return r.outputFiles[0].text;
}
