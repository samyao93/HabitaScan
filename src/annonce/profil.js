/* Profil de l'annonceur sur chaque plateforme : questions et signaux. */
import { yn } from "../utils/dom.js";

const PLATEFORMES = [
  [
    /facebook\.com|fb\.com|fb\.me|marketplace|messenger/i,
    "Facebook",
    "Touche le nom de la personne dans l'annonce, puis « À propos ».",
  ],
  [/kijiji/i, "Kijiji", "Touche le nom de l'annonceur pour ouvrir son profil et voir ses autres annonces."],
  [/lespac/i, "LesPAC", "Touche le nom de l'annonceur pour ouvrir son profil et voir ses autres annonces."],
  [
    /craigslist/i,
    "Craigslist",
    "Craigslist n'affiche pas de profil : réponds seulement aux questions que tu peux vérifier.",
  ],
  [
    /instagram|tiktok/i,
    "un réseau social",
    "Ouvre le profil du compte : regarde depuis quand il publie et ce qu'il publie.",
  ],
];

export const plateforme = (F) => {
  const t = (F.lien || "") + " " + (F.annonce || "") + " " + (F.ocrTxt || "");
  const p = PLATEFORMES.find((x) => x[0].test(t));
  return p ? { nom: p[1], aide: p[2] } : null;
};

export const blocProfil = (F) => {
  const p = plateforme(F);
  return `<details class="profil" ${p || F.pAncien || F.pAmis || F.pPlusieurs || F.pHors ? "open" : ""}><summary>Vérifier le profil de l'annonceur${p ? ` sur ${p.nom}` : ""} (facultatif)</summary>
<p class="hint" style="margin:0">${p ? p.aide : "Sur Facebook, Kijiji, LesPAC ou ailleurs : touche le nom ou la photo de l'annonceur pour ouvrir son profil."}</p>
${yn("pAncien", "Son compte existe depuis plus d'un an ?")}${yn("pAmis", "Son profil a l'air réel (photo, nom complet, publications, évaluations ou autres annonces normales) ?")}${yn("pPlusieurs", "Publie-t-il plusieurs logements, ou dans plusieurs villes ?")}${yn("pHors", "Veut-il continuer la conversation ailleurs (texto, courriel, WhatsApp) dès le début ?")}</details>`;
};

export function itemsProfil(F) {
  const it = [];
  if (F.pAncien === "non")
    it.push({ c: "y", t: "<b>Compte de moins d'un an.</b> Les faux profils sont souvent récents." });
  if (F.pAmis === "non") it.push({ c: "y", t: "<b>Profil vide ou impersonnel.</b> C'est typique d'un faux compte." });
  if (F.pPlusieurs === "oui")
    it.push({
      c: "y",
      t: "<b>Plusieurs logements ou plusieurs villes.</b> Un particulier en loue rarement autant : vérifie qu'il s'agit d'une vraie entreprise de gestion.",
    });
  if (F.pHors === "oui")
    it.push({
      c: "y",
      t: "<b>Il veut quitter la plateforme dès le début.</b> Ailleurs, tu ne peux plus signaler ses messages à la plateforme. Garde la conversation sur la plateforme jusqu'à la visite.",
    });
  if (F.pAncien === "oui" && F.pAmis === "oui" && F.pPlusieurs === "non" && F.pHors !== "oui")
    it.push({ c: "g", t: "Profil d'apparence normale. Attention : un vieux compte peut avoir été piraté." });
  else if (!it.length && !F.pAncien && !F.pAmis && !F.pPlusieurs && !F.pHors) {
    const p = plateforme(F);
    if (p)
      it.push({
        c: "i",
        t: `Annonce ${p.nom === "un réseau social" ? "sur un réseau social" : p.nom} : réponds aux questions sur le profil de l'annonceur pour une vérification plus complète.`,
      });
  }
  return it;
}

export const boutonCarte = (F) =>
  F.adr && F.adr.trim()
    ? `<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(F.adr.trim() + (F.ville && F.ville !== "Autre" ? ", " + F.ville : "") + ", QC")}">Voir l'adresse sur Google Maps</a><p class="hint">Avec Street View, compare l'immeuble avec les photos de l'annonce.</p>`
    : "";
