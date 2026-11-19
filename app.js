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
/* ===== Profil de l'annonceur (toutes les plateformes ; Facebook bloque la lecture automatique : questions facultatives) ===== */
const PLATEFORMES=[[/facebook\.com|fb\.com|fb\.me|marketplace|messenger/i,"Facebook","Touche le nom de la personne dans l'annonce, puis « À propos »."],
 [/kijiji/i,"Kijiji","Touche le nom de l'annonceur pour ouvrir son profil et voir ses autres annonces."],
 [/lespac/i,"LesPAC","Touche le nom de l'annonceur pour ouvrir son profil et voir ses autres annonces."],
 [/craigslist/i,"Craigslist","Craigslist n'affiche pas de profil : réponds seulement aux questions que tu peux vérifier."],
 [/instagram|tiktok/i,"un réseau social","Ouvre le profil du compte : regarde depuis quand il publie et ce qu'il publie."]];
const plateforme=F=>{const t=(F.lien||"")+" "+(F.annonce||"")+" "+(F.ocrTxt||"");const p=PLATEFORMES.find(x=>x[0].test(t));return p?{nom:p[1],aide:p[2]}:null};
const estFacebook=F=>{const p=plateforme(F);return !!p&&p.nom==="Facebook"};
const blocProfil=F=>{const p=plateforme(F);return `<details class="profil" ${p||F.pAncien||F.pAmis||F.pPlusieurs||F.pHors?"open":""}><summary>Vérifier le profil de l'annonceur${p?` sur ${p.nom}`:""} (facultatif)</summary>
<p class="hint" style="margin:0">${p?p.aide:"Sur Facebook, Kijiji, LesPAC ou ailleurs : touche le nom ou la photo de l'annonceur pour ouvrir son profil."}</p>
${yn("pAncien","Son compte existe depuis plus d'un an ?")}${yn("pAmis","Son profil a l'air réel (photo, nom complet, publications, évaluations ou autres annonces normales) ?")}${yn("pPlusieurs","Publie-t-il plusieurs logements, ou dans plusieurs villes ?")}${yn("pHors","Veut-il continuer la conversation ailleurs (texto, courriel, WhatsApp) dès le début ?")}</details>`};
function itemsProfil(F){const it=[];
 if(F.pAncien==="non")it.push({c:"y",t:"<b>Compte de moins d'un an.</b> Les faux profils sont souvent récents."});
 if(F.pAmis==="non")it.push({c:"y",t:"<b>Profil vide ou impersonnel.</b> C'est typique d'un faux compte."});
 if(F.pPlusieurs==="oui")it.push({c:"y",t:"<b>Plusieurs logements ou plusieurs villes.</b> Un particulier en loue rarement autant : vérifie qu'il s'agit d'une vraie entreprise de gestion."});
 if(F.pHors==="oui")it.push({c:"y",t:"<b>Il veut quitter la plateforme dès le début.</b> Ailleurs, tu ne peux plus signaler ses messages à la plateforme. Garde la conversation sur la plateforme jusqu'à la visite."});
 if(F.pAncien==="oui"&&F.pAmis==="oui"&&F.pPlusieurs==="non"&&F.pHors!=="oui")it.push({c:"g",t:"Profil d'apparence normale. Attention : un vieux compte peut avoir été piraté."});
 else if(!it.length&&!F.pAncien&&!F.pAmis&&!F.pPlusieurs&&!F.pHors){const p=plateforme(F);if(p)it.push({c:"i",t:`Annonce ${p.nom==="un réseau social"?"sur un réseau social":p.nom} : réponds aux questions sur le profil de l'annonceur pour une vérification plus complète.`})}
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
 if(/\bcession\b|\btransfert de bail\b|\blease transfer\b|sous-loca|sous-lou|\bsublet|\bsublease/.test(bas))r.cession="oui";
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
<h2>Signaler cette annonce</h2><p class="soft">Ton signalement prévient les prochaines personnes qui vérifient la même annonce, le même numéro ou les mêmes photos. Ton nom n'est jamais montré.</p>${resumeSignal(F)}
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
<h1>Signalement reçu</h1><p class="soft">Les prochaines personnes qui vérifient cette annonce, ce numéro ou ces photos verront l'avertissement. Plus nous sommes nombreux, plus l'app devient fiable.</p>
<button class="btn" data-go="accueil">Retour à l'accueil</button>`;
const boutonSignaler=F=>peutSignaler(F)?`<button class="btn ghost" id="signaler">Signaler cette annonce comme frauduleuse</button>`:`<p class="hint">Pour pouvoir signaler cette annonce, ajoute son lien, le téléphone de l'annonceur ou une capture.</p>`;

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
const top=(back,title)=>`<div class="top">${back?`<button class="back" data-go="${back}">‹ Retour</button>`:""}${title?"":`<svg class="logo-mini" aria-hidden="true"><use href="#logo"/></svg>`}<b>${title||"HabitaScan"}</b><span class="sp"></span><button type="button" class="theme-btn" data-theme-toggle aria-label="Changer de thème"></button></div>`;
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
function verdictProprio(P,F){const ces=F&&F.cession==="oui";const c=P.cmp||{};
 const doc=ces?"l'accord écrit":"le bail";
 if(P.nomReg&&P.nomBail){const m=memeNom(P.nomBail,P.nomReg);
  if(m==="oui")return ces?{c:"g",t:"L'accord vient du propriétaire inscrit",s:"Tu peux signer la cession. Paie ensuite le loyer au propriétaire, jamais au locataire qui part."}:{c:"g",t:"Le bail est au nom du propriétaire inscrit",s:"Tu peux signer. Paie le premier mois à la signature, par un moyen traçable."};
  if(m==="partiel")return {c:"y",t:"Le nom ressemble en partie",s:`Vérifie l'orthographe sur ${doc} et au Registre foncier avant de payer (deuxième prénom, entreprise apparentée).`};
  return ces?{c:"r",t:"Ce n'est pas le propriétaire inscrit",s:"L'accord écrit n'est pas signé par le propriétaire inscrit au Registre foncier. Ne paie rien."}
   :{c:"y",t:"Le bail n'est pas au nom du propriétaire inscrit",s:"Si c'est un gestionnaire, exige son mandat écrit signé par le propriétaire inscrit. Sinon, ne paie pas."}}
 if(P.nomReg&&c.nom){if(c.nom==="non")return {c:"y",t:`Le propriétaire inscrit n'apparaît pas sur ${doc}`,s:"Si c'est un gestionnaire, exige son mandat écrit. Sinon, ne paie pas."};
  if(c.adr==="non")return {c:"y",t:`L'adresse n'apparaît pas sur ${doc}`,s:`${ces?"L'accord":"Le bail"} doit être celui du logement que tu as visité.`};
  if(c.nom==="oui")return {c:"g",t:`Le propriétaire inscrit apparaît sur ${doc}`,s:"Tu peux signer. Paie à la signature, par un moyen traçable."}}
 return null}
function vueProprio(F,back){const P=F.P||(F.P={adr:F.adr?(F.adr+(F.ville&&F.ville!=="Autre"?", "+F.ville:"")):""});const V=verdictProprio(P,F),c=P.cmp,G=P.geo;
 const ligne=(etat,t)=>`<li><span class="dot ${etat}"></span><div>${t}</div></li>`;
 const lots=G&&G.lots||[];const ces=F.cession==="oui";const doc=ces?"l'accord écrit du propriétaire":"le bail";
 return `${top(back,"Propriétaire")}
<h2>Vérifier le propriétaire</h2>
<p class="soft"><b>Aucune question à poser à l'annonceur.</b> L'adresse suffit pour trouver le vrai propriétaire. La comparaison se fait au moment de signer, avant de payer : c'est le seul moment où ton argent est en jeu.</p>
${V?`<div class="verdict ${V.c}" id="pv"><strong>${V.t}</strong><span>${V.s}</span></div>`:""}
<form class="card" id="f-pro" novalidate>
<h2>1. L'adresse du logement</h2>
<p class="hint">Dans l'annonce, ou celle qu'on te donne pour la visite.</p>
<label>Adresse<input id="padr" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(P.adr||"")}"></label>
<button type="button" class="btn ghost" id="b-lot">${P.chercheLot?"Recherche…":"Trouver le numéro de lot"}</button>
${G?G.trouve?`<ul class="reasons">${ligne("g",`Adresse trouvée : ${esc(G.adresse)}.`)}
${lots.length?ligne("g",`Numéro de lot : ${lots.map(l=>`<b class="num">${esc(fmtLot(l))}</b>`).join(", ")}.`):ligne("y",`Numéro de lot non trouvé automatiquement. Cherche l'adresse sur ${lienExt(L_INFOLOT,"Infolot")}.`)}
</ul><p class="hint">Sources : Adresses Québec et cadastre du Québec, données ouvertes du gouvernement.</p>`
:`<p class="lu">${esc(G.erreur||"Adresse introuvable. Ajoute la ville, ou cherche-la sur la carte Infolot.")} ${lienExt(L_INFOLOT,"Ouvrir Infolot")}</p>`:""}
</form>
<div class="card"><h2>2. Trouve le vrai propriétaire</h2>
<p class="hint">Le Registre foncier dit à qui appartient l'immeuble. Personne ne peut le falsifier ni le faire retirer.</p>
<ul class="reasons">
${ligne("i",lots.length?`<b>Ton numéro de lot :</b> <span class="num">${lots.map(fmtLot).join(", ")}</span>.`:`<b>Le numéro de lot</b> : à l'étape 1, ou avec ${lienExt(L_INFOLOT,"Infolot")} (gratuit).`)}
${ligne("i",`<b>Consulte l'index des immeubles</b> de ce lot au ${lienExt(L_REGISTRE,"Registre foncier du Québec")}, puis le dernier acte de vente : 1 $ par document, compte requis.<div class="law">${lienExt(L_TARIF,"Grille tarifaire du Registre foncier, 1er janvier 2026")}</div>`)}
${ligne("i",`<b>Si c'est une entreprise</b>, regarde ses dirigeants au ${lienExt("https://www.registreentreprises.gouv.qc.ca/","registre des entreprises")} (gratuit).`)}</ul>
<label>Nom du propriétaire inscrit<input id="preg" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomReg||"")}"></label>
<p class="hint">L'app le garde sur ton téléphone pour la comparaison de l'étape 3.${F.ville==="Montréal"?` À Montréal, le ${lienExt(L_ROLE_MTL,"rôle d'évaluation en ligne")} donne parfois le nom gratuitement ; s'il n'y est pas, le propriétaire a pu demander son retrait (${lienExt(L_RETRAIT_MTL,"Loi sur la fiscalité municipale")}).`:""}</p></div>
${carteApprofondie()}
<form class="card" id="f-sig" novalidate><h2>3. Au moment de signer, avant de payer</h2>
${ces?`<div class="rule" style="text-align:left"><b>C'est le locataire actuel qui annonce</b> (cession ou sous-location). Le document à comparer est <b>l'accord écrit du propriétaire, avec ton nom</b> : le locataire doit aviser le propriétaire par écrit et obtenir son accord. Le propriétaire a 15 jours pour répondre ; sans réponse, il est réputé avoir accepté. En cession, le locataire qui part ne peut rien te demander en échange.
<span class="law">Code civil du Québec, art. 1870 et 1871 · ${lienExt("https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf","TAL, avis de cession")}</span></div>`
:`<p class="hint">Le nom du locateur est écrit en haut du bail, dans la section « Entre le locateur et le locataire » du formulaire obligatoire. Tu n'as rien à demander : il suffit de le lire.</p>`}
<label>Nom du ${ces?"propriétaire sur l'accord écrit":"locateur écrit sur le bail"}<input id="pbail" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomBail||"")}"></label>
<label class="drop">${P.photo?`<img src="${P.photo}" alt="Document">Changer la photo`:`Ou prends ${doc} en photo`}<input type="file" accept="image/*" data-taxe="1"></label>
${P.lecture?`<p class="lu" role="status">${P.lecture}</p>`:""}
${c&&P.nomReg?`<ul class="reasons">
${c.nom?ligne(c.nom==="oui"?"g":c.nom==="partiel"?"y":"r",c.nom==="oui"?`Le propriétaire inscrit apparaît sur ${doc}.`:c.nom==="partiel"?`Une partie seulement du nom du propriétaire inscrit apparaît sur ${doc}.`:`Le propriétaire inscrit n'apparaît pas sur ${doc}.`):""}
${c.adr?ligne(c.adr==="oui"?"g":"r",c.adr==="oui"?`L'adresse du logement est sur ${doc}.`:`L'adresse du logement n'a pas été trouvée sur ${doc}.`):""}</ul>`:""}
${!P.nomReg&&(P.nomBail||P.photo)?`<p class="lu">Inscris d'abord le nom du propriétaire trouvé à l'étape 2, pour que l'app compare.</p>`:""}
<p class="hint">La photo reste sur ton téléphone. Elle n'est envoyée nulle part.</p></form>
<button class="btn" data-go="${back}">Retour au résultat</button>`}
function lierProprio(F){const P=F.P;
 const garder=()=>{P.adr=$("#padr").value;P.nomReg=$("#preg").value.trim();P.nomBail=$("#pbail").value.trim()};
 const recomparer=()=>{if(P.texte&&P.nomReg)P.cmp=comparerProprio(P.texte,P.nomReg,P.adr)};
 ["#padr","#preg","#pbail"].forEach(s=>$(s).onchange=()=>{const avant=P.adr;garder();if(P.adr!==avant)P.geo=null;recomparer();go("proprio")});
 $("#b-lot").onclick=async()=>{garder();if(P.adr.trim().length<6||!/\d/.test(P.adr)){P.geo={trouve:false,erreur:"Entre l'adresse complète, avec le numéro et la ville."};return go("proprio")}
  P.chercheLot=true;go("proprio");try{MES.noter("lot_cherche")}catch(e){}
  try{P.geo=await INFO.adresse(P.adr.trim())}catch(e){P.geo={trouve:false,erreur:"La recherche automatique n'a pas fonctionné ici."}}
  P.chercheLot=false;if($("#f-pro"))go("proprio")};
 const inp=app.querySelector("input[data-taxe]");
 inp.onchange=()=>{const f=inp.files[0];if(!f)return;garder();const r=new FileReader();r.onload=()=>{P.photo=r.result;P.cmp=null;P.lecture="Lecture du document…";go("proprio");
  lireCapture(P.photo).then(t=>{P.texte=t;recomparer();P.lecture=null})
  .catch(()=>{P.lecture="La lecture automatique n'a pas fonctionné ici. Écris le nom toi-même ci-dessus."})
  .finally(()=>{if($("#f-sig"))go("proprio")})};r.readAsDataURL(f)}}

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
  try{MES.noter("recherche_lancee")}catch(e){}
  const b=$("#go");b.disabled=true;b.textContent="Recherche…";$("#liste").innerHTML=`<p class="hint">Recherche des annonces récentes…</p>`;
  try{const brut=await ANN.chercher(f);F.resultats=trierResultats(brut,f);F.noteRecherche=ANN.note||""}
  catch(x){F.resultats=[];F.noteRecherche=x&&x.message==="quota"?"Tu as atteint la limite de recherches pour aujourd'hui. Réessaie demain, ou cherche directement sur les sites ci-dessous.":"La recherche n'a pas fonctionné. Réessaie, ou cherche directement sur les sites ci-dessous."}
  if(!$("#f-tr"))return;b.disabled=false;b.textContent="Chercher";afficher()};
 $("#f-tr").onsubmit=e=>{e.preventDefault();chercher()};
 if(F.resultats)afficher();else if(f.max)chercher();else $("#sites").innerHTML=liensSites(f)}

/* ---------- Liaison ---------- */
function bindPlus(v){
 if(v==="proprio")lierProprio(F);
 if(v==="budget")lierBudget(F);
 if(v==="trouver")lierTrouver(F);
}
const CSS_PLUS=""; /* styles déplacés dans app.css */

/* Adaptateur adresse (Supabase : fonction info-adresse, qui appelle les services publics) */
const INFO={async adresse(a){const {data,error}=await sb.functions.invoke("info-adresse",{body:{adresse:a}});if(error||!data||data.error)return trouverLotDirect(a);return data}};

/* Adaptateur recherche (Supabase : fonction chercher-annonces → Brave Search API) */
const ANN={note:"",
 async chercher(f){if(!CFG.recherche)return [];const {data,error}=await sb.functions.invoke("chercher-annonces",{body:{ville:f.ville,ch:f.ch,max:f.max}});
  if(error){if(error.context&&error.context.status===429)throw new Error("quota");throw error}return (data&&data.resultats)||[]}};
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
<li>Le texte des annonces, tes conversations et tes captures d'écran sont lus <b>sur ton téléphone</b>. Si tu actives l'analyse intelligente, ils sont envoyés à Anthropic pour l'analyse. Nous ne les conservons jamais.</li>
<li>Aucune vente de renseignements, aucune publicité, aucun profilage ni suivi publicitaire.</li>
<li>Ta ville de connexion n'est jamais notée sans ton accord : cette fonction est désactivée par défaut et tu l'actives toi-même dans Mon compte.</li>
<li>Tu peux consulter, corriger ou supprimer tes renseignements en tout temps.</li></ul>
<p class="hint">Voir aussi les ${lienConditions}.</p>
<p class="hint">Cette politique respecte la ${lienExt(L_LOI,"Loi sur la protection des renseignements personnels dans le secteur privé")}, modifiée par la Loi 25. L'app s'adresse aux personnes de 14 ans et plus.</p></div>
<div class="card"><h2>Personne responsable</h2><p>${R.nom}, ${R.titre}, ${R.entreprise}<br>Courriel : ${R.courriel}<br>${R.adresse}</p>
<p class="hint">Écris-lui pour toute question, demande d'accès, de correction ou de suppression, ou pour porter plainte.</p></div>
<div class="card"><h2>Ce que nous recueillons</h2>${t([
 ["Courriel ou cellulaire","Te connecter avec un code, retrouver ton compte, compter les utilisateurs"],
 ["Résumé de tes vérifications : ville, chambres, loyer, lien, résultat ; travaux et licence RBQ ; empreintes non réversibles des photos et du texte de l'annonce (jamais les photos ni le texte eux-mêmes)","Ton historique, et reconnaître la même annonce publiée ailleurs. Les autres voient seulement des nombres, des prix et des villes, jamais qui a vérifié"],
 ["Signalement : lien de l'annonce, numéros de téléphone et courriels de l'annonceur (seulement en empreinte chiffrée, jamais en clair), empreinte visuelle des photos (la photo ne quitte pas ton téléphone), et motif","Avertir les autres utilisateurs (mémoire collective). Ils voient seulement un nombre"],
 ["Photo de pièce d'identité, seulement pour signaler","Éviter les fausses accusations. Lue automatiquement pour pré-remplir les informations, puis vérifiée par l'équipe. Supprimée après la vérification"],
 ["Informations lues sur la pièce : prénom, nom, année de naissance, date d'expiration, province ou pays ; empreinte chiffrée du numéro (jamais le numéro lui-même)","Vérifier l'identité, repérer une pièce expirée, une personne mineure ou une pièce utilisée par deux comptes. Une fois l'identité confirmée, seuls le prénom, l'initiale du nom et la date d'expiration sont gardés ; tout est effacé si elle est refusée"],
 ["Ville, chambres et budget de « Trouver »","Chercher des annonces. Non conservés"],
 ["Vérification complète : adresse, lot, lien de l'annonce et, si tu le donnes, le nom de l'annonceur","Faire la vérification que tu as payée et te remettre le rapport. Le rapport donne le nom du propriétaire inscrit au Registre foncier (information publique), sans aucun document"],
 ["Compteurs d'utilisation (écrans ouverts par jour) et erreurs techniques","Améliorer l'app. Compteurs sans lien avec ton compte ; erreurs sans renseignement personnel"],
 ["Ville approximative de connexion, seulement si tu l'actives dans Mon compte : ville, région, pays (déduits de l'adresse IP, sans GPS ni adresse IP conservée) et type d'appareil","Repérer une connexion inhabituelle sur ton compte et savoir quelles régions nous servons. Visible seulement par les administrateurs"],
 ["Analyse intelligente, seulement si tu l'actives : captures et texte de l'annonce, réponse de l'annonceur et captures de la discussion","Extraire les informations et repérer les signaux d'arnaque, surtout dans la conversation. Envoyés à Anthropic pour l'analyse, jamais conservés par HabitaScan"],
 ["Numéros de téléphone et courriels de l'annonceur trouvés dans l'annonce ou la conversation","Vérifier s'ils ont déjà été signalés. Comparés puis oubliés, sauf si tu les signales (empreinte chiffrée seulement)"]],["Renseignement","Pourquoi"])}
<p class="hint"><b>Restent sur ton téléphone :</b> le texte des annonces et des conversations, tes captures (sauf si la recherche des photos est activée : envoyée à Google Cloud Vision puis oubliée), la photo du compte de taxes, ton budget et ton revenu.</p>
<p class="hint"><b>Résultat automatique :</b> le verdict est calculé à partir de règles publiques. Il porte sur l'annonce, pas sur toi. Tu peux demander quelles règles ont mené à un résultat.</p></div>
<div class="card"><h2>Fournisseurs, dont hors du Québec</h2>${t([
 ["Supabase (base de données, connexion)","Données à Montréal (AWS Canada Centre) ; entreprise américaine"],
 ["Vercel (pages de l'app)","États-Unis : adresse IP ; si tu l'actives, Vercel en déduit ta ville approximative"],
 ["jsDelivr (bibliothèques de l'app)","Réseau mondial : adresse IP"],
 ["Tavily (« Trouver » et recherche des copies d'une annonce)","États-Unis : mots de la recherche ou une phrase de l'annonce, sans ton nom"],
 ["Google Cloud Vision, si activé","États-Unis : capture envoyée pour la recherche"],
 ["Stripe (paiement de la vérification complète)","Entreprise américaine : courriel et carte. HabitaScan ne voit jamais le numéro de carte"],
 ["Anthropic (analyse intelligente, si tu l'actives ; lecture de la pièce d'identité)","Entreprise américaine : captures et texte envoyés pour l'analyse ; photo de la pièce envoyée pour la lecture, sans copie conservée"]],["Fournisseur","Où et quoi"])}
<p class="hint">Avant de confier des renseignements hors du Québec, nous évaluons s'ils seront protégés adéquatement (art. 17 de la loi). Nous ne communiquons rien d'autre sans ton consentement, sauf dans les cas prévus par la loi.</p></div>
<div class="card"><h2>Conservation et sécurité</h2>
<ul class="liste"><li>Compte et historique : jusqu'à la suppression du compte, ou [24] mois sans connexion.</li>
<li>Pièce d'identité : supprimée dès la vérification, au plus tard [30] jours après l'envoi.</li>
<li>Signalements : [12] mois.</li>
<li>Ville approximative de connexion : 90 jours au plus, 20 connexions au plus ; effacée dès que tu désactives la fonction.</li>
<li>Échanges chiffrés (HTTPS) ; chaque utilisateur ne lit que ses propres renseignements.</li>
<li>En cas d'incident présentant un risque de préjudice sérieux, nous avisons la Commission d'accès à l'information et les personnes touchées.</li></ul></div>
<div class="card"><h2>Tes droits</h2>
<p>Accès et copie de tes renseignements, correction, suppression, retrait du consentement. Réponse dans les 30 jours, gratuitement.</p>
<p class="hint">Tu peux supprimer ton compte toi-même dans Mon compte, et retirer une vérification de ton historique à partir de son détail. En cas de désaccord, tu peux t'adresser à la ${lienExt(L_CAI,"Commission d'accès à l'information")}.</p></div>`}
const lienConfidentialite=`<button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>`;

/* ---------- Suppression du compte ---------- */
const vueSupprimer=()=>`${top("compte","Supprimer mon compte")}
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
/* Réglages modifiables dans la console d'administration */
const CFG={ia:true,recherche:true,approfondie:true,message:"",support:""};
const DRAPEAUX={ia_active:"ia",recherche_active:"recherche",approfondie_active:"approfondie"};
function appliquerParametres(rows){(rows||[]).forEach(r=>{const p=PARAMS.find(x=>x.cle===r.cle);const v=+r.valeur;if(p&&v>0)p.set(v);if(DRAPEAUX[r.cle])CFG[DRAPEAUX[r.cle]]=v!==0})}
const nb=v=>Number(v||0).toLocaleString("fr-CA");
function vueAdmin(){const onglet=F.onglet||"chiffres";
 const o=(k,t)=>`<button type="button" data-onglet="${k}" aria-pressed="${onglet===k}">${t}</button>`;
 return `${top("compte","Admin")}
<h2>Espace admin</h2>${ADM.demo?`<p class="demo">Démo : données fictives, rien n'est envoyé.</p>`:""}
${ADM.console?`<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Ouvrir la console complète (ordinateur) ↗</a><p class="hint">Utilisateurs, réglages, quotas, loyers, administrateurs, journal : tout se gère dans la console.</p>`:""}
<div class="seg seg6" role="group" aria-label="Section">${o("chiffres","Chiffres")}${o("demandes","Demandes")}${o("connexions","Connexions")}${o("identites","Identités")}${o("signalements","Signalements")}${o("montants","Montants")}</div>
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
${p.lue_le?`<p><b>Lu par l'IA :</b> ${esc([p.prenom,p.nom].filter(Boolean).join(" ")||"nom non lu")}${p.naissance_annee?` · né(e) en ${esc(p.naissance_annee)}`:""} · expire ${p.expire_le?esc(p.expire_le):"(non lue)"}${p.emetteur?` · ${esc(p.emetteur)}`:""}</p>
${(p.alertes||[]).length?`<ul class="reasons">${p.alertes.map(a=>`<li><span class="dot r"></span><div>${esc(ALERTES_ID[a]||a)}</div></li>`).join("")}</ul>`:`<p class="hint">Aucune alerte automatique.</p>`}`:`<p class="hint">Pas de lecture automatique : vérification manuelle.</p>`}
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
const CSS_PLUS3=""; /* styles déplacés dans app.css */
/* ===== HabitaScan : vérification approfondie payante (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, err, nouveauF, lienExt, fmtLot, chiffresLot, PARAMS, ADM
   et d'un adaptateur VAP : VAP.creer(d) → id ; VAP.mes() ; VAP.adminListe() ; VAP.adminMaj(id, statut, verdict, note)
   VAP.sauverTexte(cle, valeur) ; VAP.courriel() → courriel du compte ; VAP.demo */
const VCFG={prix:15,delai:24,lien:""};
PARAMS.push({cle:"prix_verif",n:"Prix de la vérification complète ($)",get:()=>VCFG.prix,set:v=>VCFG.prix=v},
 {cle:"delai_verif_heures",n:"Délai de réponse promis (heures)",get:()=>VCFG.delai,set:v=>VCFG.delai=v});
const prixTxt=()=>String(VCFG.prix).replace(".",",")+" $";
const VERDICTS={correspond:["g","Le nom correspond au propriétaire inscrit au Registre foncier."],
 ne_correspond_pas:["r","Le nom ne correspond pas au propriétaire inscrit. Ne paie rien avant d'avoir une explication et un mandat écrit du propriétaire."],
 compagnie:["y","Le propriétaire inscrit est une entreprise. Demande la preuve que ton interlocuteur la représente (mandat écrit, registre des entreprises)."],
 introuvable:["y","Nous n'avons pas pu confirmer le propriétaire (lot introuvable ou vente trop récente). Écris-nous pour un remboursement."],
 trouve:["g","Nous avons trouvé le propriétaire inscrit au Registre foncier."]};
const STATUTS={a_payer:["i","Paiement non reçu"],payee:["y","En cours"],terminee:["g","Terminée"],remboursee:["i","Remboursée"]};

const carteApprofondie=()=>(typeof CFG!=="undefined"&&CFG.approfondie===false)?"":`<div class="card offre"><h2>Pas le temps ? On le fait pour toi</h2>
<p>Notre équipe fait toute la vérification et t'envoie un rapport dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="proprio">Vérification complète · ${prixTxt()}</button>
<p class="hint">Paiement par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;

/* Offre visible sur le résultat et l'accueil */
const offreApprofondie=de=>(typeof CFG!=="undefined"&&CFG.approfondie===false)?"":`<div class="card offre offre-res"><p class="offre-eti">Service HabitaScan</p><h2>Vérification complète · ${prixTxt()}</h2>
<p>Sans que tu aies une seule question à poser, notre équipe vérifie l'annonce à fond et t'envoie un rapport écrit, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="${de}">Demander la vérification · ${prixTxt()}</button>
<p class="hint">Paiement sécurisé par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;
function vueApprofondie(F,back){const P=F.P||{};const A=F.VA||(F.VA={adresse:P.adr||F.adr||"",lot:(P.geo&&P.geo.lots&&P.geo.lots[0])||(P.cmp&&P.cmp.lot&&chiffresLot(P.cmp.lot))||"",nom:"",role:F.cession==="oui"?"locataire":null,lien:F.lien||""});
 return `${top(back,"Vérification complète")}
<h2>Vérification complète · ${prixTxt()}</h2>
<p class="soft">Notre équipe vérifie pour toi, puis t'envoie un rapport écrit dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<form class="card" id="f-va" novalidate>
<label>Adresse du logement<input id="va-adresse" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(A.adresse)}"></label>
<label>Numéro de lot (facultatif)<input id="va-lot" inputmode="numeric" autocomplete="off" placeholder="1 234 567" value="${esc(A.lot?fmtLot(A.lot):"")}"></label>
<p class="hint" style="margin-top:0"><b>Aucune question à poser à l'annonceur :</b> l'adresse suffit. Nous trouvons le vrai propriétaire, vérifions les photos et les autres annonces, et te disons quel nom doit figurer sur ${A.role==="locataire"?"l'accord écrit du propriétaire":"le bail"}.</p>
<label>Nom de l'annonceur, si tu l'as (facultatif)<input id="va-nom" autocomplete="off" placeholder="Tel qu'il apparaît dans l'annonce ou les messages" value="${esc(A.nom)}"></label>
<label>Lien de l'annonce (facultatif)<input id="va-lien" type="url" inputmode="url" autocomplete="off" value="${esc(A.lien)}"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="va-ok" style="width:22px;height:22px;min-height:22px;margin-top:2px;flex-shrink:0;appearance:auto;-webkit-appearance:checkbox;accent-color:var(--blue);padding:0">Je comprends que le rapport se base sur les registres publics et le Web à la date de la vérification. Ce n'est pas une garantie : je visite et je signe le bail avant de payer quoi que ce soit.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Payer ${prixTxt()} par carte</button>
<p class="hint">En payant, tu acceptes les ${lienConditions}.</p>
<p class="hint">Le paiement se fait sur la page sécurisée de Stripe : HabitaScan ne voit jamais ton numéro de carte. Nous ne te transmettons aucun document sur le propriétaire, seulement le rapport.</p>
</form>${VAP.demo?`<p class="demo">Démo : aucun paiement réel, tu pourras simuler le paiement.</p>`:""}`}
function lierApprofondie(F){const A=F.VA;
 const garder=()=>{A.adresse=$("#va-adresse").value;A.lot=chiffresLot($("#va-lot").value);A.nom=$("#va-nom").value;A.lien=$("#va-lien").value};
 $("#f-va").onsubmit=async e=>{e.preventDefault();garder();
  if(A.adresse.trim().length<6||!/\d/.test(A.adresse))return err("Entre l'adresse complète, avec le numéro et la ville.");
  if(A.lot&&!/^\d{7,8}$/.test(A.lot))return err("Le numéro de lot a 7 chiffres, par exemple 1 234 567. Laisse vide si tu ne l'as pas.");
  if(!$("#va-ok").checked)return err("Coche la case pour continuer.");
  if(!VAP.demo&&!VCFG.lien)return err("Le paiement n'est pas encore ouvert. Réessaie bientôt.");
  const b=$("#go");b.disabled=true;b.textContent="Préparation du paiement…";
  try{const id=await VAP.creer({adresse:A.adresse.trim(),lot:A.lot||null,nom_interlocuteur:A.nom.trim()||null,role:A.role,lien:A.lien.trim()||null});
   try{MES.noter("demande_creee")}catch(e){}
   if(VAP.demo){nouveauF({});return go("accueil")}
   const u=new URL(VCFG.lien);u.searchParams.set("client_reference_id",id);const c=VAP.courriel();if(c)u.searchParams.set("prefilled_email",c);
   location.href=u.toString()}
  catch(x){b.disabled=false;b.textContent=`Payer ${prixTxt()} par carte`;err("La demande n'a pas pu être créée. Réessaie.")}}}

/* Rapport de la vérification complète */
const RAPPORT={global:{continuer:["g","Tu peux continuer","Rien d'anormal n'a été trouvé. Visite, puis signe le bail avant de payer."],precautions:["y","Continue avec précaution","Obtiens ce qui est indiqué ci-dessous avant de payer quoi que ce soit."],arreter:["r","Arrête","Ne paie rien et ne donne aucun document à cette personne."]},
 entreprise:{lie:["g","L'entreprise propriétaire est active ; ses dirigeants sont indiqués ci-dessous. Le bail doit être à son nom."],non_lie:["y","Le nom de l'annonceur ne figure pas parmi les dirigeants de l'entreprise propriétaire. Le bail doit être au nom de l'entreprise ; si quelqu'un d'autre signe, exige un mandat écrit de l'entreprise."],inactive:["r","L'entreprise propriétaire n'est pas active au registre des entreprises."],non_verifie:["i","Lien avec l'entreprise non vérifié."]},
 photos:{aucune:["g","Les photos n'ont pas été trouvées ailleurs sur le Web."],reutilisees:["r","Les photos apparaissent ailleurs : autre annonce, autre ville ou site d'agence."],non_verifie:["i","Photos non vérifiées (aucune photo fournie)."]},
 doublons:{aucun:["g","Aucune autre annonce du même logement n'a été trouvée."],trouves:["y","Le même logement est annoncé ailleurs, sous un autre nom ou à un autre prix."],non_verifie:["i","Autres annonces non vérifiées."]}};
function htmlRapport(d){const r=d.rapport||{},g=RAPPORT.global[d.verdict_global||r.global];const L=[];
 const ajout=(m,k,det)=>{const x=m&&m[k];if(x)L.push(`<li><span class="dot ${x[0]}"></span><div>${x[1]}${det?`<div class="law">${esc(det)}</div>`:""}</div></li>`)};
 const reg=r.registre||{},e=r.entreprise||{};if(reg.nom)L.push(`<li><span class="dot i"></span><div><b>Au moment de signer, le bail doit être au nom de : ${esc(reg.nom)}</b>${d.role==="locataire"?" (c'est aussi ce nom qui doit signer l'accord écrit de cession)":""}. Sinon, ne paie pas avant d'avoir un mandat écrit de ce propriétaire.</div></li>`);
 L.push(`<li><span class="dot g"></span><div><b>Paie seulement par chèque ou virement au nom ${reg.nom?`de ${esc(reg.nom)}`:"du propriétaire inscrit au Registre foncier"}.</b> Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne. Si un gestionnaire perçoit les loyers, demande d'abord le mandat écrit du propriétaire.</div></li>`);if((reg.resultat||d.verdict)==="compagnie"&&e.applicable)L.push(`<li><span class="dot i"></span><div>Le propriétaire inscrit au Registre foncier est une entreprise.${reg.details?`<div class="law">${esc(reg.details)}</div>`:""}</div></li>`);else ajout(VERDICTS,reg.resultat||d.verdict,reg.details);
 if(e.applicable){ajout(RAPPORT.entreprise,e.lien,[e.nom,e.neq?`NEQ ${e.neq}`:"",e.details].filter(Boolean).join(" · "))}
 ajout(RAPPORT.photos,(r.photos||{}).resultat,(r.photos||{}).details);ajout(RAPPORT.doublons,(r.doublons||{}).resultat,(r.doublons||{}).details);
 return `${g?`<div class="verdict ${g[0]}"><strong>${g[1]}</strong><span>${g[2]}</span></div>`:""}
${L.length?`<ul class="reasons">${L.join("")}</ul>`:""}
${r.recommandations||d.note?`<div class="rule" style="text-align:left"><b>Ce qu'on te recommande</b><br>${esc(r.recommandations||d.note)}</div>`:""}
${d.termine_le?`<p class="hint">Rapport du ${esc(new Date(d.termine_le).toLocaleDateString("fr-CA",{dateStyle:"long"}))}, selon les registres publics et le Web à cette date.</p>`:""}`}

/* Liste « Mes vérifications complètes » sur l'accueil */
const blocMesApprofondies=`<div id="mes-approf"></div>`;
async function remplirMesApprofondies(){const el=$("#mes-approf");if(!el)return;
 const paye=/[?&]paye=1/.test(location.search);if(paye)try{history.replaceState(null,"",location.pathname)}catch(e){}
 let L=[];try{L=await VAP.mes()}catch(e){}
 if(!$("#mes-approf"))return;
 if(!L.length&&!paye){el.innerHTML="";return}
 el.innerHTML=`<div class="card"><h2>Vérifications complètes</h2>${paye?`<p class="lu">Paiement reçu. Ton rapport arrive ici en ${VCFG.delai} h maximum.</p>`:""}
${L.map(d=>{const s=STATUTS[d.statut]||["i",d.statut];const v=d.verdict&&VERDICTS[d.verdict];
 return `<div class="demande"><p><b>${esc(d.adresse)}</b><span class="tag ${s[0]}">${s[1]}</span></p>
${d.statut==="terminee"?(d.rapport||d.verdict_global?htmlRapport(d):v?`<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note?`<div class="law">${esc(d.note)}</div>`:""}</div></li></ul>`:""):""}
${d.statut==="payee"?`<p class="hint">Rapport au plus tard ${VCFG.delai} h après le paiement.</p>${VAP.demo?`<button type="button" class="lienbtn" data-simrapport="${esc(d.id)}">(Démo) Voir un exemple de rapport</button>`:""}`:""}
${d.statut==="a_payer"&&VAP.demo?`<button type="button" class="lienbtn" data-simpaye="${esc(d.id)}">(Démo) Simuler le paiement</button>`:""}</div>`}).join("")}</div>`;
 el.querySelectorAll("[data-simpaye]").forEach(b=>b.onclick=async()=>{await VAP.simulerPaiement(b.dataset.simpaye);remplirMesApprofondies()});
 el.querySelectorAll("[data-simrapport]").forEach(b=>b.onclick=async()=>{await VAP.simulerRapport(b.dataset.simrapport);remplirMesApprofondies()})}

/* Onglet admin « Demandes » */
async function remplirAdminDemandes(el){const L=await VAP.adminListe();if(!el.isConnected)return;
 el.innerHTML=L.length?L.map(d=>{const s=STATUTS[d.statut]||["i",d.statut];const v=d.verdict&&VERDICTS[d.verdict];
 return `<div class="card"><p><b>${esc(d.adresse)}</b> <span class="tag ${s[0]}">${s[1]}</span></p>
<p class="hint">${esc(d.contact||"")} · demandée le ${esc(String(d.created_at||"").slice(0,16).replace("T"," "))}${d.paye_le?` · payée le ${esc(String(d.paye_le).slice(0,16).replace("T"," "))}`:""}${d.montant?` · ${esc(String(d.montant))} $`:""}</p>
<p>Interlocuteur : <b>${esc(d.nom_interlocuteur)}</b> (${d.role==="gestionnaire"?"dit être gestionnaire":d.role==="locataire"?"propriétaire nommé par le locataire":"dit être propriétaire"})${d.lot?` · lot <span class="num">${esc(fmtLot(d.lot))}</span>`:""}</p>
${d.lien?`<p class="hint">${lienExt(esc(d.lien),"Annonce")}</p>`:""}
${d.statut==="terminee"&&(d.rapport||d.verdict_global)?htmlRapport(d):v?`<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note?`<div class="law">${esc(d.note)}</div>`:""}</div></li></ul>`:""}
${d.statut==="a_payer"?`<button class="btn ghost" data-maj="${esc(d.id)}" data-statut="payee">Marquer payée (vu dans Stripe)</button>`:""}
${d.statut==="payee"?`${ADM.console?`<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Remplir le rapport dans la console ↗</a>`:""}<p class="hint">Le rapport complet (registre, entreprise, photos, autres annonces, verdict) se remplit dans la console, sur ordinateur.</p>`:""}
${["payee","terminee"].includes(d.statut)?`<button type="button" class="lienbtn" data-maj="${esc(d.id)}" data-statut="remboursee">Marquer remboursée</button>`:""}</div>`}).join(""):`<div class="card"><p>Aucune demande.</p></div>`;
 el.querySelectorAll("[data-maj]").forEach(b=>b.onclick=async()=>{const id=b.dataset.maj,n=el.querySelector(`[data-note="${id}"]`);b.disabled=true;
  try{await VAP.adminMaj(id,b.dataset.statut,b.dataset.verdict||null,n?n.value.trim():"");remplirAdminDemandes(el)}catch(x){b.disabled=false;b.textContent="Erreur, réessaie"}})}

function bindPlus4(v){
 if(v==="approfondie")lierApprofondie(F);
 if(v==="accueil")remplirMesApprofondies();
 if(v==="admin"&&(F.onglet==="demandes")){const el=$("#adm");if(el)remplirAdminDemandes(el).catch(()=>{el.innerHTML=`<p class="err">Chargement impossible.</p>`})}
 if(v==="admin"&&(F.onglet||"chiffres")==="montants"){setTimeout(()=>{const el=$("#adm");if(!el||el.querySelector("#va-lienpay"))return;
  el.insertAdjacentHTML("afterbegin",`<div class="card"><h2>Paiement Stripe</h2><label>Lien de paiement Stripe (Payment Link)<span class="ligne"><input id="va-lienpay" inputmode="url" placeholder="https://buy.stripe.com/…" value="${esc(VCFG.lien)}"><button type="button" class="btn ghost petit" id="va-sauverlien">Enregistrer</button></span></label><p class="hint">Le prix et le délai se changent plus bas, dans « Budget ». Le prix affiché doit être le même que celui du lien Stripe.</p></div>`);
  $("#va-sauverlien").onclick=async()=>{const val=$("#va-lienpay").value.trim();if(val&&!/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(val)){$("#va-sauverlien").textContent="Lien invalide";return}
   try{await VAP.sauverTexte("lien_paiement",val);VCFG.lien=val;$("#va-sauverlien").textContent="Enregistré"}catch(x){$("#va-sauverlien").textContent="Erreur"}}},0)}
}
const CSS_PLUS4=""; /* styles déplacés dans app.css */
/* ===== HabitaScan : conditions d'utilisation, mesure d'usage anonyme, erreurs (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, lienExt, RESPONSABLE, VCFG, prixTxt, L_CAI
   et d'un adaptateur MES : MES.noter(type) ; MES.erreur(message, vue) ; MES.admin() → {j7, j30, payees30, erreurs7, dernieres} */

/* ---------- Conditions d'utilisation ---------- */
const L_LPC="https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1";
function vueConditions(back){const R=RESPONSABLE;
 const s=(t,c)=>`<div class="card"><h2>${t}</h2>${c}</div>`;
 return `${top(back,"Conditions")}
<h2>Conditions d'utilisation</h2>
<p class="hint">En vigueur le ${R.vigueur}. HabitaScan est exploité par ${R.entreprise}, ${R.adresse}. Courriel : ${R.courriel}.</p>
${s("1. Ce que fait HabitaScan","<p>HabitaScan aide à repérer les signes de fraude dans une annonce de logement, à vérifier qui est le propriétaire, à estimer un budget d'installation et à vérifier un entrepreneur en rénovation. Les résultats sont calculés à partir de règles publiques, de données gouvernementales et de ce que tu entres.</p>")}
${s("2. Ce n'est pas une garantie","<p><b>Un résultat vert ne garantit pas qu'une annonce est honnête,</b> et un résultat rouge ne prouve pas une fraude. HabitaScan ne remplace ni un avocat, ni un notaire, ni le Tribunal administratif du logement. Avant de payer quoi que ce soit : visite le logement, confirme le propriétaire et signe le bail.</p>")}
${s("3. Ton compte","<p>Tu dois avoir 14 ans ou plus. Ton compte est personnel : garde l'accès à ton courriel ou à ton cellulaire pour toi. Tu peux supprimer ton compte en tout temps depuis l'accueil.</p>")}
${s("4. Vérification complète payante",`<ul class="liste"><li>Prix : ${prixTxt()}, taxes incluses s'il y a lieu, payé par carte sur la page sécurisée de Stripe.</li>
<li>Nous vérifions : le propriétaire au Registre foncier ; si c'est une entreprise, son statut et ses dirigeants au registre des entreprises ; les photos de l'annonce ; les autres annonces du même logement. Tu reçois un rapport écrit avec un verdict et le nom du propriétaire inscrit (information publique du Registre foncier), à retrouver sur ton bail. Jamais de document sur le propriétaire.</li>
<li>Délai : ${VCFG.delai} h maximum après le paiement.</li>
<li><b>Remboursement complet</b> si nous ne livrons pas le rapport dans ce délai, ou si nous ne pouvons pas identifier le propriétaire. Écris-nous à ${R.courriel}.</li>
<li>Le rapport reflète les registres publics et le Web au moment de la vérification. Une vente récente peut ne pas encore être publiée, et une recherche sur le Web ne trouve pas tout.</li></ul>`)}
${s("5. Signalements","<p>Signale seulement une annonce que tu crois vraiment frauduleuse, et choisis le bon motif. Un faux signalement peut nuire à une personne honnête : nous pouvons retirer un signalement et fermer un compte qui en abuse.</p>")}
${s("6. Utilisation interdite","<ul class=\"liste\"><li>Utiliser l'app pour harceler, ficher ou retrouver une personne.</li><li>Collecter ou revendre automatiquement le contenu de l'app (robots, aspiration).</li><li>Contourner les limites d'usage ou la sécurité.</li><li>Entrer de fausses informations pour nuire à quelqu'un.</li></ul><p class=\"hint\">Des limites quotidiennes s'appliquent aux recherches automatiques, pour garder le service gratuit pour tout le monde.</p>")}
${s("7. Responsabilité",`<p>Nous faisons tout pour que l'information soit exacte et à jour, mais des données publiques peuvent contenir des erreurs ou dater. Dans les limites permises par la ${lienExt(L_LPC,"Loi sur la protection du consommateur")}, nous ne sommes pas responsables d'une décision prise seulement sur la base d'un résultat de l'app. Rien dans ces conditions ne limite les droits que cette loi te donne.</p>`)}
${s("8. Contenu et marque","<p>Le nom HabitaScan, le logo et le code de l'app nous appartiennent. Les données gouvernementales utilisées restent soumises à leurs licences (par exemple CC-BY 4.0), et leurs sources sont citées dans l'app.</p>")}
${s("9. Modifications et droit applicable",`<p>Si ces conditions changent, nous l'indiquons dans l'app. Elles sont régies par les lois du Québec. En cas de désaccord, écris-nous d'abord à ${R.courriel}. Pour tes renseignements personnels, consulte la <button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>.</p>`)}`}
const lienConditions=`<button type="button" class="lienbtn" data-go="conditions">conditions d'utilisation</button>`;

/* ---------- Mesure d'usage anonyme ---------- */
const VUES_MESUREES=["bienvenue","inscription","accueil","verifier","resultat","proprio","budget","trouver","approfondie","reno","renoResultat","victime","conditions","confidentialite"];
let derniereVue="";
function bindPlus5(v){derniereVue=v;
 if(VUES_MESUREES.includes(v))try{MES.noter("vue_"+v)}catch(e){}
 if(v==="admin"&&(F.onglet||"chiffres")==="chiffres")remplirMesure();
}
/* Erreurs techniques : 5 par session au maximum, message court, sans données de l'utilisateur */
let nbErreurs=0;
function noterErreur(m){if(++nbErreurs>5)return;try{MES.erreur(String(m||"").slice(0,300),derniereVue)}catch(e){}}
window.addEventListener("error",e=>noterErreur((e.message||"erreur")+(e.filename?` @${String(e.filename).split("/").pop()}:${e.lineno}`:"")));
window.addEventListener("unhandledrejection",e=>noterErreur("promesse : "+((e.reason&&e.reason.message)||e.reason||"")));

/* Entonnoir dans l'onglet Chiffres de l'admin */
const ETAPES=[["vue_bienvenue","Écran d'accueil (avant connexion)"],["vue_accueil","Accueil (connecté)"],["vue_verifier","Vérification commencée"],["vue_resultat","Vérification terminée"],
 ["vue_proprio","Vérifier le propriétaire"],["vue_approfondie","Offre payante ouverte"],["demande_creee","Demande payante créée"],["vue_budget","Budget"],["vue_trouver","Trouver un logement"],["recherche_lancee","Recherches lancées"],["vue_reno","Vérif-Réno"]];
async function remplirMesure(){let M;try{M=await MES.admin()}catch(e){return}
 const el=$("#adm");if(!el||!M||el.querySelector("#mesure"))return;
 const n=(o,k)=>Number((o||{})[k]||0).toLocaleString("fr-CA");
 el.insertAdjacentHTML("beforeend",`<div class="card" id="mesure"><h2>Utilisation (anonyme)</h2>
<table class="tvilles"><thead><tr><th>Étape</th><th>7 jours</th><th>30 jours</th></tr></thead><tbody>
${ETAPES.map(([k,l])=>`<tr><td>${l}</td><td class="num">${n(M.j7,k)}</td><td class="num">${n(M.j30,k)}</td></tr>`).join("")}
<tr><td><b>Vérifications payées</b></td><td></td><td class="num"><b>${Number(M.payees30||0).toLocaleString("fr-CA")}</b></td></tr></tbody></table>
<p class="hint">Compte d'ouvertures d'écrans, sans lien avec les comptes. Le taux à surveiller : « Vérification terminée » ÷ « Vérification commencée ».</p></div>
<div class="card"><h2>Erreurs techniques</h2><p>${Number(M.erreurs7||0)} erreur${M.erreurs7>1?"s":""} sur 7 jours.</p>
${(M.dernieres||[]).length?`<ul class="liste">${M.dernieres.map(e=>`<li><span class="hint">${esc(String(e.cree_le).slice(0,16).replace("T"," "))} · ${esc(e.vue||"")}</span><br>${esc(e.message)}</li>`).join("")}</ul>`:`<p class="hint">Aucune erreur.</p>`}</div>`)}
const CSS_PLUS5=""; /* styles déplacés dans app.css */
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

/* Adaptateur vérification approfondie (Supabase : table demandes_verif, paiement par lien Stripe, webhook stripe-webhook) */
const VAP={demo:false,courriel:()=>(PROFIL&&PROFIL.contact&&PROFIL.contact.includes("@"))?PROFIL.contact:"",
 async creer(d){const {data,error}=await sb.from("demandes_verif").insert(d).select("id").single();if(error)throw error;return data.id},
 async mes(){if(!SESSION)return [];const {data,error}=await sb.from("demandes_verif").select("id,adresse,statut,verdict,note,created_at,paye_le,termine_le,rapport,verdict_global").order("created_at",{ascending:false}).limit(10);if(error)throw error;return data||[]},
 adminListe:async()=>(await rpc("admin_demandes_liste",{p_statut:""}))||[],
 adminMaj:(id,statut,verdict,note)=>rpc("admin_maj_demande",{p_id:id,p_statut:statut,p_verdict:verdict,p_note:note||""}),
 async sauverTexte(cle,valeur){const {error}=await sb.from("parametres_texte").upsert({cle,valeur,maj_le:new Date().toISOString()});if(error)throw error}};
async function chargerTextes(){try{const {data}=await sb.from("parametres_texte").select("cle,valeur");(data||[]).forEach(r=>{if(r.cle==="lien_paiement")VCFG.lien=r.valeur||"";if(r.cle==="message_accueil")CFG.message=r.valeur||"";if(r.cle==="courriel_support")CFG.support=r.valeur||""})}catch(e){}}
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS4+"</style>");

/* Adaptateur mesure (Supabase : fonctions noter, noter_erreur, admin_mesure) */
const MES={noter(t){sb.rpc("noter",{p_type:t}).then(()=>{},()=>{})},erreur(m,v){sb.rpc("noter_erreur",{p_message:m,p_vue:v||null,p_agent:navigator.userAgent.slice(0,160)}).then(()=>{},()=>{})},admin:()=>rpc("admin_mesure")};
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS5+"</style>");
/* ===== HabitaScan : analyse intelligente (IA) de l'annonce et de la conversation (commun démo + Supabase) =====
   L'IA extrait les champs et repère les signaux, avec citation. Le verdict reste calculé par les règles.
   Dépend de : F, $, app, go, esc, keep, LOYERS, appliquerLecture, MES ; adaptateur IA_ADAPT : {dispo, analyser({images, texte})} */
const CLE_IA="hs_ia";
const iaActif=()=>{try{return localStorage.getItem(CLE_IA)==="1"&&IA_ADAPT.dispo}catch(e){return false}};
const SIGNAUX_IA={argent_avant_bail:"Argent demandé avant la signature du bail",depot:"Dépôt ou frais de réservation",paiement_suspect:"Moyen de paiement typique des fraudes",
 proprietaire_absent:"Propriétaire « à l'étranger » ou absent",refus_visite:"Visite refusée ou repoussée",urgence:"Pression pour décider vite",
 changement_plateforme:"Demande de continuer sur une autre messagerie",pieces_identite_demandees:"Documents personnels demandés trop tôt",
 prix_anormal_annonce:"Prix présenté comme exceptionnellement bas",autre:"Autre élément inhabituel"};
const blocIA=()=>IA_ADAPT.dispo?(!iaChoisi()?"":`<label class="ia-opt"><input type="checkbox" id="ia-ok" ${iaActif()?"checked":""}><span><b>Analyse intelligente</b> (IA)<span class="hint">Comprend mieux les captures et la conversation, aussi en anglais. Les images et le texte sont envoyés à Anthropic pour l'analyse, puis oubliés par HabitaScan.</span></span></label>`)
 :`<p class="hint">L'analyse intelligente (IA) est offerte dans la vraie app, pas dans cette démo.</p>`;
/* Réduit une capture à 1 280 px de large au maximum, en JPEG, pour limiter l'envoi */
function reduireImage(source){return new Promise((ok,ko)=>{const im=new Image();const dataUrl=typeof source==="string"?source:URL.createObjectURL(source);im.onload=()=>{const k=Math.min(1,1280/Math.max(im.width,1));
 const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
 ok(c.toDataURL("image/jpeg",0.8).split(",")[1])};im.onerror=ko;im.src=dataUrl})}
async function analyserIA(captures,texte){const images=[];for(const c of (captures||[]).slice(0,4))images.push(await reduireImage(c));
 return IA_ADAPT.analyser({images,texte:String(texte||"").slice(0,8000)})}
function appliquerIA(r){F.ia=r;const villes=Object.keys(LOYERS);
 if(r.prix)F.prix=String(r.prix);
 if(r.chambres)F.ch=String(Math.min(r.chambres,3));
 if(r.ville){const v=villes.find(x=>x.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase()===r.ville.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase());F.ville=v||"Autre"}
 if(r.cession!=null)F.cession=r.cession?"oui":"non";
 if(r.adresse&&!F.adr)F.adr=r.adresse;
 const lus=[r.prix?`${r.prix} $`:"",r.ville||"",r.chambres?`${r.chambres} ch.`:"",r.cession?"cession de bail":""].filter(Boolean).join(", ");
 const n=(r.signaux||[]).length;
 F.lu=`<b>Lu par l'IA :</b> ${esc((lus||"aucune information claire").replace(/\.$/,""))}. ${n?`<b>${n>1?n+" signaux repérés":"1 signal repéré"}</b> : tu les verras dans le résultat.`:"Aucun signal d'arnaque repéré dans le texte."} Vérifie les champs et réponds aux questions.`}
function itemsIA(F){const r=F.ia;if(!r)return [];const it=(r.signaux||[]).map(s=>({c:"y",t:`<b>${esc(SIGNAUX_IA[s.type]||"Élément inhabituel")}</b> : « ${esc(s.extrait)} »${s.explication?` ${esc(s.explication)}`:""}`,law:"Repéré par l'analyse intelligente (IA). Vérifie dans l'annonce."}));
 if(r.resume)it.push({c:"i",t:`<b>Résumé de l'IA :</b> ${esc(r.resume)}`});return it}
function bindPlus6(v){if(v!=="verifier")return;const c=$("#ia-ok");if(c)c.onchange=()=>{try{localStorage.setItem(CLE_IA,c.checked?"1":"0")}catch(e){}}}
/* Lance l'analyse IA sur les captures (remplace la lecture locale) ; en cas d'échec, revient à la lecture locale */
function lancerIA(texteSeul){const n=(F.captures||[]).length;F.lu=null;
 const f=$("#f-ver");if(f)f.insertAdjacentHTML("afterbegin",`<p class="lu" role="status">Analyse intelligente ${texteSeul?"du texte":n>1?`de ${n} captures`:"de la capture"}…</p>`);
 analyserIA(texteSeul?[]:F.captures,`${F.annonce||""}\n${F.txt||""}`)
 .then(r=>{if($("#f-ver"))keep();appliquerIA(r);try{MES.noter("ia_analyse")}catch(e){};go("verifier")})
 .catch(x=>{try{MES.noter("ia_echec")}catch(e){};F.iaOff=true;
  F.lu=x&&x.message==="quota"?"Limite d'analyses IA atteinte pour aujourd'hui : lecture simple utilisée.":"L'analyse intelligente n'a pas fonctionné : lecture simple utilisée.";
  if(!texteSeul)F.ocr=true;if($("#f-ver"))go("verifier")})}
const CSS_PLUS6=""; /* styles déplacés dans app.css */

/* Adaptateur IA (Supabase : fonction analyser-annonce → Claude Haiku 5.5) */
const IA_ADAPT={get dispo(){return CFG.ia},async analyser(p){const {data,error}=await sb.functions.invoke("analyser-annonce",{body:p});
 if(error){if(error.context&&error.context.status===429)throw new Error("quota");throw error}if(!data||data.error)throw new Error((data&&data.error)||"ia");return data}};
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS6+"</style>");
/* ===== HabitaScan : historique détaillé, mon compte, lieu de connexion (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, money, top, lienExt, TRAVAUX, formatLicence, ADM, lienConditions, lienConfidentialite
   Adaptateurs :
   HIS  : liste() → [{id, module:"logement"|"reno", date, ville, ch, prix, c, lien, travaux, licence, raisons:[{c,t,law}]}] ; supprimer(id) → Promise
   CPT  : courriel() ; statut() → {t, couleur}
   LIEU : dispo ; actif() → bool ; definir(bool) → Promise ; demo (bool)
   ADM  : connexions() ; lieuxResume() ; partageStats() */
const TITRE_VERDICT={logement:{r:"Ne paie pas",y:"Visite d'abord, puis vérifie le propriétaire",g:"Aucun signal. Tu peux visiter."},
 reno:{r:"Ne signe pas, ne paie pas",y:"Prudence",g:"Aucun signal d'alarme"}};
const TAG_VERDICT={logement:{r:"Ne paie pas",y:"Visite d'abord",g:"Aucun signal"},reno:{r:"Ne pas signer",y:"Prudence",g:"Aucun signal"}};
const REGLE_VERDICT={logement:{r:"N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.",y:"Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.",g:"Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt."},
 reno:{r:"Ne signe rien et ne verse aucun acompte.",y:"Vérifie la licence et les plaintes avant de signer.",g:"Paie selon l'avancement des travaux, jamais tout d'avance."}};
const PROVINCES={QC:"Québec",ON:"Ontario",NB:"Nouveau-Brunswick",NS:"Nouvelle-Écosse",PE:"Île-du-Prince-Édouard",NL:"Terre-Neuve-et-Labrador",MB:"Manitoba",SK:"Saskatchewan",AB:"Alberta",BC:"Colombie-Britannique",YT:"Yukon",NT:"Territoires du Nord-Ouest",NU:"Nunavut"};
const lieuTexte=x=>[x.ville,x.pays==="CA"?(PROVINCES[x.region]||x.region):x.region,x.pays&&x.pays!=="CA"?x.pays:""].filter(Boolean).join(", ")||"Inconnu";
/* Texte enregistré : on échappe tout, puis on ne réautorise que <b>, <strong>, <em> et les liens https */
function nettoyerHTML(s){let h=esc(String(s||""));
 h=h.replace(/&lt;(\/?)(b|strong|em)&gt;/g,"<$1$2>");
 h=h.replace(/&lt;a href=&quot;(https:\/\/[^\s"<>]*?)&quot;.*?&gt;/g,(m,u)=>`<a href="${u}" target="_blank" rel="noopener">`).replace(/&lt;\/a&gt;/g,"</a>");
 if((h.match(/<a /g)||[]).length>(h.match(/<\/a>/g)||[]).length)h+="</a>";return h}
const dateCourte=d=>{if(!d)return "";try{return new Date(d).toLocaleDateString("fr-CA",{day:"numeric",month:"short",year:"numeric"})}catch(e){return ""}};
const dateLongue=d=>{if(!d)return "";try{return new Date(d).toLocaleString("fr-CA",{dateStyle:"long",timeStyle:"short"})}catch(e){return ""}};
const nomTravaux=k=>((TRAVAUX[k]||{l:"Travaux"}).l.split(/ \(|,/)[0]);
function titreVerif(x){return x.module==="reno"?`Réno · ${esc(nomTravaux(x.travaux))}`:`${esc(x.ville||"Ville inconnue")} · ${x.ch==3?"3+":esc(x.ch??"?")} ch.`}
function sousTitreVerif(x){const p=[dateCourte(x.date)];
 if(x.module==="reno"){if(x.licence)p.push(`RBQ ${esc(formatLicence(x.licence))}`)}else if(x.prix)p.push(money(+x.prix)+"/mois");return p.filter(Boolean).join(" · ")}
const ligneVerif=x=>`<button type="button" class="hrow" data-verif="${esc(x.id)}" aria-label="Voir le détail : ${titreVerif(x).replace(/<[^>]+>/g,"")}">
<span class="hdot ${x.c}"></span><span class="hmain"><b>${titreVerif(x)}</b><small>${sousTitreVerif(x)}</small></span><span class="tag ${x.c}">${(TAG_VERDICT[x.module]||TAG_VERDICT.logement)[x.c]||""}</span><span class="chev" aria-hidden="true">›</span></button>`;

/* Carte d'accueil : les 3 dernières, cliquables */
function blocHistorique(){const L=HIS.liste();
 return `<div class="card"><div class="card-tete"><h2>Mes vérifications</h2>${L.length?`<button type="button" class="lienbtn" data-go="historique">Tout voir${L.length>3?` (${L.length})`:""}</button>`:""}</div>
${L.length?`<div class="hlist">${L.slice(0,3).map(ligneVerif).join("")}</div>`:`<div class="vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Chaque annonce que tu vérifies est gardée ici, avec son résultat complet.</p></div>`}</div>`}

function vueHistorique(){const L=HIS.liste(),f=F.hfiltre||"tout";
 const nbL=L.filter(x=>x.module!=="reno").length,nbR=L.length-nbL;
 const V=L.filter(x=>f==="tout"||(f==="reno"?x.module==="reno":x.module!=="reno"));
 const o=(k,t,n)=>`<button type="button" data-hfiltre="${k}" aria-pressed="${f===k}">${t} <span class="num">${n}</span></button>`;
 return `${top("accueil","Mes vérifications")}
<h1>Mes vérifications</h1><p class="soft">Touche une vérification pour revoir son résultat complet.</p>
${L.length?`${nbR?`<div class="seg seg3" role="group" aria-label="Filtrer">${o("tout","Toutes",L.length)}${o("logement","Logement",nbL)}${o("reno","Réno",nbR)}</div>`:""}
<div class="card"><div class="hlist">${V.map(ligneVerif).join("")||`<p class="soft">Rien dans cette catégorie.</p>`}</div></div>`
:`<div class="card vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Vérifie une annonce pour la retrouver ici.</p><button class="btn" data-go="verifier">Vérifier une annonce</button></div>`}`}

function vueDetailVerif(){const x=HIS.liste().find(v=>String(v.id)===String(F.verifId));const retour=F.retourVerif||"historique";
 if(!x)return `${top(retour,"Détail")}<div class="card vide"><p><b>Cette vérification n'existe plus.</b></p><button class="btn" data-go="historique">Mes vérifications</button></div>`;
 const m=x.module==="reno"?"reno":"logement",R=x.raisons||[];
 const ligne=(k,v)=>v?`<div><dt>${k}</dt><dd>${v}</dd></div>`:"";
 const lienOk=x.lien&&/^https?:\/\//i.test(x.lien);
 return `${top(retour,"Détail")}
<div class="verdict ${x.c}"><strong>${TITRE_VERDICT[m][x.c]||""}</strong><span>${titreVerif(x)}</span></div>
<div class="card"><h2>Détails</h2><dl class="details">
${ligne("Vérifiée le",esc(dateLongue(x.date)))}
${m==="logement"?ligne("Ville",esc(x.ville||""))+ligne("Chambres",x.ch==3?"3 et plus":esc(x.ch??""))+ligne("Loyer demandé",x.prix?`<span class="num">${money(+x.prix)}</span> par mois`:"")+ligne("Annonce",lienOk?lienExt(esc(x.lien),"Ouvrir l'annonce ↗"):"Aucun lien fourni")
:ligne("Travaux",esc((TRAVAUX[x.travaux]||{l:""}).l))+ligne("Licence RBQ",x.licence?`<span class="num">${esc(formatLicence(x.licence))}</span>`:"Non fournie")}
${ligne("Référence",`<span class="num">${esc(String(x.id).slice(0,8).toUpperCase())}</span>`)}
</dl></div>
<div class="card"><h2>Ce que l'app a vérifié</h2>${R.length?`<ul class="reasons">${R.map(i=>`<li><span class="dot ${esc(i.c)}"></span><div>${nettoyerHTML(i.t)}${i.law?`<div class="law">${nettoyerHTML(i.law)}</div>`:""}</div></li>`).join("")}</ul>`:`<p class="soft">Le détail n'a pas été conservé pour cette ancienne vérification.</p>`}</div>
<p class="rule">${REGLE_VERDICT[m][x.c]||""}</p>${m==="logement"&&x.c!=="r"?`<p class="rule paiement">${REGLE_PAIEMENT}</p>`:""}
<p class="hint">Résultat calculé le ${esc(dateCourte(x.date))} avec les informations fournies à ce moment. Une annonce peut changer : vérifie-la de nouveau avant de payer.</p>
${m==="logement"?`<button class="btn" data-go="verifier">Vérifier une autre annonce</button>`:`<button class="btn" data-go="reno">Vérifier un autre entrepreneur</button>`}
<button class="btn ghost danger-txt" id="h-suppr">Retirer de mon historique</button>
<p class="err" id="err" role="alert"></p>`}

/* Mon compte */
function vueCompte(){const st=CPT.statut();const nbH=HIS.liste().length;
 return `${top("accueil","Mon compte")}
<div class="card compte-tete"><span class="avatar" aria-hidden="true">${esc((CPT.courriel()||"?").charAt(0).toUpperCase())}</span><div><b>${esc(CPT.courriel()||"")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></div></div>
${PROFIL&&["aucune","refusee"].includes(PROFIL.identite_statut||"aucune")?`<button class="btn ghost" data-go="identite">Confirmer mon identité<small>Une photo de ta pièce d'identité. Nécessaire seulement pour signaler une annonce.</small></button>`:PROFIL&&PROFIL.identite_statut==="en_attente"?`<p class="hint centre">Ta pièce d'identité est en vérification par notre équipe.</p>`:""}
<div class="card menu">
<button type="button" class="mrow" data-go="historique"><span>Mes vérifications</span><span class="soft num">${nbH}</span><span class="chev">›</span></button>
${ADM.estAdmin()?`<button type="button" class="mrow" data-go="admin" id="nouvA"><span>Espace admin</span><span class="soft">Réservé</span><span class="chev">›</span></button>`:""}
</div>
${LIEU.dispo?`<div class="card"><h2>Confidentialité</h2>
<label class="interrupteur"><span><b>Partager ma ville approximative de connexion</b><small>Désactivé par défaut. Si tu l'actives, nous gardons la ville et la région déduites de ton adresse IP (pas ton adresse, pas ta position GPS) à chaque connexion, pendant 90 jours au plus. Seuls les administrateurs la voient, pour détecter l'usage frauduleux d'un compte et savoir quelles régions nous servons. Tu peux le désactiver en tout temps : l'historique de lieux est alors effacé.</small></span>
<input type="checkbox" role="switch" id="lieu-ok" ${LIEU.actif()?"checked":""}></label><p class="hint" id="lieu-msg" aria-live="polite"></p></div>`:""}
${IA_ADAPT.dispo?`<div class="card"><label class="interrupteur"><span><b>Analyse intelligente (IA)</b><small>Comprend le sens des annonces et des conversations, pas seulement des mots. Le texte et les captures sont envoyés à Anthropic (États-Unis) pour l'analyse, puis oubliés. Désactivée tant que tu ne l'actives pas.</small></span><input type="checkbox" role="switch" id="ia-compte" ${iaActif()?"checked":""}></label></div>`:""}
<div class="card menu">
<button type="button" class="mrow" data-go="conditions"><span>Conditions d'utilisation</span><span class="chev">›</span></button>
<button type="button" class="mrow" data-go="confidentialite"><span>Politique de confidentialité</span><span class="chev">›</span></button>
<button type="button" class="mrow" data-go="victime"><span>J'ai été victime d'une arnaque</span><span class="chev">›</span></button>
${typeof CFG!=="undefined"?`<a class="mrow" href="/a-propos" style="text-decoration:none"><span>Qui sommes-nous</span><span class="chev">›</span></a>`:""}
${typeof CFG!=="undefined"&&CFG.support?`<a class="mrow" href="mailto:${esc(CFG.support)}" style="text-decoration:none"><span>Nous joindre</span><span class="soft">${esc(CFG.support)}</span><span class="chev">›</span></a>`:""}
</div>
<button class="btn ghost" id="deco">Se déconnecter</button>
<button type="button" class="lienbtn centre danger-txt" data-go="supprimer">Supprimer mon compte et mes données</button>`}

/* Invitation unique et non cochée (Loi 25, art. 8.1) */
const CLE_LIEU_REP="hs_lieu_rep";
function blocInvitationLieu(){if(!LIEU.dispo||LIEU.actif())return "";try{if(localStorage.getItem(CLE_LIEU_REP))return ""}catch(e){return ""}
 return `<div class="card invite" id="inv-lieu"><p><b>Protéger ton compte</b></p><p class="soft">Veux-tu partager ta ville approximative de connexion ? Elle nous aide à repérer une connexion inhabituelle. Pas de GPS, gardée 90 jours au plus, visible seulement par les administrateurs. C'est désactivé tant que tu ne l'actives pas.</p>
<div class="duo"><button class="btn" id="inv-oui">Activer</button><button class="btn ghost" id="inv-non">Non merci</button></div></div>`}

/* Onglet admin « Connexions » */
async function remplirAdminConnexions(el){const [s,res,L]=await Promise.all([ADM.partageStats(),ADM.lieuxResume(),ADM.connexions()]);if(!$("#adm"))return;
 const q=(F.qcx||"").toLowerCase();
 const filtre=L.filter(x=>!q||[x.contact,x.ville,x.region,x.pays].join(" ").toLowerCase().includes(q)).sort((a,b)=>new Date(b.derniere)-new Date(a.derniere));
 el.innerHTML=`<div class="tuiles"><div class="tuile fort"><span>Partagent leur ville</span><b class="num">${nb(s.partagent)}</b></div><div class="tuile"><span>Comptes</span><b class="num">${nb(s.total)}</b></div></div>
<p class="hint">Seules les personnes qui ont activé le partage apparaissent. Ville déduite de l'adresse IP par l'hébergeur : approximative (un réseau mobile ou un VPN peut indiquer une autre ville).</p>
<div class="card"><h2>Par ville, 30 derniers jours</h2>${res.length?`<div class="hist">${res.map(r=>`<div><span>${esc(lieuTexte({ville:r.ville,region:r.region,pays:"CA"}))}</span><span class="num">${nb(r.personnes)} pers.</span></div>`).join("")}</div>`:`<p class="soft">Aucune donnée.</p>`}</div>
<div class="card"><h2>Dernière connexion par personne</h2>
<label class="sr" for="qcx">Rechercher</label><input id="qcx" type="search" placeholder="Courriel ou ville" value="${esc(F.qcx||"")}">
${filtre.length?`<div class="cxlist">${filtre.map(x=>`<div class="cx"><p><b>${esc(x.contact||"(sans courriel)")}</b><span class="soft">${esc(dateLongue(x.derniere))}</span></p><p>${esc(lieuTexte(x))}${x.appareil?` · <span class="soft">${esc(x.appareil)}</span>`:""} · <span class="soft">${nb(x.nb)} connexion${x.nb>1?"s":""}</span></p></div>`).join("")}</div>`:`<p class="soft">Aucun résultat.</p>`}</div>`;
 const i=$("#qcx");if(i)i.oninput=()=>{F.qcx=i.value;clearTimeout(i._t);i._t=setTimeout(()=>{remplirAdminConnexions(el).then(()=>{const j=$("#qcx");if(j){j.focus();j.setSelectionRange(j.value.length,j.value.length)}})},250)}}

function bindPlus7(v){
 if(v==="verifier"&&$("#lien")&&typeof plateforme==="function")$("#lien").addEventListener("change",()=>{const p=plateforme({lien:$("#lien").value});const d=app.querySelector("details.profil");if(!p||!d)return;
  d.open=true;d.querySelector("summary").textContent=`Vérifier le profil de l'annonceur sur ${p.nom} (facultatif)`;const h=d.querySelector(".hint");if(h)h.textContent=p.aide});
 app.querySelectorAll("[data-va-de]").forEach(b=>b.onclick=()=>{F.retourVA=b.dataset.vaDe;go("approfondie")});
 app.querySelectorAll("[data-verif]").forEach(b=>b.onclick=()=>{F.verifId=b.dataset.verif;F.retourVerif=v==="historique"?"historique":"accueil";go("detailVerif")});
 if(v==="historique")app.querySelectorAll("[data-hfiltre]").forEach(b=>b.onclick=()=>{F.hfiltre=b.dataset.hfiltre;go("historique")});
 if(v==="detailVerif"&&$("#h-suppr")){const b=$("#h-suppr");b.onclick=async()=>{
  if(!b.dataset.ok){b.dataset.ok="1";b.textContent="Confirmer : retirer définitivement";return}
  b.disabled=true;try{await HIS.supprimer(F.verifId);go("historique")}catch(e){b.disabled=false;b.textContent="Réessayer";const er=$("#err");if(er)er.textContent="Le retrait n'a pas fonctionné. Réessaie."}}}
 if(v==="compte"&&$("#lieu-ok")){const c=$("#lieu-ok"),m=$("#lieu-msg");c.onchange=async()=>{c.disabled=true;
  try{const g=await LIEU.definir(c.checked);try{localStorage.setItem(CLE_LIEU_REP,"1")}catch(e){}m.textContent=!c.checked?"Désactivé. Ton historique de lieux a été effacé.":g&&g.ville?`Activé. Ville notée pour cette connexion : ${g.ville}${g.region?" ("+g.region+")":""}. Seuls les administrateurs la voient.`:"Activé. Ta ville approximative sera notée à chaque connexion. Seuls les administrateurs la voient."}
  catch(e){c.checked=!c.checked;m.textContent="Le changement n'a pas fonctionné. Réessaie."}c.disabled=false}}
 if(v==="accueil"&&$("#inv-lieu")){const fin=async oui=>{try{localStorage.setItem(CLE_LIEU_REP,"1")}catch(e){}
   if(oui){try{await LIEU.definir(true)}catch(e){}}const el=$("#inv-lieu");if(el)el.outerHTML=oui?`<p class="hint centre">Merci. Tu peux changer ce choix dans Mon compte.</p>`:""};
  $("#inv-oui").onclick=()=>fin(true);$("#inv-non").onclick=()=>fin(false)}
 if(v==="admin"&&F.onglet==="connexions"){const el=$("#adm");if(el)remplirAdminConnexions(el).catch(()=>{el.innerHTML=`<p class="err">Chargement impossible.</p>`})}
}
const CSS_PLUS7=""; /* styles déplacés dans app.css */
/* Bouton compact « Mon compte » en tête de l'accueil */
function barreCompte(){const st=CPT.statut();return `<button type="button" class="compte-lien" data-go="compte" aria-label="Mon compte"><span class="avatar" aria-hidden="true">${esc((CPT.courriel()||"?").charAt(0).toUpperCase())}</span><span class="t"><b>${esc(CPT.courriel()||"Mon compte")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></span><span class="chev" aria-hidden="true">›</span></button>`}

/* ===== HabitaScan : le message-filtre (commun démo + Supabase) =====
   Un seul message, poli et normal, qui pose les règles du Québec (visite d'abord, paiement à la signature).
   Un vrai propriétaire répond oui ; un fraudeur insiste pour un dépôt ou disparaît. Puis l'app lit sa réponse.
   Dépend de : F, $, app, esc */
const FILTRE_MSG={
 fr:{std:"Bonjour, votre logement m'intéresse beaucoup. Est-ce que je peux le visiter cette semaine ? Si tout me convient, je suis prêt(e) à signer le bail sur place et à payer le premier mois à la signature. Merci !",
  ces:"Bonjour, votre logement m'intéresse beaucoup. Est-ce que je peux le visiter cette semaine ? Si tout me convient, je suis prêt(e) à signer la cession dès que le propriétaire aura donné son accord écrit. Merci !"},
 en:{std:"Hello, I'm very interested in your apartment. Could I visit it this week? If everything suits me, I'm ready to sign the lease on the spot and pay the first month's rent at signing. Thank you!",
  ces:"Hello, I'm very interested in your apartment. Could I visit it this week? If everything suits me, I'm ready to sign the lease transfer as soon as the landlord has given written consent. Thank you!"}};
/* Ce que la réponse peut révéler (le texte est mis en minuscules et sans accents avant la recherche) */
const FILTRE_SIGNAUX=[
 ["r",/depot|deposit|pour reserver|reservation|to (hold|reserve)|caution|paiement d.avance|en avance|payer d.avance|in advance/, "Il demande de l'argent pour réserver ou garantir le logement. Au Québec, le propriétaire peut exiger seulement le premier mois, à la signature, et aucun dépôt."],
 ["r",/interac|virement|e-?transfer|western union|moneygram|paypal|crypto|bitcoin|carte[s]? cadeau|gift card|wise\b/, "Il veut un paiement par virement, transfert ou carte-cadeau avant la signature."],
 ["r",/etranger|a l.exterieur du pays|hors du pays|en mission|out of (the )?country|abroad|overseas|missionnaire|militaire|offshore/, "Il dit être à l'étranger ou loin. C'est un scénario typique des fausses annonces."],
 ["r",/(cle|cles|key|keys).{0,40}(poste|courrier|mail|livr|envoy|ship)|(poste|courrier|airbnb|livr).{0,40}(cle|cles|key)/, "Il propose d'envoyer les clés par la poste ou par un service : on ne visite donc jamais."],
 ["r",/pas de visite|aucune visite|visite (n.est pas|impossible|pas possible)|pas possible de (le )?visiter|ne (peux|peut|pouvez|pourrez) pas (le )?visiter|no visit|can.?t (visit|show)|cannot (visit|show)|unable to show/, "Il refuse ou évite la visite."],
 ["r",/numero d.assurance sociale|\bnas\b|\bsin\b|passeport|passport|permis de conduire|driver.?s licen|releve bancaire|bank statement/, "Il demande tes papiers (NAS, passeport, relevé bancaire) avant la visite. Ne les envoie pas."],
 ["y",/beaucoup de (gens|personnes|demandes)|plusieurs (personnes|candidats)|many (people|applicants)|vite|rapidement|aujourd.hui seulement|urgent|asap|first come/, "Il te presse. La pression est une technique courante ; une vraie visite peut attendre un jour."],
 ["y",/whatsapp|telegram|signal|texto|sms|courriel|e-?mail/, "Il veut continuer ailleurs (WhatsApp, courriel). Garde la conversation sur la plateforme jusqu'à la visite."],
 ["g",/(samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain|ce soir|saturday|sunday|monday|tuesday|wednesday|thursday|friday|tomorrow)|\b\d{1,2} ?h\b|\b\d{1,2}:\d{2}\b|\d{1,2} ?(am|pm)/, "Il propose un moment précis pour la visite."],
 ["g",/(oui|yes|bien sur|sure|parfait|ok|d.accord).{0,60}(visite|visiter|visit)|(visite|visit).{0,40}(possible|disponible|available)/, "Il accepte la visite."],
 ["g",/(signature|signer|sign).{0,60}(bail|lease)|(bail|lease).{0,60}(signature|signer|sign)/, "Il accepte de signer un bail."]];
const sansAcc=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[’']/g,"'");
const TEXTES_FILTRE={r:["Ne paie pas","Sa réponse contient un signal d'arnaque. Ne paie rien et n'envoie aucun document."],
 y:["Prudence","Rien d'alarmant, mais garde la règle : visite d'abord, et paie seulement à la signature du bail."],
 g:["Bonne réponse","Il accepte la visite et la signature. Continue : visite, puis compare le nom sur le bail avec le propriétaire inscrit."],
 i:["Pas assez d'indices","Sa réponse ne dit ni oui ni non à la visite. Repose la question : « Quand puis-je visiter ? »"]};
const IA_ROUGES=["argent_avant_bail","depot","paiement_suspect","proprietaire_absent","refus_visite","refus_bail","paiement_autre_personne"];
SIGNAUX_IA.refus_bail="Refus de signer un bail";SIGNAUX_IA.paiement_autre_personne="Paiement demandé au nom d'une autre personne";SIGNAUX_IA.histoire_incoherente="Histoire qui change ou se contredit";
/* Combine l'analyse locale et l'analyse IA de la conversation, puis recalcule le verdict. */
function fusionFiltre(A,r){const s=[...A.signaux];
 for(const x of (r.signaux||[]))s.push({c:IA_ROUGES.includes(x.type)?"r":"y",m:`<b>${esc(SIGNAUX_IA[x.type]||"Élément inhabituel")}</b> : « ${esc(x.extrait)} »${x.explication?" "+esc(x.explication):""}`});
 let c=s.some(z=>z.c==="r")?"r":s.some(z=>z.c==="y")?"y":s.some(z=>z.c==="g")?"g":"i";
 if(r.reponse_filtre==="refuse")c="r";else if(r.reponse_filtre==="accepte"&&c==="i")c="g";else if(r.reponse_filtre==="esquive"&&c==="g")c="y";
 const t=TEXTES_FILTRE[c];return {c,t:t[0],s:t[1],signaux:s,ia:true,resume:r.resume||""}}
function analyserReponse(t){const x=sansAcc(t);const s=FILTRE_SIGNAUX.filter(([,re])=>re.test(x)).map(([c,,m])=>({c,m}));
 const r=s.filter(z=>z.c==="r").length,y=s.filter(z=>z.c==="y").length,g=s.filter(z=>z.c==="g").length;
 const c=r?"r":y?"y":g?"g":"i";
 const t2=TEXTES_FILTRE[c];
 return {c,t:t2[0],s:t2[1],signaux:s}}
function blocFiltre(){const lang=F.flang||"fr",ces=F.cession==="oui";const msg=FILTRE_MSG[lang][ces?"ces":"std"];const A=F.frep;
 return `<div class="card filtre"><p class="offre-eti">Gratuit · nouveau</p><h2>Le message-filtre</h2>
<p>Envoie ce seul message à l'annonceur. Il ne pose aucune question gênante : il annonce simplement les règles normales au Québec. <b>Un vrai propriétaire dira oui. Un fraudeur va insister pour un dépôt, ou disparaître.</b></p>
<div class="seg" role="group" aria-label="Langue du message"><button type="button" data-flang="fr" aria-pressed="${lang==="fr"}">Français</button><button type="button" data-flang="en" aria-pressed="${lang==="en"}">English</button></div>
<blockquote class="msg" id="f-msg" lang="${lang}">${esc(msg)}</blockquote>
${typeof navigator!=="undefined"&&navigator.share?`<div class="duo"><button type="button" class="btn" id="f-copier">Copier le message</button><button type="button" class="btn ghost" id="f-partager">Partager</button></div>`:`<button type="button" class="btn" id="f-copier">Copier le message</button>`}
<label for="f-rep" style="margin-top:14px">Colle sa réponse ici</label><textarea id="f-rep" rows="4" maxlength="3000" placeholder="La réponse de l'annonceur…">${esc(F.frepTxt||"")}</textarea>
<label class="drop" style="margin-top:4px">${(F.fcaps||[]).length?`<b>${F.fcaps.length} capture${F.fcaps.length>1?"s":""} de la discussion</b> · toucher pour changer`:"Ajouter des captures de la discussion (facultatif)"}<input type="file" accept="image/*" multiple id="f-caps"></label>
${IA_ADAPT.dispo?`<label class="ia-opt"><input type="checkbox" id="f-ia" ${iaActif()?"checked":""}><span><b>Analyse intelligente de la conversation</b> (IA)<span class="hint">Lit sa réponse et tes captures de la discussion, aussi en anglais : c'est là que les fraudeurs se trahissent. Envoyées à Anthropic pour l'analyse, puis oubliées.</span></span></label>`:""}
<button type="button" class="btn ghost" id="f-lire">Analyser sa réponse</button>
${A?`<div class="verdict ${A.c}" id="f-res" role="status"><strong>${A.t}</strong><span>${A.s}</span></div>${A.signaux.length?`<ul class="reasons">${A.signaux.map(z=>`<li><span class="dot ${z.c}"></span><div>${z.m}</div></li>`).join("")}</ul>`:""}`:""}
${A&&!A.ia&&A.c!=="r"&&IA_ADAPT.dispo&&!iaActif()?`<div class="lu"><b>Aucun mot suspect, mais un fraudeur prudent peut les éviter.</b> L'IA lit le sens de sa réponse.<button type="button" class="btn ghost" id="f-ia-go" style="margin-top:10px">Faire lire sa réponse par l'IA</button></div>`:""}
${A&&A.resume?`<p class="lu"><b>Résumé de l'IA :</b> ${esc(A.resume)}</p>`:""}
<p class="hint">${A&&A.ia?"Analysée par l'IA et par les règles de l'app. Elle repère des indices connus, sans certitude.":"Sans l'analyse intelligente, l'analyse se fait sur ton téléphone ; le texte n'est envoyé nulle part. Elle repère des indices connus, sans certitude."}</p></div>`}
function bindPlus8(v){if(v!=="resultat"||!$("#f-msg"))return;
 app.querySelectorAll("[data-flang]").forEach(b=>b.onclick=()=>{F.flang=b.dataset.flang;F.frepTxt=$("#f-rep").value;go("resultat");setTimeout(()=>{const e=$("#f-msg");if(e)e.scrollIntoView({block:"center"})},0)});
 const msg=()=>$("#f-msg").textContent;
 $("#f-copier").onclick=async()=>{const b=$("#f-copier");try{await navigator.clipboard.writeText(msg());b.textContent="Copié ✓"}catch(e){const r=document.createRange();r.selectNodeContents($("#f-msg"));const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent="Sélectionné : copie-le"}setTimeout(()=>{if(b.isConnected)b.textContent="Copier le message"},2500)};
 const p=$("#f-partager");if(p)p.onclick=()=>navigator.share({text:msg()}).catch(()=>{});
 const fc=$("#f-caps");if(fc)fc.onchange=()=>{F.frepTxt=$("#f-rep").value;F.fcaps=[...fc.files].slice(0,4);go("resultat");setTimeout(()=>{const e=$("#f-msg");if(e)e.scrollIntoView({block:"center"})},0)};
 const fia=$("#f-ia");if(fia)fia.onchange=()=>{try{localStorage.setItem(CLE_IA,fia.checked?"1":"0")}catch(e){}};
 $("#f-lire").onclick=async()=>{const t=$("#f-rep").value.trim(),caps=F.fcaps||[];if(t.length<3&&!caps.length){$("#f-rep").focus();return}
  F.frepTxt=t;let A=analyserReponse(t);const b=$("#f-lire");
  if(iaActif()){b.disabled=true;b.textContent="Analyse de la conversation…";
   try{const images=[];for(const c of caps)images.push(await reduireImage(c));const r=await IA_ADAPT.analyser({images,texte:t,mode:"conversation"});A=fusionFiltre(A,r);
    F.contacts=fusionContacts(F.contacts,{tels:r.telephones,courriels:r.courriels});try{MES.noter("ia_conversation")}catch(e){}}
   catch(x){A.s+=x&&x.message==="quota"?" (Limite d'analyses IA atteinte pour aujourd'hui : analyse simple utilisée.)":" (L'analyse intelligente n'a pas fonctionné : analyse simple utilisée.)"}}
  /* Mémoire collective : les numéros et courriels donnés dans la conversation. */
  const cc=extraireContacts(t);F.contacts=fusionContacts(F.contacts,cc);
  const m=await memoire(cc.tels.length||cc.courriels.length?F.contacts:{tels:[],courriels:[]},[]);
  itemsMemoire(m).forEach(x=>A.signaux.unshift({c:x.c,m:x.t}));if(A.signaux.some(z=>z.c==="r")&&A.c!=="r"){A.c="r";A.t=TEXTES_FILTRE.r[0];A.s=TEXTES_FILTRE.r[1]}
  F.frep=A;try{MES.noter("filtre_analyse")}catch(e){}go("resultat");setTimeout(()=>{const e=$("#f-res");if(e)e.scrollIntoView({block:"center"})},0)}}
const CSS_PLUS8=""; /* styles déplacés dans app.css */
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS8+"</style>");
/* Adaptateurs historique, compte, lieu (Supabase : table verifications, profil, fonctions *_connexion, fonction Vercel /api/lieu) */
const HIS={liste:()=>HIST.map(x=>({id:x.id,module:x.module==="reno"?"reno":"logement",date:x.created_at,ville:x.ville,ch:x.chambres,prix:x.prix,c:x.couleur,lien:x.lien,travaux:x.travaux,licence:x.licence,raisons:Array.isArray(x.raisons)?x.raisons:[]})),
 async supprimer(id){const {error}=await sb.from("verifications").delete().eq("id",id);if(error)throw error;HIST=HIST.filter(x=>String(x.id)!==String(id))}};
const CPT={courriel:()=>(PROFIL&&PROFIL.contact)||"",statut:()=>{const k=(PROFIL&&PROFIL.identite_statut)||"aucune";return {t:k==="confirmee"&&PROFIL.identite_prenom?`Identité confirmée · ${PROFIL.identite_prenom}${PROFIL.identite_nom?" "+PROFIL.identite_nom+".":""}`:STATUT[k]||"Connecté",couleur:k==="confirmee"?"var(--ok)":k==="refusee"?"var(--red)":"var(--amber)"}}};
const appareilCourt=()=>{const u=navigator.userAgent;const os=/iPhone|iPad/.test(u)?(/iPad/.test(u)?"iPad":"iPhone"):/Android/.test(u)?"Android":/Mac OS X/.test(u)?"Mac":/Windows/.test(u)?"Windows":/Linux/.test(u)?"Linux":"Autre";
 const nav=/Edg\//.test(u)?"Edge":/SamsungBrowser/.test(u)?"Samsung":/Firefox|FxiOS/.test(u)?"Firefox":/Chrome|CriOS/.test(u)?"Chrome":/Safari/.test(u)?"Safari":"Autre";return os+" · "+nav};
let LIEU_NOTE=false;
const LIEU={dispo:true,demo:false,actif:()=>!!(PROFIL&&PROFIL.partage_lieu),
 async definir(b){await rpc("definir_partage_lieu",{p_actif:b});if(PROFIL)PROFIL.partage_lieu=b;if(b){LIEU_NOTE=false;return noterLieu()}return null},
 };
/* Une fois par ouverture de l'app, seulement si la personne l'a activé */
/* ===== Mémoire collective : numéros, courriels et photos déjà signalés par d'autres utilisateurs =====
   Les numéros et courriels sont envoyés au serveur seulement pour être comparés ; il ne les garde qu'en empreinte chiffrée,
   et seulement si la personne les signale. Les photos ne quittent jamais le téléphone : seule leur empreinte visuelle est envoyée. */
const REGLE_PAIEMENT="Paie seulement par chèque ou virement au nom du propriétaire inscrit au Registre foncier. Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne.";
const RE_TEL=/(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})\b/g,RE_COURRIEL=/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
function extraireContacts(...textes){const t=textes.filter(Boolean).join("\n"),tels=new Set(),cour=new Set();
 for(const m of t.matchAll(RE_TEL))tels.add(m[1]+m[2]+m[3]);
 for(const m of t.matchAll(RE_COURRIEL))cour.add(m[0].toLowerCase());
 return {tels:[...tels].slice(0,5),courriels:[...cour].slice(0,5)}}
function fusionContacts(a,b){a=a||{};b=b||{};
 const tels=[...(a.tels||[]),...(b.tels||[]).map(x=>String(x).replace(/\D/g,"").slice(-10))].filter(x=>/^\d{10}$/.test(x));
 const cour=[...(a.courriels||[]),...(b.courriels||[]).map(x=>String(x).trim().toLowerCase())].filter(x=>/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x));
 return {tels:[...new Set(tels)].slice(0,5),courriels:[...new Set(cour)].slice(0,5)}}
/* Empreinte visuelle (dHash 64 bits) : la même photo, même redimensionnée ou recompressée, garde presque la même empreinte. */
function empreintePhoto(source,rogner){return new Promise(ok=>{const im=new Image();im.onload=()=>{try{
 const r=rogner?0.1:0,sx=im.width*r,sy=im.height*r,sw=im.width*(1-2*r),sh=im.height*(1-2*r);
 /* Réduction en deux temps (lissée), puis moyenne par blocs : stable malgré le redimensionnement et la compression. */
 const W=72,Hh=64,c=document.createElement("canvas");c.width=W;c.height=Hh;const x=c.getContext("2d");x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";
 const t=document.createElement("canvas");t.width=288;t.height=256;const tx=t.getContext("2d");tx.imageSmoothingEnabled=true;tx.imageSmoothingQuality="high";tx.drawImage(im,sx,sy,sw,sh,0,0,288,256);x.drawImage(t,0,0,W,Hh);
 const d=x.getImageData(0,0,W,Hh).data,v=[];for(let by=0;by<8;by++)for(let bx=0;bx<9;bx++){let s=0;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const p=((by*8+yy)*W+bx*8+xx)*4;s+=d[p]*.299+d[p+1]*.587+d[p+2]*.114}v.push(s)}
 let bits="";for(let y=0;y<8;y++)for(let i=0;i<8;i++)bits+=v[y*9+i]>v[y*9+i+1]?"1":"0";
 let h="";for(let k=0;k<64;k+=4)h+=parseInt(bits.slice(k,k+4),2).toString(16);ok(h)}catch(e){ok(null)}};im.onerror=()=>ok(null);im.src=typeof source==="string"?source:URL.createObjectURL(source)})}
async function empreintesPhotos(fichiers,rogner){const L=[];for(const f of (fichiers||[]).slice(0,8)){for(const rg of rogner?[false,true]:[false]){const h=await empreintePhoto(f,rg);if(h&&!/^0+$|^f+$/.test(h))L.push(h)}}return [...new Set(L)]}
/* Empreinte du texte (SimHash 64 bits) : deux textes presque identiques (annonce recopiée) donnent presque la même empreinte. */
function empreinteTexte(t){const mots=String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z\s]/g," ").split(/\s+/).filter(m=>m.length>=3);
 if(mots.length<12)return null;const v=new Array(64).fill(0);
 const h32=(s,g)=>{let h=2166136261^g;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
 for(let i=0;i+2<mots.length;i++){const s=mots[i]+" "+mots[i+1]+" "+mots[i+2],a=h32(s,0),b=h32(s,0x9e3779b9);for(let k=0;k<32;k++){v[k]+=(a>>>k)&1?1:-1;v[32+k]+=(b>>>k)&1?1:-1}}
 let bits="";for(let k=0;k<64;k++)bits+=v[k]>0?"1":"0";let h="";for(let k=0;k<64;k+=4)h+=parseInt(bits.slice(k,k+4),2).toString(16);return h}
async function retrouverAnnonce(){if(!SESSION||(!F.photos.length&&!F.texteEmp))return null;
 try{const {data,error}=await sb.rpc("retrouver_annonce",{p_photos:F.photos,p_texte:F.texteEmp,p_prix:F.prixN||null,p_ville:F.ville||null,p_lien:F.lienN||null});return error?null:data}catch(e){return null}}
function itemsRecopie(r){const it=[];if(!r||!r.vues)return it;const n=+r.vues,rg=+r.rouges||0;
 const pers=x=>x>1?`${x} personnes`:"une personne";
 if((r.autres_prix||[]).length)it.push({c:"y",t:`<b>Les mêmes photos ou le même texte apparaissent dans une autre annonce, à un autre prix</b> (${r.autres_prix.map(p=>money(+p)).join(", ")}). Une annonce copiée avec un prix différent est un signe classique de fraude.`,law:"Mémoire collective HabitaScan : vérifications faites par d'autres utilisateurs, sur d'autres sites."});
 if((r.autres_villes||[]).length)it.push({c:"y",t:`<b>Les mêmes photos ou le même texte ont été vus dans une annonce d'une autre ville</b> (${r.autres_villes.map(esc).join(", ")}). Les fraudeurs réutilisent les photos d'un logement ailleurs.`,law:"Mémoire collective HabitaScan."});
 if(rg)it.push({c:rg>=2?"r":"y",t:`<b>Cette annonce a déjà été vérifiée ailleurs par ${pers(n)}, dont ${rg} avec le résultat «&nbsp;Ne paie pas&nbsp;».</b> Mêmes photos ou même texte, sur un autre lien.`,law:"Mémoire collective HabitaScan."});
 else if(!it.length)it.push({c:"i",t:`<b>Cette annonce (mêmes photos ou même texte, même prix) a déjà été vue sur un autre site par ${pers(n)}.</b> C'est normal si le propriétaire la publie à plusieurs endroits : compare simplement le numéro et le nom de l'annonceur.`,law:"Mémoire collective HabitaScan."});
 return it}

async function memoire(c,photos){c=c||{tels:[],courriels:[]};if(!SESSION||(!c.tels.length&&!c.courriels.length&&!(photos||[]).length))return null;
 try{const {data,error}=await sb.rpc("memoire_collective",{p_tels:c.tels,p_courriels:c.courriels,p_photos:photos||[]});return error?null:data}catch(e){return null}}
function itemsMemoire(m){const it=[];if(!m)return it;
 const max=L=>Math.max(0,...(L||[]).map(Number)),nt=max(m.tels),nc=max(m.courriels),np=+m.photo||0;
 const item=(n,quoi,fem)=>({c:n>=SEUIL_ROUGE?"r":"y",t:`<b>${quoi} a déjà été signalé${fem?"e":""} ${n} fois</b> par ${n>1?"des utilisateurs":"un utilisateur"} à l'identité confirmée.${n>=SEUIL_ROUGE?" Ne paie rien.":" Redouble de prudence."}`,law:"Mémoire collective HabitaScan : chaque signalement avertit les personnes suivantes."});
 if(nt)it.push(item(nt,"Ce numéro de téléphone"));if(nc)it.push(item(nc,"Ce courriel"));if(np)it.push(item(np,"Cette photo",true));return it}
const peutSignaler=F=>!!(F.lienN||(F.contacts&&(F.contacts.tels.length||F.contacts.courriels.length))||(F.photos&&F.photos.length));
function resumeSignal(F){const c=F.contacts||{tels:[],courriels:[]},p=F.photos||[],L=[];
 if(F.lienN)L.push("le lien de l'annonce");if(c.tels.length)L.push(c.tels.length>1?`${c.tels.length} numéros de téléphone`:"le numéro de téléphone");
 if(c.courriels.length)L.push(c.courriels.length>1?`${c.courriels.length} courriels`:"le courriel");if(p.length)L.push(p.length>1?`${p.length} photos`:"la photo");
 return L.length?`<p class="lu">Ce signalement portera sur : ${L.join(", ")}. Les numéros et courriels sont gardés seulement sous forme chiffrée, jamais en clair.</p>`:""}
/* Détecte la zone « photo » d'une capture d'écran : là où les couleurs sont variées
   (une photo), contrairement au texte et aux boutons (deux ou trois couleurs). */
function detecterPhoto(source){return new Promise(ok=>{const im=new Image();im.onload=()=>{try{
 const W=180,H=Math.max(1,Math.min(480,Math.round(im.height*W/im.width)));const c=document.createElement("canvas");c.width=W;c.height=H;
 const x=c.getContext("2d");x.drawImage(im,0,0,W,H);const d=x.getImageData(0,0,W,H).data;
 const q=p=>((d[p]>>5)<<6)|((d[p+1]>>5)<<3)|(d[p+2]>>5);
 const riche=[];for(let y=0;y<H;y++){const s=new Set();for(let i=0;i<W;i++)s.add(q((y*W+i)*4));riche.push(s.size)}
 let best=[0,-1],deb=-1,trou=0;
 for(let y=0;y<=H;y++){const photo=y<H&&riche[y]>=20;
  if(photo){if(deb<0)deb=y;trou=0}
  else if(deb>=0){trou++;if(trou>3||y===H){const fin=y-trou;if(fin-deb>best[1]-best[0])best=[deb,fin];deb=-1;trou=0}}}
 const [y0,y1]=best;if(y1-y0<Math.max(30,H*0.18)){ok(null);return}
 const col=i=>{const s=new Set();for(let y=y0;y<=y1;y++)s.add(q((y*W+i)*4));return s.size};
 let x0=0,x1=W-1;while(x0<x1&&col(x0)<12)x0++;while(x1>x0&&col(x1)<12)x1--;
 if(x1-x0<W*0.4){ok(null);return}
 const k=im.width/W,o=document.createElement("canvas");o.width=Math.max(1,Math.round((x1-x0+1)*k));o.height=Math.max(1,Math.round((y1-y0+1)*k));
 o.getContext("2d").drawImage(im,x0*k,y0*k,o.width,o.height,0,0,o.width,o.height);ok(o.toDataURL("image/jpeg",0.9))}catch(e){ok(null)}};
 im.onerror=()=>ok(null);im.src=typeof source==="string"?source:URL.createObjectURL(source)})}
/* Empreintes des captures : la photo détectée (entière et recadrée) et la capture entière. */
async function empreintesCaptures(fichiers){const L=[];F.zonePhoto=null;
 for(const f of (fichiers||[]).slice(0,4)){const z=await detecterPhoto(f);
  if(z){if(!F.zonePhoto)F.zonePhoto=z;for(const rg of [false,true]){const h=await empreintePhoto(z,rg);if(h&&!/^0+$|^f+$/.test(h))L.push(h)}}
  const h=await empreintePhoto(f);if(h&&!/^0+$|^f+$/.test(h))L.push(h)}
 return [...new Set(L)]}
/* Recherche des copies de l'annonce sur le web, même si personne ne l'a vérifiée dans l'app. */
const hoteDe=u=>{try{return new URL(u).hostname.replace(/^(www|m|fr|en)\./,"")}catch(e){return ""}};
function phraseDistinctive(t){const phr=String(t||"").split(/\n|(?<=[.!?])\s+/).map(s=>s.replace(/\s+/g," ").trim())
  .filter(s=>s.split(" ").length>=8&&!/https?:|@|\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(s));
 if(!phr.length)return null;phr.sort((a,b)=>b.length-a.length);return phr[0].split(" ").slice(0,16).join(" ")}
function prixDans(t){const m=String(t||"").match(/(\d{1,2}[\s  ,.]?\d{3}|\d{3,4})\s*\$|\$\s*(\d{1,2},?\d{3}|\d{3,4})/);
 if(!m)return null;const n=+String(m[1]||m[2]).replace(/\D/g,"");return n>=300&&n<=10000?n:null}
async function chercherCopies(){if(!SESSION||!CFG.recherche)return null;
 const t=F.annonce&&F.annonce.length>80?F.annonce:(F.ocrTxt||F.annonce||"");const phrase=phraseDistinctive(t);if(!phrase)return null;
 try{const {data,error}=await sb.functions.invoke("chercher-copies",{body:{phrase}});return error||!data||data.error?null:data}catch(e){return null}}
function itemsCopiesWeb(F){const it=[],actuel=(F.lienN||"").split(/[?#]/)[0];
 const copies=((F.copiesWeb||{}).resultats||[]).filter(r=>r&&r.url&&r.url.split(/[?#]/)[0]!==actuel);
 const imgs=((F.images||{}).details||[]);
 const tout=[...copies.map(r=>({url:r.url,txt:(r.titre||"")+" "+(r.extrait||"")})),...imgs.map(r=>({url:r.url,txt:r.titre||""}))];
 const autrePrix=tout.map(x=>({...x,p:prixDans(x.txt)})).filter(x=>x.p&&F.prixN&&Math.abs(x.p-F.prixN)>Math.max(50,F.prixN*0.1));
 const lien=x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(hoteDe(x.url))}</a>`;
 if(autrePrix.length)it.push({c:"y",t:`<b>La même annonce apparaît ailleurs sur le web à un autre prix</b> : ${autrePrix.slice(0,3).map(x=>`${money(x.p)} sur ${lien(x)}`).join(", ")}. Une annonce copiée avec un prix différent est un signe classique de fraude.`,law:"Recherche des photos et du texte de l'annonce sur le web"});
 else if(copies.length)it.push({c:"i",t:`<b>Le même texte apparaît aussi sur ${copies.slice(0,3).map(lien).join(", ")}.</b> C'est normal si le propriétaire publie à plusieurs endroits : compare le numéro et le nom de l'annonceur.`,law:"Recherche du texte de l'annonce sur le web"});
 return it}
/* ===== Analyse intelligente : un choix clair (Loi 25 : désactivée tant que la personne ne l'active pas) ===== */
function iaChoisi(){try{return localStorage.getItem(CLE_IA)!==null}catch(e){return true}}
function blocChoixIA(){if(!IA_ADAPT.dispo||iaChoisi())return "";
 return `<div class="card invite choix-ia" role="region" aria-label="Analyse intelligente"><p class="offre-eti">Recommandé</p><h2>Activer l'analyse intelligente ?</h2>
<p>Elle comprend le <b>sens</b> des annonces et des messages, pas seulement des mots. Elle repère les fraudeurs prudents qui évitent les mots suspects : « un petit montant pour bloquer le logement », « je suis hors du pays pour le travail ».</p>
<p class="hint">Le texte et les captures sont envoyés à Anthropic (États-Unis) pour l'analyse, puis oubliés. Tu peux changer ce choix dans Mon compte.</p>
<div class="duo"><button type="button" class="btn" data-ia-choix="1">Activer</button><button type="button" class="btn ghost" data-ia-choix="0">Non merci</button></div></div>`}
/* Rappel sur le résultat quand seule l'analyse par mots a été faite. */
function rappelIA(){if(!IA_ADAPT.dispo||iaActif()||F.ia||!F.res||F.res.c==="r")return "";
 if(!((F.captures||[]).length||String(F.annonce||"").length>30||String(F.txt||"").length>10))return "";
 return `<div class="card invite"><p><b>L'analyse simple cherche des mots connus&nbsp;: un fraudeur prudent peut les éviter.</b> L'analyse intelligente lit le sens de l'annonce et de la conversation.</p>
<button type="button" class="btn" id="ia-relire">Faire lire l'annonce et la conversation par l'IA</button>
<p class="hint">Le texte et les captures sont envoyés à Anthropic pour l'analyse, puis oubliés. Ce choix est retenu ; tu peux le changer dans Mon compte.</p></div>`}
document.addEventListener("click",async e=>{const t=e.target.closest?e.target:null;if(!t)return;
 const choix=t.closest("[data-ia-choix]");
 if(choix){try{localStorage.setItem(CLE_IA,choix.dataset.iaChoix)}catch(x){}const v=app.dataset.v;if(v==="verifier")keep();go(v);return}
 const relire=t.closest("#ia-relire");
 if(relire){try{localStorage.setItem(CLE_IA,"1")}catch(x){}relire.disabled=true;relire.textContent="Lecture par l'IA…";
  try{const r=await analyserIA(F.captures,`${F.annonce||""}\n${F.txt||""}\n${F.ocrTxt||""}`);F.ia=r;
   F.contacts=fusionContacts(F.contacts,{tels:r.telephones,courriels:r.courriels});F.mem=await memoire(F.contacts,F.photos);
   F.res=analyser();try{MES.noter("ia_relecture")}catch(x){}go("resultat")}
  catch(x){relire.disabled=false;relire.textContent=x&&x.message==="quota"?"Limite d'analyses IA atteinte pour aujourd'hui":"L'analyse intelligente n'a pas fonctionné. Réessayer"}
  return}
 const fgo=t.closest("#f-ia-go");
 if(fgo){try{localStorage.setItem(CLE_IA,"1")}catch(x){}const b=$("#f-lire");if(b)b.click()}});
document.addEventListener("change",e=>{if(e.target&&e.target.id==="ia-compte")try{localStorage.setItem(CLE_IA,e.target.checked?"1":"0")}catch(x){}});
async function envoyerPiece(){const doc=F.doc||"permis";err("");
 busy(true,"Envoi sécurisé…");const uid=(await sb.auth.getUser()).data.user.id,stamp=Date.now();
 for(const s of ["recto","verso"]){const f=F[s];if(!f)continue;const ext=(f.type.split("/")[1]||"jpg").replace("jpeg","jpg");
  const {error}=await sb.storage.from("pieces-identite").upload(`${uid}/${stamp}-${s}.${ext}`,f,{contentType:f.type,upsert:false});
  if(error){busy(false,"Réessayer");return err("L'envoi de la photo a échoué. Vérifie ta connexion (photo de 8 Mo maximum).")}}
 const {error}=await sb.rpc("soumettre_identite",{doc_type:doc});if(error){busy(false,"Réessayer");return err("Une erreur est survenue. Réessaie.")}
 F={};await chargerProfil();go("identiteOk")}
/* Alertes de la lecture automatique (l'alerte « déjà utilisée » n'est montrée qu'aux admins). */
const ALERTES_ID={pas_une_piece:"Ce n'est peut-être pas une pièce d'identité",illisible:"Photo difficile à lire",type_different:"Le type de pièce ne correspond pas à celui choisi",
 expiree:"Pièce expirée",expiration_inconnue:"Date d'expiration non lue",mineur:"Personne mineure",naissance_inconnue:"Date de naissance non lue",deja_utilisee:"Pièce déjà utilisée par un autre compte"};
const dateId=s=>{if(!s)return "non lue";const d=new Date(s+"T12:00:00");return isNaN(d)?esc(s):d.toLocaleDateString("fr-CA",{day:"numeric",month:"long",year:"numeric"})};
async function noterLieu(){if(LIEU_NOTE||!SESSION||!LIEU.actif())return null;LIEU_NOTE=true;
 try{const base=document.documentElement.dataset.natif?"https://habitascan.vercel.app":"";const r=await fetch(base+"/api/lieu",{cache:"no-store"});if(!r.ok)return null;const g=await r.json();
  await sb.rpc("noter_connexion",{p_pays:g.pays||"",p_region:g.region||"",p_ville:g.ville||"",p_appareil:appareilCourt()});return g}catch(e){return null}}
Object.assign(ADM,{console:"/admin",connexions:()=>rpc("admin_connexions").then(d=>d||[]),lieuxResume:()=>rpc("admin_lieux_resume").then(d=>d||[]),
 partageStats:()=>rpc("admin_partage_stats").then(d=>(d&&d[0])||{partagent:0,total:0})});
document.head.insertAdjacentHTML("beforeend","<style>"+CSS_PLUS7+"</style>");
const V={
bienvenue:()=>`${top()}
<svg class="logo-grand" role="img" aria-label="HabitaScan"><use href="#logo"/></svg>
<h1>Avant de payer, vérifie.</h1>
<p class="soft">Une fausse annonce peut te faire perdre ton argent avant même d'avoir vu le logement. HabitaScan t'aide à la repérer avant d'envoyer un seul dollar.</p>
<ul class="atouts">
<li><b>Vérifie une annonce</b> en une minute, avec une capture d'écran.</li>
<li><b>Confirme le vrai propriétaire</b> grâce aux registres publics du Québec.</li>
<li><b>Calcule ton budget</b> et trouve un logement à ta mesure.</li></ul>
<button class="btn" data-go="inscription" id="commencer">Commencer gratuitement</button>
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
<ul class="confiance"><li>Gratuit</li><li>Conforme à la Loi 25</li><li>Sources publiques officielles</li><li>Fait au Québec</li></ul>
<p class="hint centre"><a href="/">En savoir plus</a> · <a href="/guides/arnaques-courantes">Arnaques courantes</a> · <a href="/en" lang="en" hreflang="en">English</a></p>
<p class="hint pied">${lienConditions.replace("conditions d'utilisation","Conditions d'utilisation")}${lienConfidentialite.replace("politique de confidentialité","Confidentialité")}</p>`,

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
<p class="hint">Ton ${t==="courriel"?"courriel":"numéro"} sert seulement à te connecter. En continuant, tu acceptes les ${lienConditions} et la ${lienConfidentialite}.</p></form>`},

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
<option value="permis">Permis de conduire (régulier, probatoire ou apprenti)</option><option value="passeport">Passeport</option><option value="rp">Carte de résident permanent</option></select></label>
<label class="drop">${F.rectoUrl?`<img src="${F.rectoUrl}" alt="Recto">Changer la photo`:"Prendre en photo le recto"}<input type="file" accept="image/*" capture="environment" data-side="recto"></label>
<label class="drop" ${F.doc==="passeport"?"hidden":""}>${F.versoUrl?`<img src="${F.versoUrl}" alt="Verso">Changer la photo`:"Prendre en photo le verso"}<input type="file" accept="image/*" capture="environment" data-side="verso"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="ok" style="width:22px;min-height:22px;margin-top:2px">J'accepte que la photo soit lue automatiquement puis vérifiée par l'équipe, uniquement pour confirmer mon identité, puis supprimée.</label>
<p class="hint">Détails dans la ${lienConfidentialite}.</p>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Envoyer pour vérification</button></form>
<p class="hint">Pourquoi ? Seuls les comptes à l'identité confirmée peuvent signaler une annonce : ça évite les fausses accusations. Vérifier une annonce ne la demande jamais.</p>
<p class="hint">Les photos sont envoyées dans un espace privé, au Canada. Pour gagner du temps, elles sont aussi lues par une IA (Anthropic, aux États-Unis), qui n'en garde aucune copie. Seule l'équipe de vérification peut les voir ; elles sont supprimées après la vérification.</p>`,

identiteLecture:()=>{const L=F.lecture||{},al=(L.alertes||[]).filter(a=>a!=="deja_utilisee");return `${top("identite","Identité")}
<h2>Vérifie ce que nous avons lu</h2><p class="soft">Lu automatiquement sur ta pièce. Notre équipe vérifiera ensuite la photo.</p>
<div class="card"><dl class="details">
<div><dt>Prénom</dt><dd>${esc(L.prenom||"non lu")}</dd></div><div><dt>Nom</dt><dd>${esc(L.nom||"non lu")}</dd></div>
<div><dt>Date de naissance</dt><dd>${dateId(L.date_naissance)}</dd></div><div><dt>Expiration</dt><dd>${dateId(L.date_expiration)}</dd></div>
<div><dt>Émise par</dt><dd>${esc(L.emetteur||"non lu")}</dd></div></dl>
${al.length?`<ul class="reasons">${al.map(a=>`<li><span class="dot y"></span><div>${esc(ALERTES_ID[a]||a)}</div></li>`).join("")}</ul>`:""}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">C'est exact, envoyer pour vérification</button>
<button type="button" class="btn ghost" id="reprendre">Reprendre les photos</button></div>
<p class="hint">Une fois l'identité confirmée, nous gardons seulement ton prénom, l'initiale de ton nom et la date d'expiration. Jamais le numéro de la pièce. Les photos sont supprimées après la vérification.</p>`},

analyse:()=>`${top(null,F.titre||"Vérification")}<div class="spin" role="status" aria-label="En cours"></div><p class="soft" style="text-align:center">${F.msg||"En cours…"}</p>`,

identiteOk:()=>`${top(null,"Identité")}
<svg class="seal" role="img" aria-label="Pièce reçue"><use href="#seal"/></svg>
<h1>Pièce reçue</h1><p class="soft">Ta pièce d'identité est en vérification. Tu pourras signaler des annonces dès qu'elle sera confirmée.</p>
<button class="btn" data-go="accueil">Continuer</button>`,

accueil:()=>`${top(null)}
${PROFIL?barreCompte():""}
${PROFIL&&PROFIL.suspendu?`<div class="verdict r" role="alert"><strong>Compte suspendu</strong><span>Tu peux encore consulter tes vérifications, mais plus en enregistrer de nouvelles.${CFG.support?` Pour en parler : <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a>.`:""}</span></div>`:""}
${CFG.message?`<div class="card invite" role="status"><p>${esc(CFG.message)}</p></div>`:""}
<h1>Que veux-tu faire ?</h1>
<div class="choix-accueil">
<button class="btn" data-go="trouver" id="nouvT">Trouver un logement<small>Selon ta ville, tes chambres et ton budget</small></button>
<button class="btn" data-go="verifier" id="nouv">Vérifier une annonce trouvée<small>Facebook, Kijiji et autres</small></button>
${CFG.approfondie?`<button class="btn ghost btn-va" data-va-de="accueil">Vérification complète par notre équipe<small>Propriétaire, entreprise, photos, autres annonces · ${prixTxt()} · rapport en ${VCFG.delai} h</small></button>`:""}
<button class="btn ghost" data-go="budget" id="nouvB">Calculer mon budget d'installation</button>
<button class="btn ghost" data-go="reno" id="nouvR">Vérifier un entrepreneur en rénovation</button>
</div>
${!ANONYME&&PROFIL&&["aucune","refusee"].includes(PROFIL.identite_statut)?`<button class="btn ghost" data-go="identite">Confirmer mon identité (pour signaler)</button>`:""}
${blocMesApprofondies}
${blocInvitationLieu()}
${blocHistorique()}
<button class="btn ghost" data-go="victime">J'ai été victime d'une arnaque</button>
<p class="hint pied">${lienConditions.replace("conditions d'utilisation","Conditions")}${lienConfidentialite.replace("politique de confidentialité","Confidentialité")}</p>`,

verifier:()=>`${top("accueil","Vérifier")}
${blocChoixIA()}
<h2>L'annonce</h2>
<form class="card" id="f-ver" novalidate>
<label class="drop drop-grand">${F.vignettes&&F.vignettes.length?`<span class="vignettes">${F.vignettes.map(u=>`<img src="${u}" alt="Capture">`).join("")}</span>Changer les captures`:`<b>Ajoute des captures d'écran</b><span>L'annonce, et surtout la conversation avec l'annonceur : c'est là que les fraudeurs se trahissent.</span>`}<input type="file" accept="image/*" multiple data-captures="1"></label>
<label class="drop">${(F.photosLog||[]).length?`<b>${F.photosLog.length} photo${F.photosLog.length>1?"s":""} du logement</b> · toucher pour changer`:`<b>Ajoute 1 ou 2 photos du logement</b> (facultatif)<br><span class="hint">Enregistre-les depuis l'annonce (appui long sur la photo). Elles permettent de retrouver la même annonce publiée ailleurs, même avec un autre lien ou un autre numéro. Elles ne quittent pas ton téléphone.</span>`}<input type="file" accept="image/*" multiple id="photos-log"></label>
${blocIA()}
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
<label>Téléphone ou courriel de l'annonceur (facultatif)<input id="contact" autocomplete="off" placeholder="514 555-0123 ou nom@exemple.com" value="${esc(F.contact||"")}"><span class="hint" style="font-weight:400">Pour savoir s'il a déjà été signalé par d'autres utilisateurs.</span></label>
${yn("argent","On te demande de l'argent avant la signature du bail ?")}
${yn("visite","As-tu pu visiter le logement en personne ?")}
${yn("cession","Est-ce le locataire actuel qui annonce (cession de bail ou sous-location) ?")}
<div id="q-accord" ${F.cession!=="oui"?"hidden":""}>${yn("accord","Le propriétaire a-t-il accepté par écrit ?")}<p class="hint">Le locataire doit aviser le propriétaire par écrit. Celui-ci a 15 jours pour répondre ; sans réponse, il est réputé avoir accepté.</p></div>
${blocProfil(F)}
<p class="err" id="e" hidden></p>
<button class="btn">Vérifier</button></form>
<p class="hint">Le texte de l'annonce et la conversation restent sur ton téléphone. Seuls la ville, le nombre de chambres, le prix, le lien et le résultat sont gardés. Si la recherche d'images est activée, la capture est envoyée à Google Vision pour cette recherche, puis n'est pas conservée. Si tu actives l'analyse intelligente, les captures et le texte sont envoyés à Anthropic pour l'analyse, puis oubliés.</p>`,

resultat:()=>{const R=F.res;return `${top("accueil","Résultat")}
<div class="verdict ${R.c}"><strong>${{r:"Ne paie pas",y:"Visite d'abord, puis vérifie le propriétaire",g:"Aucun signal. Tu peux visiter."}[R.c]}</strong><span>${esc(F.ville)} · ${F.ch==="3"?"3 ch. et plus":F.ch+" ch."} · <span class="num">${money(F.prixN)}</span></span></div>
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map(i=>`<li><span class="dot ${i.c}"></span><div>${i.t}${i.law?`<div class="law">${i.law}</div>`:""}</div></li>`).join("")}</ul></div>
${rappelIA()}
<p class="rule">${{r:"N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.",y:"Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.",g:"Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt."}[R.c]}</p>
${R.c!=="r"?`<p class="rule paiement">${REGLE_PAIEMENT}</p>`:""}
<button class="btn ghost" data-go="proprio" id="b-proprio">Vérifier le propriétaire</button>
<p class="hint">Sans rien demander à l'annonceur : l'adresse suffit, et la comparaison se fait au moment de signer.</p>
${blocFiltre()}
${offreApprofondie("resultat")}
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
historique:()=>vueHistorique(),
detailVerif:()=>vueDetailVerif(),
compte:()=>vueCompte(),
approfondie:()=>vueApprofondie(F,F.retourVA||"proprio"),
conditions:()=>vueConditions(SESSION?"accueil":"bienvenue"),
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

const PUBLIQUES=["bienvenue","inscription","code","victime","erreur","confidentialite","conditions"];
function go(v){if(!SESSION&&!PUBLIQUES.includes(v)){if(F.partage)LS.set("vl_partage",{annonce:F.annonce,lien:F.lien});v="bienvenue"}if(v==="admin"&&!ADM.estAdmin())v="accueil";app.dataset.v=v;app.innerHTML=V[v]();try{window.hsTheme&&hsTheme.appliquer()}catch(e){}window.scrollTo(0,0);bind(v);bindPlus(v);bindPlus3(v);bindPlus4(v);bindPlus5(v);bindPlus6(v);bindPlus7(v);bindPlus8(v)}
const err=m=>{const e=$("#e");if(e){e.textContent=m;e.hidden=!m}};
const busy=(on,label)=>{const b=$("#go");if(b){b.disabled=on;if(label)b.textContent=label}};
function appliquerLecture(r){["prix","ch","ville","cession"].forEach(k=>{if(r[k])F[k]=r[k]});if(r.lien&&!F.lien)F.lien=r.lien;
 const res=resumeLecture(r);F.lu=res?`<b>Lu :</b> ${esc(res)}. Vérifie et corrige si besoin.`:"Je n'ai pas trouvé le prix ni la ville : remplis-les ci-dessous."}
function keep(){["annonce","lien","ville","ch","prix","adr","txt","contact"].forEach(k=>{const el=$("#"+k);if(el)F[k]=el.value})}

/* Compte facultatif : chaque appareil reçoit une session anonyme ; créer un compte la relie à un courriel ou un cellulaire (même historique). */
/* Compte obligatoire : une session existe seulement après la validation du code (courriel ou cellulaire). */
async function ouvrirSession(){try{const {data}=await sb.auth.getSession();const u=data.session&&data.session.user;
 SESSION=!!u&&!u.is_anonymous;ANONYME=!SESSION}catch(e){SESSION=false;ANONYME=true}}
async function envoyerCode(){
 if(SESSION&&ANONYME){F.typeCode=F.cible.email?"email_change":"phone_change";const r=await sb.auth.updateUser(F.cible);
  const m=(r.error&&r.error.message||"").toLowerCase();if(!r.error||!(m.includes("already")||m.includes("registered")||m.includes("exists")))return r}
 F.typeCode=F.cible.email?"email":"sms";return sb.auth.signInWithOtp({...F.cible,options:{shouldCreateUser:true}})}
async function rechercheImages(f){try{const b64=await reduireImage(f);
 const appel=sb.functions.invoke("recherche-image",{body:{image:b64}});const {data,error}=await Promise.race([appel,new Promise(r=>setTimeout(()=>r({error:"delai"}),9000))]);
 /* La page de l'annonce elle-même n'est pas une copie : on retire les résultats du même site. */
 const hote=u=>{try{return new URL(u).hostname.replace(/^(www|m|web)\./,"")}catch(e){return ""}},site=F.lienN?hote(F.lienN):"";
 return error||!data?null:{ok:true,details:((data&&data.details)||[]).filter(d=>d&&typeof d.url==="string"&&/^https?:\/\//.test(d.url)&&(!site||hote(d.url)!==site)),pages:(data.pages||[]).filter(u=>/^https?:\/\//.test(u)&&(!site||hote(u)!==site))}}catch(e){return null}}
async function chargerProfil(){
 if(!SESSION){PROFIL=null;HIST=[];EST_ADMIN=false;return}
 const {data}=await sb.from("profiles").select("*").maybeSingle();PROFIL=data;try{EST_ADMIN=!!(await rpc("est_admin"))}catch(e){EST_ADMIN=false}
 const h=await sb.from("verifications").select("id,module,ville,chambres,prix,couleur,raisons,lien,travaux,licence,created_at").order("created_at",{ascending:false}).limit(100);HIST=h.data||[];
 noterLieu();
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
 {const pl=$("#photos-log");if(pl)pl.onchange=()=>{const fs=[...pl.files].slice(0,4);if(!fs.length)return;keep();F.photosLog=fs;go("verifier")}}
 app.querySelectorAll("input[data-captures]").forEach(inp=>inp.onchange=()=>{const fs=[...inp.files].slice(0,4);if(!fs.length)return;keep();
  F.captures=fs;F.vignettes=fs.map(f=>URL.createObjectURL(f));F.capture=fs[0];F.ocr=true;F.iaOff=false;F.ia=null;go(v)});
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
   busy(true,"Lecture de la pièce…");F.doc=doc;
   try{const images=[await reduireImage(F.recto)];if(F.verso)images.push(await reduireImage(F.verso));
    const {data,error}=await sb.functions.invoke("lire-identite",{body:{images,doc_type:doc}});
    if(!error&&data&&!data.error){F.lecture=data;return go("identiteLecture")}}catch(x){}
   /* Lecture indisponible (IA désactivée, quota, réseau) : vérification entièrement manuelle. */
   return envoyerPiece()}}
 if(v==="identiteLecture"){$("#go").onclick=()=>envoyerPiece();
  $("#reprendre").onclick=()=>{F.recto=F.verso=F.rectoUrl=F.versoUrl=F.lecture=null;go("identite")}}

 if(v==="compte"&&$("#deco"))$("#deco").onclick=async()=>{await sb.auth.signOut();PROFIL=null;HIST=[];F={};SESSION=false;LIEU_NOTE=false;go("bienvenue")};
 if(v==="resultat"&&$("#signaler"))$("#signaler").onclick=()=>{const sig={lienN:F.lienN,ville:F.ville,contacts:F.contacts,photos:F.photos};LS.set("vl_sig",sig);
  if(ANONYME)return go("inscription");const st=PROFIL&&PROFIL.identite_statut;
  if(st==="confirmee"){F=sig;return go("signaler")}go(st==="en_attente"?"attente":"identite")};
 if(v==="signaler"){if(!peutSignaler(F)){const sig=LS.get("vl_sig");if(sig)F=sig}lierSignaler(F);$("#f-sig").onsubmit=async e=>{e.preventDefault();err("");const m=validerSignal(F);if(m)return err(m);
  busy(true,"Envoi…");let ok=false;
  if(F.lienN){const {error}=await sb.from("signalements").insert({lien:F.lienN,motif:F.motif});if(!error||String(error.code).includes("23505"))ok=true}
  const c=F.contacts||{tels:[],courriels:[]};
  if(c.tels.length||c.courriels.length||(F.photos||[]).length){const {error}=await sb.rpc("signaler_cles",{p_motif:F.motif,p_tels:c.tels,p_courriels:c.courriels,p_photos:F.photos||[]});if(!error)ok=true}
  if(!ok){busy(false,"Réessayer");return err("Le signalement n'a pas pu être envoyé. Réessaie.")}
  LS.set("vl_sig",null);F={};go("signalOk")}}
 if(v==="verifier"){$("#lire").onclick=()=>{keep();F.coller=true;if(iaActif()&&!F.iaOff){go("verifier");return lancerIA(true)}appliquerLecture(extraireAnnonce(F.annonce,Object.keys(LOYERS)));go("verifier")};
  if(F.partage){F.partage=false;appliquerLecture(extraireAnnonce(F.annonce,Object.keys(LOYERS)));return go("verifier")}
  if(F.ocr&&iaActif()&&!F.iaOff){F.ocr=false;lancerIA(false)}
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
  
  F.contacts=fusionContacts(extraireContacts(F.contact,F.annonce,F.ocrTxt,F.txt),{tels:(F.ia||{}).telephones,courriels:(F.ia||{}).courriels});
  F.photos=[...new Set([...(await empreintesPhotos(F.photosLog,true)),...(await empreintesCaptures(F.captures))])].slice(0,12);
  F.texteEmp=empreinteTexte(F.annonce&&F.annonce.length>80?F.annonce:F.ocrTxt||F.annonce);
  const img=(F.photosLog||[])[0]||F.zonePhoto||F.capture;
  [F.mem,F.copie,F.images,F.copiesWeb]=await Promise.all([memoire(F.contacts,F.photos),retrouverAnnonce(),img?rechercheImages(img):null,chercherCopies()]);
  F.res=analyser();
  const brut=F.res.items.map(i=>({c:i.c,t:String(i.t).slice(0,1500),law:String(i.law||"").slice(0,800)}));
  const base={ville:F.ville,chambres:+F.ch,prix:F.prixN,couleur:F.res.c,raisons:brut,lien:F.lienN};
  const ins=!SESSION?Promise.resolve():sb.from("verifications").insert({...base,photos:F.photos.length?F.photos:null,texte_empreinte:F.texteEmp||null}).then(r=>r&&r.error?sb.from("verifications").insert(base):r);
  await Promise.all([ins,new Promise(r=>setTimeout(r,900))]);await chargerProfil();go("resultat")}}
 if(v==="resultat")$("#nouv").onclick=()=>{F={};go("verifier")};

 if(v==="reno"){lierReno(F);$("#f-reno").onsubmit=async e=>{e.preventDefault();lireReno(F);err("");const m=validerReno(F);if(m)return err(m);
  const lic=chiffres(F.licence);F.titre="Vérification";F.msg="Analyse de la soumission…";go("analyse");
  let R;/* undefined = registre pas encore importé : l'app renvoie au registre officiel */
  if(lic&&REGISTRE_PRET){const {data,error}=await sb.from("licences_rbq").select("numero,nom,autres_noms,sous_categories,mandataire").eq("numero",lic).maybeSingle();if(!error)R=data||null}
  F.res=analyserReno(F,R);
  const brut=F.res.items.map(i=>({c:i.c,t:String(i.t).slice(0,1500),law:String(i.law||"").slice(0,800)}));
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
 itemsIA(F).forEach(x=>it.push(x));
 if(F.visite==="non")it.push({c:"y",t:"<b>Tu n'as pas visité.</b> Ne paie rien sans avoir vu le logement en personne."});
 else it.push({c:"g",t:"Tu as visité le logement. Attention : un fraudeur peut louer un logement quelques jours pour le faire visiter."});
 if(F.cession==="oui"&&F.argent==="oui")it.push({c:"r",t:"<b>Le locataire te demande de l'argent.</b> En cession de bail, le locataire qui part ne peut rien exiger de toi en échange : pas de « frais de reprise », pas de dépôt.",law:'Avis de cession du TAL · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf" target="_blank" rel="noopener">TAL</a>'});
 if(F.cession==="oui")it.push({c:"i",t:"<b>Locataire actuel :</b> la preuve, c'est l'accord écrit du propriétaire, avec ton nom. « Vérifier le propriétaire » te dit qui doit le signer, à partir de l'adresse seulement."});
 if(F.cession==="oui")it.push(F.accord==="oui"?{c:"g",t:"Accord écrit du propriétaire : bon signe."}:{c:"y",t:"<b>Pas encore d'accord écrit du propriétaire.</b> Depuis 2024, il peut refuser une cession même sans motif sérieux (le bail du locataire actuel prend alors fin, et tu n'as pas de logement). Ne paie rien avant sa réponse écrite ou la fin du délai de 15 jours.",law:'Code civil du Québec, art. 1870, 1871 et 1978.2 · <a href="https://educaloi.qc.ca/capsules/la-cession-de-bail-et-la-sous-location-de-logement/" target="_blank" rel="noopener">Éducaloi</a> · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_828_E.pdf" target="_blank" rel="noopener">TAL</a>'});
 if(F.lienN){const h=new URL(F.lienN).hostname,site=SITES.find(s=>h===s.d||h.endsWith("."+s.d));
  if(!site)it.push({c:"y",t:`<b>Site inconnu : ${esc(h)}.</b> Les fraudeurs copient parfois de vrais sites d'annonces. Vérifie l'adresse lettre par lettre.`});
  const st=F.stats;if(st&&+st.rouges>0)it.push({c:"r",t:`<b>${st.rouges} vérification${st.rouges>1?"s":""} précédente${st.rouges>1?"s":""} de cette annonce ${st.rouges>1?"ont":"a"} donné « Ne paie pas ».</b>`});
  else if(st&&+st.total>0)it.push({c:"i",t:`Cette annonce a déjà été vérifiée ${st.total} fois, sans arnaque probable.`});
  const sg=itemSignalements(F.nbSig);if(sg)it.push(sg);}
 itemsMemoire(F.mem).forEach(x=>it.push(x));
 itemsRecopie(F.copie).forEach(x=>it.push(x));
 itemsCopiesWeb(F).forEach(x=>it.push(x));
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
 try{await Promise.all([chargerLoyers(),chargerRegistre(),chargerParametres(),chargerTextes()]);
  await ouvrirSession();await chargerProfil();const vq=new URLSearchParams(location.search).get("v");
  go(["confidentialite","conditions"].includes(vq)?vq:SESSION?(F.partage?"verifier":"accueil"):"bienvenue")}
 catch(e){app.innerHTML=`${top()}<p class="err">Impossible de joindre le serveur. Vérifie ta connexion et recharge la page.</p>`}
})();
}
