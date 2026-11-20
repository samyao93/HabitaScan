/* Trouver un logement : écran, cartes de résultats, liens vers les sites. */
import { villeDefaut } from "../budget/regles.js";
import { etat } from "../etat.js";
import { FB_VILLES, KIJIJI_LIEUX, lienFacebook, lienKijiji } from "./regles.js";
import { esc, top } from "../utils/dom.js";
import { L_OACIQ, lienExt, urlWeb } from "../utils/liens.js";
import { m0 } from "../utils/texte.js";

export function carteResultat(r, i) {
  return `<article class="annonce"><div class="ann-corps">
${r.exemple ? `<p class="tag-demo">Exemple (démo)</p>` : ""}
<p class="hint">${esc(r.source.n)}${r.age ? ` · ${esc(r.age)}` : ""}</p>
<h3>${r.prix ? `<span class="num">${m0(r.prix)}</span> / mois` : "Prix non lu"}${r.ch ? ` · ${r.ch >= 3 ? "3 ch. et plus" : r.ch + " ch."}` : ""}</h3>
<p>${esc(r.titre || "")}</p>
<ul class="reasons">
${r.alertes.length ? r.alertes.map((a) => `<li><span class="dot y"></span><div>${esc(a)}</div></li>`).join("") : `<li><span class="dot g"></span><div>Aucun signal dans le texte de l'annonce.</div></li>`}
${r.source.courtier ? `<li><span class="dot g"></span><div>Publiée par un courtier immobilier, encadré par l'${lienExt(L_OACIQ, "OACIQ")}.</div></li>` : ""}
${r.prix && r.moy ? `<li><span class="dot i"></span><div>Loyer moyen SCHL ici : ${m0(r.moy)}.</div></li>` : ""}</ul>
${r.exemple ? `<button class="btn" data-verif="${i}">Vérifier</button>` : `<div class="grid2"><a class="btn ghost lienbouton" href="${urlWeb(r.url) ? esc(r.url) : "#"}" target="_blank" rel="noopener">Ouvrir</a><button class="btn" data-verif="${i}">Vérifier</button></div>`}
</div></article>`;
}

export function liensSites(f) {
  const ch = f.ch === "3" ? "3 chambres" : f.ch ? f.ch + " chambres" : "";
  const taille = f.ch ? `${+f.ch + 2} 1/2 ` : "";
  const q = `${taille}à louer ${ch} ${f.ville}`.replace(/\s+/g, " ").trim();
  const g = (site) => `https://www.google.com/search?q=${encodeURIComponent(q + " site:" + site)}&tbs=qdr:w`;
  const crit = [f.ville, f.ch ? (f.ch === "3" ? "3 ch. et plus" : f.ch + " ch.") : "", f.max ? "max " + m0(+f.max) : ""]
    .filter(Boolean)
    .join(" · ");
  const kj = lienKijiji(f),
    reg = KIJIJI_LIEUX[f.ville] && KIJIJI_LIEUX[f.ville][2];
  const lien = (href, nom, sous) =>
    `<a class="btn ghost lienbouton" href="${urlWeb(href) ? esc(href) : "#"}" target="_blank" rel="noopener">${nom}<small>${sous}</small></a>`;
  return `<div class="card"><h2>Chercher aussi directement</h2><p class="hint">Kijiji s'ouvre avec tes critères (${esc(crit)}) déjà appliqués ; pour les autres sites, ajoute-les dans leurs filtres. Trouve une annonce, puis reviens la vérifier.</p>
<div class="choix-accueil sites">
${lien(lienFacebook(f), "Facebook Marketplace", `${FB_VILLES[f.ville] ? "Ajoute" : "Choisis " + esc(f.ville) + ", puis ajoute"} dans les filtres : ${esc([f.ch ? (f.ch === "3" ? "3 ch. et plus" : f.ch + " ch.") : "", f.max ? "max " + m0(+f.max) : ""].filter(Boolean).join(" · ") || "tes critères")}`)}
${kj ? lien(kj, "Kijiji", `${reg ? "Région " + esc(reg) : esc(f.ville)} · filtres déjà appliqués`) : lien(g("kijiji.ca"), "Kijiji", "Annonces des 7 derniers jours")}
${[
  ["centris.ca", "Centris (courtiers)"],
  ["kangalou.com", "Kangalou"],
  ["logisquebec.com", "LogisQuébec"],
  ["louer.ca", "Louer.ca"],
  ["lespac.com", "LesPAC"],
]
  .map(([d, n]) => lien(g(d), n, `${esc(taille.trim() || "Logements")} à ${esc(f.ville)} · 7 derniers jours`))
  .join("")}
</div></div>`;
}

export function vueTrouver(F, back) {
  const f = F.filtre || (F.filtre = { ville: villeDefaut(), ch: "", max: "" });
  return `${top(back, "Trouver")}
<h2>Trouver un logement</h2>
<p class="soft">L'app cherche les annonces récentes sur Kijiji, Centris, Kangalou et d'autres sites, retire celles hors budget et signale ce qui cloche.</p>
<form class="card" id="f-tr" novalidate>
<div class="grid2"><label>Ville<select id="t-ville">${Object.keys(etat.loyers)
    .map((v) => `<option ${f.ville === v ? "selected" : ""}>${v}</option>`)
    .join("")}</select></label>
<label>Chambres<select id="t-ch"><option value="">Toutes</option>${["1", "2", "3"].map((v) => `<option value="${v}" ${f.ch === v ? "selected" : ""}>${v === "3" ? "3 et plus" : v}</option>`).join("")}</select></label></div>
<label>Budget maximum par mois<input id="t-max" inputmode="numeric" placeholder="1 400" value="${f.max ? esc(f.max) : ""}"></label>
${!F.B ? `<p class="hint">Tu ne sais pas combien tu peux payer ? <button type="button" class="lienbtn" data-go="budget">Calcule ton budget</button></p>` : ""}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Chercher</button></form>
<div id="liste" aria-live="polite">${F.resultats ? "" : ""}</div>
<div id="sites"></div>`;
}
