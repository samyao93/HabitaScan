/* ===== Configuration Supabase (clé publiable : peut être visible dans le navigateur) ===== */
const SUPABASE_URL = "https://oyiiaqyepihkawzkkjpi.supabase.co";
const SUPABASE_KEY = "sb_publishable_LhDVlSvpyM-bkW-QSp0lsw_wgNIsELX";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ROLE = {
  Montréal: "https://montreal.ca/consulter-les-roles-devaluation-fonciere",
  Québec: "https://www.ville.quebec.qc.ca/citoyens/taxes_evaluation/evaluation_fonciere/role/",
};
const REGISTRE = "https://www.quebec.ca/habitation-territoire/achat-vente/recherche-propriete/historique";
/* Seuils à valider avec les tests sur de vraies annonces. */
const BAS = 0.75,
  HAUT = 1.4;
/* Mots repérés dans l'annonce ou la conversation. Un mot seul ne donne jamais de rouge :
   seuls la réponse de l'utilisateur (« oui, on me demande de l'argent ») et les moyens de paiement typiques des fraudes le font.
   Les mots précédés d'une négation (« aucun dépôt », « no deposit ») sont ignorés. */
const MOTS_ARGENT = [
  "dépôt",
  "depot",
  "deposit",
  "acompte",
  "frais de dossier",
  "frais de réservation",
  "frais de reservation",
  "2 mois d'avance",
  "deux mois d'avance",
  "dernier mois d'avance",
  "last month",
];
const MOYENS_FRAUDE = [
  "western union",
  "moneygram",
  "carte-cadeau",
  "carte cadeau",
  "cartes-cadeaux",
  "cartes cadeaux",
  "gift card",
  "bitcoin",
  "crypto",
];
const MOTS_SCENARIO = [
  "à l'étranger",
  "a l'etranger",
  "hors du pays",
  "out of the country",
  "pas de visite",
  "pas possible de visiter",
  "je suis en voyage",
  "missionnaire",
  "clés par la poste",
  "cles par la poste",
  "envoyer les clés",
  "courrier les clés",
  "whatsapp",
  "telegram",
  "beaucoup de demandes",
  "plusieurs personnes intéressées",
  "many people interested",
  "premier arrivé",
  "first come",
];
const NEGATION =
  /(?:\bpas\s+(?:de|d['’]|besoin)|\baucune?\b|\bsans\b|\bno\b|\bnot?\b|\bnon\b|\bjamais\b|\bnever\b|\bwithout\b|\bni\b)[^.!?\n]{0,20}$/i;
/* ===== Profil de l'annonceur (toutes les plateformes ; Facebook bloque la lecture automatique : questions facultatives) ===== */
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
const plateforme = (F) => {
  const t = (F.lien || "") + " " + (F.annonce || "") + " " + (F.ocrTxt || "");
  const p = PLATEFORMES.find((x) => x[0].test(t));
  return p ? { nom: p[1], aide: p[2] } : null;
};
const estFacebook = (F) => {
  const p = plateforme(F);
  return !!p && p.nom === "Facebook";
};
const blocProfil = (F) => {
  const p = plateforme(F);
  return `<details class="profil" ${p || F.pAncien || F.pAmis || F.pPlusieurs || F.pHors ? "open" : ""}><summary>Vérifier le profil de l'annonceur${p ? ` sur ${p.nom}` : ""} (facultatif)</summary>
<p class="hint" style="margin:0">${p ? p.aide : "Sur Facebook, Kijiji, LesPAC ou ailleurs : touche le nom ou la photo de l'annonceur pour ouvrir son profil."}</p>
${yn("pAncien", "Son compte existe depuis plus d'un an ?")}${yn("pAmis", "Son profil a l'air réel (photo, nom complet, publications, évaluations ou autres annonces normales) ?")}${yn("pPlusieurs", "Publie-t-il plusieurs logements, ou dans plusieurs villes ?")}${yn("pHors", "Veut-il continuer la conversation ailleurs (texto, courriel, WhatsApp) dès le début ?")}</details>`;
};
function itemsProfil(F) {
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
const boutonCarte = (F) =>
  F.adr && F.adr.trim()
    ? `<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(F.adr.trim() + (F.ville && F.ville !== "Autre" ? ", " + F.ville : "") + ", QC")}">Voir l'adresse sur Google Maps</a><p class="hint">Avec Street View, compare l'immeuble avec les photos de l'annonce.</p>`
    : "";

function trouverMot(txt, liste) {
  for (const m of liste) {
    let i = txt.indexOf(m);
    while (i >= 0) {
      if (!NEGATION.test(txt.slice(Math.max(0, i - 30), i))) return m;
      i = txt.indexOf(m, i + m.length);
    }
  }
  return null;
}

/* Sites d'annonces connus au Québec. */
const SITES = [
  { d: "facebook.com" },
  { d: "fb.com" },
  { d: "kijiji.ca" },
  { d: "lespac.com" },
  { d: "logisquebec.com" },
  { d: "rentals.ca" },
  { d: "padmapper.com" },
  { d: "centris.ca" },
  { d: "duproprio.com" },
  { d: "zumper.com" },
  { d: "craigslist.org" },
  { d: "liv.rent" },
  { d: "kangalou.com" },
  { d: "louer.ca" },
  { d: "realtor.ca" },
];
/* Lien comparable entre utilisateurs : sans paramètres de suivi, sans fin variable. */
function normaliser(t) {
  const m = String(t || "").match(/https?:\/\/[^\s]+/i);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
    const p = u.pathname.replace(/\/+$/, "");
    const mk = p.match(/\/marketplace\/item\/(\d+)/);
    return mk ? `https://facebook.com/marketplace/item/${mk[1]}` : `https://${h}${p}`.slice(0, 500);
  } catch (e) {
    return null;
  }
}
let LOYERS = {},
  PROFIL = null,
  HIST = [],
  F = {},
  REGISTRE_PRET = false,
  ANONYME = true,
  SESSION = false;
const LS = {
  get: (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
