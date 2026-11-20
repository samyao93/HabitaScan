/* Vérification complète : écrans et offre. */
import { CFG } from "../admin/parametres.js";
import { VAP } from "./api.js";
import { VCFG, prixTxt } from "./rapport.js";
import { lienConditions } from "../legal/conditions.js";
import { chiffresLot, fmtLot } from "../proprietaire/regles.js";
import { esc, top } from "../utils/dom.js";

export const carteApprofondie = () =>
  typeof CFG !== "undefined" && CFG.approfondie === false
    ? ""
    : `<div class="card offre"><h2>Pas le temps ? On le fait pour toi</h2>
<p>Notre équipe fait toute la vérification et t'envoie un rapport dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="proprio">Vérification complète · ${prixTxt()}</button>
<p class="hint">Paiement par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;

/* Offre visible sur le résultat et l'accueil */
export const offreApprofondie = (de) =>
  typeof CFG !== "undefined" && CFG.approfondie === false
    ? ""
    : `<div class="card offre offre-res"><p class="offre-eti">Service HabitaScan</p><h2>Vérification complète · ${prixTxt()}</h2>
<p>Sans que tu aies une seule question à poser, notre équipe vérifie l'annonce à fond et t'envoie un rapport écrit, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="${de}">Demander la vérification · ${prixTxt()}</button>
<p class="hint">Paiement sécurisé par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;

export function vueApprofondie(F, back) {
  const P = F.P || {};
  const A =
    F.VA ||
    (F.VA = {
      adresse: P.adr || F.adr || "",
      lot: (P.geo && P.geo.lots && P.geo.lots[0]) || (P.cmp && P.cmp.lot && chiffresLot(P.cmp.lot)) || "",
      nom: "",
      role: F.cession === "oui" ? "locataire" : null,
      lien: F.lien || "",
    });
  return `${top(back, "Vérification complète")}
<h2>Vérification complète · ${prixTxt()}</h2>
<p class="soft">Notre équipe vérifie pour toi, puis t'envoie un rapport écrit dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<form class="card" id="f-va" novalidate>
<label>Adresse du logement<input id="va-adresse" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(A.adresse)}"></label>
<label>Numéro de lot (facultatif)<input id="va-lot" inputmode="numeric" autocomplete="off" placeholder="1 234 567" value="${esc(A.lot ? fmtLot(A.lot) : "")}"></label>
<p class="hint" style="margin-top:0"><b>Aucune question à poser à l'annonceur :</b> l'adresse suffit. Nous trouvons le vrai propriétaire, vérifions les photos et les autres annonces, et te disons quel nom doit figurer sur ${A.role === "locataire" ? "l'accord écrit du propriétaire" : "le bail"}.</p>
<label>Nom de l'annonceur, si tu l'as (facultatif)<input id="va-nom" autocomplete="off" placeholder="Tel qu'il apparaît dans l'annonce ou les messages" value="${esc(A.nom)}"></label>
<label>Lien de l'annonce (facultatif)<input id="va-lien" type="url" inputmode="url" autocomplete="off" value="${esc(A.lien)}"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="va-ok" style="width:22px;height:22px;min-height:22px;margin-top:2px;flex-shrink:0;appearance:auto;-webkit-appearance:checkbox;accent-color:var(--blue);padding:0">Je comprends que le rapport se base sur les registres publics et le Web à la date de la vérification. Ce n'est pas une garantie : je visite et je signe le bail avant de payer quoi que ce soit.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Payer ${prixTxt()} par carte</button>
<p class="hint">En payant, tu acceptes les ${lienConditions}.</p>
<p class="hint">Le paiement se fait sur la page sécurisée de Stripe : HabitaScan ne voit jamais ton numéro de carte. Nous ne te transmettons aucun document sur le propriétaire, seulement le rapport.</p>
</form>${VAP.demo ? `<p class="demo">Démo : aucun paiement réel, tu pourras simuler le paiement.</p>` : ""}`;
}

/* Liste « Mes vérifications complètes » sur l'accueil */
export const blocMesApprofondies = `<div id="mes-approf"></div>`;
