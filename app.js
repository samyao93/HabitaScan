{
/* ===== Configuration Supabase (clé publiable : peut être visible dans le navigateur) ===== */
const SUPABASE_URL = "https://oyiiaqyepihkawzkkjpi.supabase.co";
const SUPABASE_KEY = "sb_publishable_LhDVlSvpyM-bkW-QSp0lsw_wgNIsELX";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ROLE={"Montréal":"https://montreal.ca/consulter-les-roles-devaluation-fonciere","Québec":"https://www.ville.quebec.qc.ca/citoyens/taxes_evaluation/evaluation_fonciere/role/"};
const REGISTRE="https://www.quebec.ca/habitation-territoire/achat-vente/recherche-propriete/historique";
/* Seuils à valider avec les tests sur de vraies annonces. */
const BAS=0.75,HAUT=1.4;
/* Mots repérés dans l'annonce ou la conversation. Un mot seul ne donne jamais de rouge :
   seuls la réponse de l'utilisateur (« oui, on me demande de l'argent ») et les moyens de paiement typiques des fraudes le font.
   Les mots précédés d'une négation (« aucun dépôt », « no deposit ») sont ignorés. */
const MOTS_ARGENT=["dépôt","depot","deposit","acompte","frais de dossier","frais de réservation","frais de reservation","2 mois d'avance","deux mois d'avance","dernier mois d'avance","last month"];
const MOYENS_FRAUDE=["western union","moneygram","carte-cadeau","carte cadeau","cartes-cadeaux","cartes cadeaux","gift card","bitcoin","crypto"];
const MOTS_SCENARIO=["à l'étranger","a l'etranger","hors du pays","out of the country","pas de visite","pas possible de visiter","je suis en voyage","missionnaire","clés par la poste","cles par la poste","envoyer les clés","courrier les clés","whatsapp","telegram","beaucoup de demandes","plusieurs personnes intéressées","many people interested","premier arrivé","first come"];
const NEGATION=/(?:\bpas\s+(?:de|d['’]|besoin)|\baucune?\b|\bsans\b|\bno\b|\bnot?\b|\bnon\b|\bjamais\b|\bnever\b|\bwithout\b|\bni\b)[^.!?\n]{0,20}$/i;
/* ===== Profil de l'annonceur (Facebook bloque la lecture automatique : 3 questions facultatives) ===== */
const estFacebook=F=>/facebook\.com|fb\.com|fb\.me|marketplace|messenger/i.test((F.lien||"")+" "+(F.annonce||"")+" "+(F.ocrTxt||""));
const blocProfil=F=>`<details class="profil" ${estFacebook(F)||F.pAncien||F.pAmis||F.pPlusieurs?"open":""}><summary>Vérifier le profil de l'annonceur (facultatif)</summary>
<p class="hint" style="margin:0">Sur Facebook, touche le nom de la personne dans l'annonce, puis « À propos ».</p>
${yn("pAncien","Son compte existe depuis plus d'un an ?")}${yn("pAmis","Son profil a des amis et des publications ?")}${yn("pPlusieurs","Publie-t-elle plusieurs logements, ou dans plusieurs villes ?")}</details>`;
function itemsProfil(F){const it=[];
 if(F.pAncien==="non")it.push({c:"y",t:"<b>Compte de moins d'un an.</b> Les faux profils sont souvent récents."});
 if(F.pAmis==="non")it.push({c:"y",t:"<b>Profil sans amis ni publications.</b> C'est typique d'un faux compte."});
 if(F.pPlusieurs==="oui")it.push({c:"y",t:"<b>Plusieurs logements ou plusieurs villes.</b> Un particulier en loue rarement autant : vérifie qu'il s'agit d'une vraie entreprise de gestion."});
 if(F.pAncien==="oui"&&F.pAmis==="oui"&&F.pPlusieurs==="non")it.push({c:"g",t:"Profil d'apparence normale. Attention : un vieux compte peut avoir été piraté."});
 else if(!it.length&&estFacebook(F)&&!F.pAncien&&!F.pAmis&&!F.pPlusieurs)it.push({c:"i",t:"Annonce Facebook : réponds aux 3 questions sur le profil de l'annonceur pour une vérification plus complète."});
 return it}
const boutonCarte=F=>F.adr&&F.adr.trim()?`<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(F.adr.trim()+(F.ville&&F.ville!=="Autre"?", "+F.ville:"")+", QC")}">Voir l'adresse sur Google Maps</a><p class="hint">Avec Street View, compare l'immeuble avec les photos de l'annonce.</p>`:"";

function trouverMot(txt,liste){for(const m of liste){let i=txt.indexOf(m);while(i>=0){if(!NEGATION.test(txt.slice(Math.max(0,i-30),i)))return m;i=txt.indexOf(m,i+m.length)}}return null}

/* Sites d'annonces connus au Québec. */
const SITES=[{d:"facebook.com"},{d:"fb.com"},{d:"kijiji.ca"},{d:"lespac.com"},{d:"logisquebec.com"},{d:"rentals.ca"},{d:"padmapper.com"},{d:"centris.ca"},{d:"duproprio.com"},{d:"zumper.com"},{d:"craigslist.org"},{d:"liv.rent"},{d:"kangalou.com"},{d:"louer.ca"},{d:"realtor.ca"}];
/* Lien comparable entre utilisateurs : sans paramètres de suivi, sans fin variable. */
function normaliser(t){const m=String(t||"").match(/https?:\/\/[^\s]+/i);if(!m)return null;
 try{const u=new URL(m[0]);if(!/^https?:$/.test(u.protocol))return null;const h=u.hostname.toLowerCase().replace(/^(www|m|web)\./,"");
  const p=u.pathname.replace(/\/+$/,"");const mk=p.match(/\/marketplace\/item\/(\d+)/);
  return mk?`https://facebook.com/marketplace/item/${mk[1]}`:`https://${h}${p}`.slice(0,500)}catch(e){return null}}
let LOYERS={},PROFIL=null,HIST=[],F={},REGISTRE_PRET=false,ANONYME=true,SESSION=false;
const LS={get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
/* ===== Lecture automatique d'une annonce (texte collé, partagé ou lu sur une capture) ===== */
/* Notation québécoise : un 4 ½ = 2 chambres (pièces moins 2 : cuisine et salon). Un 1 ½ ou 2 ½ = studio. */
function extraireAnnonce(brut,villes){
 const t=String(brut||"").replace(/\u00a0|\u202f/g," "),bas=t.toLowerCase(),r={};
 const url=t.match(/https?:\/\/[^\s]+/i);if(url)r.lien=url[0];
 /* Prix : un montant de 300 à 9 999 $ collé à un symbole $ ou à « par mois » / « /mois » / « month ». */
 const prix=[...t.matchAll(/(?:\$\s?(\d{1,2}[ ,.]?\d{3}|\d{3,4})(?![\d])|(\d{1,2}[ ,.]?\d{3}|\d{3,4})\s?(?:\$|dollars?\b|par mois|\/\s?mois|\/\s?mo\b|\/\s?month|per month))/gi)]
  .map(m=>parseInt((m[1]||m[2]).replace(/[ ,.]/g,""),10)).filter(n=>n>=300&&n<=9999);
 if(!prix.length){const l=t.match(/(?:loyer|prix|rent)\s*:?\s*(\d{1,2}[ ,.]?\d{3}|\d{3,4})(?!\d)/i);if(l){const n=parseInt(l[1].replace(/[ ,.]/g,""),10);if(n>=300&&n<=9999)prix.push(n)}}
 if(prix.length)r.prix=String(prix[0]);
 /* Chambres : « 4 1/2 », « 4½ », « 4.5 », « 2 chambres », « 2 cc », « 2 bedrooms », « 2 br ». */
 const demi=bas.match(/\b([1-9])\s?(?:½|1\/2|\.5|,5)(?!\d)/);
 const ch=bas.match(/\b([1-6])\s?(?:chambres?|cc\b|c\.c\.|bedrooms?|beds?\b|br\b|bdr)/);
 if(ch)r.ch=String(Math.min(+ch[1],3));
 else if(demi&&+demi[1]>=3)r.ch=String(Math.min(+demi[1]-2,3));
 /* Ville : une des villes de référence nommée dans le texte. */
 const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const nb=norm(t);const v=(villes||[]).find(x=>new RegExp("\\b"+norm(x).replace(/[-\s]/g,"[-\\s]")+"\\b").test(nb));
 if(v)r.ville=v;
 if(/\bcession\b|\btransfert de bail\b|\blease transfer\b/.test(bas))r.cession="oui";
 return r;
}
function resumeLecture(r){const p=[];if(r.prix)p.push(Number(r.prix).toLocaleString("fr-CA")+" $");if(r.ch)p.push(r.ch==="3"?"3 ch. et plus":r.ch+" ch.");if(r.ville)p.push(r.ville);if(r.cession)p.push("cession de bail");return p.join(" · ")}

/* Lecture du texte d'une capture d'écran, directement sur le téléphone (Tesseract.js, chargé seulement au besoin). */
let tesseractPret=null;
function chargerTesseract(){if(window.Tesseract)return Promise.resolve();if(tesseractPret)return tesseractPret;
 tesseractPret=new Promise((ok,ko)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";s.onload=ok;s.onerror=()=>{tesseractPret=null;ko(new Error("tesseract"))};document.head.appendChild(s)});
 return tesseractPret}
async function lireCapture(image){await chargerTesseract();const {data}=await Tesseract.recognize(image,"fra+eng");return data&&data.text||""}

/* ===== Signalements ===== */
const MOTIFS={argent_avant_bail:"On m'a demandé de l'argent avant le bail",faux_proprietaire:"La personne n'est pas le vrai propriétaire",logement_inexistant:"Le logement n'existe pas ou n'est pas à louer",photos_volees:"Les photos viennent d'une autre annonce",autre:"Autre raison"};
/* Seuils de départ, à ajuster après les premiers tests. */
const SEUIL_JAUNE=1,SEUIL_ROUGE=3;
function itemSignalements(n){if(!n)return null;
 return n>=SEUIL_ROUGE?{c:"r",t:`<b>Annonce signalée ${n} fois</b> par des utilisateurs à l'identité confirmée.`}
  :{c:"y",t:`<b>Annonce signalée ${n} fois</b> par ${n>1?"des utilisateurs":"un utilisateur"} à l'identité confirmée. Redouble de prudence.`}}
const vueSignaler=(F,retour)=>`${top(retour,"Signaler")}
<h2>Signaler cette annonce</h2><p class="soft">Ton signalement prévient les prochaines personnes qui vérifient la même annonce. Ton nom n'est jamais montré.</p>
<form class="card" id="f-sig" novalidate>
<div class="q">Qu'est-ce qui s'est passé ?<div class="choix" role="radiogroup" aria-label="Raison">${Object.entries(MOTIFS).map(([k,l])=>`<button type="button" data-motif="${k}" aria-pressed="${F.motif===k}">${l}</button>`).join("")}</div></div>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="bonnefoi" style="width:22px;min-height:22px;margin-top:2px">Je signale de bonne foi, à partir de ce que j'ai vécu.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer le signalement</button></form>
<p class="hint">Un faux signalement peut causer du tort à une personne honnête. Seuls les comptes à l'identité confirmée peuvent signaler.</p>`;
function lierSignaler(F){app.querySelectorAll("[data-motif]").forEach(b=>b.onclick=()=>{F.motif=b.dataset.motif;app.querySelectorAll("[data-motif]").forEach(x=>x.setAttribute("aria-pressed",x===b))})}
function validerSignal(F){if(!F.motif)return "Choisis une raison.";if(!$("#bonnefoi").checked)return "Coche la case pour confirmer.";return ""}
const vueSignalOk=()=>`${top(null,"Merci")}
<svg class="seal" role="img" aria-label="Signalement reçu"><use href="#seal"/></svg>
<h1>Signalement reçu</h1><p class="soft">Les prochaines personnes qui vérifient cette annonce verront l'avertissement.</p>
<button class="btn" data-go="accueil">Retour à l'accueil</button>`;
const boutonSignaler=F=>F.lienN?`<button class="btn ghost" id="signaler">Signaler cette annonce comme frauduleuse</button>`:`<p class="hint">Pour pouvoir signaler cette annonce, ajoute son lien.</p>`;

/* ===== Module Vérif-Réno : règles communes (démo et version Supabase) =====
   Sources : RBQ, liste des sous-catégories de licence ; OPC, guide du commerce itinérant
   (LPC art. 55, 59, 60, 60.1, 321 ; Règlement d'application, art. 7). */
const LIENS={
 rbq:"https://www.rbq.gouv.qc.ca/vous-etes/citoyen/verifier-la-licence-dun-entrepreneur",
 souscat:"https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Publications/francais/AnnexeListeSousCategories.pdf",
 general:"https://www.rbq.gouv.qc.ca/licence/determiner-vos-sous-categories-de-licence/entrepreneur-general/",
 opc:"https://www.opc.gouv.qc.ca/se-renseigner/",
 itinerant:"https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document8.pdf",
 lpc601:"https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document6.pdf",
 art46:"https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Decisions/decision_5800-8673_9369-5013-Quebec-inc.pdf"};
const lien=(href,txt)=>`<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
/* art7 : contrat signé à domicile = commerce itinérant, même si le client a invité l'entrepreneur (Règlement, art. 7). */
const TRAVAUX={
 toiture:{l:"Toiture, isolation, revêtement extérieur",sc:["7"],nomSc:"7",art7:true},
 portes:{l:"Portes et fenêtres",sc:["8"],nomSc:"8",art7:true},
 plomberie:{l:"Plomberie",sc:["15.5"],nomSc:"15.5",corp:"CMMTQ"},
 chauffage:{l:"Chauffage",sc:["15.1","15.2","15.3","15.4"],nomSc:"15.1 à 15.4",corp:"CMMTQ"},
 electricite:{l:"Électricité",sc:[],nomSc:"licence de la CMEQ",corp:"CMEQ"},
 general:{l:"Rénovation générale (cuisine, salle de bain…)",sc:["1.2","1.3"],nomSc:"1.2 ou 1.3"}};
const GENERAL=["1.2","1.3"];
const chiffres=t=>String(t||"").replace(/\D/g,"");
const formatLicence=d=>d.length===10?d.replace(/(\d{4})(\d{4})(\d{2})/,"$1-$2-$3"):d;
const sansAccent=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()
 .replace(/\b(inc|ltee|ltd|enr|senc|la|le|les|de|du|des)\b\.?/g," ").replace(/[^a-z0-9]+/g," ").trim();
function memeNom(a,b){const x=sansAccent(a),y=sansAccent(b);return !!x&&!!y&&(x.includes(y)||y.includes(x))}
/* Délai de 10 jours (LPC art. 59) : le jour de départ ne compte pas ; une échéance un samedi, un dimanche,
   le 26 décembre ou le 2 janvier est reportée (LPC art. 269). Les autres jours fériés ne sont pas calculés. */
function dateLimite(iso){const d=new Date(iso+"T12:00:00");if(isNaN(d))return null;d.setDate(d.getDate()+10);
 const ferie=x=>x.getDay()===6||x.getDay()===0||(x.getMonth()===11&&x.getDate()===26)||(x.getMonth()===0&&x.getDate()===2);
 while(ferie(d))d.setDate(d.getDate()+1);return d}
const jourLong=d=>d.toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const aujourdhui=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};

/* R = fiche de la liste des licences actives de la RBQ ({numero,nom,autres_noms,sous_categories,mandataire})
   ou null si introuvable ; R === undefined quand la liste n'est pas disponible (démo, ou pas encore importée). */
function analyserReno(F,R){
 const it=[],T=TRAVAUX[F.travaux],lic=chiffres(F.licence);
 const L46="Loi sur le bâtiment, art. 46 · "+lien(LIENS.art46,"RBQ"),LSC="Liste des sous-catégories · "+lien(LIENS.souscat,"RBQ");
 if(!lic)it.push({c:"y",t:"<b>Aucun numéro de licence RBQ.</b> Demande-le : la loi exige une licence pour faire des travaux, et sans licence il n'y a pas de cautionnement pour t'indemniser.",law:L46});
 else if(R===undefined)it.push({c:"i",t:`<b>Licence ${esc(formatLicence(lic))} :</b> vérifie-la dans le registre officiel (bouton plus bas). Dans la version complète, l'app la compare seule à la liste des licences actives, mise à jour chaque jour.`,law:L46});
 else if(R===null)it.push({c:"r",t:`<b>Licence ${esc(formatLicence(lic))} introuvable</b> dans la liste des licences actives de la RBQ. Vérifie le numéro ; s'il est exact, l'entreprise n'a pas de licence en vigueur.`,law:L46});
 else{
  it.push({c:"g",t:`<b>Licence active</b> : ${esc(String(R.nom||formatLicence(lic)).replace(/\.$/,""))}.`,law:"Liste des licences actives, RBQ (données ouvertes)"});
  if(F.nom&&F.nom.trim()&&!memeNom(F.nom,R.nom)&&!memeNom(F.nom,R.autres_noms))
   it.push({c:"y",t:`<b>Le nom sur la soumission (« ${esc(F.nom)} ») ne correspond pas</b> au nom de la licence (« ${esc(R.nom)} »). Utiliser la licence d'une autre entreprise est interdit : demande une explication.`,law:L46});
  const sc=String(R.sous_categories||""),aSc=x=>new RegExp("(^|[^0-9.])"+x.replace(".","\\.")+"(?![0-9])").test(sc);
  if(T.corp&&!String(R.mandataire||"").toUpperCase().includes(T.corp)&&!T.sc.some(aSc)){
   if(GENERAL.some(aSc))it.push({c:"i",t:`Entrepreneur général : il peut confier ces travaux (${T.l.toLowerCase()}) à un sous-traitant, qui doit lui aussi avoir sa licence (${T.nomSc}).`,law:lien(LIENS.general,"RBQ, entrepreneur général")});
   else it.push({c:"y",t:`<b>Cette licence ne semble pas couvrir : ${T.l.toLowerCase()}.</b> Attendu : ${T.nomSc}.`,law:LSC});}
  else if(!T.corp&&!T.sc.some(aSc)){
   if(GENERAL.some(aSc))it.push({c:"i",t:`Entrepreneur général : il peut confier ces travaux à un sous-traitant, qui doit lui aussi avoir sa licence (sous-catégorie ${T.nomSc}).`,law:lien(LIENS.general,"RBQ, entrepreneur général")});
   else it.push({c:"y",t:`<b>Cette licence ne couvre pas : ${T.l.toLowerCase()}.</b> Sous-catégorie attendue : ${T.nomSc}.`,law:LSC});}
  else it.push({c:"g",t:`La licence couvre ce type de travaux (${T.nomSc}).`,law:LSC});}

 const LIT="Loi sur la protection du consommateur · "+lien(LIENS.itinerant,"OPC, commerce itinérant");
 F.limite=null;
 if(F.domicile==="oui"&&T.art7){
  const lim=dateLimite(F.recu||aujourdhui());F.limite=lim;
  it.push({c:"i",t:`<b>Contrat itinérant</b> : signé chez toi pour ce type de travaux, c'est un contrat itinérant même si tu as invité l'entrepreneur. Tu peux l'annuler sans frais ni raison jusqu'au <b>${lim?jourLong(lim):"10e jour"}</b>.`,law:"Règlement d'application de la LPC, art. 7 ; LPC, art. 59 · "+lien(LIENS.itinerant,"OPC")});
  if(F.acompte==="oui")it.push({c:"r",t:"<b>Paiement demandé pendant le délai d'annulation.</b> Un commerçant itinérant ne peut recevoir aucun paiement avant la fin des 10 jours.",law:"LPC, art. 60 · "+lien(LIENS.itinerant,"OPC")});
  it.push({c:"i",t:"Les travaux ne peuvent pas commencer avant la fin du délai, et l'entrepreneur doit détenir un permis de commerçant itinérant de l'OPC (bouton plus bas).",law:"LPC, art. 55 et 60.1 · "+lien(LIENS.lpc601,"OPC")});}
 else if(F.domicile==="oui"){
  it.push({c:"i",t:"<b>Signé chez toi :</b> si c'est l'entrepreneur qui t'a sollicité (porte-à-porte, appel), les règles du commerce itinérant s'appliquent : 10 jours pour annuler sans frais, aucun paiement ni début des travaux avant la fin de ce délai.",law:LIT});
  if(F.acompte==="oui")it.push({c:"y",t:"<b>Paiement demandé tout de suite.</b> Si l'entrepreneur t'a sollicité chez toi, il ne peut rien recevoir avant la fin des 10 jours.",law:"LPC, art. 60 · "+lien(LIENS.itinerant,"OPC")});}
 else if(F.acompte==="oui")
  it.push({c:"i",t:"<b>Acompte demandé.</b> Pas illégal ici, mais l'OPC recommande si possible aucun acompte à la signature, sinon une petite somme, puis des paiements selon l'avancement des travaux."});
 if(F.capture)it.push({c:"i",t:"Lecture automatique du numéro et du nom sur la photo : prochaine version."});
 const c=it.some(i=>i.c==="r")?"r":it.some(i=>i.c==="y")?"y":"g";
 const ord={r:0,y:1,i:2,g:3};it.sort((a,b)=>ord[a.c]-ord[b.c]);
 return {c,items:it};
}

/* Écrans communs du module. */
const vueReno=(F,retour)=>`${top(retour,"Rénovation")}
<h2>La soumission de l'entrepreneur</h2>
<form class="card" id="f-reno" novalidate>
<label class="drop">${F.captureUrl||(typeof F.capture==="string"&&F.capture)?`<img src="${F.captureUrl||F.capture}" alt="Photo de la soumission">Changer la photo`:"Photographier la soumission (facultatif)"}<input type="file" accept="image/*" capture="environment" data-side="capture"></label>
<div class="grid2"><label>Licence RBQ<input id="licence" inputmode="numeric" autocomplete="off" placeholder="0000-0000-00" value="${esc(F.licence||"")}"></label>
<label>Nom de l'entreprise<input id="nom" autocomplete="off" placeholder="Sur la soumission" value="${esc(F.nom||"")}"></label></div>
<div class="q">Type de travaux<div class="choix" role="group" aria-label="Type de travaux">${Object.entries(TRAVAUX).map(([k,t])=>`<button type="button" data-trav="${k}" aria-pressed="${F.travaux===k}">${t.l}</button>`).join("")}</div></div>
${yn("domicile","Le contrat est (ou sera) signé chez toi ?")}
<div id="q-recu" ${F.domicile!=="oui"?"hidden":""}><label>Date où tu as reçu ton exemplaire signé<input id="recu" type="date" value="${esc(F.recu||aujourdhui())}"></label></div>
${yn("acompte","On te demande un acompte ou un paiement maintenant ?")}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Vérifier</button></form>
<p class="hint">La photo reste sur ton téléphone. Seuls le numéro de licence, le type de travaux et le résultat sont gardés dans ton historique.</p>`;

const vueRenoResultat=(F,retour)=>{const R=F.res,T=TRAVAUX[F.travaux];return `${top(retour,"Résultat")}
<div class="verdict ${R.c}"><strong>${{r:"Ne signe pas, ne paie pas",y:"Prudence",g:"Aucun signal d'alarme"}[R.c]}</strong><span>${esc(T.l)}${F.licence?` · licence <span class="num">${esc(formatLicence(chiffres(F.licence)))}</span>`:""}</span></div>
${F.limite?`<div class="rule">Annulation possible sans frais jusqu'au <b>${jourLong(F.limite)}</b>.</div>`:""}
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map(i=>`<li><span class="dot ${i.c}"></span><div>${i.t}${i.law?`<div class="law">${i.law}</div>`:""}</div></li>`).join("")}</ul></div>
<p class="rule">Paie selon l'avancement des travaux, jamais tout d'avance.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.opc}" target="_blank" rel="noopener" id="opc">Voir les plaintes à l'OPC</a>
<p class="hint">${F.nom?"En touchant le bouton, le nom de l'entreprise est copié : colle-le dans l'outil de l'OPC. ":""}Une plainte ne prouve pas une faute : regarde surtout leur nombre et leur sujet.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.rbq}" target="_blank" rel="noopener">Ouvrir le registre des licences RBQ</a>
<button class="btn" id="nouv">Vérifier un autre entrepreneur</button>`};

/* Liaisons communes du formulaire. */
function lierReno(F){
 app.querySelectorAll("[data-trav]").forEach(b=>b.onclick=()=>{F.travaux=b.dataset.trav;app.querySelectorAll("[data-trav]").forEach(x=>x.setAttribute("aria-pressed",x===b))});
 app.querySelectorAll("[data-yn=domicile]").forEach(b=>b.addEventListener("click",()=>{$("#q-recu").hidden=F.domicile!=="oui"}));
}
function lireReno(F){["licence","nom","recu"].forEach(k=>{const el=$("#"+k);if(el)F[k]=el.value})}
function validerReno(F){const d=chiffres(F.licence);
 if(d&&(d.length<8||d.length>10))return "Ce numéro de licence semble incomplet. Recopie-le tel qu'il est sur la soumission, ou laisse le champ vide.";
 if(!F.travaux)return "Choisis le type de travaux.";
 if(!F.domicile||!F.acompte)return "Réponds aux deux questions.";
 if(F.domicile==="oui"&&F.recu&&isNaN(new Date(F.recu+"T12:00:00")))return "Entre une date valide.";
 return ""}
function lierResultatReno(F){const o=$("#opc");if(o&&F.nom)o.addEventListener("click",()=>{try{navigator.clipboard.writeText(F.nom)}catch(e){}})}

/* Lien reçu par « Partager » depuis une autre app (Android) ou par l'adresse ?url= */
try{const q=new URLSearchParams(location.search),tout=[q.get("title"),q.get("text"),q.get("url")].filter(Boolean).join("\n");
 if(tout){const l=normaliser(tout);if(l)F.lien=l;F.annonce=tout;F.partage=true;history.replaceState(null,"",location.pathname)}}catch(e){}
const $=s=>document.querySelector(s);
const app=$("#app");
const esc=t=>String(t??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const money=n=>Number(n).toLocaleString("fr-CA")+" $";
const top=(back,title)=>`<div class="top">${back?`<button class="back" data-go="${back}">‹ Retour</button>`:""}<b>${title||"HabitaScan"}</b><span class="sp"></span></div>`;
const STATUT={aucune:"Identité non confirmée",en_attente:"Identité en vérification",confirmee:"Identité confirmée",refusee:"Identité refusée : recommence"};

/* ===== HabitaScan : propriétaire, budget, annonces vérifiées (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, money, top, yn, LOYERS, lireCapture, err, et d'un adaptateur ANN propre à chaque version :
   ANN.chercher({ville,ch,max}) → Promise<[{titre,url,extrait,age}]> ; ANN.note : texte affiché sous les résultats */

const L_INFOLOT="https://appli.foncier.gouv.qc.ca/infolot/";
const L_REGISTRE="https://www.registrefoncier.gouv.qc.ca";
const L_TARIF="https://portail-info.foncier.gouv.qc.ca/media/40hfdqo0/grille_tarifaire_janvier_2026.pdf";
const L_ROLE_MTL="https://montreal.ca/consulter-les-roles-devaluation-fonciere";
const L_RETRAIT_MTL="https://montreal.ca/articles/confidentialite";
const L_1904="https://www.legisquebec.gouv.qc.ca/fr/document/lc/CCQ-1991#se:1904";
const L_SCHL30="https://www.cmhc-schl.gc.ca/fr/consumers/renting-a-home/i-want-to-rent/things-to-consider-before-renting";
const lienExt=(u,t)=>`<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
const nouveauF=o=>{for(const k in F)delete F[k];Object.assign(F,o)};
const villeDefaut=()=>LOYERS["Montréal"]?"Montréal":Object.keys(LOYERS)[0];
const dateFr=d=>{try{return new Date(d+"T12:00:00").toLocaleDateString("fr-CA",{day:"numeric",month:"long",year:"numeric"})}catch(e){return d}};
const nombre=v=>{const n=parseInt(String(v||"").replace(/[^\d]/g,""),10);return isNaN(n)?0:n};

/* ---------- 1. Vérifier le propriétaire ---------- */
const sansAccents=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const chiffresLot=t=>String(t||"").replace(/\D/g,"");
const fmtLot=t=>chiffresLot(t).replace(/^(\d)(\d{3})(\d{3,4})$/,"$1 $2 $3");
// Services publics du gouvernement du Québec (données ouvertes) :
// géocodeur Adresses Québec (MRNF, CC-BY 4.0) et couche des lots du cadastre rénové.
const GEO_URL="https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/AdressesQuebec_Geocodage/GeocodeServer/findAddressCandidates";
const CAD_URL="https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query";
async function trouverLotDirect(adr){
 const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),10000);
 try{const g=await (await fetch(`${GEO_URL}?SingleLine=${encodeURIComponent(adr)}&outSR=4326&maxLocations=1&f=json`,{signal:ctl.signal})).json();
  const c=g&&g.candidates&&g.candidates[0];if(!c||!c.location||(c.score!=null&&c.score<80))return {trouve:false};
  const q=await (await fetch(`${CAD_URL}?geometry=${c.location.x},${c.location.y}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NO_LOT&returnGeometry=false&f=json`,{signal:ctl.signal})).json();
  const lots=[...new Set(((q&&q.features)||[]).map(f=>chiffresLot(f.attributes&&f.attributes.NO_LOT)).filter(Boolean))];
  return {trouve:true,adresse:c.address||adr,lots}}finally{clearTimeout(t)}}
function memeNom(a,b){const m=s=>sansAccents(s).split(/[^a-z]+/).filter(x=>x.length>=3);const A=m(a),B=m(b);if(!A.length||!B.length)return null;
 const com=A.filter(x=>B.includes(x)).length;return com===Math.min(A.length,B.length)?"oui":com?"partiel":"non"}
function comparerProprio(texte,nom,adr){
 const T=" "+sansAccents(texte).replace(/[^a-z0-9]+/g," ")+" ";
 const mots=sansAccents(nom).split(/[^a-z]+/).filter(m=>m.length>=3);
 const trouves=mots.filter(m=>T.includes(" "+m+" "));
 const no=(String(adr||"").match(/\d+/)||[])[0];
 const rue=sansAccents(adr).replace(/[^a-z ]/g," ").split(/\s+/).filter(m=>m.length>=4&&!["rue","avenue","boulevard","chemin","place","montee","rang"].includes(m))[0];
 const m=sansAccents(texte).match(/lot[^0-9]{0,25}(\d[\d ]{5,10}\d)/);
 const lot=m?m[1].replace(/\s/g,""):null;
 return {nom:mots.length?trouves.length===mots.length?"oui":trouves.length?"partiel":"non":null,
  adr:no?(T.includes(" "+no+" ")&&(!rue||T.includes(" "+rue+" "))?"oui":"non"):null,
  lot:lot&&lot.length>=7&&lot.length<=8?fmtLot(lot):null}
}
function verdictProprio(P){
 if(P.refus==="oui")return {c:"r",t:"Ne paie pas",s:"Un vrai propriétaire peut prouver qu'il possède le logement. Un refus est un signal grave."};
 const c=P.cmp||{};const nomOk=c.nom==="oui"||P.nomManuel==="oui",nomKo=c.nom==="non"||P.nomManuel==="non";
 const lotKo=c.lot&&P.geo&&P.geo.lots&&P.geo.lots.length&&!P.geo.lots.includes(chiffresLot(c.lot));
 const role=P.nomRole?memeNom(P.nomRole,P.nom):null;
 if(lotKo)return {c:"y",t:"Le numéro de lot ne correspond pas",s:"Le lot du compte de taxes n'est pas celui de l'adresse. Demande le compte de taxes de ce logement-ci."};
 if(nomKo)return {c:"y",t:"Le nom ne correspond pas",s:P.role==="gestionnaire"?"Demande le mandat écrit signé par le propriétaire inscrit sur le compte de taxes.":"Demande pourquoi. Un gestionnaire doit montrer un mandat écrit du propriétaire."};
 if(c.adr==="non")return {c:"y",t:"L'adresse ne correspond pas",s:"Le compte de taxes doit être celui de l'adresse du logement."};
 if(role==="non"&&P.role!=="gestionnaire")return {c:"y",t:"Le nom au rôle est différent",s:"Le propriétaire au rôle n'est pas ton interlocuteur. Demande le mandat écrit, ou confirme au Registre foncier : le rôle peut dater."};
 if(nomOk||role==="oui")return {c:"g",t:"Les documents correspondent",s:"Pour une preuve sûre, confirme au Registre foncier (étape 3) avant de signer."};
 return null
}
function vueProprio(F,back){const P=F.P||(F.P={adr:F.adr?(F.adr+(F.ville&&F.ville!=="Autre"?", "+F.ville:"")):"",role:"proprietaire"});const V=verdictProprio(P),c=P.cmp,G=P.geo;
 const ligne=(etat,t)=>`<li><span class="dot ${etat}"></span><div>${t}</div></li>`;
 const lots=G&&G.lots||[];const role=P.nomRole?memeNom(P.nomRole,P.nom):null;
 return `${top(back,"Propriétaire")}
<h2>Vérifier le propriétaire</h2>
<p class="soft">Le rôle d'évaluation en ligne n'affiche pas toujours le nom : à Montréal, un propriétaire peut demander qu'on retire son nom et ses coordonnées (${lienExt(L_RETRAIT_MTL,"Loi sur la fiscalité municipale")}). Voici comment le confirmer quand même.</p>
${V?`<div class="verdict ${V.c}" id="pv"><strong>${V.t}</strong><span>${V.s}</span></div>`:""}
<form class="card" id="f-pro" novalidate>
<h2>1. L'adresse et le numéro de lot</h2>
<label>Adresse du logement<input id="padr" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(P.adr||"")}"></label>
<button type="button" class="btn ghost" id="b-lot">${P.chercheLot?"Recherche…":"Trouver le numéro de lot"}</button>
${G?G.trouve?`<ul class="reasons">${ligne("g",`Adresse trouvée : ${esc(G.adresse)}.`)}
${lots.length?ligne("g",`Numéro de lot : ${lots.map(l=>`<b class="num">${esc(fmtLot(l))}</b>`).join(", ")}. Il sert au Registre foncier (étape 3).`):ligne("y",`Numéro de lot non trouvé automatiquement. Cherche l'adresse sur ${lienExt(L_INFOLOT,"Infolot")}.`)}
</ul><p class="hint">Sources : Adresses Québec et cadastre du Québec, données ouvertes du gouvernement. La carte officielle reste ${lienExt(L_INFOLOT,"Infolot")}.</p>`
:`<p class="lu">${esc(G.erreur||"Adresse introuvable. Ajoute la ville, ou cherche-la sur la carte Infolot.")} ${lienExt(L_INFOLOT,"Ouvrir Infolot")}</p>`:""}
<h2>2. Demande le compte de taxes municipales</h2>
<p class="hint">Le propriétaire le reçoit chaque année pour cette adresse. Demande-lui une photo : il peut cacher les montants. Le nom, l'adresse et le numéro de lot suffisent.</p>
<div class="seg" role="group" aria-label="Qui te loue le logement"><button type="button" data-role="proprietaire" aria-pressed="${P.role!=="gestionnaire"}">Il dit être le propriétaire</button><button type="button" data-role="gestionnaire" aria-pressed="${P.role==="gestionnaire"}">Il dit être gestionnaire</button></div>
<label>Nom de ton interlocuteur${P.role==="gestionnaire"?" (ou du propriétaire qu'il représente)":""}<input id="pnom" autocomplete="off" placeholder="Prénom Nom" value="${esc(P.nom||"")}"></label>
<label class="drop">${P.photo?`<img src="${P.photo}" alt="Compte de taxes">Changer la photo`:"Ajouter la photo du compte de taxes"}<input type="file" accept="image/*" data-taxe="1"></label>
${P.lecture?`<p class="lu" role="status">${P.lecture}</p>`:""}
${c?`<ul class="reasons">
${c.nom?ligne(c.nom==="oui"?"g":c.nom==="partiel"?"y":"r",c.nom==="oui"?"Le nom de ton interlocuteur est sur le compte de taxes.":c.nom==="partiel"?"Une partie du nom seulement est sur le compte de taxes. Vérifie toi-même.":"Le nom de ton interlocuteur n'est pas sur le compte de taxes."):""}
${c.adr?ligne(c.adr==="oui"?"g":"r",c.adr==="oui"?"L'adresse du logement est sur le compte de taxes.":"L'adresse du logement n'a pas été trouvée sur le compte de taxes."):""}
${c.lot?ligne(lots.length?(lots.includes(chiffresLot(c.lot))?"g":"r"):"i",lots.length?(lots.includes(chiffresLot(c.lot))?`Le numéro de lot du compte de taxes (<b class="num">${esc(c.lot)}</b>) est bien celui de l'adresse.`:`Le numéro de lot du compte de taxes (<b class="num">${esc(c.lot)}</b>) n'est pas celui de l'adresse.`):`Numéro de lot lu : <b class="num">${esc(c.lot)}</b>.`):ligne("y","Numéro de lot non lu sur le compte de taxes.")}</ul>`:""}
${P.photo&&P.echec?yn("pnomManuel","Le nom sur le compte de taxes est-il celui de ton interlocuteur ?"):""}
${P.role==="gestionnaire"?`<p class="hint"><b>Gestionnaire :</b> demande aussi le mandat écrit signé par le propriétaire inscrit sur le compte de taxes.</p>`:""}
${yn("prefus","Refuse-t-il de montrer le compte de taxes ou une pièce d'identité ?")}
<p class="hint">La photo reste sur ton téléphone. Elle n'est envoyée nulle part.</p>
</form>
<div class="card"><h2>3. Confirme au Registre foncier</h2>
<p class="hint">C'est la preuve qui ne peut pas être retirée : le dernier acte de vente indique à qui appartient l'immeuble.</p>
<ul class="reasons">
${ligne("i",lots.length?`<b>Ton numéro de lot :</b> <span class="num">${lots.map(fmtLot).join(", ")}</span>.`:`<b>Trouve le numéro de lot</b> à l'étape 1, ou avec ${lienExt(L_INFOLOT,"Infolot")} (gratuit).`)}
${ligne("i",`<b>Consulte l'index des immeubles</b> de ce lot au ${lienExt(L_REGISTRE,"Registre foncier du Québec")} : 1 $ par document, compte requis.<div class="law">${lienExt(L_TARIF,"Grille tarifaire du Registre foncier, 1er janvier 2026")}</div>`)}
${ligne("i","<b>Compare le nom</b> du dernier acheteur avec celui du compte de taxes et de ton interlocuteur.")}</ul></div>
<div class="card"><h2>4. Rôle d'évaluation (facultatif)</h2>
<p class="hint">${F.ville==="Montréal"||!F.ville?`À Montréal : ${lienExt(L_ROLE_MTL,"rôle d'évaluation en ligne")}.`:`Plusieurs villes publient leur rôle d'évaluation en ligne ; cherche « rôle d'évaluation » et le nom de ta ville.`} Si le nom n'apparaît pas, ce n'est pas un signal d'arnaque : le propriétaire a pu demander son retrait.</p>
<label>Nom inscrit au rôle, si tu l'as trouvé<input id="prole" autocomplete="off" placeholder="Prénom Nom" value="${esc(P.nomRole||"")}"></label>
${role?`<ul class="reasons">${ligne(role==="oui"?"g":role==="partiel"?"y":"r",role==="oui"?"Le nom au rôle est celui de ton interlocuteur.":role==="partiel"?"Le nom au rôle ressemble en partie à celui de ton interlocuteur.":"Le nom au rôle n'est pas celui de ton interlocuteur.")}</ul>`:""}
</div>
<button class="btn" data-go="${back}">Retour au résultat</button>`}
function lierProprio(F){const P=F.P;
 const garder=()=>{P.nom=$("#pnom").value;P.adr=$("#padr").value;P.nomRole=$("#prole").value};
 const recomparer=()=>{if(P.texte)P.cmp=comparerProprio(P.texte,P.nom,P.adr)};
 app.querySelectorAll("[data-role]").forEach(b=>b.onclick=()=>{garder();P.role=b.dataset.role;go("proprio")});
 app.querySelectorAll("[data-yn=prefus],[data-yn=pnomManuel]").forEach(b=>b.addEventListener("click",()=>{garder();P.refus=F.prefus;P.nomManuel=F.pnomManuel;go("proprio")}));
 ["#pnom","#padr","#prole"].forEach(s=>$(s).onchange=()=>{const avant=P.adr;garder();if(P.adr!==avant)P.geo=null;recomparer();go("proprio")});
 $("#b-lot").onclick=async()=>{garder();if(P.adr.trim().length<6||!/\d/.test(P.adr)){P.geo={trouve:false,erreur:"Entre l'adresse complète, avec le numéro et la ville."};return go("proprio")}
  P.chercheLot=true;go("proprio");
  try{P.geo=await INFO.adresse(P.adr.trim())}catch(e){P.geo={trouve:false,erreur:"La recherche automatique n'a pas fonctionné ici."}}
  P.chercheLot=false;if($("#f-pro"))go("proprio")};
 const inp=app.querySelector("input[data-taxe]");
 inp.onchange=()=>{const f=inp.files[0];if(!f)return;garder();const r=new FileReader();r.onload=()=>{P.photo=r.result;P.cmp=null;P.echec=false;P.lecture="Lecture du compte de taxes…";go("proprio");
  lireCapture(P.photo).then(t=>{P.texte=t;P.cmp=comparerProprio(t,P.nom,P.adr);P.lecture=P.nom?null:"Écris le nom de ton interlocuteur pour comparer.";})
  .catch(()=>{P.echec=true;P.lecture="La lecture automatique n'a pas fonctionné ici. Compare le nom toi-même ci-dessous."})
  .finally(()=>{if($("#f-pro"))go("proprio")})};r.readAsDataURL(f)}}

/* ---------- 2. Simulateur de budget d'installation 2026 ---------- */
const TRANSIT={ // laissez-passer mensuel régulier, tarif 2026
 "Montréal":{p:110,s:"STM, mensuel tous modes A, juillet 2026",u:"https://www.narcity.com/fr/montreal/augmentation-stm-artm-tarifs-2026"},
 "Québec":{p:115,s:"Métropolitain régulier RTC/STLévis, 1er février 2026",u:"https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf"},
 "Lévis":{p:115,s:"Métropolitain régulier RTC/STLévis, 1er février 2026",u:"https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf"},
 "Gatineau":{p:116.5,s:"STO, mensuel régulier 2026",u:"https://sto.ca/en/fares/echo-program/"}};
const ASSURANCE={p:31,s:"moyenne citée par la Chambre de l'assurance de dommages (Protégez-vous)",u:"https://www.protegez-vous.ca/partenaires/chambre-de-l-assurance/assurance-locataire-quoi-savoir-pour-prendre-une-decision-eclairee"};
const EPICERIE={p:366,s:"Rapport sur les prix alimentaires 2026 : 17 571,79 $ par an pour une famille de quatre, divisé par 4 et par 12",u:"https://www.dal.ca/news/2025/12/04/canada-food-price-report-2026.html"};
const GARDE={jour:9.65,jours:21,s:"tarif 2026 en service de garde subventionné : 9,65 $ par jour",u:"https://www.quebec.ca/famille-et-soutien-aux-personnes/enfance/garderies-et-services-de-garde/soutien-financier-frais-garde"};
const POSTES=[["loyer","Loyer"],["elec","Électricité"],["epicerie","Épicerie"],["transport","Transport"],["internet","Internet et cellulaire"],["garde","Garde d'enfants"],["assurance","Assurance locataire"],["abonnements","Abonnements"]];
const gardeDefaut=B=>String(Math.round(GARDE.jour*GARDE.jours*(+B.garderie||0)));
function budgetDefaut(F){const B=F.B||(F.B={});
 if(!B.ville)B.ville=F.ville&&LOYERS[F.ville]?F.ville:villeDefaut();
 if(!B.ch)B.ch=F.ch||"1";if(!B.unite)B.unite="an";if(!B.adultes)B.adultes="1";if(!B.enfants)B.enfants="0";if(!B.garderie)B.garderie="0";if(!B.mois)B.mois="3";
 if(+B.garderie>+B.enfants)B.garderie=B.enfants;
 if(B.transport==null){const t=TRANSIT[B.ville];B.transport=t?String(Math.round(t.p*(+B.adultes||1)*100)/100).replace(".",","):""}
 if(B.assurance==null)B.assurance=String(ASSURANCE.p);
 if(B.epicerie==null)B.epicerie=String(EPICERIE.p*((+B.adultes||1)+(+B.enfants||0)));
 if(B.garde==null)B.garde=gardeDefaut(B);
 if(B.loyer==null){const l=LOYERS[B.ville];B.loyer=l?String(l[Math.min(+B.ch,3)-1]):""}
 return B}
const montant=v=>{const n=parseFloat(String(v||"").replace(/\s/g,"").replace(",","."));return isNaN(n)?0:n};
function calculerBudget(B){
 const rev=montant(B.revenu),revMois=B.unite==="an"?rev/12:rev;
 const loyer=montant(B.loyer),elec=montant(B.elec);
 const postes=POSTES.map(([k,n])=>({k,n,v:montant(B[k])})).filter(p=>p.v>0);
 const mensuel=postes.reduce((a,p)=>a+p.v,0);
 const uniques=montant(B.demenagement)+montant(B.meubles);
 const mois=+B.mois||3;
 const max=revMois?Math.max(0,Math.floor(revMois*0.30-elec)):0;
 const ratio=revMois?(loyer+elec)/revMois:0;
 const l=LOYERS[B.ville],moy=l&&l[Math.min(+B.ch,3)-1];
 return {revMois,mensuel,postes,uniques,mois,total:uniques+mensuel*mois,max,ratio,moy,loyer,elec}}
const m0=n=>Math.round(n).toLocaleString("fr-CA")+" $";
function comparerVilles(B,R){const ch=Math.min(+B.ch,3);
 return `<h3 class="sous">Comparer les villes</h3><p class="hint">Pour ${ch===3?"3 chambres et plus":ch+" chambre"+(ch>1?"s":"")}. Loyer moyen SCHL (octobre 2025) et laissez-passer 2026.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>Loyer moyen</th><th>Transport</th>${R.revMois?"<th>30 %</th>":""}</tr></thead><tbody>
${Object.keys(LOYERS).map(v=>{const m=LOYERS[v][ch-1],t=TRANSIT[v],ok=R.revMois&&m+R.elec<=R.revMois*0.30;
 return `<tr${v===B.ville?' class="ici"':""}><td>${esc(v)}</td><td class="num">${m?m0(m):"—"}</td><td class="num">${t?String(t.p).replace(".",",")+" $":"—"}</td>${R.revMois?`<td>${m?(ok?'<span class="ok">Oui</span>':'<span class="non">Non</span>'):"—"}</td>`:""}</tr>`}).join("")}
</tbody></table>${R.revMois?`<p class="hint">« Oui » : le loyer moyen et ton électricité restent sous 30 % de ton revenu.</p>`:""}`}
function resultatBudget(B){const R=calculerBudget(B);if(!R.mensuel)return `<p class="hint">Entre le loyer visé pour voir ton budget.</p>`;
 const c=!R.revMois?"g":R.ratio<=0.30?"g":R.ratio<=0.40?"y":"r";
 return `<div class="tuiles"><div class="tuile fort"><span>Total pour ${R.mois} mois</span><b class="num">${m0(R.total)}</b></div>
<div class="tuile"><span>Par mois</span><b class="num">${m0(R.mensuel)}</b></div><div class="tuile"><span>Frais uniques</span><b class="num">${m0(R.uniques)}</b></div></div>
<p class="hint">Total : déménagement et meubles, plus ${R.mois} mois de dépenses. Le premier mois de loyer y est compris. Ne le paie qu'au moment de signer le bail, après avoir confirmé que tu parles au vrai propriétaire, et par un moyen qui laisse une trace (chèque ou virement, avec un reçu). Il ne peut rien exiger d'autre d'avance : aucun dépôt (${lienExt(L_1904,"art. 1904 C.c.Q.")}).</p>
${R.revMois?`<div class="verdict ${c}"><strong>Loyer maximum conseillé : <span class="num">${m0(R.max)}</span></strong><span>30 % de ton revenu avant impôt, moins l'électricité (${lienExt(L_SCHL30,"règle de la SCHL")}). Ton loyer visé et l'électricité font ${Math.round(R.ratio*100)} % de ton revenu${c==="g"?" : c'est dans la norme.":c==="y"?" : le budget sera serré.":" : cherche moins cher ou une colocation."}</span></div>`:`<p class="hint">Ajoute ton revenu pour connaître le loyer maximum conseillé.</p>`}
<h3 class="sous">Où va ton argent chaque mois</h3>
<div class="barres">${R.postes.sort((a,b)=>b.v-a.v).map(p=>`<div class="barre"><span>${p.n}</span><span class="num">${m0(p.v)}</span><i style="width:${Math.max(2,Math.round(p.v/R.mensuel*100))}%"></i></div>`).join("")}</div>
${R.moy?`<p class="hint">Loyer moyen à ${esc(B.ville)} : <b class="num">${m0(R.moy)}</b> (SCHL, Enquête sur les logements locatifs, octobre 2025).</p>`:""}
${R.revMois?`<button class="btn" id="b-annonces">Chercher des logements jusqu'à ${m0(R.max)}</button>`:`<button class="btn" id="b-annonces">Chercher des logements à ${esc(B.ville)}</button>`}
${comparerVilles(B,R)}`}
function vueBudget(F,back){const B=budgetDefaut(F);const t=TRANSIT[B.ville];
 const champ=(k,l,ph,aide)=>`<label>${l}<input id="b-${k}" data-b="${k}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${esc(B[k]||"")}">${aide?`<span class="hint">${aide}</span>`:""}</label>`;
 const choix=(k,l,vals)=>`<label>${l}<select id="b-${k}" data-b="${k}">${vals.map(([v,t])=>`<option value="${v}" ${String(B[k])===String(v)?"selected":""}>${t}</option>`).join("")}</select></label>`;
 const n=a=>[...Array(a[1]-a[0]+1)].map((_,i)=>[i+a[0],String(i+a[0])]);
 return `${top(back,"Budget")}
<h2>Mon budget d'installation 2026</h2>
<p class="soft">Combien prévoir pour t'installer et combien tu peux payer de loyer. Chaque montant par défaut a sa source, et tu peux le changer.</p>
<div class="card"><h2>Ta situation</h2>
<div class="grid2">${choix("ville","Ville",Object.keys(LOYERS).map(v=>[v,v]))}${choix("ch","Chambres",[["1","1"],["2","2"],["3","3 et plus"]])}</div>
<div class="grid2">${choix("adultes","Adultes",n([1,4]))}${choix("enfants","Enfants",n([0,5]))}</div>
${+B.enfants?choix("garderie","Enfants en garderie (0 à 5 ans)",n([0,+B.enfants])):""}
<div class="grid2">${champ("revenu","Revenu du ménage avant impôt","45 000")}${choix("unite","Par",[["an","année"],["mois","mois"]])}</div>
${champ("loyer","Loyer visé par mois","1 200","Par défaut : loyer moyen SCHL de la ville.")}
${choix("mois","Prévoir l'argent pour",[["1","1 mois"],["3","3 mois"],["6","6 mois"]])}
</div>
<div class="card" id="bres" aria-live="polite">${resultatBudget(B)}</div>
<div class="card"><h2>Chaque mois</h2>
${champ("elec","Électricité","80","Demande au propriétaire le montant des factures d'Hydro-Québec de l'an dernier, ou si le chauffage est inclus.")}
${champ("epicerie","Épicerie","366",`Estimation : ${lienExt(EPICERIE.u,EPICERIE.s)} = 366 $ par personne.`)}
${champ("transport","Transport",t?String(t.p):"0",t?`Un laissez-passer par adulte : ${lienExt(t.u,t.s)}. Mets ton coût d'auto si tu conduis.`:"Mets ton laissez-passer ou ton coût d'auto.")}
${champ("internet","Internet et cellulaire","90","Selon tes forfaits.")}
${+B.garderie?champ("garde","Garde d'enfants","0",`Par défaut : ${lienExt(GARDE.u,GARDE.s)}, × ${GARDE.jours} jours par mois. En garderie non subventionnée, mets ton tarif.`):""}
${champ("assurance","Assurance locataire","31",`Par défaut : ${lienExt(ASSURANCE.u,ASSURANCE.s)}.`)}
${champ("abonnements","Abonnements (télé, musique, gym…)","0")}
</div>
<div class="card"><h2>Une seule fois</h2>
${champ("demenagement","Déménagement","500","Camion, déménageurs, billets ou essence.")}
${champ("meubles","Meubles et articles de base","800","Lit, électroménagers s'ils ne sont pas fournis, vaisselle, vêtements d'hiver.")}
</div>
<button class="btn ghost" data-go="verifier" id="nouv">Vérifier une annonce que j'ai trouvée</button>`}
function lierBudget(F){const B=F.B;
 const lierBoutonAnnonces=()=>{const b=$("#b-annonces");if(b)b.onclick=()=>{const R=calculerBudget(B);nouveauF({filtre:{ville:B.ville,ch:B.ch,max:R.max||""},B});go("trouver")}};
 const maj=()=>{const r=$("#bres"),h=resultatBudget(B);if(r&&r.dataset.h!==h){r.dataset.h=h;r.innerHTML=h;lierBoutonAnnonces()}};
 app.querySelectorAll("[data-b]").forEach(el=>{el[el.tagName==="SELECT"?"onchange":"oninput"]=()=>{const k=el.dataset.b,ancien=B[k];B[k]=el.value;
  if(el.tagName==="SELECT"&&ancien!==el.value){
   if(k==="ville"){B.transport=null;B.loyer=null}
   if(k==="ch")B.loyer=null;
   if(k==="adultes"||k==="enfants")B.epicerie=null;if(k==="adultes")B.transport=null;
   if(k==="enfants"||k==="garderie"){if(+B.garderie>+B.enfants)B.garderie=B.enfants;B.garde=null}
   budgetDefaut(F);return go("budget")}
  maj()}});
 lierBoutonAnnonces()}

/* ---------- 3. Trouver : annonces trouvées sur le web, pré-triées par l'app ---------- */
// Sites où l'app cherche. « courtier » : annonce publiée par un courtier immobilier, encadré par l'OACIQ.
const SOURCES=[{d:"kijiji.ca",n:"Kijiji"},{d:"centris.ca",n:"Centris",courtier:true},{d:"realtor.ca",n:"REALTOR.ca",courtier:true},
 {d:"duproprio.com",n:"DuProprio"},{d:"rentals.ca",n:"Rentals.ca"},{d:"louer.ca",n:"Louer.ca"},{d:"kangalou.com",n:"Kangalou"},
 {d:"logisquebec.com",n:"LogisQuébec"},{d:"padmapper.com",n:"PadMapper"},{d:"lespac.com",n:"LesPAC"},{d:"zumper.com",n:"Zumper"},{d:"craigslist.org",n:"Craigslist"}];
const L_OACIQ="https://www.oaciq.com";
const source=u=>{try{const h=new URL(u).hostname.replace(/^(www|m|fr|en)\./,"");return SOURCES.find(s=>h===s.d||h.endsWith("."+s.d))}catch(e){return null}};
const estAnnonce=u=>{try{const x=new URL(u),p=x.pathname;if(/\/b-|\/search|\/recherche/i.test(p))return false;return /\/v-/.test(p)||/\d{5,}/.test(p)}catch(e){return false}};
function lirePrix(t){const m=String(t).replace(/ | /g," ").match(/(?:\$\s?(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?)|(?:(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?\s?\$)/);
 if(!m)return null;const n=parseInt((m[1]||m[2]).replace(/[ ,]/g,""),10);return n>=300&&n<=8000?n:null}
function lireChambres(t){t=sansAccents(t);let m=t.match(/(\d)\s*(?:chambres?|ch\b|cac|bedrooms?|bdr|br\b)/);if(m)return Math.min(+m[1],3);
 m=t.match(/\b([3-7])\s*(?:1\/2|½|\.5|,5|et demi)/);if(m)return Math.max(1,Math.min(+m[1]-2,3));if(/studio|1 1\/2|2 1\/2/.test(t))return 1;return null}
const ALERTES_EXTRAIT=[[/western union|moneygram|carte[s]? cadeau|gift card|bitcoin|crypto/,"Paiement typique des fraudes mentionné"],
 [/(?<!aucun |pas de |sans |no |zero )(depot|deposit)/,"Un dépôt est mentionné : il est interdit (art. 1904 C.c.Q.)"],[/whatsapp|telegram/,"Contact par WhatsApp ou Telegram demandé"],
 [/a l'etranger|hors du pays|out of (the )?country|je suis (en|au) (mission|voyage)/,"Propriétaire « à l'étranger »"]];
function trierResultats(res,f){const l=LOYERS[f.ville];const vus=new Set();const sortie=[];
 for(const r of res){const s=source(r.url);if(!s||!estAnnonce(r.url))continue;const cle=r.url.split(/[?#]/)[0];if(vus.has(cle))continue;vus.add(cle);
  const txt=`${r.titre||""} ${r.extrait||""}`;const prix=lirePrix(txt),ch=lireChambres(txt);
  if(f.max&&prix&&prix>f.max)continue;
  if(f.ch&&ch&&(f.ch==="3"?ch<3:ch!=+f.ch))continue;
  const moy=l&&l[Math.min(ch||+f.ch||1,3)-1];const t=sansAccents(txt);
  const alertes=ALERTES_EXTRAIT.filter(([re])=>re.test(t)).map(a=>a[1]);
  if(prix&&moy&&prix<moy*0.6)alertes.push(`Prix très bas pour la ville (moyenne SCHL ${m0(moy)}) : vérifie-la avant tout contact`);
  sortie.push({...r,url:cle,source:s,prix,ch,moy,alertes})}
 return sortie.sort((a,b)=>(a.alertes.length-b.alertes.length)||((b.source.courtier?1:0)-(a.source.courtier?1:0))||((a.prix||99999)-(b.prix||99999)))}
function carteResultat(r,i){
 return `<article class="annonce"><div class="ann-corps">
${r.exemple?`<p class="tag-demo">Exemple (démo)</p>`:""}
<p class="hint">${esc(r.source.n)}${r.age?` · ${esc(r.age)}`:""}</p>
<h3>${r.prix?`<span class="num">${m0(r.prix)}</span> / mois`:"Prix non lu"}${r.ch?` · ${r.ch>=3?"3 ch. et plus":r.ch+" ch."}`:""}</h3>
<p>${esc(r.titre||"")}</p>
<ul class="reasons">
${r.alertes.length?r.alertes.map(a=>`<li><span class="dot y"></span><div>${esc(a)}</div></li>`).join(""):`<li><span class="dot g"></span><div>Aucun signal dans le texte de l'annonce.</div></li>`}
${r.source.courtier?`<li><span class="dot g"></span><div>Publiée par un courtier immobilier, encadré par l'${lienExt(L_OACIQ,"OACIQ")}.</div></li>`:""}
${r.prix&&r.moy?`<li><span class="dot i"></span><div>Loyer moyen SCHL ici : ${m0(r.moy)}.</div></li>`:""}</ul>
${r.exemple?`<button class="btn" data-verif="${i}">Vérifier</button>`:`<div class="grid2"><a class="btn ghost lienbouton" href="${esc(r.url)}" target="_blank" rel="noopener">Ouvrir</a><button class="btn" data-verif="${i}">Vérifier</button></div>`}
</div></article>`}
function liensSites(f){const ch=f.ch==="3"?"3 chambres":f.ch?f.ch+" chambres":"";const q=`logement à louer ${ch} ${f.ville}`.replace(/\s+/g," ");
 const g=site=>`https://www.google.com/search?q=${encodeURIComponent(q+" site:"+site)}&tbs=qdr:w`;
 return `<div class="card"><h2>Chercher aussi directement</h2><p class="hint">Recherches des 7 derniers jours sur chaque site. Trouve une annonce, puis reviens la vérifier.</p>
<div class="choix-accueil">
<a class="btn ghost lienbouton" href="https://www.facebook.com/marketplace/category/propertyrentals" target="_blank" rel="noopener">Facebook Marketplace<small>Choisis ${esc(f.ville)} et ton prix dans les filtres</small></a>
${[["kijiji.ca","Kijiji"],["centris.ca","Centris (courtiers)"],["kangalou.com","Kangalou"],["louer.ca","Louer.ca"],["duproprio.com","DuProprio"]].map(([d,n])=>`<a class="btn ghost lienbouton" href="${g(d)}" target="_blank" rel="noopener">${n}</a>`).join("")}
</div></div>`}
function vueTrouver(F,back){const f=F.filtre||(F.filtre={ville:villeDefaut(),ch:"",max:""});
 return `${top(back,"Trouver")}
<h2>Trouver un logement</h2>
<p class="soft">L'app cherche les annonces récentes sur Kijiji, Centris, Kangalou et d'autres sites, retire celles hors budget et signale ce qui cloche.</p>
<form class="card" id="f-tr" novalidate>
<div class="grid2"><label>Ville<select id="t-ville">${Object.keys(LOYERS).map(v=>`<option ${f.ville===v?"selected":""}>${v}</option>`).join("")}</select></label>
<label>Chambres<select id="t-ch"><option value="">Toutes</option>${["1","2","3"].map(v=>`<option value="${v}" ${f.ch===v?"selected":""}>${v==="3"?"3 et plus":v}</option>`).join("")}</select></label></div>
<label>Budget maximum par mois<input id="t-max" inputmode="numeric" placeholder="1 400" value="${f.max?esc(f.max):""}"></label>
${!F.B?`<p class="hint">Tu ne sais pas combien tu peux payer ? <button type="button" class="lienbtn" data-go="budget">Calcule ton budget</button></p>`:""}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Chercher</button></form>
<div id="liste" aria-live="polite">${F.resultats?"":""}</div>
<div id="sites"></div>`}
function lierTrouver(F){const f=F.filtre;
 const afficher=()=>{const el=$("#liste");if(!el)return;const R=F.resultats||[];
  el.innerHTML=(F.noteRecherche?`<p class="demo">${F.noteRecherche}</p>`:"")+(R.length?`<p class="hint">${R.length} annonce${R.length>1?"s":""} trouvée${R.length>1?"s":""}. Le tri lit seulement le titre et l'extrait : ouvre l'annonce, puis touche « Vérifier ».</p>`+R.map(carteResultat).join("")
   :`<div class="card"><p>Aucune annonce trouvée pour ces critères.</p><p class="hint">Augmente le budget ou change le nombre de chambres, ou cherche directement sur les sites ci-dessous.</p></div>`)
;
  el.querySelectorAll("[data-verif]").forEach(b=>b.onclick=()=>{const r=R[+b.dataset.verif];
   nouveauF({lien:r.url,ville:f.ville,ch:String(r.ch||f.ch||"2"),prix:r.prix?String(r.prix):"",annonce:`${r.titre||""}\n${r.extrait||""}`,lu:`<b>Repris de la recherche :</b> ${esc(r.source.n)}${r.prix?`, ${m0(r.prix)}`:""}. Ajoute des captures de l'annonce complète et de la conversation pour une vérification complète.`});go("verifier")});
  $("#sites").innerHTML=liensSites(f)};
 const chercher=async()=>{f.ville=$("#t-ville").value;f.ch=$("#t-ch").value;f.max=nombre($("#t-max").value)||"";
  if(!f.max)return err("Entre ton budget maximum.");err("");
  const b=$("#go");b.disabled=true;b.textContent="Recherche…";$("#liste").innerHTML=`<p class="hint">Recherche des annonces récentes…</p>`;
  try{const brut=await ANN.chercher(f);F.resultats=trierResultats(brut,f);F.noteRecherche=ANN.note||""}
  catch(x){F.resultats=[];F.noteRecherche="La recherche n'a pas fonctionné. Réessaie, ou cherche directement sur les sites ci-dessous."}
  if(!$("#f-tr"))return;b.disabled=false;b.textContent="Chercher";afficher()};
 $("#f-tr").onsubmit=e=>{e.preventDefault();chercher()};
 if(F.resultats)afficher();else if(f.max)chercher();else $("#sites").innerHTML=liensSites(f)}

/* ---------- Liaison ---------- */
function bindPlus(v){
 if(v==="proprio")lierProprio(F);
 if(v==="budget")lierBudget(F);
 if(v==="trouver")lierTrouver(F);
}
const CSS_PLUS=`.lienbtn{background:none;border:0;padding:0;font:inherit;color:var(--blue);font-weight:600;text-decoration:underline;cursor:pointer;min-height:32px}
.annonce{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.annonce img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.ann-corps{padding:16px;display:flex;flex-direction:column;gap:6px}.ann-corps h3{margin:0;font-size:20px}
.ann-corps summary{color:var(--blue);font-weight:700;min-height:44px;display:flex;align-items:center;cursor:pointer}
.badge-ok{color:var(--ok);background:var(--okbg);border-radius:999px;padding:4px 10px;font-weight:700;font-size:14px;align-self:flex-start}
.tag-demo{font-size:12px;color:var(--soft);border:1px dashed var(--line);border-radius:999px;padding:2px 8px;align-self:flex-start}
#liste{display:flex;flex-direction:column;gap:14px}
.lienbouton{display:grid;place-items:center;text-decoration:none;text-align:center;padding:8px 16px}
.choix-accueil{display:grid;gap:10px}
.tuiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tuile{background:var(--bg);border:1px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:2px}
.tuile span{font-size:13px;color:var(--soft);font-weight:600}.tuile b{font-size:20px}.tuile.fort{grid-column:1/-1;background:var(--okbg);border-color:transparent}.tuile.fort b{font-size:28px;color:var(--ok)}
.sous{margin:4px 0 0;font-size:17px}.barres{display:flex;flex-direction:column;gap:10px}
.barre{display:grid;grid-template-columns:1fr auto;gap:4px 8px;font-size:15px}.barre i{grid-column:1/-1;height:8px;border-radius:99px;background:var(--blue);display:block}
.tvilles{width:100%;border-collapse:collapse;font-size:14px}.tvilles th{text-align:left;color:var(--soft);font-weight:600;padding:6px 4px;border-bottom:1px solid var(--line)}
.tvilles td{padding:8px 4px;border-bottom:1px solid var(--line)}.tvilles tr.ici td{font-weight:700}.tvilles .ok{color:var(--ok);font-weight:700}.tvilles .non{color:var(--red);font-weight:700}
.btn small{display:block;font-weight:500;font-size:14px;opacity:.85}`;
/* Adaptateur adresse (Supabase : fonction info-adresse, qui appelle les services publics) */
const INFO={async adresse(a){const {data,error}=await sb.functions.invoke("info-adresse",{body:{adresse:a}});if(error||!data||data.error)return trouverLotDirect(a);return data}};

/* Adaptateur recherche (Supabase : fonction chercher-annonces → Brave Search API) */
const ANN={note:"",
 async chercher(f){const {data,error}=await sb.functions.invoke("chercher-annonces",{body:{ville:f.ville,ch:f.ch,max:f.max}});
  if(error)throw error;return (data&&data.resultats)||[]}};
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS+"</style>");
/* ===== HabitaScan : confidentialité, suppression du compte, espace admin (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, err, LOYERS, TRANSIT, ASSURANCE, EPICERIE, GARDE, m0, nouveauF
   et d'un adaptateur ADM propre à chaque version :
   ADM.estAdmin() → bool ; ADM.stats() ; ADM.identites() ; ADM.photos(id) → [url] ; ADM.decider(id, statut)
   ADM.signalements() ; ADM.retirerSignalements(lien) ; ADM.sauverParametre(cle, valeur) ; ADM.sauverLoyer(ville, ch, loyer)
   ADM.supprimerCompte() ; ADM.demo (bool) */

/* ---------- Politique de confidentialité ---------- */
// Coordonnées à remplir avant la mise en ligne (Loi 25 : titre et coordonnées de la personne responsable).
const RESPONSABLE={nom:"[Prénom Nom]",titre:"[titre]",entreprise:"[nom de l'entreprise]",courriel:"[confidentialite@exemple.ca]",adresse:"[adresse postale]",vigueur:"[date de mise en ligne]"};
const L_LOI="https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1";
const L_CAI="https://www.cai.gouv.qc.ca";
function vueConfidentialite(back){const R=RESPONSABLE;
 const t=(rows,h)=>`<table class="tvilles"><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
 return `${top(back,"Confidentialité")}
<h2>Politique de confidentialité</h2>
<p class="hint">En vigueur le ${R.vigueur}.</p>
<div class="card"><h2>En bref</h2>
<ul class="liste"><li>Nous recueillons le minimum : ton courriel ou ton numéro pour te connecter, et le résumé de tes vérifications pour ton historique.</li>
<li>Le texte des annonces, tes conversations et tes captures d'écran sont lus <b>sur ton téléphone</b>. Nous ne les conservons pas.</li>
<li>Aucune vente de renseignements, aucune publicité, aucun profilage ni suivi publicitaire.</li>
<li>Tu peux consulter, corriger ou supprimer tes renseignements en tout temps.</li></ul>
<p class="hint">Cette politique respecte la ${lienExt(L_LOI,"Loi sur la protection des renseignements personnels dans le secteur privé")}, modifiée par la Loi 25. L'app s'adresse aux personnes de 14 ans et plus.</p></div>
<div class="card"><h2>Personne responsable</h2><p>${R.nom}, ${R.titre}, ${R.entreprise}<br>Courriel : ${R.courriel}<br>${R.adresse}</p>
<p class="hint">Écris-lui pour toute question, demande d'accès, de correction ou de suppression, ou pour porter plainte.</p></div>
<div class="card"><h2>Ce que nous recueillons</h2>${t([
 ["Courriel ou cellulaire","Te connecter avec un code, retrouver ton compte, compter les utilisateurs"],
 ["Résumé de tes vérifications : ville, chambres, loyer, lien, résultat ; travaux et licence RBQ","Ton historique. Pour un même lien, les autres voient seulement un nombre"],
 ["Signalement : lien et motif","Avertir les autres. Ils voient seulement un nombre"],
 ["Photo de pièce d'identité, seulement pour signaler","Éviter les fausses accusations. Supprimée après la vérification"],
 ["Ville, chambres et budget de « Trouver »","Chercher des annonces. Non conservés"]],["Renseignement","Pourquoi"])}
<p class="hint"><b>Restent sur ton téléphone :</b> le texte des annonces et des conversations, tes captures (sauf si la recherche des photos est activée : envoyée à Google Cloud Vision puis oubliée), la photo du compte de taxes, ton budget et ton revenu.</p>
<p class="hint"><b>Résultat automatique :</b> le verdict est calculé à partir de règles publiques. Il porte sur l'annonce, pas sur toi. Tu peux demander quelles règles ont mené à un résultat.</p></div>
<div class="card"><h2>Fournisseurs, dont hors du Québec</h2>${t([
 ["Supabase (base de données, connexion)","Données à Montréal (AWS Canada Centre) ; entreprise américaine"],
 ["Vercel (pages de l'app)","États-Unis : adresse IP"],
 ["jsDelivr (bibliothèques de l'app)","Réseau mondial : adresse IP"],
 ["Brave Search (« Trouver »)","États-Unis : mots de la recherche, sans ton nom"],
 ["Google Cloud Vision, si activé","États-Unis : capture envoyée pour la recherche"]],["Fournisseur","Où et quoi"])}
<p class="hint">Avant de confier des renseignements hors du Québec, nous évaluons s'ils seront protégés adéquatement (art. 17 de la loi). Nous ne communiquons rien d'autre sans ton consentement, sauf dans les cas prévus par la loi.</p></div>
<div class="card"><h2>Conservation et sécurité</h2>
<ul class="liste"><li>Compte et historique : jusqu'à la suppression du compte, ou [24] mois sans connexion.</li>
<li>Pièce d'identité : supprimée dès la vérification, au plus tard [30] jours après l'envoi.</li>
<li>Signalements : [12] mois.</li>
<li>Échanges chiffrés (HTTPS) ; chaque utilisateur ne lit que ses propres renseignements.</li>
<li>En cas d'incident présentant un risque de préjudice sérieux, nous avisons la Commission d'accès à l'information et les personnes touchées.</li></ul></div>
<div class="card"><h2>Tes droits</h2>
<p>Accès et copie de tes renseignements, correction, suppression, retrait du consentement. Réponse dans les 30 jours, gratuitement.</p>
<p class="hint">Tu peux supprimer ton compte toi-même depuis l'accueil. En cas de désaccord, tu peux t'adresser à la ${lienExt(L_CAI,"Commission d'accès à l'information")}.</p></div>`}
const lienConfidentialite=`<button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>`;

/* ---------- Suppression du compte ---------- */
const vueSupprimer=()=>`${top("accueil","Supprimer mon compte")}
<h2>Supprimer mon compte</h2>
<div class="card"><p>Ton compte, ton historique, tes signalements et, s'il y en a, les photos de ta pièce d'identité seront supprimés. C'est définitif.</p>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="sup-ok" style="width:22px;min-height:22px;margin-top:2px">Je comprends que la suppression est définitive.</label>
<p class="err" id="e" hidden></p>
<button class="btn danger" id="go">Supprimer définitivement</button></div>`;
function lierSupprimer(){$("#go").onclick=async()=>{if(!$("#sup-ok").checked)return err("Coche la case pour confirmer.");
 const b=$("#go");b.disabled=true;b.textContent="Suppression…";
 try{await ADM.supprimerCompte();nouveauF({});go("bienvenue")}catch(x){b.disabled=false;b.textContent="Réessayer";err("La suppression n'a pas fonctionné. Réessaie, ou écris à la personne responsable.")}}}

/* ---------- Espace admin ---------- */
const PARAMS=[ // clé en base → où l'app l'utilise
 {cle:"transit_montreal",n:"Laissez-passer Montréal",get:()=>TRANSIT["Montréal"].p,set:v=>TRANSIT["Montréal"].p=v},
 {cle:"transit_quebec",n:"Laissez-passer Québec / Lévis",get:()=>TRANSIT["Québec"].p,set:v=>{TRANSIT["Québec"].p=v;TRANSIT["Lévis"].p=v}},
 {cle:"transit_gatineau",n:"Laissez-passer Gatineau",get:()=>TRANSIT["Gatineau"].p,set:v=>TRANSIT["Gatineau"].p=v},
 {cle:"assurance",n:"Assurance locataire par mois",get:()=>ASSURANCE.p,set:v=>ASSURANCE.p=v},
 {cle:"epicerie",n:"Épicerie par personne par mois",get:()=>EPICERIE.p,set:v=>EPICERIE.p=v},
 {cle:"garde_jour",n:"Garderie subventionnée par jour",get:()=>GARDE.jour,set:v=>GARDE.jour=v}];
function appliquerParametres(rows){(rows||[]).forEach(r=>{const p=PARAMS.find(x=>x.cle===r.cle);const v=+r.valeur;if(p&&v>0)p.set(v)})}
const nb=v=>Number(v||0).toLocaleString("fr-CA");
function vueAdmin(){const onglet=F.onglet||"chiffres";
 const o=(k,t)=>`<button type="button" data-onglet="${k}" aria-pressed="${onglet===k}">${t}</button>`;
 return `${top("accueil","Admin")}
<h2>Espace admin</h2>${ADM.demo?`<p class="demo">Démo : données fictives, rien n'est envoyé.</p>`:""}
<div class="seg seg4" role="group" aria-label="Section">${o("chiffres","Chiffres")}${o("identites","Identités")}${o("signalements","Signalements")}${o("montants","Montants")}</div>
<div id="adm" aria-live="polite"><p class="hint">Chargement…</p></div>`}
async function lierAdmin(){const onglet=F.onglet||"chiffres";
 app.querySelectorAll("[data-onglet]").forEach(b=>b.onclick=()=>{F.onglet=b.dataset.onglet;go("admin")});
 const el=()=>$("#adm");const echec=()=>{if(el())el().innerHTML=`<p class="err">Chargement impossible. Vérifie que ton compte est admin.</p>`};
 try{
 if(onglet==="chiffres"){const s=await ADM.stats();if(!el())return;
  const tuile=(t,v,fort)=>`<div class="tuile${fort?" fort":""}"><span>${t}</span><b class="num">${nb(v)}</b></div>`;
  el().innerHTML=`<div class="tuiles">${tuile("Utilisateurs",s.utilisateurs,true)}${tuile("Nouveaux, 7 jours",s.nouveaux_7j)}${tuile("Vérifications, 7 jours",s.verifications_7j)}
${tuile("Vérifications au total",s.verifications)}${tuile("Résultats « Ne paie pas »",s.rouges)}${tuile("Signalements",s.signalements)}${tuile("Identités à vérifier",s.identites_attente)}</div>`}
 if(onglet==="identites"){const L=await ADM.identites();if(!el())return;
  el().innerHTML=L.length?L.map(p=>`<div class="card" data-id="${esc(p.id)}"><p><b>${esc(p.contact||"(sans contact)")}</b></p><p class="hint">Envoyée le ${esc(String(p.soumise_le||"").slice(0,10))}${p.doc_type?` · ${esc(p.doc_type)}`:""}</p>
<div class="vignettes photos"><button type="button" class="btn ghost" data-voir="${esc(p.id)}">Voir les photos</button></div>
<div class="grid2"><button class="btn" data-decider="${esc(p.id)}" data-statut="confirmee">Confirmer</button><button class="btn ghost" data-decider="${esc(p.id)}" data-statut="refusee">Refuser</button></div>
<p class="hint">La décision supprime les photos.</p></div>`).join(""):`<div class="card"><p>Aucune pièce d'identité à vérifier.</p></div>`;
  el().querySelectorAll("[data-voir]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const urls=await ADM.photos(b.dataset.voir);b.parentNode.innerHTML=urls.length?urls.map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Pièce d'identité"></a>`).join(""):`<p class="hint">Aucune photo trouvée.</p>`}catch(x){b.disabled=false;b.textContent="Réessayer"}});
  el().querySelectorAll("[data-decider]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await ADM.decider(b.dataset.decider,b.dataset.statut);go("admin")}catch(x){b.disabled=false;b.textContent="Réessayer"}})}
 if(onglet==="signalements"){const L=await ADM.signalements();if(!el())return;
  el().innerHTML=L.length?L.map(s=>`<div class="card"><p><a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.lien)}</a></p>
<p><b>${nb(s.nb)} signalement${s.nb>1?"s":""}</b>${s.dernier?` · dernier le ${esc(String(s.dernier).slice(0,10))}`:""}</p><p class="hint">${esc((s.motifs||[]).join(", "))}</p>
<button class="btn ghost" data-retirer="${esc(s.lien)}">Retirer ces signalements (annonce honnête)</button></div>`).join(""):`<div class="card"><p>Aucun signalement.</p></div>`;
  el().querySelectorAll("[data-retirer]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{await ADM.retirerSignalements(b.dataset.retirer);go("admin")}catch(x){b.disabled=false;b.textContent="Réessayer"}})}
 if(onglet==="montants"){if(!el())return;const villes=Object.keys(LOYERS);
  el().innerHTML=`<div class="card"><h2>Budget</h2><p class="hint">Change un montant quand le tarif change (chaque année). Indique la source dans tes notes.</p>
${PARAMS.map(p=>`<label>${p.n}<span class="ligne"><input data-param="${p.cle}" inputmode="decimal" value="${String(p.get()).replace(".",",")}"><button type="button" class="btn ghost petit" data-sauver="${p.cle}">Enregistrer</button></span></label>`).join("")}</div>
<div class="card"><h2>Loyers moyens SCHL</h2><p class="hint">À mettre à jour chaque année avec l'Enquête sur les logements locatifs.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>1 ch.</th><th>2 ch.</th><th>3 ch.+</th></tr></thead><tbody>
${villes.map(v=>`<tr><td>${esc(v)}</td>${[0,1,2].map(i=>`<td><input class="mini" data-loyer="${esc(v)}" data-ch="${i+1}" inputmode="numeric" value="${LOYERS[v][i]||""}"></td>`).join("")}</tr>`).join("")}</tbody></table>
<p class="hint" id="adm-msg" role="status"></p></div>`;
  const msg=t=>{const m=$("#adm-msg");if(m)m.textContent=t};
  el().querySelectorAll("[data-sauver]").forEach(b=>b.onclick=async()=>{const k=b.dataset.sauver,inp=el().querySelector(`[data-param="${k}"]`),v=parseFloat(inp.value.replace(",","."));
   if(!(v>0))return msg("Montant invalide.");b.disabled=true;try{await ADM.sauverParametre(k,v);PARAMS.find(p=>p.cle===k).set(v);b.textContent="Enregistré"}catch(x){b.textContent="Erreur"}b.disabled=false});
  el().querySelectorAll("[data-loyer]").forEach(inp=>inp.onchange=async()=>{const v=parseInt(inp.value.replace(/\D/g,""),10);if(!(v>=200&&v<=10000))return msg("Loyer invalide.");
   try{await ADM.sauverLoyer(inp.dataset.loyer,+inp.dataset.ch,v);LOYERS[inp.dataset.loyer][+inp.dataset.ch-1]=v;msg(`${inp.dataset.loyer}, ${inp.dataset.ch} ch. : ${m0(v)} enregistré.`)}catch(x){msg("Erreur d'enregistrement.")}})}
 }catch(x){echec()}}

function bindPlus3(v){
 if(v==="supprimer")lierSupprimer();
 if(v==="admin")lierAdmin();
}
const CSS_PLUS3=`.btn.danger{background:var(--red)}.liste{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}
.seg4{grid-template-columns:repeat(4,1fr)}.seg4 button{font-size:13px;padding:0 2px}
.photos{display:flex;gap:8px;flex-wrap:wrap}.photos img{width:140px;border-radius:10px;border:1px solid var(--line)}
.ligne{display:grid;grid-template-columns:1fr auto;gap:8px}.btn.petit{font-size:14px;min-height:48px;width:auto}
input.mini{min-height:40px;padding:6px 8px;font-size:15px}#adm{display:flex;flex-direction:column;gap:14px}
.pied{display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:center}`;

/* Adaptateur admin (Supabase : fonctions admin_*, tables parametres et loyers_reference, compartiment pieces-identite) */
let EST_ADMIN=false;
const rpc=async(n,a)=>{const {data,error}=await sb.rpc(n,a);if(error)throw error;return data};
const photosDe=async id=>{const {data,error}=await sb.storage.from("pieces-identite").list(id,{limit:20});if(error)throw error;return (data||[]).map(f=>`${id}/${f.name}`)};
const ADM={demo:false,estAdmin:()=>EST_ADMIN,
 stats:()=>rpc("admin_stats"),identites:async()=>(await rpc("admin_identites"))||[],
 async photos(id){const p=await photosDe(id);if(!p.length)return [];const {data,error}=await sb.storage.from("pieces-identite").createSignedUrls(p,300);if(error)throw error;return data.map(d=>d.signedUrl).filter(Boolean)},
 async decider(id,statut){await rpc("admin_decider_identite",{p_id:id,p_statut:statut});const p=await photosDe(id);if(p.length){const {error}=await sb.storage.from("pieces-identite").remove(p);if(error)throw error}},
 signalements:async()=>(await rpc("admin_signalements"))||[],
 retirerSignalements:l=>rpc("admin_retirer_signalements",{p_lien:l}),
 async sauverParametre(cle,valeur){const {error}=await sb.from("parametres").upsert({cle,valeur,maj_le:new Date().toISOString()});if(error)throw error},
 async sauverLoyer(ville,chambres,loyer){const {data,error}=await sb.from("loyers_reference").update({loyer}).eq("ville",ville).eq("chambres",chambres).select("ville");if(error)throw error;
  if(!data||!data.length){const r=await sb.from("loyers_reference").insert({ville,chambres,loyer});if(r.error)throw r.error}},
 async supprimerCompte(){const {error}=await sb.functions.invoke("supprimer-compte",{body:{}});if(error)throw error;await sb.auth.signOut();PROFIL=null;HIST=[];SESSION=false;EST_ADMIN=false}};
async function chargerParametres(){try{const {data}=await sb.from("parametres").select("cle,valeur");appliquerParametres(data)}catch(e){}}
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS3+"</style>");
const V={
bienvenue:()=>`${top()}
<svg class="seal" role="img" aria-label="Bail avec sceau vérifié"><use href="#seal"/></svg>
<h1>Avant de payer, vérifie.</h1>
<p class="soft">Une annonce de logement ou la soumission d'un entrepreneur : l'app la vérifie en quelques secondes et te dit ce qui cloche, avec la loi qui s'applique.</p>
<button class="btn" data-go="inscription" id="commencer">Commencer</button>
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
<p class="hint pied">${lienConfidentialite.replace("politique de confidentialité","Politique de confidentialité")}</p>`,

inscription:()=>{const t=F.canal||"courriel";return `${top("bienvenue","Inscription")}
<h2>Crée ton compte ou connecte-toi</h2><p class="soft">Pas de mot de passe : tu reçois un code à 6 chiffres. Même chose pour te reconnecter sur un autre appareil.</p>
<form class="card" id="f-ins" novalidate>
<div class="seg" role="group" aria-label="Moyen de connexion">
<button type="button" data-canal="courriel" aria-pressed="${t==="courriel"}">Courriel</button>
<button type="button" data-canal="tel" aria-pressed="${t==="tel"}">Téléphone</button></div>
${t==="courriel"?`<label>Adresse courriel<input id="ident" type="email" inputmode="email" autocomplete="email" placeholder="nom@exemple.com" value="${esc(F.ident)}"></label>`
:`<label>Numéro de cellulaire<input id="ident" type="tel" inputmode="tel" autocomplete="tel" placeholder="514 555-0123" value="${esc(F.ident)}"></label>`}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Recevoir le code par ${t==="courriel"?"courriel":"SMS"}</button>
<p class="hint">Ton ${t==="courriel"?"courriel":"numéro"} sert seulement à te connecter. En continuant, tu acceptes la ${lienConfidentialite}.</p></form>`},

code:()=>`${top("inscription","Code")}
<h2>Entre le code reçu</h2><p class="soft">Envoyé à <b>${esc(F.affiche)}</b>. Vérifie aussi tes courriels indésirables.</p>
<form class="card" id="f-code" novalidate>
<div class="otp">${[0,1,2,3,4,5].map(i=>`<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i+1}" data-i="${i}" autocomplete="${i?"off":"one-time-code"}">`).join("")}</div>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Valider</button>
<button type="button" class="btn ghost" id="renvoi" disabled>Renvoyer le code (<span id="t">60</span> s)</button></form>`,

identite:()=>`${top("accueil","Identité")}
<h2>Confirme ton identité</h2><p class="soft">Une photo de ta pièce d'identité suffit. Pas de selfie.</p>
<form class="card" id="f-id" novalidate>
<label>Type de pièce<select id="doc">
<option value="permis">Permis de conduire</option><option value="passeport">Passeport</option><option value="rp">Carte de résident permanent</option></select></label>
<label class="drop">${F.rectoUrl?`<img src="${F.rectoUrl}" alt="Recto">Changer la photo`:"Prendre en photo le recto"}<input type="file" accept="image/*" capture="environment" data-side="recto"></label>
<label class="drop" ${F.doc==="passeport"?"hidden":""}>${F.versoUrl?`<img src="${F.versoUrl}" alt="Verso">Changer la photo`:"Prendre en photo le verso"}<input type="file" accept="image/*" capture="environment" data-side="verso"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="ok" style="width:22px;min-height:22px;margin-top:2px">J'accepte que la photo serve uniquement à confirmer mon identité, puis soit supprimée.</label>
<p class="hint">Détails dans la ${lienConfidentialite}.</p>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer pour vérification</button></form>
<p class="hint">Pourquoi ? Seuls les comptes à l'identité confirmée peuvent signaler une annonce : ça évite les fausses accusations. Vérifier une annonce ne la demande jamais.</p>
<p class="hint">Les photos sont envoyées dans un espace privé, au Canada. Seule l'équipe de vérification peut les voir ; elles sont supprimées après la vérification.</p>`,

analyse:()=>`${top(null,F.titre||"Vérification")}<div class="spin" role="status" aria-label="En cours"></div><p class="soft" style="text-align:center">${F.msg||"En cours…"}</p>`,

identiteOk:()=>`${top(null,"Identité")}
<svg class="seal" role="img" aria-label="Pièce reçue"><use href="#seal"/></svg>
<h1>Pièce reçue</h1><p class="soft">Ta pièce d'identité est en vérification. Tu pourras signaler des annonces dès qu'elle sera confirmée.</p>
<button class="btn" data-go="accueil">Continuer</button>`,

accueil:()=>`${top(null)}
${!ANONYME&&PROFIL?`<p class="badge" style="color:${PROFIL.identite_statut==="confirmee"?"var(--ok)":"var(--amber)"}">● ${STATUT[PROFIL.identite_statut]||"Connecté"} · ${esc(PROFIL.contact||"")}</p>`:""}
<h1>Que veux-tu faire ?</h1>
<div class="choix-accueil">
<button class="btn" data-go="trouver" id="nouvT">Trouver un logement<small>Selon ta ville, tes chambres et ton budget</small></button>
<button class="btn" data-go="verifier" id="nouv">Vérifier une annonce trouvée<small>Facebook, Kijiji et autres</small></button>
<button class="btn ghost" data-go="budget" id="nouvB">Calculer mon budget d'installation</button>
<button class="btn ghost" data-go="reno" id="nouvR">Vérifier un entrepreneur en rénovation</button>
</div>
${!ANONYME&&PROFIL&&["aucune","refusee"].includes(PROFIL.identite_statut)?`<button class="btn ghost" data-go="identite">Confirmer mon identité (pour signaler)</button>`:""}
<div class="card"><h2>Mes vérifications</h2>${HIST.length?`<div class="hist">${HIST.map(x=>x.module==="reno"?`<div><span>Réno · ${esc((TRAVAUX[x.travaux]||{l:""}).l.split(/ \(|,/)[0])}${x.licence?` · <span class="num">${esc(formatLicence(x.licence))}</span>`:""}</span><span class="tag ${x.couleur}">${{r:"Ne pas signer",y:"Prudence",g:"Aucun signal"}[x.couleur]}</span></div>`:`<div><span>${esc(x.ville)} · ${x.chambres===3?"3+":x.chambres} ch. · <span class="num">${money(x.prix)}</span></span><span class="tag ${x.couleur}">${{r:"Ne paie pas",y:"Visite d'abord",g:"Aucun signal"}[x.couleur]}</span></div>`).join("")}</div>`:`<p class="soft">Aucune vérification pour l'instant.</p>`}</div>
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
${ADM.estAdmin()?`<button class="btn ghost" data-go="admin" id="nouvA">Espace admin${ADM.demo?" (démo)":""}</button>`:""}
<button class="btn ghost" id="deco">Se déconnecter</button>
<p class="hint pied">${lienConfidentialite.replace("politique de confidentialité","Confidentialité")}<button type="button" class="lienbtn" data-go="supprimer">Supprimer mon compte</button></p>`,

verifier:()=>`${top("accueil","Vérifier")}
<h2>L'annonce</h2>
<form class="card" id="f-ver" novalidate>
<label class="drop drop-grand">${F.vignettes&&F.vignettes.length?`<span class="vignettes">${F.vignettes.map(u=>`<img src="${u}" alt="Capture">`).join("")}</span>Changer les captures`:`<b>Ajoute des captures d'écran</b><span>L'annonce et, si tu l'as, la conversation. L'app lit tout.</span>`}<input type="file" accept="image/*" multiple data-captures="1"></label>
${F.lu?`<p class="lu" role="status">${F.lu}</p>`:""}
<details class="coller" ${F.coller?"open":""}><summary>ou coller le texte</summary>
<label>Texte de l'annonce<textarea id="annonce" placeholder="Colle ici le texte de l'annonce">${esc(F.annonce||"")}</textarea></label>
<button type="button" class="btn ghost" id="lire">Lire le texte</button>
<label>Messages échangés<textarea id="txt" placeholder="Colle ici la conversation avec l'annonceur">${esc(F.txt||"")}</textarea></label>
</details>
<label>Lien de l'annonce (facultatif)<input id="lien" type="url" inputmode="url" autocomplete="off" placeholder="https://www.facebook.com/marketplace/item/…" value="${esc(F.lien)}"></label>
<label>Ville<select id="ville">${Object.keys(LOYERS).map(v=>`<option ${F.ville===v?"selected":""}>${esc(v)}</option>`).join("")}<option value="Autre" ${F.ville==="Autre"?"selected":""}>Autre ville</option></select></label>
<div class="grid2"><label>Chambres<select id="ch"><option value="1">1</option><option value="2">2</option><option value="3">3 et plus</option></select></label>
<label>Loyer demandé<input id="prix" inputmode="numeric" placeholder="1 300" value="${esc(F.prix)}"></label></div>
<label>Adresse (facultatif, reste sur ton téléphone)<input id="adr" autocomplete="off" placeholder="1234, rue Exemple" value="${esc(F.adr||"")}"></label>
${yn("argent","On te demande de l'argent avant la signature du bail ?")}
${yn("visite","As-tu pu visiter le logement en personne ?")}
${yn("cession","Est-ce une cession de bail ?")}
<div id="q-accord" ${F.cession!=="oui"?"hidden":""}>${yn("accord","Le propriétaire a-t-il accepté la cession par écrit ?")}</div>
${blocProfil(F)}
<p class="err" id="e" hidden></p>
<button class="btn">Vérifier</button></form>
<p class="hint">Le texte de l'annonce et la conversation restent sur ton téléphone. Seuls la ville, le nombre de chambres, le prix, le lien et le résultat sont gardés. Si la recherche d'images est activée, la capture est envoyée à Google Vision pour cette recherche, puis n'est pas conservée.</p>`,

resultat:()=>{const R=F.res;return `${top("accueil","Résultat")}
<div class="verdict ${R.c}"><strong>${{r:"Ne paie pas",y:"Visite d'abord, puis vérifie le propriétaire",g:"Aucun signal. Tu peux visiter."}[R.c]}</strong><span>${esc(F.ville)} · ${F.ch==="3"?"3 ch. et plus":F.ch+" ch."} · <span class="num">${money(F.prixN)}</span></span></div>
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map(i=>`<li><span class="dot ${i.c}"></span><div>${i.t}${i.law?`<div class="law">${i.law}</div>`:""}</div></li>`).join("")}</ul></div>
<p class="rule">${{r:"N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.",y:"Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.",g:"Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt."}[R.c]}</p>
<button class="btn ghost" data-go="proprio" id="b-proprio">Vérifier le propriétaire</button>
<p class="hint">Le nom n'est pas toujours sur le rôle en ligne. L'app te guide avec le compte de taxes et le Registre foncier.</p>
${boutonCarte(F)}
${boutonSignaler(F)}
<button class="btn" id="nouv">Vérifier une autre annonce</button>`},
signaler:()=>vueSignaler(F,"accueil"),
signalOk:()=>vueSignalOk(),
attente:()=>`${top("accueil","Signaler")}<h2>Ta pièce est en vérification</h2><p class="soft">Tu pourras signaler des annonces dès que ton identité sera confirmée. En attendant, préviens Facebook Marketplace ou Kijiji directement.</p><button class="btn" data-go="accueil">Retour à l'accueil</button>`,

proprio:()=>vueProprio(F,"resultat"),
budget:()=>vueBudget(F,"accueil"),
trouver:()=>vueTrouver(F,"accueil"),
confidentialite:()=>vueConfidentialite(SESSION?"accueil":"bienvenue"),
supprimer:()=>vueSupprimer(),
admin:()=>vueAdmin(),
reno:()=>vueReno(F,"accueil"),
renoResultat:()=>vueRenoResultat(F,"accueil"),

victime:()=>`${top(SESSION?"accueil":"bienvenue","Aide")}
<h2>Tu as été victime ?</h2>
<div class="card"><ul class="reasons">
<li><span class="dot i"></span><div><b>1. Appelle ta banque</b> tout de suite pour tenter de bloquer le virement.</div></li>
<li><span class="dot i"></span><div><b>2. Porte plainte à la police</b> de ta ville (poste de quartier, ou 911 en cas d'urgence).<div class="law">La fraude est un acte criminel : <a href="https://laws-lois.justice.gc.ca/fra/lois/c-46/section-380.html" target="_blank" rel="noopener">Code criminel, art. 380</a></div></div></li>
<li><span class="dot i"></span><div><b>3. Signale-le au Centre antifraude du Canada</b> : 1 888 495-8501.</div></li>
<li><span class="dot i"></span><div><b>4. Signale l'annonce</b> sur Facebook Marketplace ou Kijiji.</div></li></ul></div>
<p class="hint">Tes droits de locataire : <a href="https://www.tal.gouv.qc.ca" target="_blank" rel="noopener">Tribunal administratif du logement</a></p>
<p class="hint">Un problème avec un entrepreneur : <a href="https://www.opc.gouv.qc.ca" target="_blank" rel="noopener">Office de la protection du consommateur</a> et <a href="https://www.rbq.gouv.qc.ca/services-en-ligne/plainte-signalement-et-declaration/travail-sans-licence/" target="_blank" rel="noopener">RBQ, travail sans licence</a></p>`
};
function yn(k,q){return `<div class="q">${q}<div class="yn" role="group" aria-label="${esc(q)}"><button type="button" data-yn="${k}" data-v="oui" aria-pressed="${F[k]==="oui"}">Oui</button><button type="button" data-yn="${k}" data-v="non" aria-pressed="${F[k]==="non"}">Non</button></div></div>`}

const PUBLIQUES=["bienvenue","inscription","code","victime","erreur","confidentialite"];
function go(v){if(!SESSION&&!PUBLIQUES.includes(v)){if(F.partage)LS.set("vl_partage",{annonce:F.annonce,lien:F.lien});v="bienvenue"}app.innerHTML=V[v]();window.scrollTo(0,0);bind(v);bindPlus(v);bindPlus3(v)}
const err=m=>{const e=$("#e");if(e){e.textContent=m;e.hidden=!m}};
const busy=(on,label)=>{const b=$("#go");if(b){b.disabled=on;if(label)b.textContent=label}};
function appliquerLecture(r){["prix","ch","ville","cession"].forEach(k=>{if(r[k])F[k]=r[k]});if(r.lien&&!F.lien)F.lien=r.lien;
 const res=resumeLecture(r);F.lu=res?`<b>Lu :</b> ${esc(res)}. Vérifie et corrige si besoin.`:"Je n'ai pas trouvé le prix ni la ville : remplis-les ci-dessous."}
function keep(){["annonce","lien","ville","ch","prix","adr","txt"].forEach(k=>{const el=$("#"+k);if(el)F[k]=el.value})}

/* Compte facultatif : chaque appareil reçoit une session anonyme ; créer un compte la relie à un courriel ou un cellulaire (même historique). */
/* Compte obligatoire : une session existe seulement après la validation du code (courriel ou cellulaire). */
async function ouvrirSession(){try{const {data}=await sb.auth.getSession();const u=data.session&&data.session.user;
 SESSION=!!u&&!u.is_anonymous;ANONYME=!SESSION}catch(e){SESSION=false;ANONYME=true}}
async function envoyerCode(){
 if(SESSION&&ANONYME){F.typeCode=F.cible.email?"email_change":"phone_change";const r=await sb.auth.updateUser(F.cible);
  const m=(r.error&&r.error.message||"").toLowerCase();if(!r.error||!(m.includes("already")||m.includes("registered")||m.includes("exists")))return r}
 F.typeCode=F.cible.email?"email":"sms";return sb.auth.signInWithOtp({...F.cible,options:{shouldCreateUser:true}})}
async function rechercheImages(f){try{const b64=await new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=ko;r.readAsDataURL(f)});
 const appel=sb.functions.invoke("recherche-image",{body:{image:b64}});const {data,error}=await Promise.race([appel,new Promise(r=>setTimeout(()=>r({error:"delai"}),9000))]);
 /* La page de l'annonce elle-même n'est pas une copie : on retire les résultats du même site. */
 const hote=u=>{try{return new URL(u).hostname.replace(/^(www|m|web)\./,"")}catch(e){return ""}},site=F.lienN?hote(F.lienN):"";
 return error||!data?null:{ok:true,pages:(data.pages||[]).filter(u=>/^https?:\/\//.test(u)&&(!site||hote(u)!==site))}}catch(e){return null}}
async function chargerProfil(){
 if(!SESSION){PROFIL=null;HIST=[];EST_ADMIN=false;return}
 const {data}=await sb.from("profiles").select("*").maybeSingle();PROFIL=data;try{EST_ADMIN=!!(await rpc("est_admin"))}catch(e){EST_ADMIN=false}
 const h=await sb.from("verifications").select("module,ville,chambres,prix,couleur,travaux,licence,created_at").order("created_at",{ascending:false}).limit(10);HIST=h.data||[];
}
async function chargerRegistre(){try{const {count,error}=await sb.from("licences_rbq").select("numero",{count:"exact",head:true});REGISTRE_PRET=!error&&count>0}catch(e){REGISTRE_PRET=false}}
async function chargerLoyers(){
 const {data}=await sb.from("loyers_reference").select("ville,chambres,loyer");
 LOYERS={};(data||[]).forEach(r=>{(LOYERS[r.ville]=LOYERS[r.ville]||[0,0,0])[r.chambres-1]=r.loyer});
 const ordre=Object.entries(LOYERS).sort((a,b)=>b[1][1]-a[1][1]);LOYERS=Object.fromEntries(ordre);
}
const msgAuth=e=>{const m=(e&&e.message||"").toLowerCase();
 if(m.includes("rate")||m.includes("seconds"))return "Trop de demandes. Attends une minute avant de redemander un code.";
 if(m.includes("phone")||m.includes("sms")||m.includes("provider"))return "L'envoi par SMS n'est pas encore activé. Utilise ton courriel.";
 if(m.includes("expired")||m.includes("invalid"))return "Code incorrect ou expiré.";
 return "Une erreur est survenue. Réessaie dans un instant.";};

function bind(v){
 app.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{if(b.id==="nouvR")F={};go(b.dataset.go)});
 app.querySelectorAll("[data-canal]").forEach(b=>b.onclick=()=>{F.canal=b.dataset.canal;F.ident="";go("inscription")});
 app.querySelectorAll("[data-yn]").forEach(b=>b.onclick=()=>{F[b.dataset.yn]=b.dataset.v;b.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));if(b.dataset.yn==="cession")$("#q-accord").hidden=b.dataset.v!=="oui"});
 app.querySelectorAll("input[data-captures]").forEach(inp=>inp.onchange=()=>{const fs=[...inp.files].slice(0,4);if(!fs.length)return;keep();
  F.captures=fs;F.vignettes=fs.map(f=>URL.createObjectURL(f));F.capture=fs[0];F.ocr=true;go(v)});
 app.querySelectorAll("input[type=file][data-side]").forEach(inp=>inp.onchange=()=>{const f=inp.files[0];if(!f)return;const s=inp.dataset.side;F[s]=f;F[s+"Url"]=URL.createObjectURL(f);keep();lireReno(F);if(v==="verifier"&&s==="capture")F.ocr=true;go(v)});

 if(v==="inscription")$("#f-ins").onsubmit=async e=>{e.preventDefault();err("");const val=$("#ident").value.trim();F.ident=val;
  if((F.canal||"courriel")==="courriel"){if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val))return err("Entre une adresse courriel valide.");F.cible={email:val.toLowerCase()};F.affiche=val}
  else{const d=val.replace(/\D/g,"").replace(/^1(?=\d{10}$)/,"");if(d.length!==10)return err("Entre un numéro de 10 chiffres.");F.cible={phone:"+1"+d};F.affiche=d.replace(/(\d{3})(\d{3})(\d{4})/,"$1 $2-$3")}
  busy(true,"Envoi…");const {error}=await envoyerCode();
  if(error){busy(false,"Réessayer");return err(msgAuth(error))}go("code")};

 if(v==="code"){const ins=[...app.querySelectorAll(".otp input")];ins[0].focus();
  ins.forEach((x,i)=>{x.oninput=()=>{x.value=x.value.replace(/\D/g,"").slice(-1);if(x.value&&i<5)ins[i+1].focus()};
   x.onkeydown=e=>{if(e.key==="Backspace"&&!x.value&&i)ins[i-1].focus()};
   x.onpaste=e=>{const d=(e.clipboardData.getData("text")||"").replace(/\D/g,"").slice(0,6);if(d.length){e.preventDefault();d.split("").forEach((c,j)=>ins[j].value=c);ins[Math.min(d.length,5)].focus()}}});
  let t=60;const tick=setInterval(()=>{t--;const s=$("#t");if(!s){clearInterval(tick);return}s.textContent=t;if(t<=0){clearInterval(tick);$("#renvoi").disabled=false;$("#renvoi").textContent="Renvoyer le code"}},1000);
  $("#renvoi").onclick=async()=>{const {error}=await envoyerCode();if(error)return err(msgAuth(error));go("code")};
  $("#f-code").onsubmit=async e=>{e.preventDefault();err("");const token=ins.map(x=>x.value).join("");if(token.length<6)return err("Entre les 6 chiffres.");
   busy(true,"Vérification…");const {error}=await sb.auth.verifyOtp({...F.cible,token,type:F.typeCode});
   if(error){busy(false,"Valider");return err(msgAuth(error))}
   clearInterval(tick);F={};await ouvrirSession();await chargerProfil();
   const pa=LS.get("vl_partage");if(pa){LS.set("vl_partage",null);F={annonce:pa.annonce,lien:pa.lien,partage:true};return go("verifier")}
   const sig=LS.get("vl_sig");if(sig){if(PROFIL&&PROFIL.identite_statut==="confirmee"){F=sig;return go("signaler")}return go(PROFIL&&PROFIL.identite_statut==="en_attente"?"attente":"identite")}
   go("accueil")}}

 if(v==="identite"){$("#doc").value=F.doc||"permis";$("#doc").onchange=e=>{F.doc=e.target.value;if(F.doc==="passeport"){F.verso=null;F.versoUrl=null}go("identite")};
  $("#f-id").onsubmit=async e=>{e.preventDefault();err("");const doc=F.doc||"permis";
   if(!F.recto)return err("Ajoute la photo du recto.");if(doc!=="passeport"&&!F.verso)return err("Ajoute la photo du verso.");if(!$("#ok").checked)return err("Coche la case pour continuer.");
   busy(true,"Envoi sécurisé…");const uid=(await sb.auth.getUser()).data.user.id,stamp=Date.now();
   for(const s of ["recto","verso"]){const f=F[s];if(!f)continue;const ext=(f.type.split("/")[1]||"jpg").replace("jpeg","jpg");
    const {error}=await sb.storage.from("pieces-identite").upload(`${uid}/${stamp}-${s}.${ext}`,f,{contentType:f.type,upsert:false});
    if(error){busy(false,"Réessayer");return err("L'envoi de la photo a échoué. Vérifie ta connexion (photo de 8 Mo maximum).")}}
   const {error}=await sb.rpc("soumettre_identite",{doc_type:doc});if(error){busy(false,"Réessayer");return err("Une erreur est survenue. Réessaie.")}
   F={};await chargerProfil();go("identiteOk")}}

 if(v==="accueil"&&$("#deco"))$("#deco").onclick=async()=>{await sb.auth.signOut();PROFIL=null;HIST=[];F={};SESSION=false;go("bienvenue")};
 if(v==="resultat"&&$("#signaler"))$("#signaler").onclick=()=>{const sig={lienN:F.lienN,ville:F.ville};LS.set("vl_sig",sig);
  if(ANONYME)return go("inscription");const st=PROFIL&&PROFIL.identite_statut;
  if(st==="confirmee"){F=sig;return go("signaler")}go(st==="en_attente"?"attente":"identite")};
 if(v==="signaler"){if(!F.lienN){const sig=LS.get("vl_sig");if(sig)F=sig}lierSignaler(F);$("#f-sig").onsubmit=async e=>{e.preventDefault();err("");const m=validerSignal(F);if(m)return err(m);
  busy(true,"Envoi…");const {error}=await sb.from("signalements").insert({lien:F.lienN,motif:F.motif});
  if(error&&!String(error.code).includes("23505")){busy(false,"Réessayer");return err("Le signalement n'a pas pu être envoyé. Réessaie.")}
  LS.set("vl_sig",null);F={};go("signalOk")}}
 if(v==="verifier"){$("#lire").onclick=()=>{keep();F.coller=true;appliquerLecture(extraireAnnonce(F.annonce,Object.keys(LOYERS)));go("verifier")};
  if(F.partage){F.partage=false;appliquerLecture(extraireAnnonce(F.annonce,Object.keys(LOYERS)));return go("verifier")}
  if(F.ocr){F.ocr=false;F.lu=null;const n=(F.captures||[]).length;$("#f-ver").insertAdjacentHTML("afterbegin",`<p class="lu" role="status">Lecture de ${n>1?n+" captures":"la capture"}…</p>`);
   (async()=>{let tout="";for(const c of F.captures||[])tout+="\n"+await lireCapture(c);return tout})()
   .then(txt=>{const ici=$("#f-ver");if(ici)keep();F.ocrTxt=txt.trim();appliquerLecture(extraireAnnonce(F.ocrTxt,Object.keys(LOYERS)));if(ici)go("verifier")})
   .catch(()=>{F.lu="La lecture des captures n'a pas fonctionné ici. Remplis les champs, ou colle le texte.";F.coller=true;if($("#f-ver"))go("verifier")})}}

 if(v==="verifier"){$("#ch").value=F.ch||"2";$("#f-ver").onsubmit=async e=>{e.preventDefault();keep();err("");
  F.prixN=parseInt(String(F.prix).replace(/\D/g,""),10);if(!F.prixN||F.prixN<100)return err("Entre le loyer demandé.");
  if(!F.argent||!F.visite||!F.cession)return err("Réponds aux trois questions.");if(F.cession==="oui"&&!F.accord)return err("Dis-nous si le propriétaire a accepté par écrit.");
  F.lienN=normaliser(F.lien);if(F.lien&&F.lien.trim()&&!F.lienN)return err("Ce lien n'est pas valide. Colle l'adresse complète de l'annonce, ou laisse le champ vide.");
  F.titre="Vérification";F.msg="Analyse de l'annonce…";go("analyse");
  F.stats=null;F.nbSig=0;F.images=null;
  if(F.lienN&&SESSION){const [a,b]=await Promise.all([sb.rpc("stats_lien",{p_lien:F.lienN}),sb.rpc("nb_signalements",{p_lien:F.lienN})]);F.stats=a.data&&a.data[0];F.nbSig=+b.data||0}
  if(F.capture)F.images=await rechercheImages(F.capture);
  F.res=analyser();
  const brut=F.res.items.map(i=>({c:i.c,t:i.t.replace(/<[^>]+>/g,"")}));
  const ins=SESSION?sb.from("verifications").insert({ville:F.ville,chambres:+F.ch,prix:F.prixN,couleur:F.res.c,raisons:brut,lien:F.lienN}):Promise.resolve();
  await Promise.all([ins,new Promise(r=>setTimeout(r,900))]);await chargerProfil();go("resultat")}}
 if(v==="resultat")$("#nouv").onclick=()=>{F={};go("verifier")};

 if(v==="reno"){lierReno(F);$("#f-reno").onsubmit=async e=>{e.preventDefault();lireReno(F);err("");const m=validerReno(F);if(m)return err(m);
  const lic=chiffres(F.licence);F.titre="Vérification";F.msg="Analyse de la soumission…";go("analyse");
  let R;/* undefined = registre pas encore importé : l'app renvoie au registre officiel */
  if(lic&&REGISTRE_PRET){const {data,error}=await sb.from("licences_rbq").select("numero,nom,autres_noms,sous_categories,mandataire").eq("numero",lic).maybeSingle();if(!error)R=data||null}
  F.res=analyserReno(F,R);
  const brut=F.res.items.map(i=>({c:i.c,t:i.t.replace(/<[^>]+>/g,"")}));
  const ins=!SESSION?Promise.resolve():sb.from("verifications").insert({module:"reno",travaux:F.travaux,licence:lic||null,couleur:F.res.c,raisons:brut});
  await Promise.all([ins,new Promise(r=>setTimeout(r,700))]);await chargerProfil();go("renoResultat")}}
 if(v==="renoResultat"){lierResultatReno(F);$("#nouv").onclick=()=>{F={};go("reno")}}
}

function analyser(){
 const it=[],txt=((F.txt||"")+" "+(F.annonce||"")+" "+(F.ocrTxt||"")).toLowerCase(),L1904='Code civil du Québec, art. 1904 · <a href="https://www.quebec.ca/nouvelles/actualites/details/exiger-un-depot-de-garantie-est-illegal" target="_blank" rel="noopener">Québec.ca</a>';
 const motA=trouverMot(txt,MOTS_ARGENT),motP=trouverMot(txt,MOYENS_FRAUDE),motS=trouverMot(txt,MOTS_SCENARIO);
 if(F.argent==="oui")it.push({c:"r",t:"<b>On te demande de l'argent avant le bail.</b> Au Québec, le propriétaire peut seulement exiger le premier mois de loyer, et aucun dépôt.",law:L1904});
 if(motP)it.push({c:"r",t:`<b>Paiement par « ${esc(motP)} ».</b> Aucun propriétaire honnête ne demande ce moyen de paiement : il est presque impossible de récupérer l'argent.`});
 if(motA&&F.argent!=="oui")it.push({c:"y",t:`<b>Il est question de « ${esc(motA)} ».</b> Si on te demande un dépôt ou des frais avant le bail, c'est illégal. Seul le premier mois de loyer peut être exigé d'avance.`,law:L1904});
 if(motS)it.push({c:"y",t:`<b>Scénario d'arnaque courant</b> repéré : « ${esc(motS)} ».`});
 itemsProfil(F).forEach(x=>it.push(x));
 if(F.visite==="non")it.push({c:"y",t:"<b>Tu n'as pas visité.</b> Ne paie rien sans avoir vu le logement en personne."});
 else it.push({c:"g",t:"Tu as visité le logement. Attention : un fraudeur peut louer un logement quelques jours pour le faire visiter."});
 if(F.cession==="oui")it.push(F.accord==="oui"?{c:"g",t:"Accord écrit du propriétaire pour la cession : bon signe."}:{c:"y",t:"<b>Cession sans accord écrit du propriétaire.</b> Il peut refuser ; ne paie rien avant sa réponse écrite.",law:'Code civil du Québec, art. 1870 et 1871 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_828_E.pdf" target="_blank" rel="noopener">TAL</a>'});
 if(F.lienN){const h=new URL(F.lienN).hostname,site=SITES.find(s=>h===s.d||h.endsWith("."+s.d));
  if(!site)it.push({c:"y",t:`<b>Site inconnu : ${esc(h)}.</b> Les fraudeurs copient parfois de vrais sites d'annonces. Vérifie l'adresse lettre par lettre.`});
  const st=F.stats;if(st&&+st.rouges>0)it.push({c:"r",t:`<b>${st.rouges} vérification${st.rouges>1?"s":""} précédente${st.rouges>1?"s":""} de cette annonce ${st.rouges>1?"ont":"a"} donné « Ne paie pas ».</b>`});
  else if(st&&+st.total>0)it.push({c:"i",t:`Cette annonce a déjà été vérifiée ${st.total} fois, sans arnaque probable.`});
  const sg=itemSignalements(F.nbSig);if(sg)it.push(sg);}
 if(F.images&&F.images.pages&&F.images.pages.length)it.push({c:"y",t:`<b>Ces images apparaissent sur ${F.images.pages.length} autre${F.images.pages.length>1?"s":""} page${F.images.pages.length>1?"s":""} du web.</b> Les fraudeurs copient souvent les photos d'une vraie annonce. ${F.images.pages.slice(0,3).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname)}</a>`).join(", ")}`,law:"Recherche d'image inversée (Google Vision)"});
 else if(F.images&&F.images.ok)it.push({c:"g",t:"Les images de la capture n'ont pas été trouvées ailleurs sur le web."});
 if(!F.images)it.push({c:"i",t:"Astuce : cherche la photo de l'annonce avec Google Lens (dans l'app Google) pour voir si elle est publiée ailleurs."});
 const loy=LOYERS[F.ville],moy=loy&&loy[Math.min(+F.ch,3)-1],LSCHL="SCHL, loyers moyens octobre 2025";
 /* Prix bas : jamais un signal à lui seul (vieil immeuble, quartier moins cher, propriétaire de longue date).
    Il ne devient jaune que s'il s'ajoute à un autre signal d'alarme. */
 const autreSignal=it.some(i=>i.c==="r"||i.c==="y");
 if(moy){const r=F.prixN/moy;
  if(r<BAS&&F.cession==="oui")it.push({c:"i",t:`<b>Prix sous la moyenne</b> (${money(moy)} à ${esc(F.ville)}) : normal pour une cession, car le nouveau locataire reprend le bail existant et son loyer.`,law:'Code civil du Québec, art. 1870 à 1873 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_817_E.pdf" target="_blank" rel="noopener">TAL</a>'});
  else if(r<BAS&&autreSignal)it.push({c:"y",t:`<b>Prix nettement sous la moyenne, en plus d'un autre signal.</b> ${money(F.prixN)} contre ${money(moy)} en moyenne à ${esc(F.ville)}. Un prix trop beau combiné à ces signaux est l'appât classique des fausses annonces.`,law:LSCHL});
  else if(r<BAS)it.push({c:"i",t:`<b>Prix sous la moyenne</b> (${money(moy)} à ${esc(F.ville)}). Ça arrive souvent : vieil immeuble, quartier moins cher, propriétaire de longue date. Pas un signe d'arnaque à lui seul.`,law:LSCHL});
  else if(r>HAUT)it.push({c:"i",t:`<b>Prix élevé</b> (${money(moy)} en moyenne). Pas une arnaque en soi : vérifie la section G du bail. Tu peux demander au Tribunal de fixer le loyer dans les 10 jours suivant la signature.`,law:'Code civil du Québec, art. 1896 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/Ajustement-bail-logement.pdf" target="_blank" rel="noopener">TAL, formulaire de bail</a>'});
  else it.push({c:"g",t:`<b>Prix dans la normale</b> pour ${esc(F.ville)} (${money(moy)} en moyenne).`,law:LSCHL})}
 else it.push({c:"i",t:"Pas encore de loyer de référence pour cette ville."});
 const c=it.some(i=>i.c==="r")?"r":it.some(i=>i.c==="y")?"y":"g";
 const ord={r:0,y:1,i:2,g:3};it.sort((a,b)=>ord[a.c]-ord[b.c]);
 return {c,items:it};
}

/* Partage reçu dans l'app native (iPhone/Android), voir app-native/partage-natif.js. */
window.recevoirPartage=t=>{if(!t)return;F={annonce:String(t).slice(0,5000),partage:true};const l=normaliser(t);if(l)F.lien=l;go("verifier")};
(async()=>{
 try{if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{})}catch(e){}
 go("analyse");
 try{await Promise.all([chargerLoyers(),chargerRegistre(),chargerParametres()]);
  await ouvrirSession();await chargerProfil();go(SESSION?(F.partage?"verifier":"accueil"):"bienvenue")}
 catch(e){app.innerHTML=`${top()}<p class="err">Impossible de joindre le serveur. Vérifie ta connexion et recharge la page.</p>`}
})();
}
