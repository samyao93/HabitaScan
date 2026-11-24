/* Espace admin : appels Supabase (fonctions admin_*). */
import { sb } from "../config.js";
import { etat } from "../etat.js";

export const rpc = async (n, a) => {
  const { data, error } = await sb.rpc(n, a);
  if (error) throw error;
  return data;
};

const photosDe = async (id) => {
  const { data, error } = await sb.storage.from("pieces-identite").list(id, { limit: 20 });
  if (error) throw error;
  return (data || []).map((f) => `${id}/${f.name}`);
};

export const ADM = {
  demo: false,
  estAdmin: () => etat.estAdmin,
  stats: () => rpc("admin_stats"),
  identites: async () => (await rpc("admin_identites")) || [],
  async photos(id) {
    const p = await photosDe(id);
    if (!p.length) return [];
    const { data, error } = await sb.storage.from("pieces-identite").createSignedUrls(p, 300);
    if (error) throw error;
    return data.map((d) => d.signedUrl).filter(Boolean);
  },
  async decider(id, statut) {
    await rpc("admin_decider_identite", { p_id: id, p_statut: statut });
    const p = await photosDe(id);
    if (p.length) {
      const { error } = await sb.storage.from("pieces-identite").remove(p);
      if (error) throw error;
    }
  },
  signalements: async () => (await rpc("admin_signalements")) || [],
  retirerSignalements: (l) => rpc("admin_retirer_signalements", { p_lien: l }),
  async sauverParametre(cle, valeur) {
    const { error } = await sb.from("parametres").upsert({ cle, valeur, maj_le: new Date().toISOString() });
    if (error) throw error;
  },
  async sauverLoyer(ville, chambres, loyer) {
    const { data, error } = await sb
      .from("loyers_reference")
      .update({ loyer })
      .eq("ville", ville)
      .eq("chambres", chambres)
      .select("ville");
    if (error) throw error;
    if (!data || !data.length) {
      const r = await sb.from("loyers_reference").insert({ ville, chambres, loyer });
      if (r.error) throw r.error;
    }
  },
  async sauverMediane(ville, chambres, mediane, periode) {
    const { data, error } = await sb
      .from("loyers_reference")
      .update({ mediane, mediane_periode: periode })
      .eq("ville", ville)
      .eq("chambres", chambres)
      .select("ville");
    if (error) throw error;
    // Studio : la ligne n'existe pas encore (pas de loyer moyen), on la crée avec la médiane seule.
    if (!data || !data.length) {
      const r = await sb.from("loyers_reference").insert({ ville, chambres, mediane, mediane_periode: periode });
      if (r.error) throw r.error;
    }
  },
  async supprimerCompte() {
    const { error } = await sb.functions.invoke("supprimer-compte", { body: {} });
    if (error) throw error;
    await sb.auth.signOut();
    etat.profil = null;
    etat.historique = [];
    etat.session = false;
    etat.estAdmin = false;
  },
  console: "/admin",
  connexions: () => rpc("admin_connexions").then((d) => d || []),
  lieuxResume: () => rpc("admin_lieux_resume").then((d) => d || []),
  partageStats: () => rpc("admin_partage_stats").then((d) => (d && d[0]) || { partagent: 0, total: 0 }),
};
