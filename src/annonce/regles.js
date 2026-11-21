/* Règles de lecture d'une annonce : mots d'argent, moyens de paiement et scénarios d'arnaque, négations, sites reconnus. */

/* Mots repérés dans l'annonce ou la conversation. Un mot seul ne donne jamais de rouge :
   seuls la réponse de l'utilisateur (« oui, on me demande de l'argent ») et les moyens de paiement typiques des fraudes le font.
   Les mots précédés d'une négation (« aucun dépôt », « no deposit ») sont ignorés. */
export const MOTS_ARGENT = [
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

export const MOYENS_FRAUDE = [
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

export const MOTS_SCENARIO = [
  "à l'étranger",
  "a l'etranger",
  "hors du pays",
  "out of the country",
  "overseas",
  "abroad",
  "pas de visite",
  "pas possible de visiter",
  "je suis en voyage",
  "missionnaire",
  "clés par la poste",
  "cles par la poste",
  "envoyer les clés",
  "courrier les clés",
  "keys by mail",
  "mail you the keys",
  "no viewing",
  "whatsapp",
  "telegram",
  "beaucoup de demandes",
  "plusieurs personnes intéressées",
  "many people interested",
  "premier arrivé",
  "first come",
];

export const NEGATION =
  /(?:\bpas\s+(?:de|d['’]|besoin)|\baucune?\b|\bsans\b|\bno\b|\bnot?\b|\bnon\b|\bjamais\b|\bnever\b|\bwithout\b|\bni\b)[^.!?\n]{0,20}$/i;

export function trouverMot(txt, liste) {
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
export const SITES = [
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
export function normaliser(t) {
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
