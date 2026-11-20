/* ===== HabitaScan : historique détaillé, mon compte, lieu de connexion (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, money, top, lienExt, TRAVAUX, formatLicence, ADM, lienConditions, lienConfidentialite
   Adaptateurs :
   HIS  : liste() → [{id, module:"logement"|"reno", date, ville, ch, prix, c, lien, travaux, licence, raisons:[{c,t,law}]}] ; supprimer(id) → Promise
   CPT  : courriel() ; statut() → {t, couleur}
   LIEU : dispo ; actif() → bool ; definir(bool) → Promise ; demo (bool)
   ADM  : connexions() ; lieuxResume() ; partageStats() */
const TITRE_VERDICT = {
  logement: {
    r: "Ne paie pas",
    y: "Visite d'abord, puis vérifie le propriétaire",
    g: "Aucun signal. Tu peux visiter.",
  },
  reno: { r: "Ne signe pas, ne paie pas", y: "Prudence", g: "Aucun signal d'alarme" },
};
const TAG_VERDICT = {
  logement: { r: "Ne paie pas", y: "Visite d'abord", g: "Aucun signal" },
  reno: { r: "Ne pas signer", y: "Prudence", g: "Aucun signal" },
};
const REGLE_VERDICT = {
  logement: {
    r: "N'envoie aucun argent et ne donne aucune pièce d'identité à cette personne.",
    y: "Ne paie rien avant d'avoir visité et confirmé qui est le propriétaire.",
    g: "Avant de payer : confirme le propriétaire, puis signe le bail. Le premier mois se paie à la signature, jamais avant, et jamais de dépôt.",
  },
  reno: {
    r: "Ne signe rien et ne verse aucun acompte.",
    y: "Vérifie la licence et les plaintes avant de signer.",
    g: "Paie selon l'avancement des travaux, jamais tout d'avance.",
  },
};
const PROVINCES = {
  QC: "Québec",
  ON: "Ontario",
  NB: "Nouveau-Brunswick",
  NS: "Nouvelle-Écosse",
  PE: "Île-du-Prince-Édouard",
  NL: "Terre-Neuve-et-Labrador",
  MB: "Manitoba",
  SK: "Saskatchewan",
  AB: "Alberta",
  BC: "Colombie-Britannique",
  YT: "Yukon",
  NT: "Territoires du Nord-Ouest",
  NU: "Nunavut",
};
const lieuTexte = (x) =>
  [x.ville, x.pays === "CA" ? PROVINCES[x.region] || x.region : x.region, x.pays && x.pays !== "CA" ? x.pays : ""]
    .filter(Boolean)
    .join(", ") || "Inconnu";
/* Texte enregistré : on échappe tout, puis on ne réautorise que <b>, <strong>, <em> et les liens https */
function nettoyerHTML(s) {
  let h = esc(String(s || ""));
  h = h.replace(/&lt;(\/?)(b|strong|em)&gt;/g, "<$1$2>");
  h = h
    .replace(
      /&lt;a href=&quot;(https:\/\/[^\s"<>]*?)&quot;.*?&gt;/g,
      (m, u) => `<a href="${u}" target="_blank" rel="noopener">`,
    )
    .replace(/&lt;\/a&gt;/g, "</a>");
  if ((h.match(/<a /g) || []).length > (h.match(/<\/a>/g) || []).length) h += "</a>";
  return h;
}
const dateCourte = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return "";
  }
};
const dateLongue = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
  } catch (e) {
    return "";
  }
};
const nomTravaux = (k) => (TRAVAUX[k] || { l: "Travaux" }).l.split(/ \(|,/)[0];
function titreVerif(x) {
  return x.module === "reno"
    ? `Réno · ${esc(nomTravaux(x.travaux))}`
    : `${esc(x.ville || "Ville inconnue")} · ${x.ch == 3 ? "3+" : esc(x.ch ?? "?")} ch.`;
}
function sousTitreVerif(x) {
  const p = [dateCourte(x.date)];
  if (x.module === "reno") {
    if (x.licence) p.push(`RBQ ${esc(formatLicence(x.licence))}`);
  } else if (x.prix) p.push(money(+x.prix) + "/mois");
  return p.filter(Boolean).join(" · ");
}
const ligneVerif = (
  x,
) => `<button type="button" class="hrow" data-verif="${esc(x.id)}" aria-label="Voir le détail : ${titreVerif(x).replace(/<[^>]+>/g, "")}">
<span class="hdot ${x.c}"></span><span class="hmain"><b>${titreVerif(x)}</b><small>${sousTitreVerif(x)}</small></span><span class="tag ${x.c}">${(TAG_VERDICT[x.module] || TAG_VERDICT.logement)[x.c] || ""}</span><span class="chev" aria-hidden="true">›</span></button>`;

/* Carte d'accueil : les 3 dernières, cliquables */
function blocHistorique() {
  const L = HIS.liste();
  return `<div class="card"><div class="card-tete"><h2>Mes vérifications</h2>${L.length ? `<button type="button" class="lienbtn" data-go="historique">Tout voir${L.length > 3 ? ` (${L.length})` : ""}</button>` : ""}</div>
${L.length ? `<div class="hlist">${L.slice(0, 3).map(ligneVerif).join("")}</div>` : `<div class="vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Chaque annonce que tu vérifies est gardée ici, avec son résultat complet.</p></div>`}</div>`;
}

function vueHistorique() {
  const L = HIS.liste(),
    f = F.hfiltre || "tout";
  const nbL = L.filter((x) => x.module !== "reno").length,
    nbR = L.length - nbL;
  const V = L.filter((x) => f === "tout" || (f === "reno" ? x.module === "reno" : x.module !== "reno"));
  const o = (k, t, n) =>
    `<button type="button" data-hfiltre="${k}" aria-pressed="${f === k}">${t} <span class="num">${n}</span></button>`;
  return `${top("accueil", "Mes vérifications")}
<h1>Mes vérifications</h1><p class="soft">Touche une vérification pour revoir son résultat complet.</p>
${
  L.length
    ? `${nbR ? `<div class="seg seg3" role="group" aria-label="Filtrer">${o("tout", "Toutes", L.length)}${o("logement", "Logement", nbL)}${o("reno", "Réno", nbR)}</div>` : ""}
<div class="card"><div class="hlist">${V.map(ligneVerif).join("") || `<p class="soft">Rien dans cette catégorie.</p>`}</div></div>`
    : `<div class="card vide"><p><b>Aucune vérification pour l'instant.</b></p><p class="soft">Vérifie une annonce pour la retrouver ici.</p><button class="btn" data-go="verifier">Vérifier une annonce</button></div>`
}`;
}

function vueDetailVerif() {
  const x = HIS.liste().find((v) => String(v.id) === String(F.verifId));
  const retour = F.retourVerif || "historique";
  if (!x)
    return `${top(retour, "Détail")}<div class="card vide"><p><b>Cette vérification n'existe plus.</b></p><button class="btn" data-go="historique">Mes vérifications</button></div>`;
  const m = x.module === "reno" ? "reno" : "logement",
    R = x.raisons || [];
  const ligne = (k, v) => (v ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "");
  const lienOk = x.lien && /^https?:\/\//i.test(x.lien);
  return `${top(retour, "Détail")}
<div class="verdict ${x.c}"><strong>${TITRE_VERDICT[m][x.c] || ""}</strong><span>${titreVerif(x)}</span></div>
<div class="card"><h2>Détails</h2><dl class="details">
${ligne("Vérifiée le", esc(dateLongue(x.date)))}
${
  m === "logement"
    ? ligne("Ville", esc(x.ville || "")) +
      ligne("Chambres", x.ch == 3 ? "3 et plus" : esc(x.ch ?? "")) +
      ligne("Loyer demandé", x.prix ? `<span class="num">${money(+x.prix)}</span> par mois` : "") +
      ligne("Annonce", lienOk ? lienExt(esc(x.lien), "Ouvrir l'annonce ↗") : "Aucun lien fourni")
    : ligne("Travaux", esc((TRAVAUX[x.travaux] || { l: "" }).l)) +
      ligne("Licence RBQ", x.licence ? `<span class="num">${esc(formatLicence(x.licence))}</span>` : "Non fournie")
}
${ligne("Référence", `<span class="num">${esc(String(x.id).slice(0, 8).toUpperCase())}</span>`)}
</dl></div>
<div class="card"><h2>Ce que l'app a vérifié</h2>${R.length ? `<ul class="reasons">${R.map((i) => `<li><span class="dot ${esc(i.c)}"></span><div>${nettoyerHTML(i.t)}${i.law ? `<div class="law">${nettoyerHTML(i.law)}</div>` : ""}</div></li>`).join("")}</ul>` : `<p class="soft">Le détail n'a pas été conservé pour cette ancienne vérification.</p>`}</div>
<p class="rule">${REGLE_VERDICT[m][x.c] || ""}</p>${m === "logement" && x.c !== "r" ? `<p class="rule paiement">${REGLE_PAIEMENT}</p>` : ""}
<p class="hint">Résultat calculé le ${esc(dateCourte(x.date))} avec les informations fournies à ce moment. Une annonce peut changer : vérifie-la de nouveau avant de payer.</p>
${m === "logement" ? `<button class="btn" data-go="verifier">Vérifier une autre annonce</button>` : `<button class="btn" data-go="reno">Vérifier un autre entrepreneur</button>`}
<button class="btn ghost danger-txt" id="h-suppr">Retirer de mon historique</button>
<p class="err" id="err" role="alert"></p>`;
}

/* Mon compte */
function vueCompte() {
  const st = CPT.statut();
  const nbH = HIS.liste().length;
  return `${top("accueil", "Mon compte")}
<div class="card compte-tete"><span class="avatar" aria-hidden="true">${esc((CPT.courriel() || "?").charAt(0).toUpperCase())}</span><div><b>${esc(CPT.courriel() || "")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></div></div>
${PROFIL && ["aucune", "refusee"].includes(PROFIL.identite_statut || "aucune") ? `<button class="btn ghost" data-go="identite">Confirmer mon identité<small>Une photo de ta pièce d'identité. Nécessaire seulement pour signaler une annonce.</small></button>` : PROFIL && PROFIL.identite_statut === "en_attente" ? `<p class="hint centre">Ta pièce d'identité est en vérification par notre équipe.</p>` : ""}
<div class="card menu">
<button type="button" class="mrow" data-go="historique"><span>Mes vérifications</span><span class="soft num">${nbH}</span><span class="chev">›</span></button>
${ADM.estAdmin() ? `<button type="button" class="mrow" data-go="admin" id="nouvA"><span>Espace admin</span><span class="soft">Réservé</span><span class="chev">›</span></button>` : ""}
</div>
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

/* Invitation unique et non cochée (Loi 25, art. 8.1) */
const CLE_LIEU_REP = "hs_lieu_rep";
function blocInvitationLieu() {
  if (!LIEU.dispo || LIEU.actif()) return "";
  try {
    if (localStorage.getItem(CLE_LIEU_REP)) return "";
  } catch (e) {
    return "";
  }
  return `<div class="card invite" id="inv-lieu"><p><b>Protéger ton compte</b></p><p class="soft">Veux-tu partager ta ville approximative de connexion ? Elle nous aide à repérer une connexion inhabituelle. Pas de GPS, gardée 90 jours au plus, visible seulement par les administrateurs. C'est désactivé tant que tu ne l'actives pas.</p>
<div class="duo"><button class="btn" id="inv-oui">Activer</button><button class="btn ghost" id="inv-non">Non merci</button></div></div>`;
}

/* Onglet admin « Connexions » */
async function remplirAdminConnexions(el) {
  const [s, res, L] = await Promise.all([ADM.partageStats(), ADM.lieuxResume(), ADM.connexions()]);
  if (!$("#adm")) return;
  const q = (F.qcx || "").toLowerCase();
  const filtre = L.filter((x) => !q || [x.contact, x.ville, x.region, x.pays].join(" ").toLowerCase().includes(q)).sort(
    (a, b) => new Date(b.derniere) - new Date(a.derniere),
  );
  el.innerHTML = `<div class="tuiles"><div class="tuile fort"><span>Partagent leur ville</span><b class="num">${nb(s.partagent)}</b></div><div class="tuile"><span>Comptes</span><b class="num">${nb(s.total)}</b></div></div>
<p class="hint">Seules les personnes qui ont activé le partage apparaissent. Ville déduite de l'adresse IP par l'hébergeur : approximative (un réseau mobile ou un VPN peut indiquer une autre ville).</p>
<div class="card"><h2>Par ville, 30 derniers jours</h2>${res.length ? `<div class="hist">${res.map((r) => `<div><span>${esc(lieuTexte({ ville: r.ville, region: r.region, pays: "CA" }))}</span><span class="num">${nb(r.personnes)} pers.</span></div>`).join("")}</div>` : `<p class="soft">Aucune donnée.</p>`}</div>
<div class="card"><h2>Dernière connexion par personne</h2>
<label class="sr" for="qcx">Rechercher</label><input id="qcx" type="search" placeholder="Courriel ou ville" value="${esc(F.qcx || "")}">
${filtre.length ? `<div class="cxlist">${filtre.map((x) => `<div class="cx"><p><b>${esc(x.contact || "(sans courriel)")}</b><span class="soft">${esc(dateLongue(x.derniere))}</span></p><p>${esc(lieuTexte(x))}${x.appareil ? ` · <span class="soft">${esc(x.appareil)}</span>` : ""} · <span class="soft">${nb(x.nb)} connexion${x.nb > 1 ? "s" : ""}</span></p></div>`).join("")}</div>` : `<p class="soft">Aucun résultat.</p>`}</div>`;
  const i = $("#qcx");
  if (i)
    i.oninput = () => {
      F.qcx = i.value;
      clearTimeout(i._t);
      i._t = setTimeout(() => {
        remplirAdminConnexions(el).then(() => {
          const j = $("#qcx");
          if (j) {
            j.focus();
            j.setSelectionRange(j.value.length, j.value.length);
          }
        });
      }, 250);
    };
}

function bindPlus7(v) {
  if (v === "verifier" && $("#lien") && typeof plateforme === "function")
    $("#lien").addEventListener("change", () => {
      const p = plateforme({ lien: $("#lien").value });
      const d = app.querySelector("details.profil");
      if (!p || !d) return;
      d.open = true;
      d.querySelector("summary").textContent = `Vérifier le profil de l'annonceur sur ${p.nom} (facultatif)`;
      const h = d.querySelector(".hint");
      if (h) h.textContent = p.aide;
    });
  app.querySelectorAll("[data-va-de]").forEach(
    (b) =>
      (b.onclick = () => {
        F.retourVA = b.dataset.vaDe;
        go("approfondie");
      }),
  );
  app.querySelectorAll("[data-verif]").forEach(
    (b) =>
      (b.onclick = () => {
        F.verifId = b.dataset.verif;
        F.retourVerif = v === "historique" ? "historique" : "accueil";
        go("detailVerif");
      }),
  );
  if (v === "historique")
    app.querySelectorAll("[data-hfiltre]").forEach(
      (b) =>
        (b.onclick = () => {
          F.hfiltre = b.dataset.hfiltre;
          go("historique");
        }),
    );
  if (v === "detailVerif" && $("#h-suppr")) {
    const b = $("#h-suppr");
    b.onclick = async () => {
      if (!b.dataset.ok) {
        b.dataset.ok = "1";
        b.textContent = "Confirmer : retirer définitivement";
        return;
      }
      b.disabled = true;
      try {
        await HIS.supprimer(F.verifId);
        go("historique");
      } catch (e) {
        b.disabled = false;
        b.textContent = "Réessayer";
        const er = $("#err");
        if (er) er.textContent = "Le retrait n'a pas fonctionné. Réessaie.";
      }
    };
  }
  if (v === "compte" && $("#lieu-ok")) {
    const c = $("#lieu-ok"),
      m = $("#lieu-msg");
    c.onchange = async () => {
      c.disabled = true;
      try {
        const g = await LIEU.definir(c.checked);
        try {
          localStorage.setItem(CLE_LIEU_REP, "1");
        } catch (e) {}
        m.textContent = !c.checked
          ? "Désactivé. Ton historique de lieux a été effacé."
          : g && g.ville
            ? `Activé. Ville notée pour cette connexion : ${g.ville}${g.region ? " (" + g.region + ")" : ""}. Seuls les administrateurs la voient.`
            : "Activé. Ta ville approximative sera notée à chaque connexion. Seuls les administrateurs la voient.";
      } catch (e) {
        c.checked = !c.checked;
        m.textContent = "Le changement n'a pas fonctionné. Réessaie.";
      }
      c.disabled = false;
    };
  }
  if (v === "accueil" && $("#inv-lieu")) {
    const fin = async (oui) => {
      try {
        localStorage.setItem(CLE_LIEU_REP, "1");
      } catch (e) {}
      if (oui) {
        try {
          await LIEU.definir(true);
        } catch (e) {}
      }
      const el = $("#inv-lieu");
      if (el) el.outerHTML = oui ? `<p class="hint centre">Merci. Tu peux changer ce choix dans Mon compte.</p>` : "";
    };
    $("#inv-oui").onclick = () => fin(true);
    $("#inv-non").onclick = () => fin(false);
  }
  if (v === "admin" && F.onglet === "connexions") {
    const el = $("#adm");
    if (el)
      remplirAdminConnexions(el).catch(() => {
        el.innerHTML = `<p class="err">Chargement impossible.</p>`;
      });
  }
}
const CSS_PLUS7 = ""; /* styles déplacés dans app.css */
/* Bouton compact « Mon compte » en tête de l'accueil */
function barreCompte() {
  const st = CPT.statut();
  return `<button type="button" class="compte-lien" data-go="compte" aria-label="Mon compte"><span class="avatar" aria-hidden="true">${esc((CPT.courriel() || "?").charAt(0).toUpperCase())}</span><span class="t"><b>${esc(CPT.courriel() || "Mon compte")}</b><small style="color:${st.couleur}">● ${esc(st.t)}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
}
