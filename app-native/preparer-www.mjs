// Copie l'app web (dossier parent) dans www/ pour Capacitor.
// - L'app est construite à partir de src/ (outils/construire.mjs) : installer d'abord les outils (cd outils && npm install).
// - Supabase est intégré (pas de chargement depuis Internet au démarrage).
// - Les liens vers le site public deviennent des adresses complètes : ils s'ouvrent dans le navigateur du téléphone.
// - Pas de service worker ni de manifeste : inutiles dans une app native.
import { mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { texteApp } from "../outils/construire.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const web = join(ici, "..");
const www = join(ici, "www");
const SITE = "https://habitascan.vercel.app";

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, "vendor"), { recursive: true });

for (const f of ["app.css", "theme.js", "md.js", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"]) copyFileSync(join(web, f), join(www, f));
copyFileSync(join(ici, "node_modules/@supabase/supabase-js/dist/umd/supabase.js"), join(www, "vendor/supabase.js"));

let js = await texteApp();
const avant = js;
js = js.replace(/href="\/(?!\/)/g, `href="${SITE}/`);
if (js === avant) console.warn("Aucun lien relatif trouvé dans app.js (vérifier).");
writeFileSync(join(www, "app.js"), js);

let html = readFileSync(join(web, "app.html"), "utf8");
const remplacements = [
  [/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^"]+"><\/script>/, '<script src="vendor/supabase.js"></script>'],
  [/<link rel="manifest"[^>]*>/, ""],
  [/<meta name="viewport" content="width=device-width, initial-scale=1">/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'],
];
for (const [motif, par] of remplacements) {
  if (!motif.test(html)) throw new Error("Motif introuvable dans app.html : " + motif);
  html = html.replace(motif, par);
}
html = html.replace("<html ", '<html data-natif="1" ');
writeFileSync(join(www, "index.html"), html);
console.log("www/ prêt.");
