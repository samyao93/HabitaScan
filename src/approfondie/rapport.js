/* Vérification complète (payante) : prix, verdicts, statuts et rapport. */
import { esc } from "../utils/dom.js";

/* styles déplacés dans app.css */
export const VCFG = { prix: 15, delai: 24, lien: "" };

export const prixTxt = () => String(VCFG.prix).replace(".", ",") + " $";

export const VERDICTS = {
  correspond: ["g", "Le nom correspond au propriétaire inscrit au Registre foncier."],
  ne_correspond_pas: [
    "r",
    "Le nom ne correspond pas au propriétaire inscrit. Ne paie rien avant d'avoir une explication et un mandat écrit du propriétaire.",
  ],
  compagnie: [
    "y",
    "Le propriétaire inscrit est une entreprise. Demande la preuve que ton interlocuteur la représente (mandat écrit, registre des entreprises).",
  ],
  introuvable: [
    "y",
    "Nous n'avons pas pu confirmer le propriétaire (lot introuvable ou vente trop récente). Écris-nous pour un remboursement.",
  ],
  trouve: ["g", "Nous avons trouvé le propriétaire inscrit au Registre foncier."],
};

export const STATUTS = {
  a_payer: ["i", "Paiement non reçu"],
  payee: ["y", "En cours"],
  terminee: ["g", "Terminée"],
  remboursee: ["i", "Remboursée"],
};

/* Rapport de la vérification complète */
const RAPPORT = {
  global: {
    continuer: ["g", "Tu peux continuer", "Rien d'anormal n'a été trouvé. Visite, puis signe le bail avant de payer."],
    precautions: [
      "y",
      "Continue avec précaution",
      "Obtiens ce qui est indiqué ci-dessous avant de payer quoi que ce soit.",
    ],
    arreter: ["r", "Arrête", "Ne paie rien et ne donne aucun document à cette personne."],
  },
  entreprise: {
    lie: [
      "g",
      "L'entreprise propriétaire est active ; ses dirigeants sont indiqués ci-dessous. Le bail doit être à son nom.",
    ],
    non_lie: [
      "y",
      "Le nom de l'annonceur ne figure pas parmi les dirigeants de l'entreprise propriétaire. Le bail doit être au nom de l'entreprise ; si quelqu'un d'autre signe, exige un mandat écrit de l'entreprise.",
    ],
    inactive: ["r", "L'entreprise propriétaire n'est pas active au registre des entreprises."],
    non_verifie: ["i", "Lien avec l'entreprise non vérifié."],
  },
  photos: {
    aucune: ["g", "Les photos n'ont pas été trouvées ailleurs sur le Web."],
    reutilisees: ["r", "Les photos apparaissent ailleurs : autre annonce, autre ville ou site d'agence."],
    non_verifie: ["i", "Photos non vérifiées (aucune photo fournie)."],
  },
  doublons: {
    aucun: ["g", "Aucune autre annonce du même logement n'a été trouvée."],
    trouves: ["y", "Le même logement est annoncé ailleurs, sous un autre nom ou à un autre prix."],
    non_verifie: ["i", "Autres annonces non vérifiées."],
  },
};

export function htmlRapport(d) {
  const r = d.rapport || {},
    g = RAPPORT.global[d.verdict_global || r.global];
  const L = [];
  const ajout = (m, k, det) => {
    const x = m && m[k];
    if (x)
      L.push(
        `<li><span class="dot ${x[0]}"></span><div>${x[1]}${det ? `<div class="law">${esc(det)}</div>` : ""}</div></li>`,
      );
  };
  const reg = r.registre || {},
    e = r.entreprise || {};
  if (reg.nom)
    L.push(
      `<li><span class="dot i"></span><div><b>Au moment de signer, le bail doit être au nom de : ${esc(reg.nom)}</b>${d.role === "locataire" ? " (c'est aussi ce nom qui doit signer l'accord écrit de cession)" : ""}. Sinon, ne paie pas avant d'avoir un mandat écrit de ce propriétaire.</div></li>`,
    );
  L.push(
    `<li><span class="dot g"></span><div><b>Paie seulement par chèque ou virement au nom ${reg.nom ? `de ${esc(reg.nom)}` : "du propriétaire inscrit au Registre foncier"}.</b> Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne. Si un gestionnaire perçoit les loyers, demande d'abord le mandat écrit du propriétaire.</div></li>`,
  );
  if ((reg.resultat || d.verdict) === "compagnie" && e.applicable)
    L.push(
      `<li><span class="dot i"></span><div>Le propriétaire inscrit au Registre foncier est une entreprise.${reg.details ? `<div class="law">${esc(reg.details)}</div>` : ""}</div></li>`,
    );
  else ajout(VERDICTS, reg.resultat || d.verdict, reg.details);
  if (e.applicable) {
    ajout(RAPPORT.entreprise, e.lien, [e.nom, e.neq ? `NEQ ${e.neq}` : "", e.details].filter(Boolean).join(" · "));
  }
  ajout(RAPPORT.photos, (r.photos || {}).resultat, (r.photos || {}).details);
  ajout(RAPPORT.doublons, (r.doublons || {}).resultat, (r.doublons || {}).details);
  return `${g ? `<div class="verdict ${g[0]}"><strong>${g[1]}</strong><span>${g[2]}</span></div>` : ""}
${L.length ? `<ul class="reasons">${L.join("")}</ul>` : ""}
${r.recommandations || d.note ? `<div class="rule" style="text-align:left"><b>Ce qu'on te recommande</b><br>${esc(r.recommandations || d.note)}</div>` : ""}
${d.termine_le ? `<p class="hint">Rapport du ${esc(new Date(d.termine_le).toLocaleDateString("fr-CA", { dateStyle: "long" }))}, selon les registres publics et le Web à cette date.</p>` : ""}`;
}
