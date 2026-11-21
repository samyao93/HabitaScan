/* Badge « Annonce vérifiée » : repérage du code dans l'annonce et raisons du verdict, sans affichage. */
import { esc } from "../utils/dom.js";

/* Code public : HS- suivi de 6 caractères sans I, L, O, 0, 1 (aucune confusion à la lecture). */
export const RE_BADGE = /\bHS[\s-]?([A-HJKMNP-Z2-9]{6})\b/i;

/* L'annonce prétend être vérifiée par HabitaScan (avec ou sans code). */
export const RE_MENTION_BADGE =
  /(v[ée]rifi[ée]e?s?\s+(par|sur|avec)\s+habita\s?scan|badge\s+habita\s?scan|habita\s?scan\s+v[ée]rifi)/i;

export function codeBadge(...textes) {
  const t = textes.filter(Boolean).join("\n");
  const m = t.match(RE_BADGE);
  return m ? "HS-" + m[1].toUpperCase() : null;
}

export const mentionBadge = (...textes) => RE_MENTION_BADGE.test(textes.filter(Boolean).join("\n"));

const dateFr = (d) => {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("fr-CA", { dateStyle: "long" });
  } catch (e) {
    return String(d || "");
  }
};

const LOI = "Badge Annonce vérifiée HabitaScan : Registre foncier, puis code envoyé par la poste au propriétaire.";

/* Raisons à ajouter au verdict. Un badge valide ne cache jamais un signal rouge : il s'ajoute aux autres. */
export function itemsBadge(F) {
  const r = F.badge,
    it = [];
  if (!r) {
    if (F.mentionBadge)
      it.push({
        c: "y",
        t: "<b>L'annonce se dit « vérifiée par HabitaScan », mais sans code de badge.</b> Un vrai badge porte un code HS-XXXXXX, que l'app vérifie toute seule. Sans code, cette mention ne prouve rien.",
        law: LOI,
      });
    return it;
  }
  const code = `<span class="num">${esc(r.code)}</span>`;
  const contacts = (r.contacts || []).map((c) => `<b class="num">${esc(c)}</b>`).join(", ");
  if (r.statut === "inconnu")
    it.push({
      c: "r",
      t: `<b>Faux badge HabitaScan.</b> Le code ${code} n'existe pas. Une annonce qui invente un badge cherche à gagner ta confiance : ne paie rien.`,
      law: LOI,
    });
  else if (r.statut === "revoque")
    it.push({
      c: "r",
      t: `<b>Badge retiré par HabitaScan.</b> Le code ${code} n'est plus valide. Ne paie rien.`,
      law: LOI,
    });
  else if (r.statut === "suspendu")
    it.push({
      c: "r",
      t: `<b>Badge suspendu.</b> Les coordonnées de ce propriétaire ont été signalées ${+r.signalements} fois depuis sa vérification. Ne paie rien.`,
      law: LOI,
    });
  else if (r.statut === "expire")
    it.push({
      c: "y",
      t: `<b>Badge expiré.</b> Le propriétaire n'a pas renouvelé sa preuve${r.expire_le ? ` (fin le ${esc(dateFr(r.expire_le))})` : ""}. L'immeuble a pu être vendu depuis : vérifie le propriétaire.`,
      law: LOI,
    });
  else if (r.statut === "valide") {
    const ou = `${esc(r.rue || "")}${r.ville ? `, ${esc(r.ville)}` : ""}`;
    const bail =
      r.type === "entreprise" ? `au nom de l'entreprise <b>${esc(r.nom)}</b>` : `au nom de <b>${esc(r.nom)}</b>`;
    const autres =
      +r.immeubles > 1
        ? ` (et de ${+r.immeubles - 1} autre${+r.immeubles > 2 ? "s" : ""} immeuble${+r.immeubles > 2 ? "s" : ""})`
        : "";
    if (r.par_contact && r.ville_correspond === false)
      it.push({
        c: "y",
        t: `<b>Ce contact est celui d'un propriétaire vérifié, mais pour un immeuble à ${esc(r.ville)}</b>, pas à ${esc(F.ville)}. Demande l'adresse exacte du logement avant d'aller plus loin.`,
        law: LOI,
      });
    else if (r.par_contact)
      it.push({
        c: "g",
        t: `<b>Propriétaire vérifié par HabitaScan.</b> Le numéro ou le courriel de cette annonce est celui de ${esc(r.nom)}, qui a prouvé le ${esc(dateFr(r.verifie_le))} être propriétaire de l'immeuble ${ou}${autres}. Vérifie que le logement est à cette adresse, ne parle qu'à ce numéro ou ce courriel, et signe le bail ${bail}.`,
        law: `${LOI} Valide jusqu'au ${esc(dateFr(r.expire_le))}.`,
      });
    else if (r.ville_correspond === false)
      it.push({
        c: "r",
        t: `<b>Badge d'un autre immeuble.</b> Le code ${code} est celui d'un immeuble à ${esc(r.ville)}, pas à ${esc(F.ville)}. Un badge recopié dans une autre annonce est un signe de fraude.`,
        law: LOI,
      });
    else if (r.contact_correspond === false)
      it.push({
        c: "r",
        t: `<b>Badge copié.</b> Le code ${code} appartient à un propriétaire vérifié, mais le numéro ou le courriel de l'annonce n'est pas le sien. Ses coordonnées vérifiées : ${contacts}. Ne paie rien et ne parle qu'à ces coordonnées.`,
        law: LOI,
      });
    else if (r.contact_correspond === true)
      it.push({
        c: "g",
        t: `<b>Annonce vérifiée HabitaScan.</b> ${esc(r.nom)} a prouvé le ${esc(dateFr(r.verifie_le))} être propriétaire de l'immeuble ${ou}, et le contact de l'annonce est bien le sien. Vérifie que le logement est sur cette rue, et signe le bail ${bail}.`,
        law: `${LOI} Valide jusqu'au ${esc(dateFr(r.expire_le))}.`,
      });
    else
      it.push({
        c: "y",
        t: `<b>Badge valide, mais rien ne montre que tu parles au vrai propriétaire.</b> L'annonce n'a ni numéro ni courriel. Le badge ${code} est celui de l'immeuble ${ou} ; ses coordonnées vérifiées sont ${contacts}. Demande à la personne de t'écrire ou de t'appeler de l'une d'elles, puis entre-la dans « Téléphone ou courriel de l'annonceur ».`,
        law: LOI,
      });
  }
  return it;
}

/* Statuts du côté propriétaire */
export const STATUTS_BADGE = {
  demande: ["y", "En vérification"],
  lettre_envoyee: ["y", "Lettre envoyée"],
  verifie: ["g", "Vérifié"],
  expire: ["i", "Expiré"],
  refuse: ["r", "Refusé"],
  revoque: ["r", "Retiré"],
  bloque: ["r", "Bloqué"],
};

/* Texte à coller dans l'annonce */
export const texteAnnonce = (code) =>
  `Annonce vérifiée HabitaScan : ${code}. Le propriétaire a prouvé qu'il possède l'immeuble. Vérifie ce code dans l'app HabitaScan (habitascan.vercel.app).`;
