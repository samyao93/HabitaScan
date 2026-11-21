/* Badge « Annonce vérifiée » : écran du propriétaire et liste de ses badges. */
import { STATUTS_BADGE, texteAnnonce } from "./regles.js";
import { CFG } from "../admin/parametres.js";
import { etat } from "../etat.js";
import { lienConfidentialite } from "../legal/confidentialite.js";
import { fmtLot } from "../proprietaire/regles.js";
import { esc, top } from "../utils/dom.js";

/* Bouton de l'accueil */
export const boutonBadge = () =>
  CFG.badge === false
    ? ""
    : `<button class="btn ghost" data-go="badge" id="nouvBadge">Tu es propriétaire ? Obtiens le badge « Annonce vérifiée »<small>Gratuit · reconnu par chaque vérification HabitaScan</small></button>`;

const dateFr = (d) => (d ? new Date(d).toLocaleDateString("fr-CA", { dateStyle: "long" }) : "");

function formulaire(B) {
  const prof = etat.profil || {};
  if (prof.identite_statut !== "confirmee")
    return `<div class="card"><h2>D'abord : ton identité</h2>
<p>Le badge est réservé aux comptes dont l'identité est confirmée : c'est le premier des trois verrous contre les fraudeurs.</p>
${prof.identite_statut === "en_attente" ? `<p class="lu">Ta pièce d'identité est en vérification. Reviens ici dès qu'elle est confirmée.</p>` : `<button class="btn" data-go="identite">Confirmer mon identité</button>`}</div>`;
  return `<form class="card" id="f-badge" novalidate><h2>Nouvelle demande</h2>
<label>Adresse de l'immeuble<input id="b-adresse" autocomplete="off" placeholder="1234, rue Exemple" value="${esc(B.adresse || "")}"></label>
<label>Ville<input id="b-ville" autocomplete="off" placeholder="Montréal" value="${esc(B.ville || "")}"></label>
<label>Numéro de lot (facultatif)<input id="b-lot" inputmode="numeric" autocomplete="off" placeholder="1 234 567" value="${esc(B.lot ? fmtLot(B.lot) : "")}"></label>
<label>L'immeuble appartient à<select id="b-type"><option value="personne"${B.type !== "entreprise" ? " selected" : ""}>Moi (personne)</option><option value="entreprise"${B.type === "entreprise" ? " selected" : ""}>Une entreprise que je dirige</option></select></label>
<label>Nom inscrit au Registre foncier<input id="b-nom" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(B.nom || "")}"></label>
<label ${B.type === "entreprise" ? "" : "hidden"} id="l-neq">NEQ de l'entreprise (10 chiffres)<input id="b-neq" inputmode="numeric" autocomplete="off" value="${esc(B.neq || "")}"></label>
<label>Téléphone de tes annonces<input id="b-tels" type="tel" inputmode="tel" autocomplete="off" placeholder="514 555-0123 (plusieurs : séparés par une virgule)" value="${esc(B.tels || "")}"></label>
<label>Courriel de tes annonces (facultatif)<input id="b-cour" type="email" inputmode="email" autocomplete="off" value="${esc(B.cour || "")}"></label>
<p class="hint" style="margin-top:0">Un locataire ne voit le badge en vert que si le numéro ou le courriel de l'annonce est l'un de ceux-ci (ou celui de ton compte). Un fraudeur qui recopie ton code avec son propre numéro est donc démasqué.</p>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="b-ok" style="width:22px;height:22px;min-height:22px;margin-top:2px;flex-shrink:0;appearance:auto;-webkit-appearance:checkbox;accent-color:var(--blue);padding:0">Je déclare être propriétaire de cet immeuble, ou dirigeant de l'entreprise propriétaire. J'accepte que le nom inscrit, la rue et la ville de l'immeuble et mes coordonnées masquées (514 ••• ••23) s'affichent aux personnes qui vérifient mon code.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer ma demande</button>
<p class="hint">Nous n'enregistrons pas ton adresse postale : la lettre part à l'adresse inscrite aux registres publics. Voir la ${lienConfidentialite}.</p></form>`;
}

export function vueBadge(F, back) {
  const B = F.B || (F.B = {});
  return `${top(back, "Annonce vérifiée")}
<h2>Badge « Annonce vérifiée »</h2>
<p class="soft">Continue de publier tes annonces où tu veux (Kijiji, Facebook Marketplace, Kangalou…). Prouve une seule fois que tu es le vrai propriétaire : quand un locataire vérifie ton annonce dans HabitaScan, ton code et ton numéro sont reconnus, et il voit « Propriétaire vérifié ». Tu te démarques des fausses annonces. Gratuit.</p>
<div class="card"><h2>Comment ça marche</h2><ul class="reasons">
<li><span class="dot i"></span><div><b>1. Ta demande</b> : l'adresse de l'immeuble, le nom inscrit au Registre foncier, tes coordonnées d'annonce.</div></li>
<li><span class="dot i"></span><div><b>2. Notre équipe consulte le Registre foncier</b> et compare le propriétaire inscrit avec ton identité confirmée (ou les dirigeants de l'entreprise).</div></li>
<li><span class="dot i"></span><div><b>3. Tu reçois une lettre</b> avec un code, à l'adresse du propriétaire inscrite aux registres publics. Jamais à une autre adresse : c'est ce qui empêche un fraudeur d'usurper ton nom.</div></li>
<li><span class="dot g"></span><div><b>4. Ton badge</b> : un code HS-XXXXXX à ajouter au texte de tes annonces, sur n'importe quel site. Ton numéro et ton courriel sont aussi reconnus, même sans le code. Valide ${esc(String(CFG.badgeMois || 12))} mois.</div></li></ul></div>
<div id="mes-badges" aria-live="polite"></div>
${CFG.badge === false ? `<div class="card"><p>Les demandes de badge sont fermées pour le moment.</p></div>` : formulaire(B)}`;
}

/* Liste des badges du propriétaire (remplie après chargement) */
export function htmlMesBadges(L, msg) {
  if (!L.length) return msg ? `<p class="lu" role="status">${msg}</p>` : "";
  return `<div class="card"><h2>Mes badges</h2>${msg ? `<p class="lu" role="status">${msg}</p>` : ""}
${L.map((b) => {
  const s = STATUTS_BADGE[b.statut] || ["i", b.statut];
  return `<div class="demande"><p><b>${esc(b.adresse)}${b.ville ? `, ${esc(b.ville)}` : ""}</b><span class="tag ${s[0]}">${s[1]}</span></p>
${b.statut === "demande" ? `<p class="hint">Demande du ${esc(dateFr(b.created_at))}. Après la consultation du Registre foncier, une lettre part par la poste (comptez environ une semaine).</p>` : ""}
${
  b.statut === "lettre_envoyee"
    ? `<p class="hint">Lettre envoyée le ${esc(dateFr(b.lettre_envoyee_le))} à l'adresse du propriétaire inscrite aux registres publics. Code valable 60 jours.</p>
<form class="ligne" data-confirmer="${esc(b.id)}"><input aria-label="Code de la lettre" autocomplete="one-time-code" placeholder="ABCD-EFGH" maxlength="12"><button class="btn petit">Valider</button></form>
<p class="hint">${+b.essais_restants} essai${+b.essais_restants > 1 ? "s" : ""} restant${+b.essais_restants > 1 ? "s" : ""}.</p>`
    : ""
}
${
  b.statut === "verifie"
    ? `<p class="badge-code num">${esc(b.code_public)}</p>
<p class="hint">Valide jusqu'au ${esc(dateFr(b.expire_le))}. Coordonnées reconnues : ${(b.contacts_affiches || []).map(esc).join(", ")}.</p>
<label>Texte à ajouter à tes annonces<textarea readonly rows="3" data-texte-badge>${esc(texteAnnonce(b.code_public))}</textarea></label>
<button type="button" class="btn ghost petit" data-copier-badge>Copier le texte</button>`
    : ""
}
${b.statut === "expire" ? `<p class="hint">Expiré le ${esc(dateFr(b.expire_le))}. Fais une nouvelle demande ci-dessous pour le renouveler.</p>` : ""}
${["refuse", "revoque", "bloque"].includes(b.statut) ? `<p class="hint">${b.statut === "bloque" ? "Trop d'essais avec un mauvais code. Écris-nous pour recevoir une nouvelle lettre." : ""}${b.motif ? ` ${esc(b.motif)}` : ""}${CFG.support ? ` Pour en parler : <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a>.` : ""}</p>` : ""}</div>`;
}).join("")}</div>`;
}
