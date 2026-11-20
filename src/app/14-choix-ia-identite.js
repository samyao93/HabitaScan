/* ===== Analyse intelligente : un choix clair (Loi 25 : désactivée tant que la personne ne l'active pas) ===== */
function iaChoisi() {
  try {
    return localStorage.getItem(CLE_IA) !== null;
  } catch (e) {
    return true;
  }
}
function blocChoixIA() {
  if (!IA_ADAPT.dispo || iaChoisi()) return "";
  return `<div class="card invite choix-ia" role="region" aria-label="Analyse intelligente"><p class="offre-eti">Recommandé</p><h2>Activer l'analyse intelligente ?</h2>
<p>Elle comprend le <b>sens</b> des annonces et des messages, pas seulement des mots. Elle repère les fraudeurs prudents qui évitent les mots suspects : « un petit montant pour bloquer le logement », « je suis hors du pays pour le travail ».</p>
<p class="hint">Le texte et les captures sont envoyés à Anthropic (États-Unis) pour l'analyse, puis oubliés. Tu peux changer ce choix dans Mon compte.</p>
<div class="duo"><button type="button" class="btn" data-ia-choix="1">Activer</button><button type="button" class="btn ghost" data-ia-choix="0">Non merci</button></div></div>`;
}
/* Rappel sur le résultat quand seule l'analyse par mots a été faite. */
function rappelIA() {
  if (!IA_ADAPT.dispo || iaActif() || F.ia || !F.res || F.res.c === "r") return "";
  if (!((F.captures || []).length || String(F.annonce || "").length > 30 || String(F.txt || "").length > 10)) return "";
  return `<div class="card invite"><p><b>L'analyse simple cherche des mots connus&nbsp;: un fraudeur prudent peut les éviter.</b> L'analyse intelligente lit le sens de l'annonce et de la conversation.</p>
<button type="button" class="btn" id="ia-relire">Faire lire l'annonce et la conversation par l'IA</button>
<p class="hint">Le texte et les captures sont envoyés à Anthropic pour l'analyse, puis oubliés. Ce choix est retenu ; tu peux le changer dans Mon compte.</p></div>`;
}
document.addEventListener("click", async (e) => {
  const t = e.target.closest ? e.target : null;
  if (!t) return;
  const choix = t.closest("[data-ia-choix]");
  if (choix) {
    try {
      localStorage.setItem(CLE_IA, choix.dataset.iaChoix);
    } catch (x) {}
    const v = app.dataset.v;
    if (v === "verifier") keep();
    go(v);
    return;
  }
  const relire = t.closest("#ia-relire");
  if (relire) {
    try {
      localStorage.setItem(CLE_IA, "1");
    } catch (x) {}
    relire.disabled = true;
    relire.textContent = "Lecture par l'IA…";
    try {
      const r = await analyserIA(F.captures, `${F.annonce || ""}\n${F.txt || ""}\n${F.ocrTxt || ""}`);
      F.ia = r;
      F.contacts = fusionContacts(F.contacts, { tels: r.telephones, courriels: r.courriels });
      F.mem = await memoire(F.contacts, F.photos);
      F.res = analyser();
      try {
        MES.noter("ia_relecture");
      } catch (x) {}
      go("resultat");
    } catch (x) {
      relire.disabled = false;
      relire.textContent =
        x && x.message === "quota"
          ? "Limite d'analyses IA atteinte pour aujourd'hui"
          : "L'analyse intelligente n'a pas fonctionné. Réessayer";
    }
    return;
  }
  const fgo = t.closest("#f-ia-go");
  if (fgo) {
    try {
      localStorage.setItem(CLE_IA, "1");
    } catch (x) {}
    const b = $("#f-lire");
    if (b) b.click();
  }
});
document.addEventListener("change", (e) => {
  if (e.target && e.target.id === "ia-compte")
    try {
      localStorage.setItem(CLE_IA, e.target.checked ? "1" : "0");
    } catch (x) {}
});
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest && e.target.closest("[data-mode]");
    if (b) F.modeCx = b.dataset.mode === "connexion";
  },
  true,
);
async function envoyerPiece() {
  const doc = F.doc || "permis";
  err("");
  busy(true, "Envoi sécurisé…");
  const uid = (await sb.auth.getUser()).data.user.id,
    stamp = Date.now();
  for (const s of ["recto", "verso"]) {
    const f = F[s];
    if (!f) continue;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const { error } = await sb.storage
      .from("pieces-identite")
      .upload(`${uid}/${stamp}-${s}.${ext}`, f, { contentType: f.type, upsert: false });
    if (error) {
      busy(false, "Réessayer");
      return err("L'envoi de la photo a échoué. Vérifie ta connexion (photo de 8 Mo maximum).");
    }
  }
  let { error } = await sb.rpc("soumettre_identite", {
    doc_type: doc,
    p_prenom: F.prenomDecl || null,
    p_nom: F.nomDecl || null,
  });
  if (error && /PGRST20|function|fonction/i.test(String(error.code) + " " + String(error.message)))
    ({ error } = await sb.rpc("soumettre_identite", { doc_type: doc }));
  if (error) {
    busy(false, "Réessayer");
    return err("Une erreur est survenue. Réessaie.");
  }
  F = {};
  await chargerProfil();
  go("identiteOk");
}
/* Alertes de la lecture automatique (l'alerte « déjà utilisée » n'est montrée qu'aux admins). */
const ALERTES_ID = {
  pas_une_piece: "Ce n'est peut-être pas une pièce d'identité",
  illisible: "Photo difficile à lire",
  type_different: "Le type de pièce ne correspond pas à celui choisi",
  expiree: "Pièce expirée",
  expiration_inconnue: "Date d'expiration non lue",
  mineur: "Personne mineure",
  naissance_inconnue: "Date de naissance non lue",
  deja_utilisee: "Pièce déjà utilisée par un autre compte",
  nom_different: "Le nom lu sur la pièce ne correspond pas à celui écrit",
};
const nomsConcordent = (a, b) => {
  const n = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
  const x = n(a),
    y = n(b);
  return !x || !y || x.includes(y) || y.includes(x);
};
const dateId = (s) => {
  if (!s) return "non lue";
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? esc(s) : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
};
async function noterLieu() {
  if (LIEU_NOTE || !SESSION || !LIEU.actif()) return null;
  LIEU_NOTE = true;
  try {
    const base = document.documentElement.dataset.natif ? "https://habitascan.vercel.app" : "";
    const r = await fetch(base + "/api/lieu", { cache: "no-store" });
    if (!r.ok) return null;
    const g = await r.json();
    await sb.rpc("noter_connexion", {
      p_pays: g.pays || "",
      p_region: g.region || "",
      p_ville: g.ville || "",
      p_appareil: appareilCourt(),
    });
    return g;
  } catch (e) {
    return null;
  }
}
Object.assign(ADM, {
  console: "/admin",
  connexions: () => rpc("admin_connexions").then((d) => d || []),
  lieuxResume: () => rpc("admin_lieux_resume").then((d) => d || []),
  partageStats: () => rpc("admin_partage_stats").then((d) => (d && d[0]) || { partagent: 0, total: 0 }),
});
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS7 + "</style>");
