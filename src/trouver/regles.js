/* Trouver un logement : sources, lecture du prix et des chambres, tri, liens Kijiji et Facebook. */
import { CFG } from "../admin/parametres.js";
import { loyerSchl } from "../prix/reference.js";
import { sb } from "../config.js";
import { m0, sansAccents } from "../utils/texte.js";

// Sites où l'app cherche. « courtier » : annonce publiée par un courtier immobilier, encadré par l'OACIQ.
export const SOURCES = [
  { d: "kijiji.ca", n: "Kijiji" },
  { d: "centris.ca", n: "Centris", courtier: true },
  { d: "realtor.ca", n: "REALTOR.ca", courtier: true },
  { d: "duproprio.com", n: "DuProprio" },
  { d: "rentals.ca", n: "Rentals.ca" },
  { d: "louer.ca", n: "Louer.ca" },
  { d: "kangalou.com", n: "Kangalou" },
  { d: "logisquebec.com", n: "LogisQuébec" },
  { d: "padmapper.com", n: "PadMapper" },
  { d: "lespac.com", n: "LesPAC" },
  { d: "zumper.com", n: "Zumper" },
  { d: "craigslist.org", n: "Craigslist" },
];

export const source = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^(www|m|fr|en)\./, "");
    return SOURCES.find((s) => h === s.d || h.endsWith("." + s.d));
  } catch (e) {
    return null;
  }
};

export const estAnnonce = (u) => {
  try {
    const x = new URL(u),
      p = x.pathname;
    if (/\/b-|\/search|\/recherche/i.test(p)) return false;
    return /\/v-/.test(p) || /\d{5,}/.test(p);
  } catch (e) {
    return false;
  }
};

export function lirePrix(t) {
  const m = String(t)
    .replace(/ | /g, " ")
    .match(/(?:\$\s?(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?)|(?:(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?\s?\$)/);
  if (!m) return null;
  const n = parseInt((m[1] || m[2]).replace(/[ ,]/g, ""), 10);
  return n >= 300 && n <= 8000 ? n : null;
}

export function lireChambres(t) {
  t = sansAccents(t);
  let m = t.match(/(\d)\s*(?:chambres?|ch\b|cac|bedrooms?|bdr|br\b)/);
  if (m) return Math.min(+m[1], 3);
  m = t.match(/\b([3-7])\s*(?:1\/2|½|\.5|,5|et demi)/);
  if (m) return Math.max(1, Math.min(+m[1] - 2, 3));
  if (/studio|bachelor|\b[12] ?(?:1\/2|½)/.test(t)) return 0;
  return null;
}

export const ALERTES_EXTRAIT = [
  [/western union|moneygram|carte[s]? cadeau|gift card|bitcoin|crypto/, "Paiement typique des fraudes mentionné"],
  [/(?<!aucun |pas de |sans |no |zero )(depot|deposit)/, "Un dépôt est mentionné : il est interdit (art. 1904 C.c.Q.)"],
  [/whatsapp|telegram/, "Contact par WhatsApp ou Telegram demandé"],
  [/a l'etranger|hors du pays|out of (the )?country|je suis (en|au) (mission|voyage)/, "Propriétaire « à l'étranger »"],
];

export function trierResultats(res, f) {
  const vus = new Set();
  const sortie = [];
  for (const r of res) {
    const s = source(r.url);
    if (!s || !estAnnonce(r.url)) continue;
    const cle = r.url.split(/[?#]/)[0];
    if (vus.has(cle)) continue;
    vus.add(cle);
    const txt = `${r.titre || ""} ${r.extrait || ""}`;
    const prix = lirePrix(txt),
      ch = lireChambres(txt);
    if (f.max && prix && prix > f.max) continue;
    if (f.ch && ch != null && (f.ch === "3" ? ch < 3 : ch != +f.ch)) continue;
    const ref = loyerSchl(f.ville, ch ?? (f.ch || 1)),
      moy = ref ? ref.loyer : 0;
    const t = sansAccents(txt);
    const alertes = ALERTES_EXTRAIT.filter(([re]) => re.test(t)).map((a) => a[1]);
    if (prix && moy && prix < moy * 0.6)
      alertes.push(
        `Prix très bas pour la ville (loyer ${ref && ref.stat} SCHL ${m0(moy)}) : vérifie-la avant tout contact`,
      );
    sortie.push({ ...r, url: cle, source: s, prix, ch, moy, alertes });
  }
  return sortie.sort(
    (a, b) =>
      a.alertes.length - b.alertes.length ||
      (b.source.courtier ? 1 : 0) - (a.source.courtier ? 1 : 0) ||
      (a.prix || 99999) - (b.prix || 99999),
  );
}

/* Liens vers les sites, avec les critères du formulaire déjà appliqués quand le site le permet.
   Kijiji : adresses vérifiées (catégorie appartements c37, lieu, ?numberbedrooms=, ?price=__max).
   Facebook Marketplace : n'applique pas les filtres passés dans l'adresse ; on affiche les critères à reporter. */
export const KIJIJI_LIEUX = {
  Montréal: ["ville-de-montreal", "l1700281"],
  Québec: ["ville-de-quebec", "l1700124"],
  Gatineau: ["gatineau", "l1700186"],
  Sherbrooke: ["sherbrooke-qc", "l1700156"],
  Saguenay: ["saguenay-lac-saint-jean", "l1700178", "Saguenay–Lac-Saint-Jean"],
  Rimouski: ["rimouski-bas-st-laurent", "l1700250", "Bas-Saint-Laurent"],
  "Rivière-du-Loup": ["rimouski-bas-st-laurent", "l1700250", "Bas-Saint-Laurent"],
  "Trois-Rivières": ["mauricie", "l1700147", "Mauricie"],
  Drummondville: ["centre-du-quebec", "l1700121", "Centre-du-Québec"],
};

export const FB_VILLES = { Montréal: "montreal" };

export function lienKijiji(f) {
  const l = KIJIJI_LIEUX[f.ville];
  if (!l) return null;
  const p = new URLSearchParams();
  if (f.ch) p.set("numberbedrooms", f.ch === "3" ? "3,4" : f.ch);
  if (f.max) p.set("price", "__" + f.max);
  const q = p.toString();
  return `https://www.kijiji.ca/b-appartement-condo/${l[0]}/c37${l[1]}${q ? "?" + q : ""}`;
}

export function lienFacebook(f) {
  const v = FB_VILLES[f.ville];
  return `https://www.facebook.com/marketplace/${v ? v + "/propertyrentals" : "category/propertyrentals"}`;
}

/* Adaptateur recherche (Supabase : fonction chercher-annonces → Brave Search API) */
export const ANN = {
  note: "",
  async chercher(f) {
    if (!CFG.recherche) return [];
    let { data, error } = await sb.functions.invoke("chercher-annonces", {
      body: { ville: f.ville, ch: f.ch, max: f.max },
    });
    // Ancienne version de la fonction (sans les studios) : on cherche sans filtre, le tri garde les studios.
    if (error && f.ch === "0" && error.context && error.context.status === 400)
      ({ data, error } = await sb.functions.invoke("chercher-annonces", {
        body: { ville: f.ville, ch: "", max: f.max },
      }));
    if (error) {
      if (error.context && error.context.status === 429) throw new Error("quota");
      throw error;
    }
    return (data && data.resultats) || [];
  },
};
