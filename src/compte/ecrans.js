/* Écran « Mon compte » et barre de compte. */
import { ADM } from "../admin/api.js";
import { CFG } from "../admin/parametres.js";
import { blocReglageAlertes } from "../alertes/alertes.js";
import { CPT } from "./api.js";
import { LIEU } from "./lieu.js";
import { etat } from "../etat.js";
import { HIS } from "../historique/api.js";
import { IA_ADAPT, iaActif } from "../ia/analyse.js";
import { esc, top } from "../utils/dom.js";

/* Mon compte */
export function vueCompte() {
  const st = CPT.statut();
  const nbH = HIS.liste().length;
  return `${top("accueil", "Mon compte")}
<div class="card compte-tete"><span class="avatar" aria-hidden="true">${esc((CPT.courriel() || "?").charAt(0).toUpperCase())}</span><div><b>${esc(CPT.courriel() || "")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></div></div>
${etat.profil && ["aucune", "refusee"].includes(etat.profil.identite_statut || "aucune") ? `<button class="btn ghost" data-go="identite">Confirmer mon identité<small>Une photo de ta pièce d'identité. Nécessaire seulement pour signaler une annonce.</small></button>` : etat.profil && etat.profil.identite_statut === "en_attente" ? `<p class="hint centre">Ta pièce d'identité est en vérification par notre équipe.</p>` : ""}
<div class="card menu">
<button type="button" class="mrow" data-go="historique"><span>Mes vérifications</span><span class="soft num">${nbH}</span><span class="chev">›</span></button>
${ADM.estAdmin() ? `<button type="button" class="mrow" data-go="admin" id="nouvA"><span>Espace admin</span><span class="soft">Réservé</span><span class="chev">›</span></button>` : ""}
</div>
${blocReglageAlertes()}
${
  LIEU.dispo
    ? `<div class="card"><h2>Confidentialité</h2>
<label class="interrupteur"><span><b>Partager ma ville approximative de connexion</b><small>Désactivé par défaut. Si tu l'actives, nous gardons la ville et la région déduites de ton adresse IP (pas ton adresse, pas ta position GPS) à chaque connexion, pendant 90 jours au plus. Seuls les administrateurs la voient, pour détecter l'usage frauduleux d'un compte et savoir quelles régions nous servons. Tu peux le désactiver en tout temps : l'historique de lieux est alors effacé.</small></span>
<input type="checkbox" role="switch" id="lieu-ok" ${LIEU.actif() ? "checked" : ""}></label><p class="hint" id="lieu-msg" aria-live="polite"></p></div>`
    : ""
}
${IA_ADAPT.dispo ? `<div class="card"><label class="interrupteur"><span><b>Analyse intelligente</b><small>Comprend le sens des annonces et des conversations, pas seulement des mots. Le texte et les captures sont envoyés à Anthropic (États-Unis) pour l'analyse, puis oubliés. Désactivée tant que tu ne l'actives pas.</small></span><input type="checkbox" role="switch" id="ia-compte" ${iaActif() ? "checked" : ""}></label></div>` : ""}
<div class="card menu">
<button type="button" class="mrow" data-go="conditions"><span>Conditions d'utilisation</span><span class="chev">›</span></button>
<button type="button" class="mrow" data-go="confidentialite"><span>Politique de confidentialité</span><span class="chev">›</span></button>
<button type="button" class="mrow" data-go="victime"><span>J'ai été victime d'une arnaque</span><span class="chev">›</span></button>
${typeof CFG !== "undefined" ? `<a class="mrow" href="/a-propos" style="text-decoration:none"><span>Qui sommes-nous</span><span class="chev">›</span></a>` : ""}
${typeof CFG !== "undefined" && CFG.support ? `<a class="mrow" href="mailto:${esc(CFG.support)}" style="text-decoration:none"><span>Nous joindre</span><span class="soft">${esc(CFG.support)}</span><span class="chev">›</span></a>` : ""}
</div>
<button class="btn ghost" id="deco">Se déconnecter</button>
<button type="button" class="lienbtn centre danger-txt" data-go="supprimer">Supprimer mon compte et mes données</button>`;
}

/* styles déplacés dans app.css */
/* Bouton compact « Mon compte » en tête de l'accueil */
export function barreCompte() {
  const st = CPT.statut();
  return `<button type="button" class="compte-lien" data-go="compte" aria-label="Mon compte"><span class="avatar" aria-hidden="true">${esc((CPT.courriel() || "?").charAt(0).toUpperCase())}</span><span class="t"><b>${esc(CPT.courriel() || "Mon compte")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
}
