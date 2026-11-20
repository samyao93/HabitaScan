// Suppression du compte par l'utilisateur lui-même (Loi 25 : droit de faire supprimer ses renseignements).
// Supprime les photos de pièce d'identité, puis le compte. Les lignes de l'utilisateur dans les tables
// (profil, vérifications, signalements, quotas, connexions…) partent avec lui : clés étrangères ON DELETE CASCADE.
// Utilise la clé service_role, fournie automatiquement aux fonctions par Supabase (jamais dans l'app).
import { avantTraitement, clientServeur, json } from "../_shared/commun.ts";

Deno.serve(async (req) => {
  const refus = avantTraitement(req);
  if (refus) return refus;

  const jeton = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const admin = clientServeur();

  // Qui fait la demande : seulement l'utilisateur connecté, pour son propre compte.
  const { data: u, error: eu } = await admin.auth.getUser(jeton);
  if (eu || !u?.user) return json(req, { error: "non_connecte" }, 401);
  const uid = u.user.id;

  // 1. Photos de pièce d'identité (le stockage n'est pas supprimé en cascade)
  const { data: fichiers } = await admin.storage.from("pieces-identite").list(uid, { limit: 100 });
  if (fichiers && fichiers.length) {
    await admin.storage.from("pieces-identite").remove(fichiers.map((f) => `${uid}/${f.name}`));
  }
  // 2. Le compte, et par cascade toutes ses lignes
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return json(req, { error: "suppression" }, 500);
  return json(req, { ok: true });
});
