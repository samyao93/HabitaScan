/* Table des écrans de l'app : nom de l'écran → HTML. */
import { vueAdmin } from "../admin/ecran.js";
import { CFG } from "../admin/parametres.js";
import { blocAlertes } from "../alertes/alertes.js";
import { htmlFait } from "../annonce/faits.js";
import { blocProfil, boutonCarte } from "../annonce/profil.js";
import { blocMesApprofondies, offreApprofondie, vueApprofondie } from "../approfondie/ecrans.js";
import { VCFG, prixTxt } from "../approfondie/rapport.js";
import { vueBudget } from "../budget/ecrans.js";
import { barreCompte, vueCompte } from "../compte/ecrans.js";
import { blocInvitationLieu } from "../compte/lieu.js";
import { vueSupprimer } from "../compte/suppression.js";
import { etat } from "../etat.js";
import { blocFiltre } from "../filtre/ecran.js";
import { blocHistorique, vueDetailVerif, vueHistorique } from "../historique/ecrans.js";
import { blocChoixIA, blocIA, rappelIA } from "../ia/ecrans.js";
import { ALERTES_ID } from "../identite/identite.js";
import { lienConditions, vueConditions } from "../legal/conditions.js";
import { lienConfidentialite, vueConfidentialite } from "../legal/confidentialite.js";
import { PAGES_LEG, vuePageLegale } from "../legal/pages.js";
import { REGLE_PAIEMENT } from "../memoire/contacts.js";
import { vueProprio } from "../proprietaire/ecran.js";
import { vueReno, vueRenoResultat } from "../renovation/ecrans.js";
import { boutonSignaler, vueSignalOk, vueSignaler } from "../signalements/signalements.js";
import { vueTrouver } from "../trouver/ecrans.js";
import { esc, money, top, yn } from "../utils/dom.js";
import { dateId } from "../utils/texte.js";

export const V = {
  bienvenue: () => `${top()}
<svg class="logo-grand" role="img" aria-label="HabitaScan"><use href="#logo"/></svg>
<h1>Avant de payer, vérifie.</h1>
<p class="soft">Une fausse annonce peut te faire perdre ton argent avant même d'avoir vu le logement. HabitaScan t'aide à la repérer avant d'envoyer un seul dollar.</p>
<ul class="atouts">
<li><b>Vérifie une annonce</b> en une minute, avec une capture d'écran.</li>
<li><b>Confirme le vrai propriétaire</b> grâce aux registres publics du Québec.</li>
<li><b>Calcule ton budget</b> et trouve un logement à ta mesure.</li></ul>
<button class="btn" data-go="inscription" data-mode="inscription" id="commencer">Commencer gratuitement</button>
<p class="centre" style="margin:-4px 0 2px"><button type="button" class="lienbtn" data-go="inscription" data-mode="connexion">Déjà inscrit ? Me connecter</button></p>
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
<ul class="confiance"><li>Gratuit</li><li>Conforme à la Loi 25</li><li>Sources publiques officielles</li><li>Fait au Québec</li></ul>
<p class="hint centre"><a href="/">En savoir plus</a> · <a href="/guides/arnaques-courantes">Arnaques courantes</a> · <a href="/en" lang="en" hreflang="en">English</a></p>
<p class="hint pied">${lienConditions.replace("conditions d'utilisation", "Conditions d'utilisation")}${lienConfidentialite.replace("politique de confidentialité", "Confidentialité")}</p>`,

  inscription: () => {
    const t = CFG.sms ? etat.fiche.canal || "courriel" : "courriel";
    return `${top("bienvenue", etat.fiche.modeCx ? "Connexion" : "Inscription")}
${etat.fiche.modeCx ? `<h2>Connecte-toi</h2><p class="soft">Entre ${CFG.sms ? "le courriel ou le numéro" : "le courriel"} de ton compte : tu retrouves ton historique. Pas de mot de passe : tu reçois un code à 6 chiffres.</p>` : `<h2>Crée ton compte</h2><p class="soft">Gratuit, en 30 secondes. Pas de mot de passe : tu reçois un code à 6 chiffres. Si ce courriel a déjà un compte, tu le retrouves simplement.</p>`}
<form class="card" id="f-ins" novalidate>
${
  CFG.sms
    ? `<div class="seg" role="group" aria-label="Moyen de connexion">
<button type="button" data-canal="courriel" aria-pressed="${t === "courriel"}">Courriel</button>
<button type="button" data-canal="tel" aria-pressed="${t === "tel"}">Téléphone</button></div>`
    : ""
}
${
  t === "courriel"
    ? `<label>Adresse courriel<input id="ident" type="email" inputmode="email" autocomplete="email" placeholder="nom@exemple.com" value="${esc(etat.fiche.ident)}"></label>`
    : `<label>Numéro de cellulaire<input id="ident" type="tel" inputmode="tel" autocomplete="tel" placeholder="514 555-0123" value="${esc(etat.fiche.ident)}"></label>`
}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Recevoir le code par ${t === "courriel" ? "courriel" : "SMS"}</button>
<p class="hint">Ton ${t === "courriel" ? "courriel" : "numéro"} sert seulement à te connecter. En continuant, tu acceptes les ${lienConditions} et la ${lienConfidentialite}.</p></form>
<p class="centre">${etat.fiche.modeCx ? `<button type="button" class="lienbtn" data-go="inscription" data-mode="inscription">Pas encore de compte ? M'inscrire</button>` : `<button type="button" class="lienbtn" data-go="inscription" data-mode="connexion">Déjà inscrit ? Me connecter</button>`}</p>`;
  },

  code: () => `${top("inscription", "Code")}
<h2>Entre le code reçu</h2><p class="soft">Envoyé à <b>${esc(etat.fiche.affiche)}</b>. Vérifie aussi tes courriels indésirables.</p>
<form class="card" id="f-code" novalidate>
<div class="otp">${[0, 1, 2, 3, 4, 5].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i + 1}" data-i="${i}" autocomplete="${i ? "off" : "one-time-code"}">`).join("")}</div>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Valider</button>
<button type="button" class="btn ghost" id="renvoi" disabled>Renvoyer le code (<span id="t">60</span> s)</button></form>`,

  identite: () => `${top("accueil", "Identité")}
<h2>Confirme ton identité</h2><p class="soft">Une photo de ta pièce d'identité suffit : ton nom, ta date de naissance et la date d'expiration sont lus automatiquement. Rien à taper, pas de selfie.</p>
<form class="card" id="f-id" novalidate>
<label>Type de pièce<select id="doc">
<option value="permis">Permis de conduire (régulier, probatoire ou apprenti)</option><option value="passeport">Passeport</option><option value="rp">Carte de résident permanent</option></select></label>
<label class="drop">${etat.fiche.rectoUrl ? `<img src="${etat.fiche.rectoUrl}" alt="Recto">Changer la photo` : "Prendre en photo le recto"}<input type="file" accept="image/*" capture="environment" data-side="recto"></label>
<label class="drop" ${etat.fiche.doc === "passeport" ? "hidden" : ""}>${etat.fiche.versoUrl ? `<img src="${etat.fiche.versoUrl}" alt="Verso">Changer la photo` : "Prendre en photo le verso"}<input type="file" accept="image/*" capture="environment" data-side="verso"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="ok" style="width:22px;min-height:22px;margin-top:2px">J'accepte que la photo soit lue automatiquement puis vérifiée par l'équipe, uniquement pour confirmer mon identité, puis supprimée.</label>
<p class="hint">Détails dans la ${lienConfidentialite}.</p>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer pour vérification</button></form>
<p class="hint">Pourquoi ? Seuls les comptes à l'identité confirmée peuvent signaler une annonce : ça évite les fausses accusations. Vérifier une annonce ne la demande jamais.</p>
<p class="hint">Les photos sont envoyées dans un espace privé, au Canada. Pour gagner du temps, elles sont aussi lues par une IA (Anthropic, aux États-Unis), qui n'en garde aucune copie. Seule l'équipe de vérification peut les voir ; elles sont supprimées après la vérification.</p>`,

  identiteLecture: () => {
    const L = etat.fiche.lecture || {},
      al = (L.alertes || []).filter((a) => a !== "deja_utilisee");
    return `${top("identite", "Identité")}
<h2>Vérifie ce que nous avons lu</h2><p class="soft">Lu automatiquement sur ta pièce. Notre équipe vérifiera ensuite la photo.</p>
<div class="card"><dl class="details">
<div><dt>Prénom</dt><dd>${esc(L.prenom || "non lu")}</dd></div><div><dt>Nom</dt><dd>${esc(L.nom || "non lu")}</dd></div>
<div><dt>Date de naissance</dt><dd>${dateId(L.date_naissance)}</dd></div><div><dt>Expiration</dt><dd>${dateId(L.date_expiration)}</dd></div>
<div><dt>Émise par</dt><dd>${esc(L.emetteur || "non lu")}</dd></div></dl>
${al.length ? `<ul class="reasons">${al.map((a) => `<li><span class="dot y"></span><div>${esc(ALERTES_ID[a] || a)}</div></li>`).join("")}</ul>` : ""}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">C'est exact, envoyer pour vérification</button>
<button type="button" class="btn ghost" id="reprendre">Reprendre les photos</button></div>
<p class="hint">Une fois l'identité confirmée, nous gardons seulement ton prénom, l'initiale de ton nom et la date d'expiration. Jamais le numéro de la pièce. Les photos sont supprimées après la vérification.</p>`;
  },

  analyse: () =>
    `${top(null, etat.fiche.titre || "Vérification")}<div class="spin" role="status" aria-label="En cours"></div><p class="soft" style="text-align:center">${etat.fiche.msg || "En cours…"}</p>`,

  identiteOk: () => `${top(null, "Identité")}
<svg class="seal" role="img" aria-label="Pièce reçue"><use href="#seal"/></svg>
<h1>Pièce reçue</h1><p class="soft">Ta pièce d'identité est en vérification. Tu pourras signaler des annonces dès qu'elle sera confirmée.</p>
<button class="btn" data-go="accueil">Continuer</button>`,

  accueil: () => `${top(null)}
${etat.profil ? barreCompte() : ""}
${etat.profil && etat.profil.suspendu ? `<div class="verdict r" role="alert"><strong>Compte suspendu</strong><span>Tu peux encore consulter tes vérifications, mais plus en enregistrer de nouvelles.${CFG.support ? ` Pour en parler : <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a>.` : ""}</span></div>` : ""}
${blocAlertes()}
${CFG.message ? `<div class="card invite" role="status"><p>${esc(CFG.message)}</p></div>` : ""}
<h1>Que veux-tu faire ?</h1>
<div class="choix-accueil">
<button class="btn" data-go="trouver" id="nouvT">Trouver un logement<small>Selon ta ville, tes chambres et ton budget</small></button>
<button class="btn" data-go="verifier" id="nouv">Vérifier une annonce trouvée<small>Facebook, Kijiji et autres</small></button>
${CFG.approfondie ? `<button class="btn ghost btn-va" data-va-de="accueil">Vérification complète par notre équipe<small>Propriétaire, entreprise, photos, autres annonces · ${prixTxt()} · rapport en ${VCFG.delai} h</small></button>` : ""}
<button class="btn ghost" data-go="budget" id="nouvB">Calculer mon budget d'installation</button>
<button class="btn ghost" data-go="reno" id="nouvR">Vérifier un entrepreneur en rénovation</button>
</div>
${!etat.anonyme && etat.profil && ["aucune", "refusee"].includes(etat.profil.identite_statut) ? `<button class="btn ghost" data-go="identite">Confirmer mon identité (pour signaler)</button>` : ""}
${blocMesApprofondies}
${blocInvitationLieu()}
${blocHistorique()}
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
<p class="hint pied">${lienConditions.replace("conditions d'utilisation", "Conditions")}${lienConfidentialite.replace("politique de confidentialité", "Confidentialité")}</p>`,

  verifier: () => `${top("accueil", "Vérifier")}
${blocChoixIA()}
<h2>L'annonce</h2>
<form class="card" id="f-ver" novalidate>
<label class="drop drop-grand">${etat.fiche.vignettes && etat.fiche.vignettes.length ? `<span class="vignettes">${etat.fiche.vignettes.map((u) => `<img src="${u}" alt="Capture">`).join("")}</span>Changer les captures` : `<b>Tu doutes d'une annonce ?</b><span>Un annonceur te paraît louche, ou sa conversation te met la puce à l'oreille ? Ajoute les captures de l'annonce, ses photos ou votre conversation, ou colle le texte ci-dessous.</span>`}<input type="file" accept="image/*" multiple data-captures="1"></label>
<label class="drop">${(etat.fiche.photosLog || []).length ? `<b>${etat.fiche.photosLog.length} photo${etat.fiche.photosLog.length > 1 ? "s" : ""} du logement</b> · toucher pour changer` : `<b>Ajoute 1 ou 2 photos du logement</b> (facultatif)<br><span class="hint">Enregistre-les depuis l'annonce (appui long sur la photo). Elles permettent de retrouver la même annonce publiée ailleurs, même avec un autre lien ou un autre numéro. Elles ne quittent pas ton téléphone.</span>`}<input type="file" accept="image/*" multiple id="photos-log"></label>
${blocIA()}
${etat.fiche.lu ? `<p class="lu" role="status">${etat.fiche.lu}</p>` : ""}
<details class="coller" ${etat.fiche.coller ? "open" : ""}><summary>ou coller le texte</summary>
<label>Texte de l'annonce<textarea id="annonce" placeholder="Colle ici le texte de l'annonce">${esc(etat.fiche.annonce || "")}</textarea></label>
<button type="button" class="btn ghost" id="lire">Lire le texte</button>
<label>Messages échangés<textarea id="txt" placeholder="Colle ici la conversation avec l'annonceur">${esc(etat.fiche.txt || "")}</textarea></label>
</details>
<label>Lien de l'annonce (facultatif)<input id="lien" type="url" inputmode="url" autocomplete="off" placeholder="https://www.facebook.com/marketplace/item/…" value="${esc(etat.fiche.lien)}"></label>
<label>Ville<select id="ville">${Object.keys(etat.loyers)
    .map((v) => `<option ${etat.fiche.ville === v ? "selected" : ""}>${esc(v)}</option>`)
    .join(
      "",
    )}<option value="Autre" ${etat.fiche.ville === "Autre" ? "selected" : ""}>Autre ville</option></select></label>
<div class="grid2"><label>Chambres<select id="ch"><option value="1">1</option><option value="2">2</option><option value="3">3 et plus</option></select></label>
<label>Loyer demandé<input id="prix" inputmode="numeric" placeholder="1 300" value="${esc(etat.fiche.prix)}"></label></div>
<label>Adresse (facultatif, reste sur ton téléphone)<input id="adr" autocomplete="off" placeholder="1234, rue Exemple" value="${esc(etat.fiche.adr || "")}"></label>
<label>Téléphone ou courriel de l'annonceur (facultatif)<input id="contact" autocomplete="off" placeholder="514 555-0123 ou nom@exemple.com" value="${esc(etat.fiche.contact || "")}"><span class="hint" style="font-weight:400">Pour savoir s'il a déjà été signalé par d'autres utilisateurs.</span></label>
${yn("argent", "On te demande de l'argent avant la signature du bail ?")}
${yn("visite", "As-tu pu visiter le logement en personne ?")}
${yn("cession", "Est-ce le locataire actuel qui annonce (cession de bail ou sous-location) ?")}
<div id="q-accord" ${etat.fiche.cession !== "oui" ? "hidden" : ""}>${yn("accord", "Le propriétaire a-t-il accepté par écrit ?")}<p class="hint">Le locataire doit aviser le propriétaire par écrit. Celui-ci a 15 jours pour répondre ; sans réponse, il est réputé avoir accepté.</p></div>
${blocProfil(etat.fiche)}
<p class="err" id="e" hidden></p>
<button class="btn">Vérifier</button></form>
<p class="hint">Le texte de l'annonce et la conversation restent sur ton téléphone. Seuls la ville, le nombre de chambres, le prix, le lien et le résultat sont gardés. Si la recherche d'images est activée, la capture est envoyée à Google Vision pour cette recherche, puis n'est pas conservée. Si tu actives l'analyse intelligente, les captures et le texte sont envoyés à Anthropic pour l'analyse, puis oubliés.</p>`,

  resultat: () => {
    const R = etat.fiche.res;
    return `${top("accueil", "Résultat")}
<div class="verdict ${R.c}"><strong>${{ r: "Ne paie pas", y: "Visite d'abord, puis vérifie le propriétaire", g: "Aucun signal. Tu peux visiter." }[R.c]}</strong><span>${esc(etat.fiche.ville)} · ${etat.fiche.ch === "3" ? "3 ch. et plus" : etat.fiche.ch + " ch."} · <span class="num">${money(etat.fiche.prixN)}</span></span></div>
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map((i) => `<li><span class="dot ${i.c}"></span><div>${i.t}${i.law ? `<div class="law">${i.law}</div>` : ""}${htmlFait(i.fait)}</div></li>`).join("")}</ul></div>
${rappelIA()}
<p class="rule">${{ r: "N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.", y: "Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.", g: "Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt." }[R.c]}</p>
${R.c !== "r" ? `<p class="rule paiement">${REGLE_PAIEMENT}</p>` : ""}
<button class="btn ghost" data-go="proprio" id="b-proprio">Vérifier le propriétaire</button>
<p class="hint">Sans rien demander à l'annonceur : l'adresse suffit, et la comparaison se fait au moment de signer.</p>
${blocFiltre()}
${offreApprofondie("resultat")}
${boutonCarte(etat.fiche)}
${boutonSignaler(etat.fiche)}
<button type="button" class="btn ghost" id="b-carte">Partager le résultat en image</button>
<p class="hint" id="carte-info">Pour prévenir un coloc ou un parent. L'image montre le verdict, la ville, le loyer et les signaux, jamais l'adresse ni l'annonceur.</p>
<button class="btn" id="nouv">Vérifier une autre annonce</button>`;
  },
  signaler: () => vueSignaler(etat.fiche, "accueil"),
  signalOk: () => vueSignalOk(),
  attente: () =>
    `${top("accueil", "Signaler")}<h2>Ta pièce est en vérification</h2><p class="soft">Tu pourras signaler des annonces dès que ton identité sera confirmée. En attendant, préviens Facebook Marketplace ou Kijiji directement.</p><button class="btn" data-go="accueil">Retour à l'accueil</button>`,

  proprio: () => vueProprio(etat.fiche, "resultat"),
  budget: () => vueBudget(etat.fiche, "accueil"),
  trouver: () => vueTrouver(etat.fiche, "accueil"),
  confidentialite: () =>
    PAGES_LEG.confidentialite
      ? vuePageLegale("confidentialite", "Confidentialité", etat.session ? "accueil" : "bienvenue")
      : vueConfidentialite(etat.session ? "accueil" : "bienvenue"),
  supprimer: () => vueSupprimer(),
  admin: () => vueAdmin(),
  historique: () => vueHistorique(),
  detailVerif: () => vueDetailVerif(),
  compte: () => vueCompte(),
  approfondie: () => vueApprofondie(etat.fiche, etat.fiche.retourVA || "proprio"),
  conditions: () =>
    PAGES_LEG.conditions
      ? vuePageLegale("conditions", "Conditions", etat.session ? "accueil" : "bienvenue")
      : vueConditions(etat.session ? "accueil" : "bienvenue"),
  reno: () => vueReno(etat.fiche, "accueil"),
  renoResultat: () => vueRenoResultat(etat.fiche, "accueil"),

  victime: () => `${top(etat.session ? "accueil" : "bienvenue", "Aide")}
<h2>Tu as été victime ?</h2>
<div class="card"><ul class="reasons">
<li><span class="dot i"></span><div><b>1. Appelle ta banque</b> tout de suite pour tenter de bloquer le virement.</div></li>
<li><span class="dot i"></span><div><b>2. Porte plainte à la police</b> de ta ville (poste de quartier, ou 911 en cas d'urgence).<div class="law">La fraude est un acte criminel : <a href="https://laws-lois.justice.gc.ca/fra/lois/c-46/section-380.html" target="_blank" rel="noopener">Code criminel, art. 380</a></div></div></li>
<li><span class="dot i"></span><div><b>3. Signale-le au Centre antifraude du Canada</b> : 1 888 495-8501.</div></li>
<li><span class="dot i"></span><div><b>4. Signale l'annonce</b> sur Facebook Marketplace ou Kijiji.</div></li></ul></div>
<p class="hint">Tes droits de locataire : <a href="https://www.tal.gouv.qc.ca" target="_blank" rel="noopener">Tribunal administratif du logement</a></p>
<p class="hint">Un problème avec un entrepreneur : <a href="https://www.opc.gouv.qc.ca" target="_blank" rel="noopener">Office de la protection du consommateur</a> et <a href="https://www.rbq.gouv.qc.ca/services-en-ligne/plainte-signalement-et-declaration/travail-sans-licence/" target="_blank" rel="noopener">RBQ, travail sans licence</a></p>`,
};
