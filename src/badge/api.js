/* Badge « Annonce vérifiée » : appels Supabase (fonctions demander_badge, verifier_badge…). */
import { rpc } from "../admin/api.js";
import { codeBadge, mentionBadge } from "./regles.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";

export const BADGE = {
  demander: (d) =>
    rpc("demander_badge", {
      p_adresse: d.adresse,
      p_ville: d.ville || null,
      p_lot: d.lot || null,
      p_nom: d.nom,
      p_type: d.type,
      p_neq: d.neq || null,
      p_tels: d.tels,
      p_courriels: d.courriels,
      p_consentement: true,
    }),
  mes: async () => (await rpc("mes_badges")) || [],
  confirmer: (id, code) => rpc("confirmer_badge", { p_id: id, p_code: code }),
  adminListe: async (statut) => (await rpc("admin_badges", { p_statut: statut || "" })) || [],
  adminLettre: (id) => rpc("admin_badge_lettre", { p_id: id }),
  adminDecider: (id, statut, motif) => rpc("admin_badge_decider", { p_id: id, p_statut: statut, p_motif: motif || "" }),
};

/* Pendant la vérification d'une annonce publiée ailleurs (Kijiji, Facebook…) : reconnaît le code du badge,
   ou à défaut le numéro ou le courriel d'un propriétaire vérifié. */
export async function badgeDeLAnnonce(F) {
  const textes = [F.annonce, F.ocrTxt, F.txt, F.contact];
  F.mentionBadge = mentionBadge(...textes);
  const code = codeBadge(...textes);
  const c = F.contacts || {};
  if (!etat.session || (!code && !(c.tels || []).length && !(c.courriels || []).length)) return null;
  try {
    const { data, error } = await sb.rpc("verifier_badge", {
      p_code: code,
      p_tels: c.tels || [],
      p_courriels: c.courriels || [],
      p_ville: F.ville || null,
    });
    return error || !data || data.statut === "quota" ? null : data;
  } catch (e) {
    return null;
  }
}
