/* Liens externes : adresses officielles et création de liens sûrs (http et https seulement). */

export const lien = (href, txt) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;

export const L_INFOLOT = "https://appli.foncier.gouv.qc.ca/infolot/";

export const L_REGISTRE = "https://www.registrefoncier.gouv.qc.ca";

export const L_TARIF = "https://portail-info.foncier.gouv.qc.ca/media/40hfdqo0/grille_tarifaire_janvier_2026.pdf";

export const L_ROLE_MTL = "https://montreal.ca/consulter-les-roles-devaluation-fonciere";

export const L_RETRAIT_MTL = "https://montreal.ca/articles/confidentialite";

export const L_1904 = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/CCQ-1991#se:1904";

export const L_SCHL30 =
  "https://www.cmhc-schl.gc.ca/fr/consumers/renting-a-home/i-want-to-rent/things-to-consider-before-renting";

/* Seuls les liens web (http, https) deviennent cliquables : une adresse « javascript: » venue d'une annonce ou d'une recherche reste du texte. */
export const urlWeb = (u) => /^https?:\/\//i.test(String(u ?? "").trim());

export const lienExt = (u, t) => (urlWeb(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t);

export const L_OACIQ = "https://www.oaciq.com";

export const L_LOI = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1";

export const L_CAI = "https://www.cai.gouv.qc.ca";

/* styles déplacés dans app.css */

export const L_LPC = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1";
