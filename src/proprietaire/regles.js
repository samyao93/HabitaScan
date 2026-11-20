/* Vérifier le propriétaire : numéro de lot, comparaison des noms, verdict. */
import { sb } from "../config.js";
import { sansAccents } from "../utils/texte.js";

export const chiffresLot = (t) => String(t || "").replace(/\D/g, "");

export const fmtLot = (t) => chiffresLot(t).replace(/^(\d)(\d{3})(\d{3,4})$/, "$1 $2 $3");

// Services publics du gouvernement du Québec (données ouvertes) :
// géocodeur Adresses Québec (MRNF, CC-BY 4.0) et couche des lots du cadastre rénové.
export const GEO_URL =
  "https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/AdressesQuebec_Geocodage/GeocodeServer/findAddressCandidates";

export const CAD_URL =
  "https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query";

export async function trouverLotDirect(adr) {
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), 10000);
  try {
    const g = await (
      await fetch(`${GEO_URL}?SingleLine=${encodeURIComponent(adr)}&outSR=4326&maxLocations=1&f=json`, {
        signal: ctl.signal,
      })
    ).json();
    const c = g && g.candidates && g.candidates[0];
    if (!c || !c.location || (c.score != null && c.score < 80)) return { trouve: false };
    const q = await (
      await fetch(
        `${CAD_URL}?geometry=${c.location.x},${c.location.y}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NO_LOT&returnGeometry=false&f=json`,
        { signal: ctl.signal },
      )
    ).json();
    const lots = [
      ...new Set(
        ((q && q.features) || []).map((f) => chiffresLot(f.attributes && f.attributes.NO_LOT)).filter(Boolean),
      ),
    ];
    return { trouve: true, adresse: c.address || adr, lots };
  } finally {
    clearTimeout(t);
  }
}

export function memeNom(a, b) {
  const m = (s) =>
    sansAccents(s)
      .split(/[^a-z]+/)
      .filter((x) => x.length >= 3);
  const A = m(a),
    B = m(b);
  if (!A.length || !B.length) return null;
  const com = A.filter((x) => B.includes(x)).length;
  return com === Math.min(A.length, B.length) ? "oui" : com ? "partiel" : "non";
}

export function comparerProprio(texte, nom, adr) {
  const T = " " + sansAccents(texte).replace(/[^a-z0-9]+/g, " ") + " ";
  const mots = sansAccents(nom)
    .split(/[^a-z]+/)
    .filter((m) => m.length >= 3);
  const trouves = mots.filter((m) => T.includes(" " + m + " "));
  const no = (String(adr || "").match(/\d+/) || [])[0];
  const rue = sansAccents(adr)
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(
      (m) => m.length >= 4 && !["rue", "avenue", "boulevard", "chemin", "place", "montee", "rang"].includes(m),
    )[0];
  const m = sansAccents(texte).match(/lot[^0-9]{0,25}(\d[\d ]{5,10}\d)/);
  const lot = m ? m[1].replace(/\s/g, "") : null;
  return {
    nom: mots.length ? (trouves.length === mots.length ? "oui" : trouves.length ? "partiel" : "non") : null,
    adr: no ? (T.includes(" " + no + " ") && (!rue || T.includes(" " + rue + " ")) ? "oui" : "non") : null,
    lot: lot && lot.length >= 7 && lot.length <= 8 ? fmtLot(lot) : null,
  };
}

export function verdictProprio(P, F) {
  const ces = F && F.cession === "oui";
  const c = P.cmp || {};
  const doc = ces ? "l'accord écrit" : "le bail";
  if (P.nomReg && P.nomBail) {
    const m = memeNom(P.nomBail, P.nomReg);
    if (m === "oui")
      return ces
        ? {
            c: "g",
            t: "L'accord vient du propriétaire inscrit",
            s: "Tu peux signer la cession. Paie ensuite le loyer au propriétaire, jamais au locataire qui part.",
          }
        : {
            c: "g",
            t: "Le bail est au nom du propriétaire inscrit",
            s: "Tu peux signer. Paie le premier mois à la signature, par un moyen traçable.",
          };
    if (m === "partiel")
      return {
        c: "y",
        t: "Le nom ressemble en partie",
        s: `Vérifie l'orthographe sur ${doc} et au Registre foncier avant de payer (deuxième prénom, entreprise apparentée).`,
      };
    return ces
      ? {
          c: "r",
          t: "Ce n'est pas le propriétaire inscrit",
          s: "L'accord écrit n'est pas signé par le propriétaire inscrit au Registre foncier. Ne paie rien.",
        }
      : {
          c: "y",
          t: "Le bail n'est pas au nom du propriétaire inscrit",
          s: "Si c'est un gestionnaire, exige son mandat écrit signé par le propriétaire inscrit. Sinon, ne paie pas.",
        };
  }
  if (P.nomReg && c.nom) {
    if (c.nom === "non")
      return {
        c: "y",
        t: `Le propriétaire inscrit n'apparaît pas sur ${doc}`,
        s: "Si c'est un gestionnaire, exige son mandat écrit. Sinon, ne paie pas.",
      };
    if (c.adr === "non")
      return {
        c: "y",
        t: `L'adresse n'apparaît pas sur ${doc}`,
        s: `${ces ? "L'accord" : "Le bail"} doit être celui du logement que tu as visité.`,
      };
    if (c.nom === "oui")
      return {
        c: "g",
        t: `Le propriétaire inscrit apparaît sur ${doc}`,
        s: "Tu peux signer. Paie à la signature, par un moyen traçable.",
      };
  }
  return null;
}

/* styles déplacés dans app.css */

/* Adaptateur adresse (Supabase : fonction info-adresse, qui appelle les services publics) */
export const INFO = {
  async adresse(a) {
    const { data, error } = await sb.functions.invoke("info-adresse", { body: { adresse: a } });
    if (error || !data || data.error) return trouverLotDirect(a);
    return data;
  },
};
