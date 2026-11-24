/* Comparer le prix : le loyer demandé face au loyer moyen SCHL, au loyer des annonces récentes
   (Statistique Canada) et à la médiane des annonces déjà vérifiées dans HabitaScan.
   Chaque référence affiche sa source, sa période et le type de logement. Une référence absente est dite absente. */
import ANNONCES from "./loyers-annonces.json";
import { sb } from "../config.js";
import { esc, money } from "../utils/dom.js";

export const LOYERS_ANNONCES = ANNONCES;

const libelleCh = (ch) => (String(ch) === "3" ? "3 chambres et plus" : `${ch} chambre${+ch > 1 ? "s" : ""}`);

/* Écart en % entre le loyer demandé et une référence : « 12 % au-dessus », « 8 % sous », « au même niveau ». */
export function ecart(prix, ref) {
  if (!(prix > 0) || !(ref > 0)) return null;
  const p = Math.round(((prix - ref) / ref) * 100);
  if (Math.abs(p) < 3) return { p, t: "au même niveau" };
  return { p, t: p > 0 ? `${p} % au-dessus` : `${-p} % sous` };
}

/* Médiane HabitaScan (fonction mediane_loyers_annonces) : { n, mediane, jours, minimum }, ou null si indisponible. */
export async function chargerMedianeHabitascan(ville, ch) {
  if (!ville || ville === "Autre" || !ch) return null;
  try {
    const { data, error } = await sb.rpc("mediane_loyers_annonces", { p_ville: ville, p_chambres: Math.min(+ch, 3) });
    const r = !error && data && data[0];
    return r
      ? { n: +r.n || 0, mediane: r.mediane ? +r.mediane : null, jours: +r.jours || 90, minimum: +r.minimum || 10 }
      : null;
  } catch (e) {
    return null;
  }
}

/* Les trois références pour une fiche : [{ cle, nom, valeur, stat, type, source, periode, lien, note, absent }]. */
export function referencesPrix(F, loyers, infos, annonces = ANNONCES) {
  const ch = Math.min(+F.ch || 1, 3),
    v = F.ville,
    type = libelleCh(ch);
  const schl = loyers[v] && loyers[v][ch - 1];
  const info = (infos && infos[v]) || {};
  const sc = annonces.villes && annonces.villes[v] && annonces.villes[v][ch - 1];
  const hs = F.medianeHS;
  return [
    {
      cle: "schl",
      nom: "Loyer moyen SCHL",
      valeur: schl || null,
      type: `Appartements locatifs d'initiative privée, ${type}`,
      source: info.source || "SCHL, Enquête sur les logements locatifs",
      periode: info.periode || "octobre 2025",
      note: "Moyenne de tous les locataires, y compris ceux en place depuis longtemps : souvent plus bas que le loyer d'un logement à louer aujourd'hui.",
      absent: schl ? null : "Pas de loyer SCHL pour cette ville.",
    },
    {
      cle: "statcan",
      nom: "Annonces récentes (Statistique Canada)",
      valeur: sc ? sc.loyer : null,
      type: `${annonces.description || "Loyer demandé dans les annonces"}, ${type}`,
      source: annonces.source,
      periode: sc ? sc.periode : annonces.periode,
      lien: annonces.url,
      note: "Loyer demandé dans les annonces en ligne de la région métropolitaine, pas le loyer payé par les locataires en place.",
      absent: sc
        ? null
        : annonces.ref
          ? "Statistique Canada ne publie pas ce chiffre pour cette ville et ce nombre de chambres."
          : "Données pas encore importées.",
    },
    {
      cle: "habitascan",
      nom: "Annonces vérifiées dans HabitaScan",
      valeur: hs && hs.mediane ? hs.mediane : null,
      type: `Médiane des annonces de ${v || "cette ville"}, ${type}, sans les résultats « Ne paie pas »`,
      source: "HabitaScan",
      periode: `${(hs && hs.jours) || 90} derniers jours`,
      note: "Chaque annonce compte une seule fois, même si elle a été vérifiée plusieurs fois.",
      absent:
        hs && hs.mediane
          ? null
          : hs
            ? `Pas encore assez d'annonces vérifiées pour une médiane fiable (${hs.n} sur ${hs.minimum} nécessaires).`
            : "Médiane indisponible pour le moment.",
    },
  ];
}

/* Bloc « Comparer le prix » du résultat. */
export function blocComparaison(F, loyers, infos) {
  if (!(F.prixN > 0) || !F.ville || F.ville === "Autre") return "";
  const refs = referencesPrix(F, loyers, infos);
  const ligne = (r) => {
    const e = ecart(F.prixN, r.valeur);
    const src = r.lien ? `<a href="${esc(r.lien)}" target="_blank" rel="noopener">${esc(r.source)}</a>` : esc(r.source);
    return `<li><span class="dot i"></span><div><b>${esc(r.nom)}</b> : ${
      r.valeur
        ? `<span class="num">${money(r.valeur)}</span>${e ? ` · ton loyer est <b>${e.t}</b>` : ""}`
        : esc(r.absent)
    }<div class="law">${esc(r.type)} · ${esc(r.periode || "période inconnue")} · ${src}</div>${
      r.valeur ? `<div class="law">${esc(r.note)}</div>` : ""
    }</div></li>`;
  };
  return `<div class="card" id="comparaison"><h2>Comparer le prix</h2><p class="soft">Loyer demandé : <b class="num">${money(F.prixN)}</b> · ${esc(F.ville)} · ${libelleCh(Math.min(+F.ch || 1, 3))}</p><ul class="reasons">${refs.map(ligne).join("")}</ul><p class="hint">Un prix différent de ces repères n'est pas une arnaque à lui seul : l'état du logement, le quartier et ce qui est inclus comptent.</p></div>`;
}
