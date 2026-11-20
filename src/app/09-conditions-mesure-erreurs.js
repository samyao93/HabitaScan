/* ===== HabitaScan : conditions d'utilisation, mesure d'usage anonyme, erreurs (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, lienExt, RESPONSABLE, VCFG, prixTxt, L_CAI
   et d'un adaptateur MES : MES.noter(type) ; MES.erreur(message, vue) ; MES.admin() → {j7, j30, payees30, erreurs7, dernieres} */

/* ---------- Conditions d'utilisation ---------- */
const L_LPC = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-40.1";
function vueConditions(back) {
  const R = RESPONSABLE;
  const s = (t, c) => `<div class="card"><h2>${t}</h2>${c}</div>`;
  return `${top(back, "Conditions")}
<h2>Conditions d'utilisation</h2>
<p class="hint">En vigueur le ${R.vigueur}. HabitaScan est exploité par ${R.entreprise}, ${R.adresse}. Courriel : ${R.courriel}.</p>
${s("1. Ce que fait HabitaScan", "<p>HabitaScan aide à repérer les signes de fraude dans une annonce de logement, à vérifier qui est le propriétaire, à estimer un budget d'installation et à vérifier un entrepreneur en rénovation. Les résultats sont calculés à partir de règles publiques, de données gouvernementales et de ce que tu entres.</p>")}
${s("2. Ce n'est pas une garantie", "<p><b>Un résultat vert ne garantit pas qu'une annonce est honnête,</b> et un résultat rouge ne prouve pas une fraude. HabitaScan ne remplace ni un avocat, ni un notaire, ni le Tribunal administratif du logement. Avant de payer quoi que ce soit : visite le logement, confirme le propriétaire et signe le bail.</p>")}
${s("3. Ton compte", "<p>Tu dois avoir 14 ans ou plus. Ton compte est personnel : garde l'accès à ton courriel ou à ton cellulaire pour toi. Tu peux supprimer ton compte en tout temps depuis l'accueil.</p>")}
${s(
  "4. Vérification complète payante",
  `<ul class="liste"><li>Prix : ${prixTxt()}, taxes incluses s'il y a lieu, payé par carte sur la page sécurisée de Stripe.</li>
<li>Nous vérifions : le propriétaire au Registre foncier ; si c'est une entreprise, son statut et ses dirigeants au registre des entreprises ; les photos de l'annonce ; les autres annonces du même logement. Tu reçois un rapport écrit avec un verdict et le nom du propriétaire inscrit (information publique du Registre foncier), à retrouver sur ton bail. Jamais de document sur le propriétaire.</li>
<li>Délai : ${VCFG.delai} h maximum après le paiement.</li>
<li><b>Remboursement complet</b> si nous ne livrons pas le rapport dans ce délai, ou si nous ne pouvons pas identifier le propriétaire. Écris-nous à ${R.courriel}.</li>
<li>Le rapport reflète les registres publics et le Web au moment de la vérification. Une vente récente peut ne pas encore être publiée, et une recherche sur le Web ne trouve pas tout.</li></ul>`,
)}
${s("5. Signalements", "<p>Signale seulement une annonce que tu crois vraiment frauduleuse, et choisis le bon motif. Un faux signalement peut nuire à une personne honnête : nous pouvons retirer un signalement et fermer un compte qui en abuse.</p>")}
${s("6. Utilisation interdite", "<ul class=\"liste\"><li>Utiliser l'app pour harceler, ficher ou retrouver une personne.</li><li>Collecter ou revendre automatiquement le contenu de l'app (robots, aspiration).</li><li>Contourner les limites d'usage ou la sécurité.</li><li>Entrer de fausses informations pour nuire à quelqu'un.</li></ul><p class=\"hint\">Des limites quotidiennes s'appliquent aux recherches automatiques, pour garder le service gratuit pour tout le monde.</p>")}
${s("7. Responsabilité", `<p>Nous faisons tout pour que l'information soit exacte et à jour, mais des données publiques peuvent contenir des erreurs ou dater. Dans les limites permises par la ${lienExt(L_LPC, "Loi sur la protection du consommateur")}, nous ne sommes pas responsables d'une décision prise seulement sur la base d'un résultat de l'app. Rien dans ces conditions ne limite les droits que cette loi te donne.</p>`)}
${s("8. Contenu et marque", "<p>Le nom HabitaScan, le logo et le code de l'app nous appartiennent. Les données gouvernementales utilisées restent soumises à leurs licences (par exemple CC-BY 4.0), et leurs sources sont citées dans l'app.</p>")}
${s("9. Modifications et droit applicable", `<p>Si ces conditions changent, nous l'indiquons dans l'app. Elles sont régies par les lois du Québec. En cas de désaccord, écris-nous d'abord à ${R.courriel}. Pour tes renseignements personnels, consulte la <button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>.</p>`)}`;
}
const lienConditions = `<button type="button" class="lienbtn" data-go="conditions">conditions d'utilisation</button>`;

/* ---------- Mesure d'usage anonyme ---------- */
const VUES_MESUREES = [
  "bienvenue",
  "inscription",
  "accueil",
  "verifier",
  "resultat",
  "proprio",
  "budget",
  "trouver",
  "approfondie",
  "reno",
  "renoResultat",
  "victime",
  "conditions",
  "confidentialite",
];
let derniereVue = "";
function bindPlus5(v) {
  derniereVue = v;
  if (VUES_MESUREES.includes(v))
    try {
      MES.noter("vue_" + v);
    } catch (e) {}
  if (v === "admin" && (F.onglet || "chiffres") === "chiffres") remplirMesure();
}
/* Erreurs techniques : 5 par session au maximum, message court, sans données de l'utilisateur */
let nbErreurs = 0;
function noterErreur(m) {
  if (++nbErreurs > 5) return;
  try {
    MES.erreur(String(m || "").slice(0, 300), derniereVue);
  } catch (e) {}
}
window.addEventListener("error", (e) =>
  noterErreur((e.message || "erreur") + (e.filename ? ` @${String(e.filename).split("/").pop()}:${e.lineno}` : "")),
);
window.addEventListener("unhandledrejection", (e) =>
  noterErreur("promesse : " + ((e.reason && e.reason.message) || e.reason || "")),
);

/* Entonnoir dans l'onglet Chiffres de l'admin */
const ETAPES = [
  ["vue_bienvenue", "Écran d'accueil (avant connexion)"],
  ["vue_accueil", "Accueil (connecté)"],
  ["vue_verifier", "Vérification commencée"],
  ["vue_resultat", "Vérification terminée"],
  ["vue_proprio", "Vérifier le propriétaire"],
  ["vue_approfondie", "Offre payante ouverte"],
  ["demande_creee", "Demande payante créée"],
  ["vue_budget", "Budget"],
  ["vue_trouver", "Trouver un logement"],
  ["recherche_lancee", "Recherches lancées"],
  ["vue_reno", "Vérif-Réno"],
];
async function remplirMesure() {
  let M;
  try {
    M = await MES.admin();
  } catch (e) {
    return;
  }
  const el = $("#adm");
  if (!el || !M || el.querySelector("#mesure")) return;
  const n = (o, k) => Number((o || {})[k] || 0).toLocaleString("fr-CA");
  el.insertAdjacentHTML(
    "beforeend",
    `<div class="card" id="mesure"><h2>Utilisation (anonyme)</h2>
<table class="tvilles"><thead><tr><th>Étape</th><th>7 jours</th><th>30 jours</th></tr></thead><tbody>
${ETAPES.map(([k, l]) => `<tr><td>${l}</td><td class="num">${n(M.j7, k)}</td><td class="num">${n(M.j30, k)}</td></tr>`).join("")}
<tr><td><b>Vérifications payées</b></td><td></td><td class="num"><b>${Number(M.payees30 || 0).toLocaleString("fr-CA")}</b></td></tr></tbody></table>
<p class="hint">Compte d'ouvertures d'écrans, sans lien avec les comptes. Le taux à surveiller : « Vérification terminée » ÷ « Vérification commencée ».</p></div>
<div class="card"><h2>Erreurs techniques</h2><p>${Number(M.erreurs7 || 0)} erreur${M.erreurs7 > 1 ? "s" : ""} sur 7 jours.</p>
${(M.dernieres || []).length ? `<ul class="liste">${M.dernieres.map((e) => `<li><span class="hint">${esc(String(e.cree_le).slice(0, 16).replace("T", " "))} · ${esc(e.vue || "")}</span><br>${esc(e.message)}</li>`).join("")}</ul>` : `<p class="hint">Aucune erreur.</p>`}</div>`,
  );
}
const CSS_PLUS5 = ""; /* styles déplacés dans app.css */
/* Adaptateur admin (Supabase : fonctions admin_*, tables parametres et loyers_reference, compartiment pieces-identite) */
let EST_ADMIN = false;
const rpc = async (n, a) => {
  const { data, error } = await sb.rpc(n, a);
  if (error) throw error;
  return data;
};
const photosDe = async (id) => {
  const { data, error } = await sb.storage.from("pieces-identite").list(id, { limit: 20 });
  if (error) throw error;
  return (data || []).map((f) => `${id}/${f.name}`);
};
const ADM = {
  demo: false,
  estAdmin: () => EST_ADMIN,
  stats: () => rpc("admin_stats"),
  identites: async () => (await rpc("admin_identites")) || [],
  async photos(id) {
    const p = await photosDe(id);
    if (!p.length) return [];
    const { data, error } = await sb.storage.from("pieces-identite").createSignedUrls(p, 300);
    if (error) throw error;
    return data.map((d) => d.signedUrl).filter(Boolean);
  },
  async decider(id, statut) {
    await rpc("admin_decider_identite", { p_id: id, p_statut: statut });
    const p = await photosDe(id);
    if (p.length) {
      const { error } = await sb.storage.from("pieces-identite").remove(p);
      if (error) throw error;
    }
  },
  signalements: async () => (await rpc("admin_signalements")) || [],
  retirerSignalements: (l) => rpc("admin_retirer_signalements", { p_lien: l }),
  async sauverParametre(cle, valeur) {
    const { error } = await sb.from("parametres").upsert({ cle, valeur, maj_le: new Date().toISOString() });
    if (error) throw error;
  },
  async sauverLoyer(ville, chambres, loyer) {
    const { data, error } = await sb
      .from("loyers_reference")
      .update({ loyer })
      .eq("ville", ville)
      .eq("chambres", chambres)
      .select("ville");
    if (error) throw error;
    if (!data || !data.length) {
      const r = await sb.from("loyers_reference").insert({ ville, chambres, loyer });
      if (r.error) throw r.error;
    }
  },
  async supprimerCompte() {
    const { error } = await sb.functions.invoke("supprimer-compte", { body: {} });
    if (error) throw error;
    await sb.auth.signOut();
    PROFIL = null;
    HIST = [];
    SESSION = false;
    EST_ADMIN = false;
  },
};
async function chargerParametres() {
  try {
    const { data } = await sb.from("parametres").select("cle,valeur");
    appliquerParametres(data);
  } catch (e) {}
}
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS3 + "</style>");

/* Adaptateur vérification approfondie (Supabase : table demandes_verif, paiement par lien Stripe, webhook stripe-webhook) */
const VAP = {
  demo: false,
  courriel: () => (PROFIL && PROFIL.contact && PROFIL.contact.includes("@") ? PROFIL.contact : ""),
  async creer(d) {
    const { data, error } = await sb.from("demandes_verif").insert(d).select("id").single();
    if (error) throw error;
    return data.id;
  },
  async mes() {
    if (!SESSION) return [];
    const { data, error } = await sb
      .from("demandes_verif")
      .select("id,adresse,statut,verdict,note,created_at,paye_le,termine_le,rapport,verdict_global")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    return data || [];
  },
  adminListe: async () => (await rpc("admin_demandes_liste", { p_statut: "" })) || [],
  adminMaj: (id, statut, verdict, note) =>
    rpc("admin_maj_demande", { p_id: id, p_statut: statut, p_verdict: verdict, p_note: note || "" }),
  async sauverTexte(cle, valeur) {
    const { error } = await sb.from("parametres_texte").upsert({ cle, valeur, maj_le: new Date().toISOString() });
    if (error) throw error;
  },
};
const PAGES_LEG = {};
async function chargerPages() {
  try {
    const { data } = await sb.from("pages_legales").select("cle,contenu");
    (data || []).forEach((r) => {
      if (r.contenu) PAGES_LEG[r.cle] = r.contenu;
    });
  } catch (e) {}
}
/* Page légale rédigée dans la console (Markdown). Les liens vers l'autre page restent dans l'app. */
function vuePageLegale(cle, titre, retour) {
  let h = window.hsMarkdown ? hsMarkdown(PAGES_LEG[cle], { sections: true }) : esc(PAGES_LEG[cle]);
  h = h
    .replace(/<h1>([\s\S]*?)<\/h1>/, "<h2>$1</h2>")
    .replace(
      /<a href="\/(conditions|confidentialite)">([\s\S]*?)<\/a>/g,
      '<button type="button" class="lienbtn" data-go="$1">$2</button>',
    );
  if (document.documentElement.dataset.natif) h = h.replace(/href="\//g, 'href="https://habitascan.vercel.app/');
  return `${top(retour, titre)}<div class="legal-app">${h}</div>`;
}
async function chargerTextes() {
  try {
    const { data } = await sb.from("parametres_texte").select("cle,valeur");
    (data || []).forEach((r) => {
      if (r.cle === "lien_paiement") VCFG.lien = r.valeur || "";
      if (r.cle === "message_accueil") CFG.message = r.valeur || "";
      if (r.cle === "courriel_support") CFG.support = r.valeur || "";
    });
  } catch (e) {}
}
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS4 + "</style>");

/* Adaptateur mesure (Supabase : fonctions noter, noter_erreur, admin_mesure) */
const MES = {
  noter(t) {
    sb.rpc("noter", { p_type: t }).then(
      () => {},
      () => {},
    );
  },
  erreur(m, v) {
    sb.rpc("noter_erreur", { p_message: m, p_vue: v || null, p_agent: navigator.userAgent.slice(0, 160) }).then(
      () => {},
      () => {},
    );
  },
  admin: () => rpc("admin_mesure"),
};
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS5 + "</style>");
