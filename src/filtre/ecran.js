/* Message-filtre : bloc affiché sur le résultat. */
import { etat } from "../etat.js";
import { FILTRE_MSG } from "./regles.js";
import { IA_ADAPT, iaActif } from "../ia/analyse.js";
import { esc } from "../utils/dom.js";

const NIVEAUX = { r: "Signal d'arnaque", y: "À surveiller", g: "Bon signe", i: "Neutre" };

/* Le fil de la conversation : un repère par message de l'annonceur, puis ce qui a changé. */
export function blocFil(fil) {
  if (!fil) return "";
  const court = (t) => (t.length > 140 ? t.slice(0, 137) + "…" : t);
  return `<div class="fil" id="f-fil"><h3>Au fil de la conversation</h3>
<p class="hint">${fil.nb} messages de l'annonceur, dans l'ordre.</p>
<div class="fil-barre" role="img" aria-label="Niveau de risque de chaque message, du premier au dernier">${fil.etapes.map((e) => `<span class="${e.niveau}" title="Message ${e.n} : ${NIVEAUX[e.niveau]}"></span>`).join("")}</div>
${fil.tendances.length ? `<ul class="reasons">${fil.tendances.map((z) => `<li><span class="dot ${z.c}"></span><div>${z.m}</div></li>`).join("")}</ul>` : `<p class="lu">Le ton reste le même d'un message à l'autre : ni pression qui monte, ni autre messagerie, ni pièce d'identité demandée.</p>`}
<details><summary>Voir les ${fil.nb} messages</summary><ol class="fil-msgs">${fil.etapes.map((e) => `<li><span class="dot ${e.niveau}" aria-label="${NIVEAUX[e.niveau]}"></span><div><b>Message ${e.n}</b> « ${esc(court(e.texte))} »</div></li>`).join("")}</ol></details></div>`;
}

export function blocFiltre() {
  const lang = etat.fiche.flang || "fr",
    ces = etat.fiche.cession === "oui";
  const msg = FILTRE_MSG[lang][ces ? "ces" : "std"];
  const A = etat.fiche.frep;
  return `<div class="card filtre"><p class="offre-eti">Gratuit · nouveau</p><h2>Le message-filtre</h2>
<p>Envoie ce seul message à l'annonceur. Il ne pose aucune question gênante : il annonce simplement les règles normales au Québec. <b>Un vrai propriétaire dira oui. Un fraudeur va insister pour un dépôt, ou disparaître.</b></p>
<div class="seg" role="group" aria-label="Langue du message"><button type="button" data-flang="fr" aria-pressed="${lang === "fr"}">Français</button><button type="button" data-flang="en" aria-pressed="${lang === "en"}">English</button></div>
<blockquote class="msg" id="f-msg" lang="${lang}">${esc(msg)}</blockquote>
${typeof navigator !== "undefined" && navigator.share ? `<div class="duo"><button type="button" class="btn" id="f-copier">Copier le message</button><button type="button" class="btn ghost" id="f-partager">Partager</button></div>` : `<button type="button" class="btn" id="f-copier">Copier le message</button>`}
<label for="f-rep" style="margin-top:14px">Colle sa réponse, ou toute la conversation</label><textarea id="f-rep" rows="4" maxlength="8000" placeholder="La réponse de l'annonceur… Pour toute la conversation, un message par ligne (« Moi : … » pour les tiens).">${esc(etat.fiche.frepTxt || "")}</textarea>
<label class="drop" style="margin-top:4px">${(etat.fiche.fcaps || []).length ? `<b>${etat.fiche.fcaps.length} capture${etat.fiche.fcaps.length > 1 ? "s" : ""} de la discussion</b> · toucher pour changer` : "Ajouter des captures de toute la discussion (jusqu'à 8, facultatif)"}<input type="file" accept="image/*" multiple id="f-caps"></label>
${IA_ADAPT.dispo ? `<label class="ia-opt"><input type="checkbox" id="f-ia" ${iaActif() ? "checked" : ""}><span><b>Analyse intelligente de la conversation</b><span class="hint">Lit toute la discussion, message par message, aussi en anglais : c'est là que les fraudeurs se trahissent. Envoyées à Anthropic pour l'analyse, puis oubliées.</span></span></label>` : ""}
<button type="button" class="btn ghost" id="f-lire">${(etat.fiche.fcaps || []).length > 1 ? "Analyser la conversation" : "Analyser sa réponse"}</button>
${A ? `<div class="verdict ${A.c}" id="f-res" role="status"><strong>${A.t}</strong><span>${A.s}</span></div>${A.signaux.length ? `<ul class="reasons">${A.signaux.map((z) => `<li><span class="dot ${z.c}"></span><div>${z.m}</div></li>`).join("")}</ul>` : ""}${blocFil(A.fil)}` : ""}
${A && !A.ia && A.c !== "r" && IA_ADAPT.dispo && !iaActif() ? `<div class="lu"><b>Aucun mot suspect, mais un fraudeur prudent peut les éviter.</b> L'IA lit le sens de sa réponse.<button type="button" class="btn ghost" id="f-ia-go" style="margin-top:10px">Faire lire sa réponse par l'IA</button></div>` : ""}
${A && A.resume ? `<p class="lu"><b>Résumé de l'IA :</b> ${esc(A.resume)}</p>` : ""}
<p class="hint">${A && A.ia ? "Analysée par l'IA et par les règles de l'app. Elle repère des indices connus, sans certitude." : "Sans l'analyse intelligente, l'analyse se fait sur ton téléphone ; le texte n'est envoyé nulle part. Elle repère des indices connus, sans certitude."}</p></div>`;
}
