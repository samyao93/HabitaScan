// Génère les pages du site /confidentialite et /conditions à partir des écrans de l'app (src/legal/),
// pour que le texte d'origine soit le même dans l'app et sur le site.
// Usage (à la racine du projet) :  node outils/pages-legales.mjs
// Prérequis : Node 22 ou plus récent, et Google Chrome (chemin modifiable avec la variable CHROME).
// À relancer après toute modification des textes d'origine dans src/legal/confidentialite.js ou src/legal/conditions.js.
// (Les versions modifiées dans la console admin s'affichent par-dessus, sans relancer cet outil.)
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { RACINE, rendreEcrans } from "./ecrans.mjs";

// 1. Rendu des deux écrans dans Chrome sans interface (Supabase simulé, comme pour les tests)
const rendu = await rendreEcrans();
const ecrans = { confidentialite: rendu.sansSession.confidentialite, conditions: rendu.sansSession.conditions };

// 2. Adaptation au site : sans la barre de l'app, liens internes → pages du site, premier titre en h1.
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
<!-- Page générée par outils/pages-legales.mjs à partir de src/legal/ : ne pas modifier à la main. -->
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
