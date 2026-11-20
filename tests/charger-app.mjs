// Charge app.js dans Node, avec un navigateur et un Supabase simulés, pour tester ses fonctions une par une.
// Tout le code de l'app est dans un bloc { … } : on y ajoute à la fin une petite fonction `__HS(nom)` qui
// renvoie n'importe quelle variable ou fonction de l'app (par exemple __HS("calculerBudget")).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

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
  const js = readFileSync(join(RACINE, "app.js"), "utf8");
  const fin = js.lastIndexOf("}");
  // eval direct : voit les variables du bloc de l'app.
  const code = js.slice(0, fin) + "\nglobalThis.__HS = (nom) => eval(nom);\n" + js.slice(fin);
  vm.runInContext(code, contexte, { filename: "app.js" });
  return contexte.__HS;
}
