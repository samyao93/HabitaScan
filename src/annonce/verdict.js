/* Verdict de la vérification d'une annonce (rouge, jaune, vert) et ses raisons. */
import { FAITS, faitScenario } from "./faits.js";
import { itemsProfil } from "./profil.js";
import { MOTS_ARGENT, MOTS_SCENARIO, MOYENS_FRAUDE, SITES, trouverMot } from "./regles.js";
import { BAS, HAUT } from "../config.js";
import { etat } from "../etat.js";
import { itemsIA } from "../ia/analyse.js";
import { itemsCopiesWeb } from "../memoire/copies-web.js";
import { itemsMemoire, itemsRecopie } from "../memoire/memoire.js";
import { itemSignalements } from "../signalements/signalements.js";
import { loyerSchl } from "../prix/reference.js";
import { esc, money } from "../utils/dom.js";
import { urlWeb } from "../utils/liens.js";

export function analyser() {
  const it = [],
    txt = ((etat.fiche.txt || "") + " " + (etat.fiche.annonce || "") + " " + (etat.fiche.ocrTxt || "")).toLowerCase(),
    L1904 =
      'Code civil du Québec, art. 1904 · <a href="https://www.quebec.ca/nouvelles/actualites/details/exiger-un-depot-de-garantie-est-illegal" target="_blank" rel="noopener">Québec.ca</a>';
  const motA = trouverMot(txt, MOTS_ARGENT),
    motP = trouverMot(txt, MOYENS_FRAUDE),
    motS = trouverMot(txt, MOTS_SCENARIO);
  if (etat.fiche.argent === "oui")
    it.push({
      c: "r",
      t: "<b>On te demande de l'argent avant le bail.</b> Au Québec, le propriétaire peut seulement exiger le premier mois de loyer, et aucun dépôt.",
      law: L1904,
      fait: FAITS.depot,
    });
  if (motP)
    it.push({
      c: "r",
      t: `<b>Paiement par « ${esc(motP)} ».</b> Aucun propriétaire honnête ne demande ce moyen de paiement : il est presque impossible de récupérer l'argent.`,
      fait: FAITS.paiement,
    });
  if (motA && etat.fiche.argent !== "oui")
    it.push({
      c: "y",
      t: `<b>Il est question de « ${esc(motA)} ».</b> Si on te demande un dépôt ou des frais avant le bail, c'est illégal. Seul le premier mois de loyer peut être exigé d'avance.`,
      law: L1904,
      fait: FAITS.depot,
    });
  if (motS)
    it.push({ c: "y", t: `<b>Scénario d'arnaque courant</b> repéré : « ${esc(motS)} ».`, fait: faitScenario(motS) });
  itemsProfil(etat.fiche).forEach((x) => it.push(x));
  itemsIA(etat.fiche).forEach((x) => it.push(x));
  if (etat.fiche.visite === "non")
    it.push({
      c: "y",
      t: "<b>Tu n'as pas visité.</b> Ne paie rien sans avoir vu le logement en personne.",
      fait: FAITS.visite,
    });
  else
    it.push({
      c: "g",
      t: "Tu as visité le logement. Attention : un fraudeur peut louer un logement quelques jours pour le faire visiter.",
    });
  if (etat.fiche.cession === "oui" && etat.fiche.argent === "oui")
    it.push({
      c: "r",
      t: "<b>Le locataire te demande de l'argent.</b> En cession de bail, le locataire qui part ne peut rien exiger de toi en échange : pas de « frais de reprise », pas de dépôt.",
      law: 'Avis de cession du TAL · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf" target="_blank" rel="noopener">TAL</a>',
    });
  if (etat.fiche.cession === "oui")
    it.push({
      c: "i",
      t: "<b>Locataire actuel :</b> la preuve, c'est l'accord écrit du propriétaire, avec ton nom. Pour savoir qui doit le signer, touche le bouton <b>« Vérifier le propriétaire »</b>, plus bas sur cette page : il trouve le vrai propriétaire à partir de l'adresse seulement, sans rien demander à l'annonceur.",
    });
  if (etat.fiche.cession === "oui")
    it.push(
      etat.fiche.accord === "oui"
        ? { c: "g", t: "Accord écrit du propriétaire : bon signe." }
        : {
            c: "y",
            t: "<b>Pas encore d'accord écrit du propriétaire.</b> Depuis 2024, il peut refuser une cession même sans motif sérieux (le bail du locataire actuel prend alors fin, et tu n'as pas de logement). Ne paie rien avant sa réponse écrite ou la fin du délai de 15 jours.",
            law: 'Code civil du Québec, art. 1870, 1871 et 1978.2 · <a href="https://educaloi.qc.ca/capsules/la-cession-de-bail-et-la-sous-location-de-logement/" target="_blank" rel="noopener">Éducaloi</a> · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_828_E.pdf" target="_blank" rel="noopener">TAL</a>',
          },
    );
  if (etat.fiche.lienN) {
    const h = new URL(etat.fiche.lienN).hostname,
      site = SITES.find((s) => h === s.d || h.endsWith("." + s.d));
    if (!site)
      it.push({
        c: "y",
        t: `<b>Site inconnu : ${esc(h)}.</b> Les fraudeurs copient parfois de vrais sites d'annonces. Vérifie l'adresse lettre par lettre.`,
      });
    const st = etat.fiche.stats;
    if (st && +st.rouges > 0)
      it.push({
        c: "r",
        t: `<b>${st.rouges} vérification${st.rouges > 1 ? "s" : ""} précédente${st.rouges > 1 ? "s" : ""} de cette annonce ${st.rouges > 1 ? "ont" : "a"} donné « Ne paie pas ».</b>`,
      });
    else if (st && +st.total > 0)
      it.push({ c: "i", t: `Cette annonce a déjà été vérifiée ${st.total} fois, sans arnaque probable.` });
    const sg = itemSignalements(etat.fiche.nbSig);
    if (sg) it.push(sg);
  }
  itemsMemoire(etat.fiche.mem).forEach((x) => it.push(x));
  itemsRecopie(etat.fiche.copie).forEach((x) => it.push(x));
  itemsCopiesWeb(etat.fiche).forEach((x) => it.push(x));
  if (etat.fiche.images && etat.fiche.images.pages && etat.fiche.images.pages.length)
    it.push({
      c: "y",
      t: `<b>Ces images apparaissent sur ${etat.fiche.images.pages.length} autre${etat.fiche.images.pages.length > 1 ? "s" : ""} page${etat.fiche.images.pages.length > 1 ? "s" : ""} du web.</b> Les fraudeurs copient souvent les photos d'une vraie annonce. ${etat.fiche.images.pages
        .filter(urlWeb)
        .slice(0, 3)
        .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname)}</a>`)
        .join(", ")}`,
      law: "Recherche d'image inversée (Google Vision)",
      fait: FAITS.copie,
    });
  else if (etat.fiche.images && etat.fiche.images.ok)
    it.push({ c: "g", t: "Les images de la capture n'ont pas été trouvées ailleurs sur le web." });
  if (!etat.fiche.images)
    it.push({
      c: "i",
      t: "Astuce : cherche la photo de l'annonce avec Google Lens (dans l'app Google) pour voir si elle est publiée ailleurs.",
    });
  const ref = loyerSchl(etat.fiche.ville, etat.fiche.ch),
    moy = ref ? ref.loyer : 0,
    LSCHL = ref ? `SCHL, loyer ${ref.stat}, ${ref.periode}` : "";
  /* Prix bas : jamais un signal à lui seul (vieil immeuble, quartier moins cher, propriétaire de longue date).
    Il ne devient jaune que s'il s'ajoute à un autre signal d'alarme. */
  const autreSignal = it.some((i) => i.c === "r" || i.c === "y");
  if (moy) {
    const r = etat.fiche.prixN / moy;
    if (r < BAS && etat.fiche.cession === "oui")
      it.push({
        c: "i",
        t: `<b>Prix sous le loyer ${ref.stat}</b> (${money(moy)} à ${esc(etat.fiche.ville)}) : normal pour une cession, car le nouveau locataire reprend le bail existant et son loyer.`,
        law: 'Code civil du Québec, art. 1870 à 1873 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_817_E.pdf" target="_blank" rel="noopener">TAL</a>',
      });
    else if (r < BAS && autreSignal)
      it.push({
        c: "y",
        t: `<b>Prix nettement sous le loyer ${ref.stat}, en plus d'un autre signal.</b> ${money(etat.fiche.prixN)} contre ${money(moy)} (loyer ${ref.stat}) à ${esc(etat.fiche.ville)}. Un prix trop beau combiné à ces signaux est l'appât classique des fausses annonces.`,
        law: LSCHL,
        fait: FAITS.prix,
      });
    else if (r < BAS)
      it.push({
        c: "i",
        t: `<b>Prix sous le loyer ${ref.stat}</b> (${money(moy)} à ${esc(etat.fiche.ville)}). Ça arrive souvent : vieil immeuble, quartier moins cher, propriétaire de longue date. Pas un signe d'arnaque à lui seul.`,
        law: LSCHL,
      });
    else if (r > HAUT)
      it.push({
        c: "i",
        t: `<b>Prix élevé</b> (loyer ${ref.stat} : ${money(moy)}). Pas une arnaque en soi : vérifie la section G du bail. Tu peux demander au Tribunal de fixer le loyer dans les 10 jours suivant la signature.`,
        law: 'Code civil du Québec, art. 1896 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/Ajustement-bail-logement.pdf" target="_blank" rel="noopener">TAL, formulaire de bail</a>',
      });
    else
      it.push({
        c: "g",
        t: `<b>Prix dans la normale</b> pour ${esc(etat.fiche.ville)} (loyer ${ref.stat} : ${money(moy)}).`,
        law: LSCHL,
      });
  } else it.push({ c: "i", t: "Pas encore de loyer de référence pour cette ville." });
  const c = it.some((i) => i.c === "r") ? "r" : it.some((i) => i.c === "y") ? "y" : "g";
  const ord = { r: 0, y: 1, i: 2, g: 3 };
  it.sort((a, b) => ord[a.c] - ord[b.c]);
  return { c, items: it };
}
