/* ===== HabitaScan : le message-filtre (commun démo + Supabase) =====
   Un seul message, poli et normal, qui pose les règles du Québec (visite d'abord, paiement à la signature).
   Un vrai propriétaire répond oui ; un fraudeur insiste pour un dépôt ou disparaît. Puis l'app lit sa réponse.
   Dépend de : F, $, app, esc */
const FILTRE_MSG = {
  fr: {
    std: "Bonjour, votre logement m'intéresse beaucoup. Est-ce que je peux le visiter cette semaine ? Si tout me convient, je suis prêt(e) à signer le bail sur place et à payer le premier mois à la signature. Merci !",
    ces: "Bonjour, votre logement m'intéresse beaucoup. Est-ce que je peux le visiter cette semaine ? Si tout me convient, je suis prêt(e) à signer la cession dès que le propriétaire aura donné son accord écrit. Merci !",
  },
  en: {
    std: "Hello, I'm very interested in your apartment. Could I visit it this week? If everything suits me, I'm ready to sign the lease on the spot and pay the first month's rent at signing. Thank you!",
    ces: "Hello, I'm very interested in your apartment. Could I visit it this week? If everything suits me, I'm ready to sign the lease transfer as soon as the landlord has given written consent. Thank you!",
  },
};
/* Ce que la réponse peut révéler (le texte est mis en minuscules et sans accents avant la recherche) */
const FILTRE_SIGNAUX = [
  [
    "r",
    /depot|deposit|pour reserver|reservation|to (hold|reserve)|caution|paiement d.avance|en avance|payer d.avance|in advance/,
    "Il demande de l'argent pour réserver ou garantir le logement. Au Québec, le propriétaire peut exiger seulement le premier mois, à la signature, et aucun dépôt.",
  ],
  [
    "r",
    /interac|virement|e-?transfer|western union|moneygram|paypal|crypto|bitcoin|carte[s]? cadeau|gift card|wise\b/,
    "Il veut un paiement par virement, transfert ou carte-cadeau avant la signature.",
  ],
  [
    "r",
    /etranger|a l.exterieur du pays|hors du pays|en mission|out of (the )?country|abroad|overseas|missionnaire|militaire|offshore/,
    "Il dit être à l'étranger ou loin. C'est un scénario typique des fausses annonces.",
  ],
  [
    "r",
    /(cle|cles|key|keys).{0,40}(poste|courrier|mail|livr|envoy|ship)|(poste|courrier|airbnb|livr).{0,40}(cle|cles|key)/,
    "Il propose d'envoyer les clés par la poste ou par un service : on ne visite donc jamais.",
  ],
  [
    "r",
    /pas de visite|aucune visite|visite (n.est pas|impossible|pas possible)|pas possible de (le )?visiter|ne (peux|peut|pouvez|pourrez) pas (le )?visiter|no visit|can.?t (visit|show)|cannot (visit|show)|unable to show/,
    "Il refuse ou évite la visite.",
  ],
  [
    "r",
    /numero d.assurance sociale|\bnas\b|\bsin\b|passeport|passport|permis de conduire|driver.?s licen|releve bancaire|bank statement/,
    "Il demande tes papiers (NAS, passeport, relevé bancaire) avant la visite. Ne les envoie pas.",
  ],
  [
    "y",
    /beaucoup de (gens|personnes|demandes)|plusieurs (personnes|candidats)|many (people|applicants)|vite|rapidement|aujourd.hui seulement|urgent|asap|first come/,
    "Il te presse. La pression est une technique courante ; une vraie visite peut attendre un jour.",
  ],
  [
    "y",
    /whatsapp|telegram|signal|texto|sms|courriel|e-?mail/,
    "Il veut continuer ailleurs (WhatsApp, courriel). Garde la conversation sur la plateforme jusqu'à la visite.",
  ],
  [
    "g",
    /(samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain|ce soir|saturday|sunday|monday|tuesday|wednesday|thursday|friday|tomorrow)|\b\d{1,2} ?h\b|\b\d{1,2}:\d{2}\b|\d{1,2} ?(am|pm)/,
    "Il propose un moment précis pour la visite.",
  ],
  [
    "g",
    /(oui|yes|bien sur|sure|parfait|ok|d.accord).{0,60}(visite|visiter|visit)|(visite|visit).{0,40}(possible|disponible|available)/,
    "Il accepte la visite.",
  ],
  [
    "g",
    /(signature|signer|sign).{0,60}(bail|lease)|(bail|lease).{0,60}(signature|signer|sign)/,
    "Il accepte de signer un bail.",
  ],
];
const sansAcc = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'");
const TEXTES_FILTRE = {
  r: ["Ne paie pas", "Sa réponse contient un signal d'arnaque. Ne paie rien et n'envoie aucun document."],
  y: ["Prudence", "Rien d'alarmant, mais garde la règle : visite d'abord, et paie seulement à la signature du bail."],
  g: [
    "Bonne réponse",
    "Il accepte la visite et la signature. Continue : visite, puis compare le nom sur le bail avec le propriétaire inscrit.",
  ],
  i: [
    "Pas assez d'indices",
    "Sa réponse ne dit ni oui ni non à la visite. Repose la question : « Quand puis-je visiter ? »",
  ],
};
const IA_ROUGES = [
  "argent_avant_bail",
  "depot",
  "paiement_suspect",
  "proprietaire_absent",
  "refus_visite",
  "refus_bail",
  "paiement_autre_personne",
];
SIGNAUX_IA.refus_bail = "Refus de signer un bail";
SIGNAUX_IA.paiement_autre_personne = "Paiement demandé au nom d'une autre personne";
SIGNAUX_IA.histoire_incoherente = "Histoire qui change ou se contredit";
/* Combine l'analyse locale et l'analyse IA de la conversation, puis recalcule le verdict. */
function fusionFiltre(A, r) {
  const s = [...A.signaux];
  for (const x of r.signaux || [])
    s.push({
      c: IA_ROUGES.includes(x.type) ? "r" : "y",
      m: `<b>${esc(SIGNAUX_IA[x.type] || "Élément inhabituel")}</b> : « ${esc(x.extrait)} »${x.explication ? " " + esc(x.explication) : ""}`,
    });
  let c = s.some((z) => z.c === "r") ? "r" : s.some((z) => z.c === "y") ? "y" : s.some((z) => z.c === "g") ? "g" : "i";
  if (r.reponse_filtre === "refuse") c = "r";
  else if (r.reponse_filtre === "accepte" && c === "i") c = "g";
  else if (r.reponse_filtre === "esquive" && c === "g") c = "y";
  const t = TEXTES_FILTRE[c];
  return { c, t: t[0], s: t[1], signaux: s, ia: true, resume: r.resume || "" };
}
function analyserReponse(t) {
  const x = sansAcc(t);
  const s = FILTRE_SIGNAUX.filter(([, re]) => re.test(x)).map(([c, , m]) => ({ c, m }));
  const r = s.filter((z) => z.c === "r").length,
    y = s.filter((z) => z.c === "y").length,
    g = s.filter((z) => z.c === "g").length;
  const c = r ? "r" : y ? "y" : g ? "g" : "i";
  const t2 = TEXTES_FILTRE[c];
  return { c, t: t2[0], s: t2[1], signaux: s };
}
function blocFiltre() {
  const lang = F.flang || "fr",
    ces = F.cession === "oui";
  const msg = FILTRE_MSG[lang][ces ? "ces" : "std"];
  const A = F.frep;
  return `<div class="card filtre"><p class="offre-eti">Gratuit · nouveau</p><h2>Le message-filtre</h2>
<p>Envoie ce seul message à l'annonceur. Il ne pose aucune question gênante : il annonce simplement les règles normales au Québec. <b>Un vrai propriétaire dira oui. Un fraudeur va insister pour un dépôt, ou disparaître.</b></p>
<div class="seg" role="group" aria-label="Langue du message"><button type="button" data-flang="fr" aria-pressed="${lang === "fr"}">Français</button><button type="button" data-flang="en" aria-pressed="${lang === "en"}">English</button></div>
<blockquote class="msg" id="f-msg" lang="${lang}">${esc(msg)}</blockquote>
${typeof navigator !== "undefined" && navigator.share ? `<div class="duo"><button type="button" class="btn" id="f-copier">Copier le message</button><button type="button" class="btn ghost" id="f-partager">Partager</button></div>` : `<button type="button" class="btn" id="f-copier">Copier le message</button>`}
<label for="f-rep" style="margin-top:14px">Colle sa réponse ici</label><textarea id="f-rep" rows="4" maxlength="3000" placeholder="La réponse de l'annonceur…">${esc(F.frepTxt || "")}</textarea>
<label class="drop" style="margin-top:4px">${(F.fcaps || []).length ? `<b>${F.fcaps.length} capture${F.fcaps.length > 1 ? "s" : ""} de la discussion</b> · toucher pour changer` : "Ajouter des captures de la discussion (facultatif)"}<input type="file" accept="image/*" multiple id="f-caps"></label>
${IA_ADAPT.dispo ? `<label class="ia-opt"><input type="checkbox" id="f-ia" ${iaActif() ? "checked" : ""}><span><b>Analyse intelligente de la conversation</b><span class="hint">Lit sa réponse et tes captures de la discussion, aussi en anglais : c'est là que les fraudeurs se trahissent. Envoyées à Anthropic pour l'analyse, puis oubliées.</span></span></label>` : ""}
<button type="button" class="btn ghost" id="f-lire">Analyser sa réponse</button>
${A ? `<div class="verdict ${A.c}" id="f-res" role="status"><strong>${A.t}</strong><span>${A.s}</span></div>${A.signaux.length ? `<ul class="reasons">${A.signaux.map((z) => `<li><span class="dot ${z.c}"></span><div>${z.m}</div></li>`).join("")}</ul>` : ""}` : ""}
${A && !A.ia && A.c !== "r" && IA_ADAPT.dispo && !iaActif() ? `<div class="lu"><b>Aucun mot suspect, mais un fraudeur prudent peut les éviter.</b> L'IA lit le sens de sa réponse.<button type="button" class="btn ghost" id="f-ia-go" style="margin-top:10px">Faire lire sa réponse par l'IA</button></div>` : ""}
${A && A.resume ? `<p class="lu"><b>Résumé de l'IA :</b> ${esc(A.resume)}</p>` : ""}
<p class="hint">${A && A.ia ? "Analysée par l'IA et par les règles de l'app. Elle repère des indices connus, sans certitude." : "Sans l'analyse intelligente, l'analyse se fait sur ton téléphone ; le texte n'est envoyé nulle part. Elle repère des indices connus, sans certitude."}</p></div>`;
}
function bindPlus8(v) {
  if (v !== "resultat" || !$("#f-msg")) return;
  app.querySelectorAll("[data-flang]").forEach(
    (b) =>
      (b.onclick = () => {
        F.flang = b.dataset.flang;
        F.frepTxt = $("#f-rep").value;
        go("resultat");
        setTimeout(() => {
          const e = $("#f-msg");
          if (e) e.scrollIntoView({ block: "center" });
        }, 0);
      }),
  );
  const msg = () => $("#f-msg").textContent;
  $("#f-copier").onclick = async () => {
    const b = $("#f-copier");
    try {
      await navigator.clipboard.writeText(msg());
      b.textContent = "Copié ✓";
    } catch (e) {
      const r = document.createRange();
      r.selectNodeContents($("#f-msg"));
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
      b.textContent = "Sélectionné : copie-le";
    }
    setTimeout(() => {
      if (b.isConnected) b.textContent = "Copier le message";
    }, 2500);
  };
  const p = $("#f-partager");
  if (p) p.onclick = () => navigator.share({ text: msg() }).catch(() => {});
  const fc = $("#f-caps");
  if (fc)
    fc.onchange = () => {
      F.frepTxt = $("#f-rep").value;
      F.fcaps = [...fc.files].slice(0, 4);
      go("resultat");
      setTimeout(() => {
        const e = $("#f-msg");
        if (e) e.scrollIntoView({ block: "center" });
      }, 0);
    };
  const fia = $("#f-ia");
  if (fia)
    fia.onchange = () => {
      try {
        localStorage.setItem(CLE_IA, fia.checked ? "1" : "0");
      } catch (e) {}
    };
  $("#f-lire").onclick = async () => {
    const t = $("#f-rep").value.trim(),
      caps = F.fcaps || [];
    if (t.length < 3 && !caps.length) {
      $("#f-rep").focus();
      return;
    }
    F.frepTxt = t;
    let A = analyserReponse(t);
    const b = $("#f-lire");
    if (iaActif()) {
      b.disabled = true;
      b.textContent = "Analyse de la conversation…";
      try {
        const images = [];
        for (const c of caps) images.push(await reduireImage(c));
        const r = await IA_ADAPT.analyser({ images, texte: t, mode: "conversation" });
        A = fusionFiltre(A, r);
        F.contacts = fusionContacts(F.contacts, { tels: r.telephones, courriels: r.courriels });
        try {
          MES.noter("ia_conversation");
        } catch (e) {}
      } catch (x) {
        A.s +=
          x && x.message === "quota"
            ? " (Limite d'analyses IA atteinte pour aujourd'hui : analyse simple utilisée.)"
            : " (L'analyse intelligente n'a pas fonctionné : analyse simple utilisée.)";
      }
    }
    /* Mémoire collective : les numéros et courriels donnés dans la conversation. */
    const cc = extraireContacts(t);
    F.contacts = fusionContacts(F.contacts, cc);
    const m = await memoire(cc.tels.length || cc.courriels.length ? F.contacts : { tels: [], courriels: [] }, []);
    itemsMemoire(m).forEach((x) => A.signaux.unshift({ c: x.c, m: x.t }));
    if (A.signaux.some((z) => z.c === "r") && A.c !== "r") {
      A.c = "r";
      A.t = TEXTES_FILTRE.r[0];
      A.s = TEXTES_FILTRE.r[1];
    }
    F.frep = A;
    try {
      MES.noter("filtre_analyse");
    } catch (e) {}
    go("resultat");
    setTimeout(() => {
      const e = $("#f-res");
      if (e) e.scrollIntoView({ block: "center" });
    }, 0);
  };
}
const CSS_PLUS8 = ""; /* styles déplacés dans app.css */
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS8 + "</style>");
/* Adaptateurs historique, compte, lieu (Supabase : table verifications, profil, fonctions *_connexion, fonction Vercel /api/lieu) */
const HIS = {
  liste: () =>
    HIST.map((x) => ({
      id: x.id,
      module: x.module === "reno" ? "reno" : "logement",
      date: x.created_at,
      ville: x.ville,
      ch: x.chambres,
      prix: x.prix,
      c: x.couleur,
      lien: x.lien,
      travaux: x.travaux,
      licence: x.licence,
      raisons: Array.isArray(x.raisons) ? x.raisons : [],
    })),
  async supprimer(id) {
    const { error } = await sb.from("verifications").delete().eq("id", id);
    if (error) throw error;
    HIST = HIST.filter((x) => String(x.id) !== String(id));
  },
};
const CPT = {
  courriel: () => (PROFIL && PROFIL.contact) || "",
  statut: () => {
    const k = (PROFIL && PROFIL.identite_statut) || "aucune";
    return {
      t:
        k === "confirmee" && PROFIL.identite_prenom
          ? `Identité confirmée · ${PROFIL.identite_prenom}${PROFIL.identite_nom ? " " + PROFIL.identite_nom + "." : ""}`
          : STATUT[k] || "Connecté",
      couleur: k === "confirmee" ? "var(--ok)" : k === "refusee" ? "var(--red)" : "var(--amber)",
    };
  },
};
const appareilCourt = () => {
  const u = navigator.userAgent;
  const os = /iPhone|iPad/.test(u)
    ? /iPad/.test(u)
      ? "iPad"
      : "iPhone"
    : /Android/.test(u)
      ? "Android"
      : /Mac OS X/.test(u)
        ? "Mac"
        : /Windows/.test(u)
          ? "Windows"
          : /Linux/.test(u)
            ? "Linux"
            : "Autre";
  const nav = /Edg\//.test(u)
    ? "Edge"
    : /SamsungBrowser/.test(u)
      ? "Samsung"
      : /Firefox|FxiOS/.test(u)
        ? "Firefox"
        : /Chrome|CriOS/.test(u)
          ? "Chrome"
          : /Safari/.test(u)
            ? "Safari"
            : "Autre";
  return os + " · " + nav;
};
let LIEU_NOTE = false;
const LIEU = {
  dispo: true,
  demo: false,
  actif: () => !!(PROFIL && PROFIL.partage_lieu),
  async definir(b) {
    await rpc("definir_partage_lieu", { p_actif: b });
    if (PROFIL) PROFIL.partage_lieu = b;
    if (b) {
      LIEU_NOTE = false;
      return noterLieu();
    }
    return null;
  },
};
/* Une fois par ouverture de l'app, seulement si la personne l'a activé */
