/* Vérifier le propriétaire : écran. */
import { carteApprofondie } from "../approfondie/ecrans.js";
import { fmtLot, verdictProprio } from "./regles.js";
import { esc, top } from "../utils/dom.js";
import { L_INFOLOT, L_REGISTRE, L_RETRAIT_MTL, L_ROLE_MTL, L_TARIF, lienExt } from "../utils/liens.js";

export function vueProprio(F, back) {
  const P = F.P || (F.P = { adr: F.adr ? F.adr + (F.ville && F.ville !== "Autre" ? ", " + F.ville : "") : "" });
  const V = verdictProprio(P, F),
    c = P.cmp,
    G = P.geo;
  const ligne = (etat, t) => `<li><span class="dot ${etat}"></span><div>${t}</div></li>`;
  const lots = (G && G.lots) || [];
  const ces = F.cession === "oui";
  const doc = ces ? "l'accord écrit du propriétaire" : "le bail";
  return `${top(back, "Propriétaire")}
<h2>Vérifier le propriétaire</h2>
<p class="soft"><b>Aucune question à poser à l'annonceur.</b> L'adresse suffit pour trouver le vrai propriétaire. La comparaison se fait au moment de signer, avant de payer : c'est le seul moment où ton argent est en jeu.</p>
${V ? `<div class="verdict ${V.c}" id="pv"><strong>${V.t}</strong><span>${V.s}</span></div>` : ""}
<form class="card" id="f-pro" novalidate>
<h2>1. L'adresse du logement</h2>
<p class="hint">Dans l'annonce, ou celle qu'on te donne pour la visite.</p>
<label>Adresse<input id="padr" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(P.adr || "")}"></label>
<button type="button" class="btn ghost" id="b-lot">${P.chercheLot ? "Recherche…" : "Trouver le numéro de lot"}</button>
${
  G
    ? G.trouve
      ? `<ul class="reasons">${ligne("g", `Adresse trouvée : ${esc(G.adresse)}.`)}
${lots.length ? ligne("g", `Numéro de lot : ${lots.map((l) => `<b class="num">${esc(fmtLot(l))}</b>`).join(", ")}.`) : ligne("y", `Numéro de lot non trouvé automatiquement. Cherche l'adresse sur ${lienExt(L_INFOLOT, "Infolot")}.`)}
</ul><p class="hint">Sources : Adresses Québec et cadastre du Québec, données ouvertes du gouvernement.</p>`
      : `<p class="lu">${esc(G.erreur || "Adresse introuvable. Ajoute la ville, ou cherche-la sur la carte Infolot.")} ${lienExt(L_INFOLOT, "Ouvrir Infolot")}</p>`
    : ""
}
</form>
<div class="card"><h2>2. Trouve le vrai propriétaire</h2>
<p class="hint">Le Registre foncier dit à qui appartient l'immeuble. Personne ne peut le falsifier ni le faire retirer.</p>
<ul class="reasons">
${ligne("i", lots.length ? `<b>Ton numéro de lot :</b> <span class="num">${lots.map(fmtLot).join(", ")}</span>.` : `<b>Le numéro de lot</b> : à l'étape 1, ou avec ${lienExt(L_INFOLOT, "Infolot")} (gratuit).`)}
${ligne("i", `<b>Consulte l'index des immeubles</b> de ce lot au ${lienExt(L_REGISTRE, "Registre foncier du Québec")}, puis le dernier acte de vente : 1 $ par document, compte requis.<div class="law">${lienExt(L_TARIF, "Grille tarifaire du Registre foncier, 1er janvier 2026")}</div>`)}
${ligne("i", `<b>Si c'est une entreprise</b>, regarde ses dirigeants au ${lienExt("https://www.registreentreprises.gouv.qc.ca/", "registre des entreprises")} (gratuit).`)}</ul>
<label>Nom du propriétaire inscrit<input id="preg" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomReg || "")}"></label>
<p class="hint">L'app le garde sur ton téléphone pour la comparaison de l'étape 3.${F.ville === "Montréal" ? ` À Montréal, le ${lienExt(L_ROLE_MTL, "rôle d'évaluation en ligne")} donne parfois le nom gratuitement ; s'il n'y est pas, le propriétaire a pu demander son retrait (${lienExt(L_RETRAIT_MTL, "Loi sur la fiscalité municipale")}).` : ""}</p></div>
${carteApprofondie()}
<form class="card" id="f-sig" novalidate><h2>3. Au moment de signer, avant de payer</h2>
${
  ces
    ? `<div class="rule" style="text-align:left"><b>C'est le locataire actuel qui annonce</b> (cession ou sous-location). Le document à comparer est <b>l'accord écrit du propriétaire, avec ton nom</b> : le locataire doit aviser le propriétaire par écrit et obtenir son accord. Le propriétaire a 15 jours pour répondre ; sans réponse, il est réputé avoir accepté. En cession, le locataire qui part ne peut rien te demander en échange.
<span class="law">Code civil du Québec, art. 1870 et 1871 · ${lienExt("https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf", "TAL, avis de cession")}</span></div>`
    : `<p class="hint">Le nom du locateur est écrit en haut du bail, dans la section « Entre le locateur et le locataire » du formulaire obligatoire. Tu n'as rien à demander : il suffit de le lire.</p>`
}
<label>Nom du ${ces ? "propriétaire sur l'accord écrit" : "locateur écrit sur le bail"}<input id="pbail" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomBail || "")}"></label>
<label class="drop">${P.photo ? `<img src="${P.photo}" alt="Document">Changer la photo` : `Ou prends ${doc} en photo`}<input type="file" accept="image/*" data-taxe="1"></label>
${P.lecture ? `<p class="lu" role="status">${P.lecture}</p>` : ""}
${
  c && P.nomReg
    ? `<ul class="reasons">
${c.nom ? ligne(c.nom === "oui" ? "g" : c.nom === "partiel" ? "y" : "r", c.nom === "oui" ? `Le propriétaire inscrit apparaît sur ${doc}.` : c.nom === "partiel" ? `Une partie seulement du nom du propriétaire inscrit apparaît sur ${doc}.` : `Le propriétaire inscrit n'apparaît pas sur ${doc}.`) : ""}
${c.adr ? ligne(c.adr === "oui" ? "g" : "r", c.adr === "oui" ? `L'adresse du logement est sur ${doc}.` : `L'adresse du logement n'a pas été trouvée sur ${doc}.`) : ""}</ul>`
    : ""
}
${!P.nomReg && (P.nomBail || P.photo) ? `<p class="lu">Inscris d'abord le nom du propriétaire trouvé à l'étape 2, pour que l'app compare.</p>` : ""}
<p class="hint">La photo reste sur ton téléphone. Elle n'est envoyée nulle part.</p></form>
<button class="btn" data-go="${back}">Retour au résultat</button>`;
}
