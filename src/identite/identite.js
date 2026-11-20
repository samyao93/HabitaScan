/* Pièce d'identité : statut, envoi, alertes de la lecture automatique. */
import { chargerProfil } from "../compte/session.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { busy, err } from "../utils/dom.js";

export const STATUT = {
  aucune: "Identité non confirmée",
  en_attente: "Identité en vérification",
  confirmee: "Identité confirmée",
  refusee: "Identité refusée : recommence",
};

export async function envoyerPiece() {
  const doc = etat.fiche.doc || "permis";
  err("");
  busy(true, "Envoi sécurisé…");
  const uid = (await sb.auth.getUser()).data.user.id,
    stamp = Date.now();
  for (const s of ["recto", "verso"]) {
    const f = etat.fiche[s];
    if (!f) continue;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const { error } = await sb.storage
      .from("pieces-identite")
      .upload(`${uid}/${stamp}-${s}.${ext}`, f, { contentType: f.type, upsert: false });
    if (error) {
      busy(false, "Réessayer");
      return err("L'envoi de la photo a échoué. Vérifie ta connexion (photo de 8 Mo maximum).");
    }
  }
  let { error } = await sb.rpc("soumettre_identite", {
    doc_type: doc,
    p_prenom: etat.fiche.prenomDecl || null,
    p_nom: etat.fiche.nomDecl || null,
  });
  if (error && /PGRST20|function|fonction/i.test(String(error.code) + " " + String(error.message)))
    ({ error } = await sb.rpc("soumettre_identite", { doc_type: doc }));
  if (error) {
    busy(false, "Réessayer");
    return err("Une erreur est survenue. Réessaie.");
  }
  etat.fiche = {};
  await chargerProfil();
  go("identiteOk");
}

/* Alertes de la lecture automatique (l'alerte « déjà utilisée » n'est montrée qu'aux admins). */
export const ALERTES_ID = {
  pas_une_piece: "Ce n'est peut-être pas une pièce d'identité",
  illisible: "Photo difficile à lire",
  type_different: "Le type de pièce ne correspond pas à celui choisi",
  expiree: "Pièce expirée",
  expiration_inconnue: "Date d'expiration non lue",
  mineur: "Personne mineure",
  naissance_inconnue: "Date de naissance non lue",
  deja_utilisee: "Pièce déjà utilisée par un autre compte",
  nom_different: "Le nom lu sur la pièce ne correspond pas à celui écrit",
};
