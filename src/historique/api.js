/* Adaptateur Supabase de l'historique. */
import { sb } from "../config.js";
import { etat } from "../etat.js";

/* Adaptateurs historique, compte, lieu (Supabase : table verifications, profil, fonctions *_connexion, fonction Vercel /api/lieu) */
export const HIS = {
  liste: () =>
    etat.historique.map((x) => ({
      id: x.id,
      module: x.module === "reno" ? "reno" : "logement",
      date: x.created_at,
      ville: x.ville,
      ch: x.chambres,
      prix: x.prix,
      c: x.couleur,
      lien: x.lien,
      travaux: x.travaux,
      licence: x.licence,
      raisons: Array.isArray(x.raisons) ? x.raisons : [],
    })),
  async supprimer(id) {
    const { error } = await sb.from("verifications").delete().eq("id", id);
    if (error) throw error;
    etat.historique = etat.historique.filter((x) => String(x.id) !== String(id));
  },
};
