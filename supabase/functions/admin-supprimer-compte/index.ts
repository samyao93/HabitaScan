// Suppression d'un compte par un administrateur (console d'administration).
// Réservé aux comptes de la table admins ; on ne peut supprimer ni son propre compte ni celui d'un autre admin.
// Les lignes du compte partent avec lui (ON DELETE CASCADE). L'action est inscrite au journal d'administration.
import { avantTraitement, clientServeur, estUuid, json } from "../_shared/commun.ts";

Deno.serve(async (req) => {
  const refus = avantTraitement(req);
  if (refus) return refus;

  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const admin = clientServeur();

  const { data: u, error: eu } = await admin.auth.getUser(jeton);
  if (eu || !u?.user) return json(req, { error: "non_connecte" }, 401);
  const moi = u.user.id;
  const { data: estAdmin } = await admin.from("admins").select("user_id").eq("user_id", moi).maybeSingle();
  if (!estAdmin) return json(req, { error: "reserve_aux_admins" }, 403);

  let cible = "";
  try { cible = String((await req.json()).user_id || ""); } catch (_) { /* corps invalide */ }
  if (!estUuid(cible)) return json(req, { error: "identifiant" }, 400);
  if (cible === moi) return json(req, { error: "soi_meme" }, 400);
  const { data: estCibleAdmin } = await admin.from("admins").select("user_id").eq("user_id", cible).maybeSingle();
  if (estCibleAdmin) return json(req, { error: "cible_admin" }, 400);

  const { data: prof } = await admin.from("profiles").select("contact").eq("id", cible).maybeSingle();
  const { data: monProf } = await admin.from("profiles").select("contact").eq("id", moi).maybeSingle();

  const { data: fichiers } = await admin.storage.from("pieces-identite").list(cible, { limit: 100 });
  if (fichiers && fichiers.length) {
    await admin.storage.from("pieces-identite").remove(fichiers.map((f) => `${cible}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(cible);
  if (error) return json(req, { error: "suppression" }, 500);
  await admin.from("admin_journal").insert({
    admin_id: moi, admin_contact: monProf?.contact || null, action: "supprimer_compte", cible: prof?.contact || cible,
  });
  return json(req, { ok: true });
});
