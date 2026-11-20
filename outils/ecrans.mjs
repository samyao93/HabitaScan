// Ouvre l'app dans Chrome sans interface (Supabase simulé, aucun appel réseau) et rend chaque écran.
// Sert à deux choses :
//  - test automatique : l'app se charge sans erreur et chaque écran s'affiche (tests/ecrans.test.mjs) ;
//  - comparaison avant/après une réorganisation du code : `node outils/ecrans.mjs sortie.json` écrit le HTML
//    de chaque écran, à comparer avec celui d'une autre version.
// Prérequis : Node 22 ou plus récent, et Google Chrome (chemin modifiable avec la variable CHROME).
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { optionsApp } from "./construire.mjs";

export const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

export function cheminChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidats =
    process.platform === "win32"
      ? [
          "C:/Program Files/Google/Chrome/Application/chrome.exe",
          "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        ]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
        : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return candidats.find((c) => existsSync(c)) || null;
}

/** Scripts locaux chargés par app.html, dans l'ordre. */
export function scriptsApp() {
  const html = readFileSync(join(RACINE, "app.html"), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
}

// Supabase simulé : toute méthode renvoie un objet qui accepte n'importe quel appel, et « await » donne { data: null }.
const STUB =
  'function mk(){const f=function(){};return new Proxy(f,{get(t,p){if(p==="then")return r=>r({data:null,error:null});return mk()},apply(){return mk()}})}window.supabase={createClient:()=>mk()};';

/**
 * Prépare une copie de l'app dans un dossier temporaire, l'ouvre dans Chrome et exécute `travail(evaluer)`.
 * `extra` : code (module ES, chemins relatifs à src/) exécuté après le démarrage de l'app ; il peut importer
 * n'importe quel module de l'app pour l'observer.
 */
export async function avecApp(travail, extra = "") {
  const chrome = cheminChrome();
  if (!chrome) throw new Error("Google Chrome introuvable (variable CHROME).");
  const tmp = mkdtempSync(join(tmpdir(), "hs-app-"));
  for (const f of [...scriptsApp().filter((s) => s !== "app.js"), "app.css", "theme.js", "icon.svg"]) {
    mkdirSync(dirname(join(tmp, f)), { recursive: true });
    copyFileSync(join(RACINE, f), join(tmp, f));
  }
  // L'app construite comme en production, avec en plus le code d'observation
  await build(
    optionsApp({
      entryPoints: undefined,
      stdin: {
        contents: `import "./main.js";\n${extra}`,
        resolveDir: join(RACINE, "src"),
        sourcefile: "observation.js",
      },
      outfile: join(tmp, "app.js"),
    }),
  );
  writeFileSync(join(tmp, "stub.js"), STUB);
  const html = readFileSync(join(RACINE, "app.html"), "utf8").replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"><\/script>/,
    '<script src="stub.js"></script>',
  );
  writeFileSync(join(tmp, "app.html"), html);

  const port = 9300 + Math.floor(Math.random() * 600);
  const profil = mkdtempSync(join(tmpdir(), "hs-chrome-"));
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profil}`,
      "--allow-file-access-from-files",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    let cible;
    for (let i = 0; i < 75 && !cible; i++) {
      try {
        cible = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
      } catch {
        /* Chrome démarre */
      }
      if (!cible) await attendre(200);
    }
    if (!cible) throw new Error("Chrome ne répond pas.");
    const ws = new WebSocket(cible.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const attente = new Map(),
      erreurs = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && attente.has(m.id)) {
        attente.get(m.id)(m);
        attente.delete(m.id);
      }
      if (m.method === "Runtime.exceptionThrown")
        erreurs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    };
    const envoyer = (method, params = {}) =>
      new Promise((r) => {
        const i = ++id;
        attente.set(i, r);
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    await envoyer("Runtime.enable");
    await envoyer("Page.enable");
    await envoyer("Page.navigate", { url: pathToFileURL(join(tmp, "app.html")).href });
    await attendre(2500);
    const evaluer = async (expr) => {
      const r = await envoyer("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || "erreur");
      return r.result.result.value;
    };
    const resultat = await travail(evaluer, erreurs);
    ws.close();
    return resultat;
  } finally {
    proc.kill();
    await attendre(300);
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* fichiers encore ouverts */
    }
  }
}

/** HTML de chaque écran (clés de V), sans session puis avec une session simulée. */
export async function rendreEcrans() {
  const extra = `import { etat } from "./etat.js";
import { go } from "./navigation/routeur.js";
import { V } from "./navigation/ecrans.js";
import { app } from "./utils/dom.js";
window.HS_ECRANS = () => Object.keys(V);
window.HS_ECRAN = (v, session) => {
  etat.session = session;
  try {
    go(v);
    return app.innerHTML;
  } catch (e) {
    return "ERREUR : " + e.message;
  }
};`;
  return avecApp(async (evaluer, erreurs) => {
    const ecrans = await evaluer("HS_ECRANS()");
    const sortie = { erreursChargement: [...erreurs], sansSession: {}, avecSession: {} };
    for (const v of ecrans) sortie.sansSession[v] = await evaluer(`HS_ECRAN(${JSON.stringify(v)},false)`);
    for (const v of ecrans)
      sortie.avecSession[v] = await evaluer(
        `HS_ECRAN(${JSON.stringify(v)},{user:{id:"00000000-0000-0000-0000-000000000000",email:"test@example.com"}})`,
      );
    sortie.erreursRendu = erreurs.slice(sortie.erreursChargement.length);
    return sortie;
  }, extra);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sortie = await rendreEcrans();
  const n = Object.keys(sortie.sansSession).length;
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(sortie, null, 1));
  console.log(
    `${n} écrans rendus ; erreurs au chargement : ${sortie.erreursChargement.length} ; erreurs au rendu : ${sortie.erreursRendu.length}`,
  );
  for (const e of [...sortie.erreursChargement, ...sortie.erreursRendu]) console.log(" -", e.split("\n")[0]);
}
