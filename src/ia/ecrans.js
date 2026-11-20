/* Analyse intelligente : blocs affichés (choix, rappel). */
import { etat } from "../etat.js";
import { CLE_IA, IA_ADAPT, iaActif } from "./analyse.js";

export const blocIA = () =>
  IA_ADAPT.dispo
    ? !iaChoisi()
      ? ""
      : `<label class="ia-opt"><input type="checkbox" id="ia-ok" ${iaActif() ? "checked" : ""}><span><b>Analyse intelligente</b><span class="hint">Comprend mieux les captures et la conversation, aussi en anglais. Les images et le texte sont envoyés à Anthropic pour l'analyse, puis oubliés par HabitaScan.</span></span></label>`
    : `<p class="hint">L'analyse intelligente est offerte dans la vraie app, pas dans cette démo.</p>`;

function iaChoisi() {
  try {
    return localStorage.getItem(CLE_IA) !== null;
  } catch (e) {
    return true;
  }
}

export function blocChoixIA() {
  if (!IA_ADAPT.dispo || iaChoisi()) return "";
  return `<div class="card invite choix-ia" role="region" aria-label="Analyse intelligente"><p class="offre-eti">Recommandé</p><h2>Activer l'analyse intelligente ?</h2>
<p>Elle comprend le <b>sens</b> des annonces et des messages, pas seulement des mots. Elle repère les fraudeurs prudents qui évitent les mots suspects : « un petit montant pour bloquer le logement », « je suis hors du pays pour le travail ».</p>
<p class="hint">Le texte et les captures sont envoyés à Anthropic (États-Unis) pour l'analyse, puis oubliés. Tu peux changer ce choix dans Mon compte.</p>
<div class="duo"><button type="button" class="btn" data-ia-choix="1">Activer</button><button type="button" class="btn ghost" data-ia-choix="0">Non merci</button></div></div>`;
}

/* Rappel sur le résultat quand seule l'analyse par mots a été faite. */
export function rappelIA() {
  if (!IA_ADAPT.dispo || iaActif() || etat.fiche.ia || !etat.fiche.res || etat.fiche.res.c === "r") return "";
  if (!(
    (etat.fiche.captures || []).length ||
    String(etat.fiche.annonce || "").length > 30 ||
    String(etat.fiche.txt || "").length > 10
  ))
    return "";
  return `<div class="card invite"><p><b>L'analyse simple cherche des mots connus&nbsp;: un fraudeur prudent peut les éviter.</b> L'analyse intelligente lit le sens de l'annonce et de la conversation.</p>
<button type="button" class="btn" id="ia-relire">Faire lire l'annonce et la conversation par l'IA</button>
<p class="hint">Le texte et les captures sont envoyés à Anthropic pour l'analyse, puis oubliés. Ce choix est retenu ; tu peux le changer dans Mon compte.</p></div>`;
}
