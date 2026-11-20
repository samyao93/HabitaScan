/* Vérification complète : adaptateur Supabase (table demandes_verif). */
import { rpc } from "../admin/api.js";
import { PARAMS } from "../admin/parametres.js";
import { VCFG } from "./rapport.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";

export function ajouterParametresApprofondie() {
  PARAMS.push(
    { cle: "prix_verif", n: "Prix de la vérification complète ($)", get: () => VCFG.prix, set: (v) => (VCFG.prix = v) },
    {
      cle: "delai_verif_heures",
      n: "Délai de réponse promis (heures)",
      get: () => VCFG.delai,
      set: (v) => (VCFG.delai = v),
    },
  );
}

/* Adaptateur vérification approfondie (Supabase : table demandes_verif, paiement par lien Stripe, webhook stripe-webhook) */
export const VAP = {
  demo: false,
  courriel: () => (etat.profil && etat.profil.contact && etat.profil.contact.includes("@") ? etat.profil.contact : ""),
  async creer(d) {
    const { data, error } = await sb.from("demandes_verif").insert(d).select("id").single();
    if (error) throw error;
    return data.id;
  },
  async mes() {
    if (!etat.session) return [];
    const { data, error } = await sb
      .from("demandes_verif")
      .select("id,adresse,statut,verdict,note,created_at,paye_le,termine_le,rapport,verdict_global")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data || [];
  },
  adminListe: async () => (await rpc("admin_demandes_liste", { p_statut: "" })) || [],
  adminMaj: (id, statut, verdict, note) =>
    rpc("admin_maj_demande", { p_id: id, p_statut: statut, p_verdict: verdict, p_note: note || "" }),
  async sauverTexte(cle, valeur) {
    const { error } = await sb.from("parametres_texte").upsert({ cle, valeur, maj_le: new Date().toISOString() });
    if (error) throw error;
  },
};
