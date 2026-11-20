/* Session : ouverture, envoi du code, messages d'erreur, chargement du profil. */
import { rpc } from "../admin/api.js";
import { noterLieu } from "./lieu.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";

/* Compte facultatif : chaque appareil reçoit une session anonyme ; créer un compte la relie à un courriel ou un cellulaire (même historique). */
/* Compte obligatoire : une session existe seulement après la validation du code (courriel ou cellulaire). */
export async function ouvrirSession() {
  try {
    const { data } = await sb.auth.getSession();
    const u = data.session && data.session.user;
    etat.session = !!u && !u.is_anonymous;
    etat.anonyme = !etat.session;
  } catch (e) {
    etat.session = false;
    etat.anonyme = true;
  }
}

export async function envoyerCode() {
  if (etat.session && etat.anonyme) {
    etat.fiche.typeCode = etat.fiche.cible.email ? "email_change" : "phone_change";
    const r = await sb.auth.updateUser(etat.fiche.cible);
    const m = ((r.error && r.error.message) || "").toLowerCase();
    if (!r.error || !(m.includes("already") || m.includes("registered") || m.includes("exists"))) return r;
  }
  etat.fiche.typeCode = etat.fiche.cible.email ? "email" : "sms";
  return sb.auth.signInWithOtp({ ...etat.fiche.cible, options: { shouldCreateUser: true } });
}

export async function chargerProfil() {
  if (!etat.session) {
    etat.profil = null;
    etat.historique = [];
    etat.estAdmin = false;
    return;
  }
  const { data } = await sb.from("profiles").select("*").maybeSingle();
  etat.profil = data;
  try {
    etat.estAdmin = !!(await rpc("est_admin"));
  } catch (e) {
    etat.estAdmin = false;
  }
  const h = await sb
    .from("verifications")
    .select("id,module,ville,chambres,prix,couleur,raisons,lien,travaux,licence,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  etat.historique = h.data || [];
  noterLieu();
}

export const msgAuth = (e) => {
  const m = ((e && e.message) || "").toLowerCase();
  if (m.includes("rate") || m.includes("seconds"))
    return "Trop de demandes. Attends une minute avant de redemander un code.";
  if (m.includes("phone") || m.includes("sms") || m.includes("provider"))
    return "L'envoi par SMS n'est pas encore activé. Utilise ton courriel.";
  if (m.includes("expired") || m.includes("invalid")) return "Code incorrect ou expiré.";
  if (m.includes("sending") || m.includes("email") || (e && e.status === 500))
    return "Le courriel n'a pas pu être envoyé. Vérifie l'adresse, puis réessaie dans quelques minutes.";
  return "Une erreur est survenue. Réessaie dans un instant.";
};
