/* Mémoire collective : annonces recopiées et contacts déjà signalés. */
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { SEUIL_ROUGE } from "../signalements/signalements.js";
import { esc, money } from "../utils/dom.js";

export async function retrouverAnnonce() {
  if (!etat.session || (!etat.fiche.photos.length && !etat.fiche.texteEmp)) return null;
  try {
    const { data, error } = await sb.rpc("retrouver_annonce", {
      p_photos: etat.fiche.photos,
      p_texte: etat.fiche.texteEmp,
      p_prix: etat.fiche.prixN || null,
      p_ville: etat.fiche.ville || null,
      p_lien: etat.fiche.lienN || null,
    });
    return error ? null : data;
  } catch (e) {
    return null;
  }
}

export function itemsRecopie(r) {
  const it = [];
  if (!r || !r.vues) return it;
  const n = +r.vues,
    rg = +r.rouges || 0;
  const pers = (x) => (x > 1 ? `${x} personnes` : "une personne");
  if ((r.autres_prix || []).length)
    it.push({
      c: "y",
      t: `<b>Les mêmes photos ou le même texte apparaissent dans une autre annonce, à un autre prix</b> (${r.autres_prix.map((p) => money(+p)).join(", ")}). Une annonce copiée avec un prix différent est un signe classique de fraude.`,
      law: "Mémoire collective HabitaScan : vérifications faites par d'autres utilisateurs, sur d'autres sites.",
    });
  if ((r.autres_villes || []).length)
    it.push({
      c: "y",
      t: `<b>Les mêmes photos ou le même texte ont été vus dans une annonce d'une autre ville</b> (${r.autres_villes.map(esc).join(", ")}). Les fraudeurs réutilisent les photos d'un logement ailleurs.`,
      law: "Mémoire collective HabitaScan.",
    });
  if (rg)
    it.push({
      c: rg >= 2 ? "r" : "y",
      t: `<b>Cette annonce a déjà été vérifiée ailleurs par ${pers(n)}, dont ${rg} avec le résultat «&nbsp;Ne paie pas&nbsp;».</b> Mêmes photos ou même texte, sur un autre lien.`,
      law: "Mémoire collective HabitaScan.",
    });
  else if (!it.length)
    it.push({
      c: "i",
      t: `<b>Cette annonce (mêmes photos ou même texte, même prix) a déjà été vue sur un autre site par ${pers(n)}.</b> C'est normal si le propriétaire la publie à plusieurs endroits : compare simplement le numéro et le nom de l'annonceur.`,
      law: "Mémoire collective HabitaScan.",
    });
  return it;
}

export async function memoire(c, photos) {
  c = c || { tels: [], courriels: [] };
  if (!etat.session || (!c.tels.length && !c.courriels.length && !(photos || []).length)) return null;
  try {
    const { data, error } = await sb.rpc("memoire_collective", {
      p_tels: c.tels,
      p_courriels: c.courriels,
      p_photos: photos || [],
    });
    return error ? null : data;
  } catch (e) {
    return null;
  }
}

export function itemsMemoire(m) {
  const it = [];
  if (!m) return it;
  const max = (L) => Math.max(0, ...(L || []).map(Number)),
    nt = max(m.tels),
    nc = max(m.courriels),
    np = +m.photo || 0;
  const item = (n, quoi, fem) => ({
    c: n >= SEUIL_ROUGE ? "r" : "y",
    t: `<b>${quoi} a déjà été signalé${fem ? "e" : ""} ${n} fois</b> par ${n > 1 ? "des utilisateurs" : "un utilisateur"} à l'identité confirmée.${n >= SEUIL_ROUGE ? " Ne paie rien." : " Redouble de prudence."}`,
    law: "Mémoire collective HabitaScan : chaque signalement avertit les personnes suivantes.",
  });
  if (nt) it.push(item(nt, "Ce numéro de téléphone"));
  if (nc) it.push(item(nc, "Ce courriel"));
  if (np) it.push(item(np, "Cette photo", true));
  return it;
}

export const peutSignaler = (F) =>
  !!(
    F.lienN ||
    (F.contacts && (F.contacts.tels.length || F.contacts.courriels.length)) ||
    (F.photos && F.photos.length)
  );

export function resumeSignal(F) {
  const c = F.contacts || { tels: [], courriels: [] },
    p = F.photos || [],
    L = [];
  if (F.lienN) L.push("le lien de l'annonce");
  if (c.tels.length) L.push(c.tels.length > 1 ? `${c.tels.length} numéros de téléphone` : "le numéro de téléphone");
  if (c.courriels.length) L.push(c.courriels.length > 1 ? `${c.courriels.length} courriels` : "le courriel");
  if (p.length) L.push(p.length > 1 ? `${p.length} photos` : "la photo");
  return L.length
    ? `<p class="lu">Ce signalement portera sur : ${L.join(", ")}. Les numéros et courriels sont gardés seulement sous forme chiffrée, jamais en clair.</p>`
    : "";
}
