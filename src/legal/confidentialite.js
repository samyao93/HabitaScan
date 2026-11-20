/* Politique de confidentialité (texte d'origine, remplacé par la version publiée dans la console s'il y en a une). */
import { lienConditions } from "./conditions.js";
import { top } from "../utils/dom.js";
import { L_CAI, L_LOI, lienExt } from "../utils/liens.js";

// Coordonnées à remplir avant la mise en ligne (Loi 25 : titre et coordonnées de la personne responsable).
export const RESPONSABLE = {
  nom: "[Prénom Nom]",
  titre: "[titre]",
  entreprise: "[nom de l'entreprise]",
  courriel: "[confidentialite@exemple.ca]",
  adresse: "[adresse postale]",
  vigueur: "[date de mise en ligne]",
};

export function vueConfidentialite(back) {
  const R = RESPONSABLE;
  const t = (rows, h) =>
    `<table class="tvilles"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `${top(back, "Confidentialité")}
<h2>Politique de confidentialité</h2>
<p class="hint">En vigueur le ${R.vigueur}.</p>
<div class="card"><h2>En bref</h2>
<ul class="liste"><li>Nous recueillons le minimum : ton courriel ou ton numéro pour te connecter, et le résumé de tes vérifications pour ton historique.</li>
<li>Le texte des annonces, tes conversations et tes captures d'écran sont lus <b>sur ton téléphone</b>. Si tu actives l'analyse intelligente, ils sont envoyés à Anthropic pour l'analyse. Nous ne les conservons jamais.</li>
<li>Aucune vente de renseignements, aucune publicité, aucun profilage ni suivi publicitaire.</li>
<li>Ta ville de connexion n'est jamais notée sans ton accord : cette fonction est désactivée par défaut et tu l'actives toi-même dans Mon compte.</li>
<li>Tu peux consulter, corriger ou supprimer tes renseignements en tout temps.</li></ul>
<p class="hint">Voir aussi les ${lienConditions}.</p>
<p class="hint">Cette politique respecte la ${lienExt(L_LOI, "Loi sur la protection des renseignements personnels dans le secteur privé")}, modifiée par la Loi 25. L'app s'adresse aux personnes de 14 ans et plus.</p></div>
<div class="card"><h2>Personne responsable</h2><p>${R.nom}, ${R.titre}, ${R.entreprise}<br>Courriel : ${R.courriel}<br>${R.adresse}</p>
<p class="hint">Écris-lui pour toute question, demande d'accès, de correction ou de suppression, ou pour porter plainte.</p></div>
<div class="card"><h2>Ce que nous recueillons</h2>${t(
    [
      ["Courriel ou cellulaire", "Te connecter avec un code, retrouver ton compte, compter les utilisateurs"],
      [
        "Résumé de tes vérifications : ville, chambres, loyer, lien, résultat ; travaux et licence RBQ ; empreintes non réversibles des photos et du texte de l'annonce (jamais les photos ni le texte eux-mêmes)",
        "Ton historique, et reconnaître la même annonce publiée ailleurs. Les autres voient seulement des nombres, des prix et des villes, jamais qui a vérifié",
      ],
      [
        "Signalement : lien de l'annonce, numéros de téléphone et courriels de l'annonceur (seulement en empreinte chiffrée, jamais en clair), empreinte visuelle des photos (la photo ne quitte pas ton téléphone), et motif",
        "Avertir les autres utilisateurs (mémoire collective). Ils voient seulement un nombre",
      ],
      [
        "Photo de pièce d'identité, seulement pour signaler",
        "Éviter les fausses accusations. Lue automatiquement pour pré-remplir les informations, puis vérifiée par l'équipe. Supprimée après la vérification",
      ],
      [
        "Informations lues sur la pièce : prénom, nom, année de naissance, date d'expiration, province ou pays ; empreinte chiffrée du numéro (jamais le numéro lui-même)",
        "Vérifier l'identité, repérer une pièce expirée, une personne mineure ou une pièce utilisée par deux comptes. Une fois l'identité confirmée, seuls le prénom, l'initiale du nom et la date d'expiration sont gardés ; tout est effacé si elle est refusée",
      ],
      ["Ville, chambres et budget de « Trouver »", "Chercher des annonces. Non conservés"],
      [
        "Vérification complète : adresse, lot, lien de l'annonce et, si tu le donnes, le nom de l'annonceur",
        "Faire la vérification que tu as payée et te remettre le rapport. Le rapport donne le nom du propriétaire inscrit au Registre foncier (information publique), sans aucun document",
      ],
      [
        "Compteurs d'utilisation (écrans ouverts par jour) et erreurs techniques",
        "Améliorer l'app. Compteurs sans lien avec ton compte ; erreurs sans renseignement personnel",
      ],
      [
        "Ville approximative de connexion, seulement si tu l'actives dans Mon compte : ville, région, pays (déduits de l'adresse IP, sans GPS ni adresse IP conservée) et type d'appareil",
        "Repérer une connexion inhabituelle sur ton compte et savoir quelles régions nous servons. Visible seulement par les administrateurs",
      ],
      [
        "Analyse intelligente, seulement si tu l'actives : captures et texte de l'annonce, réponse de l'annonceur et captures de la discussion",
        "Extraire les informations et repérer les signaux d'arnaque, surtout dans la conversation. Envoyés à Anthropic pour l'analyse, jamais conservés par HabitaScan",
      ],
      [
        "Numéros de téléphone et courriels de l'annonceur trouvés dans l'annonce ou la conversation",
        "Vérifier s'ils ont déjà été signalés. Comparés puis oubliés, sauf si tu les signales (empreinte chiffrée seulement)",
      ],
    ],
    ["Renseignement", "Pourquoi"],
  )}
<p class="hint"><b>Restent sur ton téléphone :</b> le texte des annonces et des conversations, tes captures (sauf si la recherche des photos est activée : envoyée à Google Cloud Vision puis oubliée), la photo du compte de taxes, ton budget et ton revenu.</p>
<p class="hint"><b>Résultat automatique :</b> le verdict est calculé à partir de règles publiques. Il porte sur l'annonce, pas sur toi. Tu peux demander quelles règles ont mené à un résultat.</p></div>
<div class="card"><h2>Fournisseurs, dont hors du Québec</h2>${t(
    [
      ["Supabase (base de données, connexion)", "Données à Montréal (AWS Canada Centre) ; entreprise américaine"],
      ["Vercel (pages de l'app)", "États-Unis : adresse IP ; si tu l'actives, Vercel en déduit ta ville approximative"],
      ["jsDelivr (bibliothèques de l'app)", "Réseau mondial : adresse IP"],
      [
        "Tavily (« Trouver » et recherche des copies d'une annonce)",
        "États-Unis : mots de la recherche ou une phrase de l'annonce, sans ton nom",
      ],
      ["Google Cloud Vision, si activé", "États-Unis : capture envoyée pour la recherche"],
      [
        "Stripe (paiement de la vérification complète)",
        "Entreprise américaine : courriel et carte. HabitaScan ne voit jamais le numéro de carte",
      ],
      [
        "Anthropic (analyse intelligente, si tu l'actives ; lecture de la pièce d'identité)",
        "Entreprise américaine : captures et texte envoyés pour l'analyse ; photo de la pièce envoyée pour la lecture, sans copie conservée",
      ],
    ],
    ["Fournisseur", "Où et quoi"],
  )}
<p class="hint">Avant de confier des renseignements hors du Québec, nous évaluons s'ils seront protégés adéquatement (art. 17 de la loi). Nous ne communiquons rien d'autre sans ton consentement, sauf dans les cas prévus par la loi.</p></div>
<div class="card"><h2>Conservation et sécurité</h2>
<ul class="liste"><li>Compte et historique : jusqu'à la suppression du compte, ou [24] mois sans connexion.</li>
<li>Pièce d'identité : supprimée dès la vérification, au plus tard [30] jours après l'envoi.</li>
<li>Signalements : [12] mois.</li>
<li>Ville approximative de connexion : 90 jours au plus, 20 connexions au plus ; effacée dès que tu désactives la fonction.</li>
<li>Échanges chiffrés (HTTPS) ; chaque utilisateur ne lit que ses propres renseignements.</li>
<li>En cas d'incident présentant un risque de préjudice sérieux, nous avisons la Commission d'accès à l'information et les personnes touchées.</li></ul></div>
<div class="card"><h2>Tes droits</h2>
<p>Accès et copie de tes renseignements, correction, suppression, retrait du consentement. Réponse dans les 30 jours, gratuitement.</p>
<p class="hint">Tu peux supprimer ton compte toi-même dans Mon compte, et retirer une vérification de ton historique à partir de son détail. En cas de désaccord, tu peux t'adresser à la ${lienExt(L_CAI, "Commission d'accès à l'information")}.</p></div>`;
}

export const lienConfidentialite = `<button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>`;
