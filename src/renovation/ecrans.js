/* Vérif-Réno : écrans du formulaire et du résultat. */
import { LIENS, TRAVAUX } from "./regles.js";
import { esc, top, yn } from "../utils/dom.js";
import { aujourdhui, chiffres, formatLicence, jourLong } from "../utils/texte.js";

/* Écrans communs du module. */
export const vueReno = (F, retour) => `${top(retour, "Rénovation")}
<h2>La soumission de l'entrepreneur</h2>
<form class="card" id="f-reno" novalidate>
<label class="drop">${F.captureUrl || (typeof F.capture === "string" && F.capture) ? `<img src="${F.captureUrl || F.capture}" alt="Photo de la soumission">Changer la photo` : "Photographier la soumission (facultatif)"}<input type="file" accept="image/*" capture="environment" data-side="capture"></label>
<div class="grid2"><label>Licence RBQ<input id="licence" inputmode="numeric" autocomplete="off" placeholder="0000-0000-00" value="${esc(F.licence || "")}"></label>
<label>Nom de l'entreprise<input id="nom" autocomplete="off" placeholder="Sur la soumission" value="${esc(F.nom || "")}"></label></div>
<div class="q">Type de travaux<div class="choix" role="group" aria-label="Type de travaux">${Object.entries(TRAVAUX)
  .map(([k, t]) => `<button type="button" data-trav="${k}" aria-pressed="${F.travaux === k}">${t.l}</button>`)
  .join("")}</div></div>
${yn("domicile", "Le contrat est (ou sera) signé chez toi ?")}
<div id="q-recu" ${F.domicile !== "oui" ? "hidden" : ""}><label>Date où tu as reçu ton exemplaire signé<input id="recu" type="date" value="${esc(F.recu || aujourdhui())}"></label></div>
${yn("acompte", "On te demande un acompte ou un paiement maintenant ?")}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Vérifier</button></form>
<p class="hint">La photo reste sur ton téléphone. Seuls le numéro de licence, le type de travaux et le résultat sont gardés dans ton historique.</p>`;

export const vueRenoResultat = (F, retour) => {
  const R = F.res,
    T = TRAVAUX[F.travaux];
  return `${top(retour, "Résultat")}
<div class="verdict ${R.c}"><strong>${{ r: "Ne signe pas, ne paie pas", y: "Prudence", g: "Aucun signal d'alarme" }[R.c]}</strong><span>${esc(T.l)}${F.licence ? ` · licence <span class="num">${esc(formatLicence(chiffres(F.licence)))}</span>` : ""}</span></div>
${F.limite ? `<div class="rule">Annulation possible sans frais jusqu'au <b>${jourLong(F.limite)}</b>.</div>` : ""}
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map((i) => `<li><span class="dot ${i.c}"></span><div>${i.t}${i.law ? `<div class="law">${i.law}</div>` : ""}</div></li>`).join("")}</ul></div>
<p class="rule">Paie selon l'avancement des travaux, jamais tout d'avance.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.opc}" target="_blank" rel="noopener" id="opc">Voir les plaintes à l'OPC</a>
<p class="hint">${F.nom ? "En touchant le bouton, le nom de l'entreprise est copié : colle-le dans l'outil de l'OPC. " : ""}Une plainte ne prouve pas une faute : regarde surtout leur nombre et leur sujet.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.rbq}" target="_blank" rel="noopener">Ouvrir le registre des licences RBQ</a>
<button class="btn" id="nouv">Vérifier un autre entrepreneur</button>`;
};
