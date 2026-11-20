// Génère les pages du site /confidentialite et /conditions à partir des écrans de l'app (app.js),
// pour que le texte soit toujours le même dans l'app et sur le site.
// Usage (à la racine du projet) :  node outils/pages-legales.mjs
// Prérequis : Node 22 ou plus récent, et Google Chrome (chemin modifiable avec la variable CHROME).
// À relancer après toute modification des textes juridiques dans app.js.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME =
  process.env.CHROME ||
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "google-chrome");

// 1. Copie de l'app, sans serveur : Supabase est simulé, et une fonction rend un écran à la demande.
const tmp = mkdtempSync(join(tmpdir(), "hs-legal-"));
let js = readFileSync(join(RACINE, "app.js"), "utf8");
const fin = js.lastIndexOf("}");
js = js.slice(0, fin) + "\nwindow.HS_ECRAN=v=>{SESSION=false;go(v);return app.innerHTML};\n" + js.slice(fin);
writeFileSync(join(tmp, "app.js"), js);
writeFileSync(
  join(tmp, "stub.js"),
  'function mk(){const f=function(){};return new Proxy(f,{get(t,p){if(p==="then")return r=>r({data:null,error:null});return mk()},apply(){return mk()}})}window.supabase={createClient:()=>mk()};',
);
for (const f of ["app.css", "theme.js", "icon.svg"]) copyFileSync(join(RACINE, f), join(tmp, f));
const html = readFileSync(join(RACINE, "app.html"), "utf8").replace(
  /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"><\/script>/,
  '<script src="stub.js"></script>',
);
writeFileSync(join(tmp, "app.html"), html);

// 2. Chrome sans interface : rendu des deux écrans.
const port = 9600 + Math.floor(Math.random() * 300);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "hs-chrome-"))}`,
    "--allow-file-access-from-files",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let cible;
for (let i = 0; i < 50 && !cible; i++) {
  try {
    cible = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  } catch {}
  await attendre(200);
}
if (!cible) throw new Error("Chrome ne répond pas. Vérifie le chemin (variable CHROME).");
const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const att = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) {
    att.get(m.id)(m);
    att.delete(m.id);
  }
};
const env = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    att.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
await env("Page.enable");
await env("Page.navigate", { url: pathToFileURL(join(tmp, "app.html")).href });
await attendre(2000);
const rendre = async (v) =>
  (await env("Runtime.evaluate", { expression: `HS_ECRAN(${JSON.stringify(v)})`, returnByValue: true })).result.result
    .value;
const ecrans = { confidentialite: await rendre("confidentialite"), conditions: await rendre("conditions") };
ws.close();
chrome.kill();

// 3. Adaptation au site : sans la barre de l'app, liens internes → pages du site, premier titre en h1.
const adapter = (h) =>
  h
    .replace(/<div class="top">[\s\S]*?<\/div>/, "")
    .replace(/<button[^>]*data-go="(conditions|confidentialite)"[^>]*>([\s\S]*?)<\/button>/g, '<a href="/$1">$2</a>')
    .replace(/<button[\s\S]*?<\/button>/g, "")
    .replace(/<h2>/, "<h1>")
    .replace(/<\/h2>/, "</h1>");

const PAGES = {
  confidentialite: {
    titre: "Politique de confidentialité",
    desc: "Comment HabitaScan recueille, utilise et protège tes renseignements personnels (Loi 25).",
  },
  conditions: {
    titre: "Conditions d'utilisation",
    desc: "Les conditions d'utilisation du site et de l'app HabitaScan.",
  },
};
const NAV =
  '<header class="nav"><div class="wrap"><a class="marque" href="/"><img src="/icon.svg" alt="">HabitaScan</a><nav><a class="cacher" href="/guides/arnaques-courantes">Arnaques courantes</a><a class="cacher" href="/guides/verifier-un-proprietaire">Vérifier un propriétaire</a><a class="cacher" href="/a-propos">Qui sommes-nous</a><a href="/en" lang="en" hreflang="en">English</a><button type="button" class="theme-btn" data-theme-toggle aria-label="Changer de thème"></button><a class="btn sm" href="/app" target="_blank" rel="noopener">Ouvrir l\'app</a></nav></div></header>';
const PIED =
  '<footer><div class="wrap"><span>© 2026 HabitaScan · Fait au Québec</span><span><a href="/">Accueil</a> · <a href="/a-propos">Qui sommes-nous</a> · <a href="/confidentialite">Confidentialité</a> · <a href="/conditions">Conditions d\'utilisation</a> · <a href="/en">English</a></span></div></footer>';
for (const [nom, p] of Object.entries(PAGES)) {
  const page = `<!DOCTYPE html>
<html lang="fr-CA">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.titre} · HabitaScan</title>
<meta name="description" content="${p.desc}">
<link rel="canonical" href="https://habitascan.vercel.app/${nom}">
<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet"><script src="/theme.js"></script><link rel="stylesheet" href="/site.css">
</head>
<body>
<!-- Page générée par outils/pages-legales.mjs à partir de app.js : ne pas modifier à la main. -->
${NAV}
<article class="legal"><p class="fil"><a href="/">Accueil</a> › ${p.titre}</p>
${adapter(ecrans[nom])}
</article>
${PIED}
<script src="/md.js"></script>
<script>
/* Texte modifié dans la console admin (table pages_legales) : remplace le texte d'origine ci-dessus. */
fetch("https://oyiiaqyepihkawzkkjpi.supabase.co/rest/v1/pages_legales?select=contenu&cle=eq.${nom}",{headers:{apikey:"sb_publishable_LhDVlSvpyM-bkW-QSp0lsw_wgNIsELX"}})
.then(r=>r.ok?r.json():[]).then(L=>{if(!L.length||!L[0].contenu||!window.hsMarkdown)return;
 document.querySelector("article.legal").innerHTML='<p class="fil"><a href="/">Accueil</a> › ${p.titre.replace(/'/g, "\\'")}</p>'+hsMarkdown(L[0].contenu,{sections:true})}).catch(()=>{});
</script>
</body>
</html>
`;
  writeFileSync(join(RACINE, `${nom}.html`), page);
  console.log(`${nom}.html écrite`);
}
