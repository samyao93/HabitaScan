const PUBLIQUES = ["bienvenue", "inscription", "code", "victime", "erreur", "confidentialite", "conditions"];
function go(v) {
  if (!SESSION && !PUBLIQUES.includes(v)) {
    if (F.partage) LS.set("vl_partage", { annonce: F.annonce, lien: F.lien });
    v = "bienvenue";
  }
  if (v === "admin" && !ADM.estAdmin()) v = "accueil";
  app.dataset.v = v;
  app.innerHTML = V[v]();
  try {
    window.hsTheme && hsTheme.appliquer();
  } catch (e) {}
  window.scrollTo(0, 0);
  bind(v);
  bindPlus(v);
  bindPlus3(v);
  bindPlus4(v);
  bindPlus5(v);
  bindPlus6(v);
  bindPlus7(v);
  bindPlus8(v);
}
const err = (m) => {
  const e = $("#e");
  if (e) {
    e.textContent = m;
    e.hidden = !m;
  }
};
const busy = (on, label) => {
  const b = $("#go");
  if (b) {
    b.disabled = on;
    if (label) b.textContent = label;
  }
};
function appliquerLecture(r) {
  ["prix", "ch", "ville", "cession"].forEach((k) => {
    if (r[k]) F[k] = r[k];
  });
  if (r.lien && !F.lien) F.lien = r.lien;
  const res = resumeLecture(r);
  F.lu = res
    ? `<b>Lu :</b> ${esc(res)}. Vérifie et corrige si besoin.`
    : "Je n'ai pas trouvé le prix ni la ville : remplis-les ci-dessous.";
}
function keep() {
  ["annonce", "lien", "ville", "ch", "prix", "adr", "txt", "contact"].forEach((k) => {
    const el = $("#" + k);
    if (el) F[k] = el.value;
  });
}

/* Compte facultatif : chaque appareil reçoit une session anonyme ; créer un compte la relie à un courriel ou un cellulaire (même historique). */
/* Compte obligatoire : une session existe seulement après la validation du code (courriel ou cellulaire). */
async function ouvrirSession() {
  try {
    const { data } = await sb.auth.getSession();
    const u = data.session && data.session.user;
    SESSION = !!u && !u.is_anonymous;
    ANONYME = !SESSION;
  } catch (e) {
    SESSION = false;
    ANONYME = true;
  }
}
async function envoyerCode() {
  if (SESSION && ANONYME) {
    F.typeCode = F.cible.email ? "email_change" : "phone_change";
    const r = await sb.auth.updateUser(F.cible);
    const m = ((r.error && r.error.message) || "").toLowerCase();
    if (!r.error || !(m.includes("already") || m.includes("registered") || m.includes("exists"))) return r;
  }
  F.typeCode = F.cible.email ? "email" : "sms";
  return sb.auth.signInWithOtp({ ...F.cible, options: { shouldCreateUser: true } });
}
async function rechercheImages(f) {
  try {
    const b64 = await reduireImage(f);
    const appel = sb.functions.invoke("recherche-image", { body: { image: b64 } });
    const { data, error } = await Promise.race([
      appel,
      new Promise((r) => setTimeout(() => r({ error: "delai" }), 9000)),
    ]);
    /* La page de l'annonce elle-même n'est pas une copie : on retire les résultats du même site. */
    const hote = (u) => {
        try {
          return new URL(u).hostname.replace(/^(www|m|web)\./, "");
        } catch (e) {
          return "";
        }
      },
      site = F.lienN ? hote(F.lienN) : "";
    return error || !data
      ? null
      : {
          ok: true,
          details: ((data && data.details) || []).filter(
            (d) => d && typeof d.url === "string" && /^https?:\/\//.test(d.url) && (!site || hote(d.url) !== site),
          ),
          pages: (data.pages || []).filter((u) => /^https?:\/\//.test(u) && (!site || hote(u) !== site)),
        };
  } catch (e) {
    return null;
  }
}
async function chargerProfil() {
  if (!SESSION) {
    PROFIL = null;
    HIST = [];
    EST_ADMIN = false;
    return;
  }
  const { data } = await sb.from("profiles").select("*").maybeSingle();
  PROFIL = data;
  try {
    EST_ADMIN = !!(await rpc("est_admin"));
  } catch (e) {
    EST_ADMIN = false;
  }
  const h = await sb
    .from("verifications")
    .select("id,module,ville,chambres,prix,couleur,raisons,lien,travaux,licence,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  HIST = h.data || [];
  noterLieu();
}
async function chargerRegistre() {
  try {
    const { count, error } = await sb.from("licences_rbq").select("numero", { count: "exact", head: true });
    REGISTRE_PRET = !error && count > 0;
  } catch (e) {
    REGISTRE_PRET = false;
  }
}
async function chargerLoyers() {
  const { data } = await sb.from("loyers_reference").select("ville,chambres,loyer");
  LOYERS = {};
  (data || []).forEach((r) => {
    (LOYERS[r.ville] = LOYERS[r.ville] || [0, 0, 0])[r.chambres - 1] = r.loyer;
  });
  const ordre = Object.entries(LOYERS).sort((a, b) => b[1][1] - a[1][1]);
  LOYERS = Object.fromEntries(ordre);
}
const msgAuth = (e) => {
  const m = ((e && e.message) || "").toLowerCase();
  if (m.includes("rate") || m.includes("seconds"))
    return "Trop de demandes. Attends une minute avant de redemander un code.";
  if (m.includes("phone") || m.includes("sms") || m.includes("provider"))
    return "L'envoi par SMS n'est pas encore activé. Utilise ton courriel.";
  if (m.includes("expired") || m.includes("invalid")) return "Code incorrect ou expiré.";
  if (m.includes("sending") || m.includes("email") || (e && e.status === 500))
    return "Le courriel n'a pas pu être envoyé. Vérifie l'adresse, puis réessaie dans quelques minutes.";
  return "Une erreur est survenue. Réessaie dans un instant.";
};

function bind(v) {
  app.querySelectorAll("[data-go]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.id === "nouvR") F = {};
        go(b.dataset.go);
      }),
  );
  app.querySelectorAll("[data-canal]").forEach(
    (b) =>
      (b.onclick = () => {
        F.canal = b.dataset.canal;
        F.ident = "";
        go("inscription");
      }),
  );
  app.querySelectorAll("[data-yn]").forEach(
    (b) =>
      (b.onclick = () => {
        F[b.dataset.yn] = b.dataset.v;
        b.parentNode.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        if (b.dataset.yn === "cession") $("#q-accord").hidden = b.dataset.v !== "oui";
      }),
  );
  {
    const pl = $("#photos-log");
    if (pl)
      pl.onchange = () => {
        const fs = [...pl.files].slice(0, 4);
        if (!fs.length) return;
        keep();
        F.photosLog = fs;
        go("verifier");
      };
  }
  app.querySelectorAll("input[data-captures]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const fs = [...inp.files].slice(0, 4);
        if (!fs.length) return;
        keep();
        F.captures = fs;
        F.vignettes = fs.map((f) => URL.createObjectURL(f));
        F.capture = fs[0];
        F.ocr = true;
        F.iaOff = false;
        F.ia = null;
        go(v);
      }),
  );
  app.querySelectorAll("input[type=file][data-side]").forEach(
    (inp) =>
      (inp.onchange = () => {
        const f = inp.files[0];
        if (!f) return;
        const s = inp.dataset.side;
        F[s] = f;
        F[s + "Url"] = URL.createObjectURL(f);
        keep();
        lireReno(F);
        if (v === "verifier" && s === "capture") F.ocr = true;
        go(v);
      }),
  );

  if (v === "inscription")
    $("#f-ins").onsubmit = async (e) => {
      e.preventDefault();
      err("");
      const val = $("#ident").value.trim();
      F.ident = val;
      if ((F.canal || "courriel") === "courriel") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return err("Entre une adresse courriel valide.");
        F.cible = { email: val.toLowerCase() };
        F.affiche = val;
      } else {
        const d = val.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
        if (d.length !== 10) return err("Entre un numéro de 10 chiffres.");
        F.cible = { phone: "+1" + d };
        F.affiche = d.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2-$3");
      }
      busy(true, "Envoi…");
      const { error } = await envoyerCode();
      if (error) {
        busy(false, "Réessayer");
        return err(msgAuth(error));
      }
      go("code");
    };

  if (v === "code") {
    const ins = [...app.querySelectorAll(".otp input")];
    ins[0].focus();
    ins.forEach((x, i) => {
      x.oninput = () => {
        x.value = x.value.replace(/\D/g, "").slice(-1);
        if (x.value && i < 5) ins[i + 1].focus();
      };
      x.onkeydown = (e) => {
        if (e.key === "Backspace" && !x.value && i) ins[i - 1].focus();
      };
      x.onpaste = (e) => {
        const d = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
        if (d.length) {
          e.preventDefault();
          d.split("").forEach((c, j) => (ins[j].value = c));
          ins[Math.min(d.length, 5)].focus();
        }
      };
    });
    let t = 60;
    const tick = setInterval(() => {
      t--;
      const s = $("#t");
      if (!s) {
        clearInterval(tick);
        return;
      }
      s.textContent = t;
      if (t <= 0) {
        clearInterval(tick);
        $("#renvoi").disabled = false;
        $("#renvoi").textContent = "Renvoyer le code";
      }
    }, 1000);
    $("#renvoi").onclick = async () => {
      const { error } = await envoyerCode();
      if (error) return err(msgAuth(error));
      go("code");
    };
    $("#f-code").onsubmit = async (e) => {
      e.preventDefault();
      err("");
      const token = ins.map((x) => x.value).join("");
      if (token.length < 6) return err("Entre les 6 chiffres.");
      busy(true, "Vérification…");
      const { error } = await sb.auth.verifyOtp({ ...F.cible, token, type: F.typeCode });
      if (error) {
        busy(false, "Valider");
        return err(msgAuth(error));
      }
      clearInterval(tick);
      F = {};
      await ouvrirSession();
      await chargerProfil();
      const pa = LS.get("vl_partage");
      if (pa) {
        LS.set("vl_partage", null);
        F = { annonce: pa.annonce, lien: pa.lien, partage: true };
        return go("verifier");
      }
      const sig = LS.get("vl_sig");
      if (sig) {
        if (PROFIL && PROFIL.identite_statut === "confirmee") {
          F = sig;
          return go("signaler");
        }
        return go(PROFIL && PROFIL.identite_statut === "en_attente" ? "attente" : "identite");
      }
      go("accueil");
    };
  }

  if (v === "identite") {
    $("#doc").value = F.doc || "permis";
    $("#doc").onchange = (e) => {
      F.doc = e.target.value;
      if (F.doc === "passeport") {
        F.verso = null;
        F.versoUrl = null;
      }
      go("identite");
    };
    $("#f-id").onsubmit = async (e) => {
      e.preventDefault();
      err("");
      const doc = F.doc || "permis";
      if (!F.recto) return err("Ajoute la photo du recto.");
      if (doc !== "passeport" && !F.verso) return err("Ajoute la photo du verso.");
      if (!$("#ok").checked) return err("Coche la case pour continuer.");
      busy(true, "Lecture de la pièce…");
      F.doc = doc;
      try {
        const images = [await reduireImage(F.recto)];
        if (F.verso) images.push(await reduireImage(F.verso));
        const { data, error } = await sb.functions.invoke("lire-identite", { body: { images, doc_type: doc } });
        if (!error && data && !data.error) {
          F.lecture = data;
          return go("identiteLecture");
        }
      } catch (x) {}
      /* Lecture indisponible (IA désactivée, quota, réseau) : vérification entièrement manuelle. */
      return envoyerPiece();
    };
  }
  if (v === "identiteLecture") {
    $("#go").onclick = () => envoyerPiece();
    $("#reprendre").onclick = () => {
      F.recto = F.verso = F.rectoUrl = F.versoUrl = F.lecture = null;
      go("identite");
    };
  }

  if (v === "compte" && $("#deco"))
    $("#deco").onclick = async () => {
      await sb.auth.signOut();
      PROFIL = null;
      HIST = [];
      F = {};
      SESSION = false;
      LIEU_NOTE = false;
      go("bienvenue");
    };
  if (v === "resultat" && $("#signaler"))
    $("#signaler").onclick = () => {
      const sig = { lienN: F.lienN, ville: F.ville, contacts: F.contacts, photos: F.photos };
      LS.set("vl_sig", sig);
      if (ANONYME) return go("inscription");
      const st = PROFIL && PROFIL.identite_statut;
      if (st === "confirmee") {
        F = sig;
        return go("signaler");
      }
      go(st === "en_attente" ? "attente" : "identite");
    };
  if (v === "signaler") {
    if (!peutSignaler(F)) {
      const sig = LS.get("vl_sig");
      if (sig) F = sig;
    }
    lierSignaler(F);
    $("#f-sig").onsubmit = async (e) => {
      e.preventDefault();
      err("");
      const m = validerSignal(F);
      if (m) return err(m);
      busy(true, "Envoi…");
      let ok = false;
      if (F.lienN) {
        const { error } = await sb.from("signalements").insert({ lien: F.lienN, motif: F.motif });
        if (!error || String(error.code).includes("23505")) ok = true;
      }
      const c = F.contacts || { tels: [], courriels: [] };
      if (c.tels.length || c.courriels.length || (F.photos || []).length) {
        const { error } = await sb.rpc("signaler_cles", {
          p_motif: F.motif,
          p_tels: c.tels,
          p_courriels: c.courriels,
          p_photos: F.photos || [],
        });
        if (!error) ok = true;
      }
      if (!ok) {
        busy(false, "Réessayer");
        return err("Le signalement n'a pas pu être envoyé. Réessaie.");
      }
      LS.set("vl_sig", null);
      F = {};
      go("signalOk");
    };
  }
  if (v === "verifier") {
    $("#lire").onclick = () => {
      keep();
      F.coller = true;
      if (iaActif() && !F.iaOff) {
        go("verifier");
        return lancerIA(true);
      }
      appliquerLecture(extraireAnnonce(F.annonce, Object.keys(LOYERS)));
      go("verifier");
    };
    if (F.partage) {
      F.partage = false;
      appliquerLecture(extraireAnnonce(F.annonce, Object.keys(LOYERS)));
      return go("verifier");
    }
    if (F.ocr && iaActif() && !F.iaOff) {
      F.ocr = false;
      lancerIA(false);
    }
    if (F.ocr) {
      F.ocr = false;
      F.lu = null;
      const n = (F.captures || []).length;
      $("#f-ver").insertAdjacentHTML(
        "afterbegin",
        `<p class="lu" role="status">Lecture de ${n > 1 ? n + " captures" : "la capture"}…</p>`,
      );
      (async () => {
        let tout = "";
        for (const c of F.captures || []) tout += "\n" + (await lireCapture(c));
        return tout;
      })()
        .then((txt) => {
          const ici = $("#f-ver");
          if (ici) keep();
          F.ocrTxt = txt.trim();
          appliquerLecture(extraireAnnonce(F.ocrTxt, Object.keys(LOYERS)));
          if (ici) go("verifier");
        })
        .catch(() => {
          F.lu = "La lecture des captures n'a pas fonctionné ici. Remplis les champs, ou colle le texte.";
          F.coller = true;
          if ($("#f-ver")) go("verifier");
        });
    }
  }

  if (v === "verifier") {
    $("#ch").value = F.ch || "2";
    $("#f-ver").onsubmit = async (e) => {
      e.preventDefault();
      keep();
      err("");
      F.prixN = parseInt(String(F.prix).replace(/\D/g, ""), 10);
      if (!F.prixN || F.prixN < 100) return err("Entre le loyer demandé.");
      if (!F.argent || !F.visite || !F.cession) return err("Réponds aux trois questions.");
      if (F.cession === "oui" && !F.accord) return err("Dis-nous si le propriétaire a accepté par écrit.");
      F.lienN = normaliser(F.lien);
      if (F.lien && F.lien.trim() && !F.lienN)
        return err("Ce lien n'est pas valide. Colle l'adresse complète de l'annonce, ou laisse le champ vide.");
      F.titre = "Vérification";
      F.msg = "Analyse de l'annonce…";
      go("analyse");
      F.stats = null;
      F.nbSig = 0;
      F.images = null;
      if (F.lienN && SESSION) {
        const [a, b] = await Promise.all([
          sb.rpc("stats_lien", { p_lien: F.lienN }),
          sb.rpc("nb_signalements", { p_lien: F.lienN }),
        ]);
        F.stats = a.data && a.data[0];
        F.nbSig = +b.data || 0;
      }

      F.contacts = fusionContacts(extraireContacts(F.contact, F.annonce, F.ocrTxt, F.txt), {
        tels: (F.ia || {}).telephones,
        courriels: (F.ia || {}).courriels,
      });
      F.photos = [
        ...new Set([...(await empreintesPhotos(F.photosLog, true)), ...(await empreintesCaptures(F.captures))]),
      ].slice(0, 12);
      F.texteEmp = empreinteTexte(F.annonce && F.annonce.length > 80 ? F.annonce : F.ocrTxt || F.annonce);
      const img = (F.photosLog || [])[0] || F.zonePhoto || F.capture;
      [F.mem, F.copie, F.images, F.copiesWeb] = await Promise.all([
        memoire(F.contacts, F.photos),
        retrouverAnnonce(),
        img ? rechercheImages(img) : null,
        chercherCopies(),
      ]);
      F.res = analyser();
      const brut = F.res.items.map((i) => ({
        c: i.c,
        t: String(i.t).slice(0, 1500),
        law: String(i.law || "").slice(0, 800),
      }));
      const base = { ville: F.ville, chambres: +F.ch, prix: F.prixN, couleur: F.res.c, raisons: brut, lien: F.lienN };
      const ins = !SESSION
        ? Promise.resolve()
        : sb
            .from("verifications")
            .insert({ ...base, photos: F.photos.length ? F.photos : null, texte_empreinte: F.texteEmp || null })
            .then((r) => (r && r.error ? sb.from("verifications").insert(base) : r));
      await Promise.all([ins, new Promise((r) => setTimeout(r, 900))]);
      await chargerProfil();
      go("resultat");
    };
  }
  if (v === "resultat")
    $("#nouv").onclick = () => {
      F = {};
      go("verifier");
    };

  if (v === "reno") {
    lierReno(F);
    $("#f-reno").onsubmit = async (e) => {
      e.preventDefault();
      lireReno(F);
      err("");
      const m = validerReno(F);
      if (m) return err(m);
      const lic = chiffres(F.licence);
      F.titre = "Vérification";
      F.msg = "Analyse de la soumission…";
      go("analyse");
      let R; /* undefined = registre pas encore importé : l'app renvoie au registre officiel */
      if (lic && REGISTRE_PRET) {
        const { data, error } = await sb
          .from("licences_rbq")
          .select("numero,nom,autres_noms,sous_categories,mandataire")
          .eq("numero", lic)
          .maybeSingle();
        if (!error) R = data || null;
      }
      F.res = analyserReno(F, R);
      const brut = F.res.items.map((i) => ({
        c: i.c,
        t: String(i.t).slice(0, 1500),
        law: String(i.law || "").slice(0, 800),
      }));
      const ins = !SESSION
        ? Promise.resolve()
        : sb
            .from("verifications")
            .insert({ module: "reno", travaux: F.travaux, licence: lic || null, couleur: F.res.c, raisons: brut });
      await Promise.all([ins, new Promise((r) => setTimeout(r, 700))]);
      await chargerProfil();
      go("renoResultat");
    };
  }
  if (v === "renoResultat") {
    lierResultatReno(F);
    $("#nouv").onclick = () => {
      F = {};
      go("reno");
    };
  }
}

function analyser() {
  const it = [],
    txt = ((F.txt || "") + " " + (F.annonce || "") + " " + (F.ocrTxt || "")).toLowerCase(),
    L1904 =
      'Code civil du Québec, art. 1904 · <a href="https://www.quebec.ca/nouvelles/actualites/details/exiger-un-depot-de-garantie-est-illegal" target="_blank" rel="noopener">Québec.ca</a>';
  const motA = trouverMot(txt, MOTS_ARGENT),
    motP = trouverMot(txt, MOYENS_FRAUDE),
    motS = trouverMot(txt, MOTS_SCENARIO);
  if (F.argent === "oui")
    it.push({
      c: "r",
      t: "<b>On te demande de l'argent avant le bail.</b> Au Québec, le propriétaire peut seulement exiger le premier mois de loyer, et aucun dépôt.",
      law: L1904,
    });
  if (motP)
    it.push({
      c: "r",
      t: `<b>Paiement par « ${esc(motP)} ».</b> Aucun propriétaire honnête ne demande ce moyen de paiement : il est presque impossible de récupérer l'argent.`,
    });
  if (motA && F.argent !== "oui")
    it.push({
      c: "y",
      t: `<b>Il est question de « ${esc(motA)} ».</b> Si on te demande un dépôt ou des frais avant le bail, c'est illégal. Seul le premier mois de loyer peut être exigé d'avance.`,
      law: L1904,
    });
  if (motS) it.push({ c: "y", t: `<b>Scénario d'arnaque courant</b> repéré : « ${esc(motS)} ».` });
  itemsProfil(F).forEach((x) => it.push(x));
  itemsIA(F).forEach((x) => it.push(x));
  if (F.visite === "non")
    it.push({ c: "y", t: "<b>Tu n'as pas visité.</b> Ne paie rien sans avoir vu le logement en personne." });
  else
    it.push({
      c: "g",
      t: "Tu as visité le logement. Attention : un fraudeur peut louer un logement quelques jours pour le faire visiter.",
    });
  if (F.cession === "oui" && F.argent === "oui")
    it.push({
      c: "r",
      t: "<b>Le locataire te demande de l'argent.</b> En cession de bail, le locataire qui part ne peut rien exiger de toi en échange : pas de « frais de reprise », pas de dépôt.",
      law: 'Avis de cession du TAL · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf" target="_blank" rel="noopener">TAL</a>',
    });
  if (F.cession === "oui")
    it.push({
      c: "i",
      t: "<b>Locataire actuel :</b> la preuve, c'est l'accord écrit du propriétaire, avec ton nom. Pour savoir qui doit le signer, touche le bouton <b>« Vérifier le propriétaire »</b>, plus bas sur cette page : il trouve le vrai propriétaire à partir de l'adresse seulement, sans rien demander à l'annonceur.",
    });
  if (F.cession === "oui")
    it.push(
      F.accord === "oui"
        ? { c: "g", t: "Accord écrit du propriétaire : bon signe." }
        : {
            c: "y",
            t: "<b>Pas encore d'accord écrit du propriétaire.</b> Depuis 2024, il peut refuser une cession même sans motif sérieux (le bail du locataire actuel prend alors fin, et tu n'as pas de logement). Ne paie rien avant sa réponse écrite ou la fin du délai de 15 jours.",
            law: 'Code civil du Québec, art. 1870, 1871 et 1978.2 · <a href="https://educaloi.qc.ca/capsules/la-cession-de-bail-et-la-sous-location-de-logement/" target="_blank" rel="noopener">Éducaloi</a> · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_828_E.pdf" target="_blank" rel="noopener">TAL</a>',
          },
    );
  if (F.lienN) {
    const h = new URL(F.lienN).hostname,
      site = SITES.find((s) => h === s.d || h.endsWith("." + s.d));
    if (!site)
      it.push({
        c: "y",
        t: `<b>Site inconnu : ${esc(h)}.</b> Les fraudeurs copient parfois de vrais sites d'annonces. Vérifie l'adresse lettre par lettre.`,
      });
    const st = F.stats;
    if (st && +st.rouges > 0)
      it.push({
        c: "r",
        t: `<b>${st.rouges} vérification${st.rouges > 1 ? "s" : ""} précédente${st.rouges > 1 ? "s" : ""} de cette annonce ${st.rouges > 1 ? "ont" : "a"} donné « Ne paie pas ».</b>`,
      });
    else if (st && +st.total > 0)
      it.push({ c: "i", t: `Cette annonce a déjà été vérifiée ${st.total} fois, sans arnaque probable.` });
    const sg = itemSignalements(F.nbSig);
    if (sg) it.push(sg);
  }
  itemsMemoire(F.mem).forEach((x) => it.push(x));
  itemsRecopie(F.copie).forEach((x) => it.push(x));
  itemsCopiesWeb(F).forEach((x) => it.push(x));
  if (F.images && F.images.pages && F.images.pages.length)
    it.push({
      c: "y",
      t: `<b>Ces images apparaissent sur ${F.images.pages.length} autre${F.images.pages.length > 1 ? "s" : ""} page${F.images.pages.length > 1 ? "s" : ""} du web.</b> Les fraudeurs copient souvent les photos d'une vraie annonce. ${F.images.pages
        .filter(urlWeb)
        .slice(0, 3)
        .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname)}</a>`)
        .join(", ")}`,
      law: "Recherche d'image inversée (Google Vision)",
    });
  else if (F.images && F.images.ok)
    it.push({ c: "g", t: "Les images de la capture n'ont pas été trouvées ailleurs sur le web." });
  if (!F.images)
    it.push({
      c: "i",
      t: "Astuce : cherche la photo de l'annonce avec Google Lens (dans l'app Google) pour voir si elle est publiée ailleurs.",
    });
  const loy = LOYERS[F.ville],
    moy = loy && loy[Math.min(+F.ch, 3) - 1],
    LSCHL = "SCHL, loyers moyens octobre 2025";
  /* Prix bas : jamais un signal à lui seul (vieil immeuble, quartier moins cher, propriétaire de longue date).
    Il ne devient jaune que s'il s'ajoute à un autre signal d'alarme. */
  const autreSignal = it.some((i) => i.c === "r" || i.c === "y");
  if (moy) {
    const r = F.prixN / moy;
    if (r < BAS && F.cession === "oui")
      it.push({
        c: "i",
        t: `<b>Prix sous la moyenne</b> (${money(moy)} à ${esc(F.ville)}) : normal pour une cession, car le nouveau locataire reprend le bail existant et son loyer.`,
        law: 'Code civil du Québec, art. 1870 à 1873 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_817_E.pdf" target="_blank" rel="noopener">TAL</a>',
      });
    else if (r < BAS && autreSignal)
      it.push({
        c: "y",
        t: `<b>Prix nettement sous la moyenne, en plus d'un autre signal.</b> ${money(F.prixN)} contre ${money(moy)} en moyenne à ${esc(F.ville)}. Un prix trop beau combiné à ces signaux est l'appât classique des fausses annonces.`,
        law: LSCHL,
      });
    else if (r < BAS)
      it.push({
        c: "i",
        t: `<b>Prix sous la moyenne</b> (${money(moy)} à ${esc(F.ville)}). Ça arrive souvent : vieil immeuble, quartier moins cher, propriétaire de longue date. Pas un signe d'arnaque à lui seul.`,
        law: LSCHL,
      });
    else if (r > HAUT)
      it.push({
        c: "i",
        t: `<b>Prix élevé</b> (${money(moy)} en moyenne). Pas une arnaque en soi : vérifie la section G du bail. Tu peux demander au Tribunal de fixer le loyer dans les 10 jours suivant la signature.`,
        law: 'Code civil du Québec, art. 1896 · <a href="https://www.tal.gouv.qc.ca/sites/default/files/Ajustement-bail-logement.pdf" target="_blank" rel="noopener">TAL, formulaire de bail</a>',
      });
    else
      it.push({
        c: "g",
        t: `<b>Prix dans la normale</b> pour ${esc(F.ville)} (${money(moy)} en moyenne).`,
        law: LSCHL,
      });
  } else it.push({ c: "i", t: "Pas encore de loyer de référence pour cette ville." });
  const c = it.some((i) => i.c === "r") ? "r" : it.some((i) => i.c === "y") ? "y" : "g";
  const ord = { r: 0, y: 1, i: 2, g: 3 };
  it.sort((a, b) => ord[a.c] - ord[b.c]);
  return { c, items: it };
}
