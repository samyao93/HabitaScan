/* Conditions d'utilisation (texte d'origine). */
import { VCFG, prixTxt } from "../approfondie/rapport.js";
import { RESPONSABLE } from "./confidentialite.js";
import { top } from "../utils/dom.js";
import { L_LPC, lienExt } from "../utils/liens.js";

export function vueConditions(back) {
  const R = RESPONSABLE;
  const s = (t, c) => `<div class="card"><h2>${t}</h2>${c}</div>`;
  return `${top(back, "Conditions")}
<h2>Conditions d'utilisation</h2>
<p class="hint">En vigueur le ${R.vigueur}. HabitaScan est exploité par ${R.entreprise}, ${R.adresse}. Courriel : ${R.courriel}.</p>
${s("1. Ce que fait HabitaScan", "<p>HabitaScan aide à repérer les signes de fraude dans une annonce de logement, à vérifier qui est le propriétaire, à estimer un budget d'installation et à vérifier un entrepreneur en rénovation. Les résultats sont calculés à partir de règles publiques, de données gouvernementales et de ce que tu entres.</p>")}
${s("2. Ce n'est pas une garantie", "<p><b>Un résultat vert ne garantit pas qu'une annonce est honnête,</b> et un résultat rouge ne prouve pas une fraude. HabitaScan ne remplace ni un avocat, ni un notaire, ni le Tribunal administratif du logement. Avant de payer quoi que ce soit : visite le logement, confirme le propriétaire et signe le bail.</p>")}
${s("3. Ton compte", "<p>Tu dois avoir 14 ans ou plus. Ton compte est personnel : garde l'accès à ton courriel ou à ton cellulaire pour toi. Tu peux supprimer ton compte en tout temps depuis l'accueil.</p>")}
${s(
  "4. Vérification complète payante",
  `<ul class="liste"><li>Prix : ${prixTxt()}, taxes incluses s'il y a lieu, payé par carte sur la page sécurisée de Stripe.</li>
<li>Nous vérifions : le propriétaire au Registre foncier ; si c'est une entreprise, son statut et ses dirigeants au registre des entreprises ; les photos de l'annonce ; les autres annonces du même logement. Tu reçois un rapport écrit avec un verdict et le nom du propriétaire inscrit (information publique du Registre foncier), à retrouver sur ton bail. Jamais de document sur le propriétaire.</li>
<li>Délai : ${VCFG.delai} h maximum après le paiement.</li>
<li><b>Remboursement complet</b> si nous ne livrons pas le rapport dans ce délai, ou si nous ne pouvons pas identifier le propriétaire. Écris-nous à ${R.courriel}.</li>
<li>Le rapport reflète les registres publics et le Web au moment de la vérification. Une vente récente peut ne pas encore être publiée, et une recherche sur le Web ne trouve pas tout.</li></ul>`,
)}
${s("5. Signalements", "<p>Signale seulement une annonce que tu crois vraiment frauduleuse, et choisis le bon motif. Un faux signalement peut nuire à une personne honnête : nous pouvons retirer un signalement et fermer un compte qui en abuse.</p>")}
${s("6. Utilisation interdite", "<ul class=\"liste\"><li>Utiliser l'app pour harceler, ficher ou retrouver une personne.</li><li>Collecter ou revendre automatiquement le contenu de l'app (robots, aspiration).</li><li>Contourner les limites d'usage ou la sécurité.</li><li>Entrer de fausses informations pour nuire à quelqu'un.</li></ul><p class=\"hint\">Des limites quotidiennes s'appliquent aux recherches automatiques, pour garder le service gratuit pour tout le monde.</p>")}
${s("7. Responsabilité", `<p>Nous faisons tout pour que l'information soit exacte et à jour, mais des données publiques peuvent contenir des erreurs ou dater. Dans les limites permises par la ${lienExt(L_LPC, "Loi sur la protection du consommateur")}, nous ne sommes pas responsables d'une décision prise seulement sur la base d'un résultat de l'app. Rien dans ces conditions ne limite les droits que cette loi te donne.</p>`)}
${s("8. Contenu et marque", "<p>Le nom HabitaScan, le logo et le code de l'app nous appartiennent. Les données gouvernementales utilisées restent soumises à leurs licences (par exemple CC-BY 4.0), et leurs sources sont citées dans l'app.</p>")}
${s("9. Modifications et droit applicable", `<p>Si ces conditions changent, nous l'indiquons dans l'app. Elles sont régies par les lois du Québec. En cas de désaccord, écris-nous d'abord à ${R.courriel}. Pour tes renseignements personnels, consulte la <button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>.</p>`)}`;
}

export const lienConditions = `<button type="button" class="lienbtn" data-go="conditions">conditions d'utilisation</button>`;
