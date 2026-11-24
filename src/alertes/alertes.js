/* Alerte « annonce signalée » : une annonce que la personne a vérifiée, ou une annonce reliée
   (même lien, mêmes photos, même téléphone ou courriel, même texte), a été signalée ensuite par d'autres. */
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { MOTIFS } from "../signalements/signalements.js";
import { esc, money } from "../utils/dom.js";
import { dateCourte } from "../utils/texte.js";

const QUOI = {
  lien: "le même lien",
  photo: "les mêmes photos",
  tel: "le même numéro de téléphone",
  courriel: "le même courriel",
  texte: "le même texte",
};

/** Charge les alertes de la personne connectée (null si désactivées ou indisponibles). */
export async function chargerAlertes() {
  etat.alertes = [];
  if (!etat.session) return;
  try {
    const { data, error } = await sb.rpc("mes_alertes_signalement");
    etat.alertes = !error && Array.isArray(data) ? data : [];
  } catch (e) {
    etat.alertes = [];
  }
}

export const alertesActives = () => !etat.profil || etat.profil.alertes_signalement !== false;

export const alerteDe = (id) => (etat.alertes || []).find((a) => String(a.verif) === String(id)) || null;

/** « le même lien et les mêmes photos » */
export function texteQuoi(L) {
  const t = (L || []).map((k) => QUOI[k]).filter(Boolean);
  if (!t.length) return "une annonce reliée";
  return t.length === 1 ? t[0] : t.slice(0, -1).join(", ") + " et " + t[t.length - 1];
}

const pers = (n) => (n > 1 ? `${n} personnes` : "une personne");

/** Phrase d'alerte pour une vérification. */
export function phraseAlerte(a) {
  const n = +a.nb || 1;
  const directe = (a.quoi || []).includes("lien");
  return directe
    ? `Depuis ta vérification, ${pers(n)} à l'identité confirmée ${n > 1 ? "ont" : "a"} signalé cette annonce comme arnaque.`
    : `Depuis ta vérification, ${pers(n)} à l'identité confirmée ${n > 1 ? "ont" : "a"} signalé comme arnaque une annonce qui a ${texteQuoi(a.quoi)}.`;
}

const motifs = (a) =>
  (a.motifs || [])
    .map((m) => MOTIFS[m])
    .filter(Boolean)
    .map((m) => `«&nbsp;${esc(m)}&nbsp;»`)
    .join(", ");

/** Carte de l'accueil : seulement les alertes nouvelles (après le dernier « Compris »). */
export function blocAlertes() {
  if (!alertesActives()) return "";
  const N = (etat.alertes || []).filter((a) => a.nouvelle);
  if (!N.length) return "";
  const H = etat.historique || [];
  const ligne = (a) => {
    const v = H.find((x) => String(x.id) === String(a.verif)) || {};
    const titre = [
      v.ville,
      v.prix ? money(+v.prix) + "/mois" : "",
      v.created_at ? "vérifiée le " + dateCourte(v.created_at) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return `<li><button type="button" class="lienbtn" data-verif="${esc(a.verif)}"><b>${esc(titre || "Une de tes vérifications")}</b></button><br>${esc(phraseAlerte(a))}</li>`;
  };
  return `<div class="verdict r" role="alert" id="alertes"><strong>${N.length > 1 ? `${N.length} annonces que tu as vérifiées ont été signalées` : "Une annonce que tu as vérifiée a été signalée"}</strong>
<span>N'envoie aucun argent. Si tu as déjà payé, garde toutes les preuves et signale-le à la police.</span>
<ul class="alertes-liste">${N.map(ligne).join("")}</ul>
<span><button type="button" class="btn ghost" id="alertes-vues">Compris</button></span></div>`;
}

/** Encadré du détail d'une vérification. */
export function blocAlerteDetail(id) {
  if (!alertesActives()) return "";
  const a = alerteDe(id);
  if (!a) return "";
  const m = motifs(a);
  return `<div class="verdict r" role="alert"><strong>Signalée comme arnaque depuis ta vérification</strong>
<span>${esc(phraseAlerte(a))}${m ? ` Raisons données : ${m}.` : ""} Dernier signalement le ${esc(dateCourte(a.dernier))}.</span>
<span>N'envoie aucun argent à cet annonceur. Si tu as déjà payé : <button type="button" class="lienbtn" data-go="victime">J'ai été victime d'une arnaque</button>.</span></div>`;
}

/** Interrupteur de Mon compte. */
export const blocReglageAlertes = () =>
  `<div class="card"><label class="interrupteur"><span><b>M'alerter si une annonce que j'ai vérifiée est signalée</b><small>Si d'autres utilisateurs signalent ensuite comme arnaque une annonce que tu as vérifiée, ou une annonce avec les mêmes photos, le même numéro ou le même texte, tu es prévenu dans l'app. Tu ne sais jamais qui a signalé.</small></span><input type="checkbox" role="switch" id="alertes-ok" ${alertesActives() ? "checked" : ""}></label><p class="hint" id="alertes-msg" aria-live="polite"></p></div>`;

export async function marquerAlertesVues() {
  (etat.alertes || []).forEach((a) => (a.nouvelle = false));
  try {
    await sb.rpc("marquer_alertes_vues");
  } catch (e) {}
}

export async function definirAlertes(actif) {
  const { error } = await sb.rpc("definir_alertes_signalement", { p_actif: !!actif });
  if (error) throw error;
  if (etat.profil) etat.profil.alertes_signalement = !!actif;
  if (actif) await chargerAlertes();
  else etat.alertes = [];
}
