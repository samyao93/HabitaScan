/* Faits concrets affichés sous certains signaux du verdict, chacun avec sa source publique.
   Règle : aucun chiffre sans source vérifiable. Les chiffres américains sont dits « aux États-Unis ».
   Pour ajouter un fait : une phrase courte, la source entre parenthèses, et le lien vers la page qui le dit. */

const SPVM =
  '<a href="https://spvm.qc.ca/fr/Fiches/Details/Fraude-Location-dun-logement" target="_blank" rel="noopener">SPVM</a>';
const BBB =
  '<a href="https://www.bbb.org/all/scamstudies/is_that_rental_listing_real_scam/is_that_rental_listing_real_full_study" target="_blank" rel="noopener">BBB, étude sur les fausses annonces</a>';
const LA_PRESSE =
  '<a href="https://www.lapresse.ca/actualites/2024-02-27/crise-du-logement/faux-logis-a-bon-prix.php" target="_blank" rel="noopener">La Presse, 2024</a>';

export const FAITS = {
  depot: {
    t: "À Montréal, les fraudeurs demandent en moyenne un dépôt d'un ou deux mois de loyer, soit de 500 $ à 1 200 $, par virement et avant même la visite.",
    src: SPVM,
  },
  paiement: {
    t: "Virement d'argent (Western Union, MoneyGram), cartes-cadeaux et cartes prépayées : ce sont les moyens de paiement des fausses locations contre lesquels le Better Business Bureau met en garde. L'argent envoyé ainsi est presque impossible à récupérer.",
    src: BBB,
  },
  etranger: {
    t: "Le faux propriétaire « à l'étranger » qui ne peut pas faire visiter est l'un des scénarios de fraude au logement décrits par la police de Montréal.",
    src: SPVM,
  },
  messagerie: {
    t: "Dans la fraude décrite par le SPVM, le faux locateur demande de poursuivre la discussion dans une application de messagerie, loin de la plateforme d'annonces.",
    src: SPVM,
  },
  copie: {
    t: "Les fraudeurs recopient souvent la description et les photos de vraies annonces, parfois périmées. Une étude de l'Université de New York a trouvé 29 000 fausses annonces de location sur 2 millions examinées.",
    src: `${LA_PRESSE} · ${BBB}`,
  },
  visite: {
    t: "Aux États-Unis, une personne sur trois qui a perdu de l'argent dans une fausse location a perdu plus de 1 000 $.",
    src: `Sondage Apartment List, cité par ${BBB}`,
  },
  prix: {
    t: "Un loyer anormalement bas fait partie des signes d'alerte du Bureau de la concurrence du Canada pour les fausses annonces de logement.",
    src: LA_PRESSE,
  },
};

/* Choisit le fait qui correspond au mot de scénario repéré. */
export function faitScenario(mot) {
  if (/whatsapp|telegram/.test(mot)) return FAITS.messagerie;
  if (/tranger|pays|country|voyage|missionnaire|poste|clés|cles/.test(mot)) return FAITS.etranger;
  return null;
}

/* HTML du fait, sous le texte du signal. */
export const htmlFait = (f) =>
  f ? `<div class="fait"><b>Le savais-tu ?</b> ${f.t} <span>(${f.src})</span></div>` : "";
