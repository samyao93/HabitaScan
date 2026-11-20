/* Pages légales et textes modifiables dans la console (tables pages_legales et parametres_texte). */
import { CFG } from "../admin/parametres.js";
import { VCFG } from "../approfondie/rapport.js";
import { sb } from "../config.js";
import { esc, top } from "../utils/dom.js";

export const PAGES_LEG = {};

export async function chargerPages() {
  try {
    const { data } = await sb.from("pages_legales").select("cle,contenu");
    (data || []).forEach((r) => {
      if (r.contenu) PAGES_LEG[r.cle] = r.contenu;
    });
  } catch (e) {}
}

/* Page légale rédigée dans la console (Markdown). Les liens vers l'autre page restent dans l'app. */
export function vuePageLegale(cle, titre, retour) {
  let h = window.hsMarkdown ? hsMarkdown(PAGES_LEG[cle], { sections: true }) : esc(PAGES_LEG[cle]);
  h = h
    .replace(/<h1>([\s\S]*?)<\/h1>/, "<h2>$1</h2>")
    .replace(
      /<a href="\/(conditions|confidentialite)">([\s\S]*?)<\/a>/g,
      '<button type="button" class="lienbtn" data-go="$1">$2</button>',
    );
  if (document.documentElement.dataset.natif) h = h.replace(/href="\//g, 'href="https://habitascan.vercel.app/');
  return `${top(retour, titre)}<div class="legal-app">${h}</div>`;
}

export async function chargerTextes() {
  try {
    const { data } = await sb.from("parametres_texte").select("cle,valeur");
    (data || []).forEach((r) => {
      if (r.cle === "lien_paiement") VCFG.lien = r.valeur || "";
      if (r.cle === "message_accueil") CFG.message = r.valeur || "";
      if (r.cle === "courriel_support") CFG.support = r.valeur || "";
    });
  } catch (e) {}
}
