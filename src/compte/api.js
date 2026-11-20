/* Adaptateur Supabase du compte. */
import { etat } from "../etat.js";
import { STATUT } from "../identite/identite.js";

export const CPT = {
  courriel: () => (etat.profil && etat.profil.contact) || "",
  statut: () => {
    const k = (etat.profil && etat.profil.identite_statut) || "aucune";
    return {
      t:
        k === "confirmee" && etat.profil.identite_prenom
          ? `Identité confirmée · ${etat.profil.identite_prenom}${etat.profil.identite_nom ? " " + etat.profil.identite_nom + "." : ""}`
          : STATUT[k] || "Connecté",
      couleur: k === "confirmee" ? "var(--ok)" : k === "refusee" ? "var(--red)" : "var(--amber)",
    };
  },
};
