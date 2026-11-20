/* Vérif-Réno : licence RBQ, type de travaux, délai d'annulation (LPC). */
import { esc } from "../utils/dom.js";
import { lien } from "../utils/liens.js";
import { aujourdhui, chiffres, formatLicence, jourLong, sansAccent } from "../utils/texte.js";

export const LIENS = {
  rbq: "https://www.rbq.gouv.qc.ca/vous-etes/citoyen/verifier-la-licence-dun-entrepreneur",
  souscat: "https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Publications/francais/AnnexeListeSousCategories.pdf",
  general: "https://www.rbq.gouv.qc.ca/licence/determiner-vos-sous-categories-de-licence/entrepreneur-general/",
  opc: "https://www.opc.gouv.qc.ca/se-renseigner/",
  itinerant: "https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document8.pdf",
  lpc601: "https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document6.pdf",
  art46: "https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Decisions/decision_5800-8673_9369-5013-Quebec-inc.pdf",
};

/* art7 : contrat signé à domicile = commerce itinérant, même si le client a invité l'entrepreneur (Règlement, art. 7). */
export const TRAVAUX = {
  toiture: { l: "Toiture, isolation, revêtement extérieur", sc: ["7"], nomSc: "7", art7: true },
  portes: { l: "Portes et fenêtres", sc: ["8"], nomSc: "8", art7: true },
  plomberie: { l: "Plomberie", sc: ["15.5"], nomSc: "15.5", corp: "CMMTQ" },
  chauffage: { l: "Chauffage", sc: ["15.1", "15.2", "15.3", "15.4"], nomSc: "15.1 à 15.4", corp: "CMMTQ" },
  electricite: { l: "Électricité", sc: [], nomSc: "licence de la CMEQ", corp: "CMEQ" },
  general: { l: "Rénovation générale (cuisine, salle de bain…)", sc: ["1.2", "1.3"], nomSc: "1.2 ou 1.3" },
};

export const GENERAL = ["1.2", "1.3"];

/* Nom d'entreprise sur la soumission ≈ nom inscrit à la RBQ (l'un contient l'autre, sans « inc. », « ltée »…).
   Ne pas confondre avec memeNom (module propriétaire), qui compare des noms de personnes. */
export function memeEntreprise(a, b) {
  const x = sansAccent(a),
    y = sansAccent(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

/* Délai de 10 jours (LPC art. 59) : le jour de départ ne compte pas ; une échéance un samedi, un dimanche,
   le 26 décembre ou le 2 janvier est reportée (LPC art. 269). Les autres jours fériés ne sont pas calculés. */
export function dateLimite(iso) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + 10);
  const ferie = (x) =>
    x.getDay() === 6 ||
    x.getDay() === 0 ||
    (x.getMonth() === 11 && x.getDate() === 26) ||
    (x.getMonth() === 0 && x.getDate() === 2);
  while (ferie(d)) d.setDate(d.getDate() + 1);
  return d;
}

/* R = fiche de la liste des licences actives de la RBQ ({numero,nom,autres_noms,sous_categories,mandataire})
   ou null si introuvable ; R === undefined quand la liste n'est pas disponible (démo, ou pas encore importée). */
export function analyserReno(F, R) {
  const it = [],
    T = TRAVAUX[F.travaux],
    lic = chiffres(F.licence);
  const L46 = "Loi sur le bâtiment, art. 46 · " + lien(LIENS.art46, "RBQ"),
    LSC = "Liste des sous-catégories · " + lien(LIENS.souscat, "RBQ");
  if (!lic)
    it.push({
      c: "y",
      t: "<b>Aucun numéro de licence RBQ.</b> Demande-le : la loi exige une licence pour faire des travaux, et sans licence il n'y a pas de cautionnement pour t'indemniser.",
      law: L46,
    });
  else if (R === undefined)
    it.push({
      c: "i",
      t: `<b>Licence ${esc(formatLicence(lic))} :</b> vérifie-la dans le registre officiel (bouton plus bas). Dans la version complète, l'app la compare seule à la liste des licences actives, mise à jour chaque jour.`,
      law: L46,
    });
  else if (R === null)
    it.push({
      c: "r",
      t: `<b>Licence ${esc(formatLicence(lic))} introuvable</b> dans la liste des licences actives de la RBQ. Vérifie le numéro ; s'il est exact, l'entreprise n'a pas de licence en vigueur.`,
      law: L46,
    });
  else {
    it.push({
      c: "g",
      t: `<b>Licence active</b> : ${esc(String(R.nom || formatLicence(lic)).replace(/\.$/, ""))}.`,
      law: "Liste des licences actives, RBQ (données ouvertes)",
    });
    if (F.nom && F.nom.trim() && !memeEntreprise(F.nom, R.nom) && !memeEntreprise(F.nom, R.autres_noms))
      it.push({
        c: "y",
        t: `<b>Le nom sur la soumission (« ${esc(F.nom)} ») ne correspond pas</b> au nom de la licence (« ${esc(R.nom)} »). Utiliser la licence d'une autre entreprise est interdit : demande une explication.`,
        law: L46,
      });
    const sc = String(R.sous_categories || ""),
      aSc = (x) => new RegExp("(^|[^0-9.])" + x.replace(".", "\\.") + "(?![0-9])").test(sc);
    if (
      T.corp &&
      !String(R.mandataire || "")
        .toUpperCase()
        .includes(T.corp) &&
      !T.sc.some(aSc)
    ) {
      if (GENERAL.some(aSc))
        it.push({
          c: "i",
          t: `Entrepreneur général : il peut confier ces travaux (${T.l.toLowerCase()}) à un sous-traitant, qui doit lui aussi avoir sa licence (${T.nomSc}).`,
          law: lien(LIENS.general, "RBQ, entrepreneur général"),
        });
      else
        it.push({
          c: "y",
          t: `<b>Cette licence ne semble pas couvrir : ${T.l.toLowerCase()}.</b> Attendu : ${T.nomSc}.`,
          law: LSC,
        });
    } else if (!T.corp && !T.sc.some(aSc)) {
      if (GENERAL.some(aSc))
        it.push({
          c: "i",
          t: `Entrepreneur général : il peut confier ces travaux à un sous-traitant, qui doit lui aussi avoir sa licence (sous-catégorie ${T.nomSc}).`,
          law: lien(LIENS.general, "RBQ, entrepreneur général"),
        });
      else
        it.push({
          c: "y",
          t: `<b>Cette licence ne couvre pas : ${T.l.toLowerCase()}.</b> Sous-catégorie attendue : ${T.nomSc}.`,
          law: LSC,
        });
    } else it.push({ c: "g", t: `La licence couvre ce type de travaux (${T.nomSc}).`, law: LSC });
  }

  const LIT = "Loi sur la protection du consommateur · " + lien(LIENS.itinerant, "OPC, commerce itinérant");
  F.limite = null;
  if (F.domicile === "oui" && T.art7) {
    const lim = dateLimite(F.recu || aujourdhui());
    F.limite = lim;
    it.push({
      c: "i",
      t: `<b>Contrat itinérant</b> : signé chez toi pour ce type de travaux, c'est un contrat itinérant même si tu as invité l'entrepreneur. Tu peux l'annuler sans frais ni raison jusqu'au <b>${lim ? jourLong(lim) : "10e jour"}</b>.`,
      law: "Règlement d'application de la LPC, art. 7 ; LPC, art. 59 · " + lien(LIENS.itinerant, "OPC"),
    });
    if (F.acompte === "oui")
      it.push({
        c: "r",
        t: "<b>Paiement demandé pendant le délai d'annulation.</b> Un commerçant itinérant ne peut recevoir aucun paiement avant la fin des 10 jours.",
        law: "LPC, art. 60 · " + lien(LIENS.itinerant, "OPC"),
      });
    it.push({
      c: "i",
      t: "Les travaux ne peuvent pas commencer avant la fin du délai, et l'entrepreneur doit détenir un permis de commerçant itinérant de l'OPC (bouton plus bas).",
      law: "LPC, art. 55 et 60.1 · " + lien(LIENS.lpc601, "OPC"),
    });
  } else if (F.domicile === "oui") {
    it.push({
      c: "i",
      t: "<b>Signé chez toi :</b> si c'est l'entrepreneur qui t'a sollicité (porte-à-porte, appel), les règles du commerce itinérant s'appliquent : 10 jours pour annuler sans frais, aucun paiement ni début des travaux avant la fin de ce délai.",
      law: LIT,
    });
    if (F.acompte === "oui")
      it.push({
        c: "y",
        t: "<b>Paiement demandé tout de suite.</b> Si l'entrepreneur t'a sollicité chez toi, il ne peut rien recevoir avant la fin des 10 jours.",
        law: "LPC, art. 60 · " + lien(LIENS.itinerant, "OPC"),
      });
  } else if (F.acompte === "oui")
    it.push({
      c: "i",
      t: "<b>Acompte demandé.</b> Pas illégal ici, mais l'OPC recommande si possible aucun acompte à la signature, sinon une petite somme, puis des paiements selon l'avancement des travaux.",
    });
  if (F.capture) it.push({ c: "i", t: "Lecture automatique du numéro et du nom sur la photo : prochaine version." });
  const c = it.some((i) => i.c === "r") ? "r" : it.some((i) => i.c === "y") ? "y" : "g";
  const ord = { r: 0, y: 1, i: 2, g: 3 };
  it.sort((a, b) => ord[a.c] - ord[b.c]);
  return { c, items: it };
}

export function validerReno(F) {
  const d = chiffres(F.licence);
  if (d && (d.length < 8 || d.length > 10))
    return "Ce numéro de licence semble incomplet. Recopie-le tel qu'il est sur la soumission, ou laisse le champ vide.";
  if (!F.travaux) return "Choisis le type de travaux.";
  if (!F.domicile || !F.acompte) return "Réponds aux deux questions.";
  if (F.domicile === "oui" && F.recu && isNaN(new Date(F.recu + "T12:00:00"))) return "Entre une date valide.";
  return "";
}
