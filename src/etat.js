/* État partagé de l'app. */

/* Toutes les données qui changent pendant l'utilisation et que plusieurs modules lisent ou modifient.
   Un seul objet, pour que chaque modification soit visible partout (les variables importées sont en lecture seule). */
export const etat = {
  fiche: {}, // la vérification en cours (annonce, réponses, résultat)
  session: false, // la session Supabase, ou false si personne n'est connecté
  profil: null, // le profil de la personne connectée
  historique: [], // ses vérifications passées
  alertes: [], // ses vérifications signalées ensuite par d'autres (alertes/alertes.js)
  loyers: {}, // loyers moyens SCHL par ville
  loyersInfo: {}, // période et source de ces loyers, par ville
  registrePret: false, // la liste des licences RBQ est chargée
  anonyme: true,
  estAdmin: false,
  lieuNote: false, // le lieu de connexion a déjà été noté pour cette session
};

export const nouveauF = (o) => {
  for (const k in etat.fiche) delete etat.fiche[k];
  Object.assign(etat.fiche, o);
};
