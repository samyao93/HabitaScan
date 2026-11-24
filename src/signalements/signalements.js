/* Signalements d'annonces : motifs, seuils, écran et validation. */
import { peutSignaler, resumeSignal } from "../memoire/memoire.js";
import { $, app, top } from "../utils/dom.js";

export const MOTIFS = {
  argent_avant_bail: "On m'a demandé de l'argent avant le bail",
  faux_proprietaire: "La personne n'est pas le vrai propriétaire",
  logement_inexistant: "Le logement n'existe pas ou n'est pas à louer",
  photos_volees: "Les photos viennent d'une autre annonce",
  autre: "Autre raison",
};

/* Seuils de départ, à ajuster après les premiers tests. */
export const SEUIL_JAUNE = 1,
  SEUIL_ROUGE = 3;

export function itemSignalements(n) {
  if (!n) return null;
  return n >= SEUIL_ROUGE
    ? { c: "r", t: `<b>Annonce signalée ${n} fois</b> par des utilisateurs à l'identité confirmée.` }
    : {
        c: "y",
        t: `<b>Annonce signalée ${n} fois</b> par ${n > 1 ? "des utilisateurs" : "un utilisateur"} à l'identité confirmée. Redouble de prudence.`,
      };
}

export const vueSignaler = (F, retour) => `${top(retour, "Signaler")}
<h2>Signaler cette annonce</h2><p class="soft">Ton signalement prévient les prochaines personnes qui vérifient la même annonce, le même numéro ou les mêmes photos. Ton nom n'est jamais montré.</p>${resumeSignal(F)}
<form class="card" id="f-sig" novalidate>
<div class="q">Qu'est-ce qui s'est passé ?<div class="choix" role="radiogroup" aria-label="Raison">${Object.entries(
  MOTIFS,
)
  .map(([k, l]) => `<button type="button" data-motif="${k}" aria-pressed="${F.motif === k}">${l}</button>`)
  .join("")}</div></div>
<label>Code postal du logement (facultatif)<input id="cp" autocomplete="off" autocapitalize="characters" maxlength="7" placeholder="Ex. H2X 1Y4" value="${F.cp || ""}"></label>
<p class="hint" style="margin-top:-6px">Seuls les 3 premiers caractères (ex. H2X) sont gardés, pour la <a href="/carte" target="_blank" rel="noopener">carte des arnaques par quartier</a>. Un secteur n'y apparaît qu'à partir de 3 personnes différentes.</p>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="bonnefoi" style="width:22px;min-height:22px;margin-top:2px">Je signale de bonne foi, à partir de ce que j'ai vécu.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer le signalement</button></form>
<p class="hint">Un faux signalement peut causer du tort à une personne honnête. Seuls les comptes à l'identité confirmée peuvent signaler.</p>`;

export function lierSignaler(F) {
  app.querySelectorAll("[data-motif]").forEach(
    (b) =>
      (b.onclick = () => {
        F.motif = b.dataset.motif;
        app.querySelectorAll("[data-motif]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      }),
  );
}

/** Secteur (RTA) : les 3 premiers caractères d'un code postal du Québec, ou "" si absent ou invalide. */
export function rtaDe(texte) {
  const r = String(texte || "")
    .replace(/\s/g, "")
    .toUpperCase()
    .slice(0, 3);
  return /^[GHJ][0-9][A-Z]$/.test(r) ? r : "";
}

export function validerSignal(F) {
  if (!F.motif) return "Choisis une raison.";
  const cp = $("#cp") ? $("#cp").value.trim() : "";
  if (cp && !rtaDe(cp))
    return "Le code postal doit être celui d'un logement au Québec (ex. H2X 1Y4), ou laisse la case vide.";
  if (!$("#bonnefoi").checked) return "Coche la case pour confirmer.";
  return "";
}

export const vueSignalOk = () => `${top(null, "Merci")}
<svg class="seal" role="img" aria-label="Signalement reçu"><use href="#seal"/></svg>
<h1>Signalement reçu</h1><p class="soft">Les prochaines personnes qui vérifient cette annonce, ce numéro ou ces photos verront l'avertissement. Plus nous sommes nombreux, plus l'app devient fiable.</p>
<button class="btn" data-go="accueil">Retour à l'accueil</button>`;

export const boutonSignaler = (F) =>
  peutSignaler(F)
    ? `<button class="btn ghost" id="signaler">Signaler cette annonce comme frauduleuse</button>`
    : `<p class="hint">Pour pouvoir signaler cette annonce, ajoute son lien, le téléphone de l'annonceur ou une capture.</p>`;
