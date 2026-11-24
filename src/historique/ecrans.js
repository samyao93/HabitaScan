/* Historique des vérifications et détail d'une vérification. */
import { alerteDe, alertesActives, blocAlerteDetail } from "../alertes/alertes.js";
import { etat } from "../etat.js";
import { HIS } from "./api.js";
import { REGLE_PAIEMENT } from "../memoire/contacts.js";
import { TRAVAUX } from "../renovation/regles.js";
import { esc, money, top } from "../utils/dom.js";
import { lienExt } from "../utils/liens.js";
import { dateCourte, dateLongue, formatLicence, nettoyerHTML } from "../utils/texte.js";

const TITRE_VERDICT = {
  logement: {
    r: "Ne paie pas",
    y: "Visite d'abord, puis vérifie le propriétaire",
    g: "Aucun signal. Tu peux visiter.",
  },
  reno: { r: "Ne signe pas, ne paie pas", y: "Prudence", g: "Aucun signal d'alarme" },
};

const TAG_VERDICT = {
  logement: { r: "Ne paie pas", y: "Visite d'abord", g: "Aucun signal" },
  reno: { r: "Ne pas signer", y: "Prudence", g: "Aucun signal" },
};

const REGLE_VERDICT = {
  logement: {
    r: "N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.",
    y: "Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.",
    g: "Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt.",
  },
  reno: {
    r: "Ne signe rien et ne verse aucun acompte.",
    y: "Vérifie la licence et les plaintes avant de signer.",
    g: "Paie selon l'avancement des travaux, jamais tout d'avance.",
  },
};

const nomTravaux = (k) => (TRAVAUX[k] || { l: "Travaux" }).l.split(/ \(|,/)[0];

function titreVerif(x) {
  return x.module === "reno"
    ? `Réno · ${esc(nomTravaux(x.travaux))}`
    : `${esc(x.ville || "Ville inconnue")} · ${x.ch == 3 ? "3+" : esc(x.ch ?? "?")} ch.`;
}

function sousTitreVerif(x) {
  const p = [dateCourte(x.date)];
  if (x.module === "reno") {
    if (x.licence) p.push(`RBQ ${esc(formatLicence(x.licence))}`);
  } else if (x.prix) p.push(money(+x.prix) + "/mois");
  return p.filter(Boolean).join(" · ");
}

const ligneVerif = (
  x,
) => `<button type="button" class="hrow" data-verif="${esc(x.id)}" aria-label="Voir le détail : ${titreVerif(x).replace(/<[^>]+>/g, "")}">
<span class="hdot ${x.c}"></span><span class="hmain"><b>${titreVerif(x)}</b><small>${sousTitreVerif(x)}</small></span>${alertesActives() && alerteDe(x.id) ? `<span class="tag r">Signalée</span>` : `<span class="tag ${x.c}">${(TAG_VERDICT[x.module] || TAG_VERDICT.logement)[x.c] || ""}</span>`}<span class="chev" aria-hidden="true">›</span></button>`;

/* Carte d'accueil : les 3 dernières, cliquables */
export function blocHistorique() {
  const L = HIS.liste();
  return `<div class="card"><div class="card-tete"><h2>Mes vérifications</h2>${L.length ? `<button type="button" class="lienbtn" data-go="historique">Tout voir${L.length > 3 ? ` (${L.length})` : ""}</button>` : ""}</div>
${L.length ? `<div class="hlist">${L.slice(0, 3).map(ligneVerif).join("")}</div>` : `<div class="vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Chaque annonce que tu vérifies est gardée ici, avec son résultat complet.</p></div>`}</div>`;
}

export function vueHistorique() {
  const L = HIS.liste(),
    f = etat.fiche.hfiltre || "tout";
  const nbL = L.filter((x) => x.module !== "reno").length,
    nbR = L.length - nbL;
  const V = L.filter((x) => f === "tout" || (f === "reno" ? x.module === "reno" : x.module !== "reno"));
  const o = (k, t, n) =>
    `<button type="button" data-hfiltre="${k}" aria-pressed="${f === k}">${t} <span class="num">${n}</span></button>`;
  return `${top("accueil", "Mes vérifications")}
<h1>Mes vérifications</h1><p class="soft">Touche une vérification pour revoir son résultat complet.</p>
${
  L.length
    ? `${nbR ? `<div class="seg seg3" role="group" aria-label="Filtrer">${o("tout", "Toutes", L.length)}${o("logement", "Logement", nbL)}${o("reno", "Réno", nbR)}</div>` : ""}
<div class="card"><div class="hlist">${V.map(ligneVerif).join("") || `<p class="soft">Rien dans cette catégorie.</p>`}</div></div>`
    : `<div class="card vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Vérifie une annonce pour la retrouver ici.</p><button class="btn" data-go="verifier">Vérifier une annonce</button></div>`
}`;
}

export function vueDetailVerif() {
  const x = HIS.liste().find((v) => String(v.id) === String(etat.fiche.verifId));
  const retour = etat.fiche.retourVerif || "historique";
  if (!x)
    return `${top(retour, "Détail")}<div class="card vide"><p><b>Cette vérification n'existe plus.</b></p><button class="btn" data-go="historique">Mes vérifications</button></div>`;
  const m = x.module === "reno" ? "reno" : "logement",
    R = x.raisons || [];
  const ligne = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "");
  const lienOk = x.lien && /^https?:\/\//i.test(x.lien);
  return `${top(retour, "Détail")}
${blocAlerteDetail(x.id)}
<div class="verdict ${x.c}"><strong>${TITRE_VERDICT[m][x.c] || ""}</strong><span>${titreVerif(x)}</span></div>
<div class="card"><h2>Détails</h2><dl class="details">
${ligne("Vérifiée le", esc(dateLongue(x.date)))}
${
  m === "logement"
    ? ligne("Ville", esc(x.ville || "")) +
      ligne("Chambres", x.ch == 3 ? "3 et plus" : esc(x.ch ?? "")) +
      ligne("Loyer demandé", x.prix ? `<span class="num">${money(+x.prix)}</span> par mois` : "") +
      ligne("Annonce", lienOk ? lienExt(esc(x.lien), "Ouvrir l'annonce ↗") : "Aucun lien fourni")
    : ligne("Travaux", esc((TRAVAUX[x.travaux] || { l: "" }).l)) +
      ligne("Licence RBQ", x.licence ? `<span class="num">${esc(formatLicence(x.licence))}</span>` : "Non fournie")
}
${ligne("Référence", `<span class="num">${esc(String(x.id).slice(0, 8).toUpperCase())}</span>`)}
</dl></div>
<div class="card"><h2>Ce que l'app a vérifié</h2>${R.length ? `<ul class="reasons">${R.map((i) => `<li><span class="dot ${esc(i.c)}"></span><div>${nettoyerHTML(i.t)}${i.law ? `<div class="law">${nettoyerHTML(i.law)}</div>` : ""}</div></li>`).join("")}</ul>` : `<p class="soft">Le détail n'a pas été conservé pour cette ancienne vérification.</p>`}</div>
<p class="rule">${REGLE_VERDICT[m][x.c] || ""}</p>${m === "logement" && x.c !== "r" ? `<p class="rule paiement">${REGLE_PAIEMENT}</p>` : ""}
<p class="hint">Résultat calculé le ${esc(dateCourte(x.date))} avec les informations fournies à ce moment. Une annonce peut changer : vérifie-la de nouveau avant de payer.</p>
${m === "logement" ? `<button class="btn" data-go="verifier">Vérifier une autre annonce</button>` : `<button class="btn" data-go="reno">Vérifier un autre entrepreneur</button>`}
<button class="btn ghost danger-txt" id="h-suppr">Retirer de mon historique</button>
<p class="err" id="err" role="alert"></p>`;
}
