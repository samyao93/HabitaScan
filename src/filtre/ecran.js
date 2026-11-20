/* Message-filtre : bloc affiché sur le résultat. */
import { etat } from "../etat.js";
import { FILTRE_MSG } from "./regles.js";
import { IA_ADAPT, iaActif } from "../ia/analyse.js";
import { esc } from "../utils/dom.js";

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
<label for="f-rep" style="margin-top:14px">Colle sa réponse ici</label><textarea id="f-rep" rows="4" maxlength="3000" placeholder="La réponse de l'annonceur…">${esc(etat.fiche.frepTxt || "")}</textarea>
<label class="drop" style="margin-top:4px">${(etat.fiche.fcaps || []).length ? `<b>${etat.fiche.fcaps.length} capture${etat.fiche.fcaps.length > 1 ? "s" : ""} de la discussion</b> · toucher pour changer` : "Ajouter des captures de la discussion (facultatif)"}<input type="file" accept="image/*" multiple id="f-caps"></label>
${IA_ADAPT.dispo ? `<label class="ia-opt"><input type="checkbox" id="f-ia" ${iaActif() ? "checked" : ""}><span><b>Analyse intelligente de la conversation</b><span class="hint">Lit sa réponse et tes captures de la discussion, aussi en anglais : c'est là que les fraudeurs se trahissent. Envoyées à Anthropic pour l'analyse, puis oubliées.</span></span></label>` : ""}
<button type="button" class="btn ghost" id="f-lire">Analyser sa réponse</button>
${A ? `<div class="verdict ${A.c}" id="f-res" role="status"><strong>${A.t}</strong><span>${A.s}</span></div>${A.signaux.length ? `<ul class="reasons">${A.signaux.map((z) => `<li><span class="dot ${z.c}"></span><div>${z.m}</div></li>`).join("")}</ul>` : ""}` : ""}
${A && !A.ia && A.c !== "r" && IA_ADAPT.dispo && !iaActif() ? `<div class="lu"><b>Aucun mot suspect, mais un fraudeur prudent peut les éviter.</b> L'IA lit le sens de sa réponse.<button type="button" class="btn ghost" id="f-ia-go" style="margin-top:10px">Faire lire sa réponse par l'IA</button></div>` : ""}
${A && A.resume ? `<p class="lu"><b>Résumé de l'IA :</b> ${esc(A.resume)}</p>` : ""}
<p class="hint">${A && A.ia ? "Analysée par l'IA et par les règles de l'app. Elle repère des indices connus, sans certitude." : "Sans l'analyse intelligente, l'analyse se fait sur ton téléphone ; le texte n'est envoyé nulle part. Elle repère des indices connus, sans certitude."}</p></div>`;
}
