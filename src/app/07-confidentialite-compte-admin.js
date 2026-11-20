/* ===== HabitaScan : confidentialité, suppression du compte, espace admin (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, err, LOYERS, TRANSIT, ASSURANCE, EPICERIE, GARDE, m0, nouveauF
   et d'un adaptateur ADM propre à chaque version :
   ADM.estAdmin() → bool ; ADM.stats() ; ADM.identites() ; ADM.photos(id) → [url] ; ADM.decider(id, statut)
   ADM.signalements() ; ADM.retirerSignalements(lien) ; ADM.sauverParametre(cle, valeur) ; ADM.sauverLoyer(ville, ch, loyer)
   ADM.supprimerCompte() ; ADM.demo (bool) */

/* ---------- Politique de confidentialité ---------- */
// Coordonnées à remplir avant la mise en ligne (Loi 25 : titre et coordonnées de la personne responsable).
const RESPONSABLE = {
  nom: "[Prénom Nom]",
  titre: "[titre]",
  entreprise: "[nom de l'entreprise]",
  courriel: "[confidentialite@exemple.ca]",
  adresse: "[adresse postale]",
  vigueur: "[date de mise en ligne]",
};
const L_LOI = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/P-39.1";
const L_CAI = "https://www.cai.gouv.qc.ca";
function vueConfidentialite(back) {
  const R = RESPONSABLE;
  const t = (rows, h) =>
    `<table class="tvilles"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `${top(back, "Confidentialité")}
<h2>Politique de confidentialité</h2>
<p class="hint">En vigueur le ${R.vigueur}.</p>
<div class="card"><h2>En bref</h2>
<ul class="liste"><li>Nous recueillons le minimum : ton courriel ou ton numéro pour te connecter, et le résumé de tes vérifications pour ton historique.</li>
<li>Le texte des annonces, tes conversations et tes captures d'écran sont lus <b>sur ton téléphone</b>. Si tu actives l'analyse intelligente, ils sont envoyés à Anthropic pour l'analyse. Nous ne les conservons jamais.</li>
<li>Aucune vente de renseignements, aucune publicité, aucun profilage ni suivi publicitaire.</li>
<li>Ta ville de connexion n'est jamais notée sans ton accord : cette fonction est désactivée par défaut et tu l'actives toi-même dans Mon compte.</li>
<li>Tu peux consulter, corriger ou supprimer tes renseignements en tout temps.</li></ul>
<p class="hint">Voir aussi les ${lienConditions}.</p>
<p class="hint">Cette politique respecte la ${lienExt(L_LOI, "Loi sur la protection des renseignements personnels dans le secteur privé")}, modifiée par la Loi 25. L'app s'adresse aux personnes de 14 ans et plus.</p></div>
<div class="card"><h2>Personne responsable</h2><p>${R.nom}, ${R.titre}, ${R.entreprise}<br>Courriel : ${R.courriel}<br>${R.adresse}</p>
<p class="hint">Écris-lui pour toute question, demande d'accès, de correction ou de suppression, ou pour porter plainte.</p></div>
<div class="card"><h2>Ce que nous recueillons</h2>${t(
    [
      ["Courriel ou cellulaire", "Te connecter avec un code, retrouver ton compte, compter les utilisateurs"],
      [
        "Résumé de tes vérifications : ville, chambres, loyer, lien, résultat ; travaux et licence RBQ ; empreintes non réversibles des photos et du texte de l'annonce (jamais les photos ni le texte eux-mêmes)",
        "Ton historique, et reconnaître la même annonce publiée ailleurs. Les autres voient seulement des nombres, des prix et des villes, jamais qui a vérifié",
      ],
      [
        "Signalement : lien de l'annonce, numéros de téléphone et courriels de l'annonceur (seulement en empreinte chiffrée, jamais en clair), empreinte visuelle des photos (la photo ne quitte pas ton téléphone), et motif",
        "Avertir les autres utilisateurs (mémoire collective). Ils voient seulement un nombre",
      ],
      [
        "Photo de pièce d'identité, seulement pour signaler",
        "Éviter les fausses accusations. Lue automatiquement pour pré-remplir les informations, puis vérifiée par l'équipe. Supprimée après la vérification",
      ],
      [
        "Informations lues sur la pièce : prénom, nom, année de naissance, date d'expiration, province ou pays ; empreinte chiffrée du numéro (jamais le numéro lui-même)",
        "Vérifier l'identité, repérer une pièce expirée, une personne mineure ou une pièce utilisée par deux comptes. Une fois l'identité confirmée, seuls le prénom, l'initiale du nom et la date d'expiration sont gardés ; tout est effacé si elle est refusée",
      ],
      ["Ville, chambres et budget de « Trouver »", "Chercher des annonces. Non conservés"],
      [
        "Vérification complète : adresse, lot, lien de l'annonce et, si tu le donnes, le nom de l'annonceur",
        "Faire la vérification que tu as payée et te remettre le rapport. Le rapport donne le nom du propriétaire inscrit au Registre foncier (information publique), sans aucun document",
      ],
      [
        "Compteurs d'utilisation (écrans ouverts par jour) et erreurs techniques",
        "Améliorer l'app. Compteurs sans lien avec ton compte ; erreurs sans renseignement personnel",
      ],
      [
        "Ville approximative de connexion, seulement si tu l'actives dans Mon compte : ville, région, pays (déduits de l'adresse IP, sans GPS ni adresse IP conservée) et type d'appareil",
        "Repérer une connexion inhabituelle sur ton compte et savoir quelles régions nous servons. Visible seulement par les administrateurs",
      ],
      [
        "Analyse intelligente, seulement si tu l'actives : captures et texte de l'annonce, réponse de l'annonceur et captures de la discussion",
        "Extraire les informations et repérer les signaux d'arnaque, surtout dans la conversation. Envoyés à Anthropic pour l'analyse, jamais conservés par HabitaScan",
      ],
      [
        "Numéros de téléphone et courriels de l'annonceur trouvés dans l'annonce ou la conversation",
        "Vérifier s'ils ont déjà été signalés. Comparés puis oubliés, sauf si tu les signales (empreinte chiffrée seulement)",
      ],
    ],
    ["Renseignement", "Pourquoi"],
  )}
<p class="hint"><b>Restent sur ton téléphone :</b> le texte des annonces et des conversations, tes captures (sauf si la recherche des photos est activée : envoyée à Google Cloud Vision puis oubliée), la photo du compte de taxes, ton budget et ton revenu.</p>
<p class="hint"><b>Résultat automatique :</b> le verdict est calculé à partir de règles publiques. Il porte sur l'annonce, pas sur toi. Tu peux demander quelles règles ont mené à un résultat.</p></div>
<div class="card"><h2>Fournisseurs, dont hors du Québec</h2>${t(
    [
      ["Supabase (base de données, connexion)", "Données à Montréal (AWS Canada Centre) ; entreprise américaine"],
      ["Vercel (pages de l'app)", "États-Unis : adresse IP ; si tu l'actives, Vercel en déduit ta ville approximative"],
      ["jsDelivr (bibliothèques de l'app)", "Réseau mondial : adresse IP"],
      [
        "Tavily (« Trouver » et recherche des copies d'une annonce)",
        "États-Unis : mots de la recherche ou une phrase de l'annonce, sans ton nom",
      ],
      ["Google Cloud Vision, si activé", "États-Unis : capture envoyée pour la recherche"],
      [
        "Stripe (paiement de la vérification complète)",
        "Entreprise américaine : courriel et carte. HabitaScan ne voit jamais le numéro de carte",
      ],
      [
        "Anthropic (analyse intelligente, si tu l'actives ; lecture de la pièce d'identité)",
        "Entreprise américaine : captures et texte envoyés pour l'analyse ; photo de la pièce envoyée pour la lecture, sans copie conservée",
      ],
    ],
    ["Fournisseur", "Où et quoi"],
  )}
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
<p class="hint">Tu peux supprimer ton compte toi-même dans Mon compte, et retirer une vérification de ton historique à partir de son détail. En cas de désaccord, tu peux t'adresser à la ${lienExt(L_CAI, "Commission d'accès à l'information")}.</p></div>`;
}
const lienConfidentialite = `<button type="button" class="lienbtn" data-go="confidentialite">politique de confidentialité</button>`;

/* ---------- Suppression du compte ---------- */
const vueSupprimer = () => `${top("compte", "Supprimer mon compte")}
<h2>Supprimer mon compte</h2>
<div class="card"><p>Ton compte, ton historique, tes signalements et, s'il y en a, les photos de ta pièce d'identité seront supprimés. C'est définitif.</p>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="sup-ok" style="width:22px;min-height:22px;margin-top:2px">Je comprends que la suppression est définitive.</label>
<p class="err" id="e" hidden></p>
<button class="btn danger" id="go">Supprimer définitivement</button></div>`;
function lierSupprimer() {
  $("#go").onclick = async () => {
    if (!$("#sup-ok").checked) return err("Coche la case pour confirmer.");
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Suppression…";
    try {
      await ADM.supprimerCompte();
      nouveauF({});
      go("bienvenue");
    } catch (x) {
      b.disabled = false;
      b.textContent = "Réessayer";
      err("La suppression n'a pas fonctionné. Réessaie, ou écris à la personne responsable.");
    }
  };
}

/* ---------- Espace admin ---------- */
const PARAMS = [
  // clé en base → où l'app l'utilise
  {
    cle: "transit_montreal",
    n: "Laissez-passer Montréal",
    get: () => TRANSIT["Montréal"].p,
    set: (v) => (TRANSIT["Montréal"].p = v),
  },
  {
    cle: "transit_quebec",
    n: "Laissez-passer Québec / Lévis",
    get: () => TRANSIT["Québec"].p,
    set: (v) => {
      TRANSIT["Québec"].p = v;
      TRANSIT["Lévis"].p = v;
    },
  },
  {
    cle: "transit_gatineau",
    n: "Laissez-passer Gatineau",
    get: () => TRANSIT["Gatineau"].p,
    set: (v) => (TRANSIT["Gatineau"].p = v),
  },
  { cle: "assurance", n: "Assurance locataire par mois", get: () => ASSURANCE.p, set: (v) => (ASSURANCE.p = v) },
  { cle: "epicerie", n: "Épicerie par personne par mois", get: () => EPICERIE.p, set: (v) => (EPICERIE.p = v) },
  { cle: "garde_jour", n: "Garderie subventionnée par jour", get: () => GARDE.jour, set: (v) => (GARDE.jour = v) },
];
/* Réglages modifiables dans la console d'administration */
const CFG = { ia: true, recherche: true, approfondie: true, sms: false, message: "", support: "" };
const DRAPEAUX = {
  ia_active: "ia",
  recherche_active: "recherche",
  approfondie_active: "approfondie",
  sms_actif: "sms",
};
function appliquerParametres(rows) {
  (rows || []).forEach((r) => {
    const p = PARAMS.find((x) => x.cle === r.cle);
    const v = +r.valeur;
    if (p && v > 0) p.set(v);
    if (DRAPEAUX[r.cle]) CFG[DRAPEAUX[r.cle]] = v !== 0;
  });
}
const nb = (v) => Number(v || 0).toLocaleString("fr-CA");
function vueAdmin() {
  const onglet = F.onglet || "chiffres";
  const o = (k, t) => `<button type="button" data-onglet="${k}" aria-pressed="${onglet === k}">${t}</button>`;
  return `${top("compte", "Admin")}
<h2>Espace admin</h2>${ADM.demo ? `<p class="demo">Démo : données fictives, rien n'est envoyé.</p>` : ""}
${ADM.console ? `<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Ouvrir la console complète (ordinateur) ↗</a><p class="hint">Utilisateurs, réglages, quotas, loyers, administrateurs, journal : tout se gère dans la console.</p>` : ""}
<div class="seg seg6" role="group" aria-label="Section">${o("chiffres", "Chiffres")}${o("demandes", "Demandes")}${o("connexions", "Connexions")}${o("identites", "Identités")}${o("signalements", "Signalements")}${o("montants", "Montants")}</div>
<div id="adm" aria-live="polite"><p class="hint">Chargement…</p></div>`;
}
async function lierAdmin() {
  const onglet = F.onglet || "chiffres";
  app.querySelectorAll("[data-onglet]").forEach(
    (b) =>
      (b.onclick = () => {
        F.onglet = b.dataset.onglet;
        go("admin");
      }),
  );
  const el = () => $("#adm");
  const echec = () => {
    if (el()) el().innerHTML = `<p class="err">Chargement impossible. Vérifie que ton compte est admin.</p>`;
  };
  try {
    if (onglet === "chiffres") {
      const s = await ADM.stats();
      if (!el()) return;
      const tuile = (t, v, fort) =>
        `<div class="tuile${fort ? " fort" : ""}"><span>${t}</span><b class="num">${nb(v)}</b></div>`;
      el().innerHTML = `<div class="tuiles">${tuile("Utilisateurs", s.utilisateurs, true)}${tuile("Nouveaux, 7 jours", s.nouveaux_7j)}${tuile("Vérifications, 7 jours", s.verifications_7j)}
${tuile("Vérifications au total", s.verifications)}${tuile("Résultats « Ne paie pas »", s.rouges)}${tuile("Signalements", s.signalements)}${tuile("Identités à vérifier", s.identites_attente)}</div>`;
    }
    if (onglet === "identites") {
      const L = await ADM.identites();
      if (!el()) return;
      el().innerHTML = L.length
        ? L.map(
            (
              p,
            ) => `<div class="card" data-id="${esc(p.id)}"><p><b>${esc(p.contact || "(sans contact)")}</b></p><p class="hint">Envoyée le ${esc(String(p.soumise_le || "").slice(0, 10))}${p.doc_type ? ` · ${esc(p.doc_type)}` : ""}</p>
${p.prenom_declare || p.nom_declare ? `<p><b>Nom déclaré :</b> ${esc([p.prenom_declare, p.nom_declare].filter(Boolean).join(" "))}</p>` : ""}
${
  p.lue_le
    ? `<p><b>Lu par l'IA :</b> ${esc([p.prenom, p.nom].filter(Boolean).join(" ") || "nom non lu")}${p.naissance_annee ? ` · né(e) en ${esc(p.naissance_annee)}` : ""} · expire ${p.expire_le ? esc(p.expire_le) : "(non lue)"}${p.emetteur ? ` · ${esc(p.emetteur)}` : ""}</p>
${(p.alertes || []).length ? `<ul class="reasons">${p.alertes.map((a) => `<li><span class="dot r"></span><div>${esc(ALERTES_ID[a] || a)}</div></li>`).join("")}</ul>` : `<p class="hint">Aucune alerte automatique.</p>`}`
    : `<p class="hint">Pas de lecture automatique : vérification manuelle.</p>`
}
<div class="vignettes photos"><button type="button" class="btn ghost" data-voir="${esc(p.id)}">Voir les photos</button></div>
<div class="grid2"><button class="btn" data-decider="${esc(p.id)}" data-statut="confirmee">Confirmer</button><button class="btn ghost" data-decider="${esc(p.id)}" data-statut="refusee">Refuser</button></div>
<p class="hint">La décision supprime les photos.</p></div>`,
          ).join("")
        : `<div class="card"><p>Aucune pièce d'identité à vérifier.</p></div>`;
      el()
        .querySelectorAll("[data-voir]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                const urls = await ADM.photos(b.dataset.voir);
                b.parentNode.innerHTML = urls.length
                  ? urls
                      .filter(urlWeb)
                      .map(
                        (u) =>
                          `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="Pièce d'identité"></a>`,
                      )
                      .join("")
                  : `<p class="hint">Aucune photo trouvée.</p>`;
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
      el()
        .querySelectorAll("[data-decider]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                await ADM.decider(b.dataset.decider, b.dataset.statut);
                go("admin");
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
    }
    if (onglet === "signalements") {
      const L = await ADM.signalements();
      if (!el()) return;
      el().innerHTML = L.length
        ? L.map(
            (s) => `<div class="card"><p><a href="${esc(s.lien)}" target="_blank" rel="noopener">${esc(s.lien)}</a></p>
<p><b>${nb(s.nb)} signalement${s.nb > 1 ? "s" : ""}</b>${s.dernier ? ` · dernier le ${esc(String(s.dernier).slice(0, 10))}` : ""}</p><p class="hint">${esc((s.motifs || []).join(", "))}</p>
<button class="btn ghost" data-retirer="${esc(s.lien)}">Retirer ces signalements (annonce honnête)</button></div>`,
          ).join("")
        : `<div class="card"><p>Aucun signalement.</p></div>`;
      el()
        .querySelectorAll("[data-retirer]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              b.disabled = true;
              try {
                await ADM.retirerSignalements(b.dataset.retirer);
                go("admin");
              } catch (x) {
                b.disabled = false;
                b.textContent = "Réessayer";
              }
            }),
        );
    }
    if (onglet === "montants") {
      if (!el()) return;
      const villes = Object.keys(LOYERS);
      el().innerHTML = `<div class="card"><h2>Budget</h2><p class="hint">Change un montant quand le tarif change (chaque année). Indique la source dans tes notes.</p>
${PARAMS.map((p) => `<label>${p.n}<span class="ligne"><input data-param="${p.cle}" inputmode="decimal" value="${String(p.get()).replace(".", ",")}"><button type="button" class="btn ghost petit" data-sauver="${p.cle}">Enregistrer</button></span></label>`).join("")}</div>
<div class="card"><h2>Loyers moyens SCHL</h2><p class="hint">À mettre à jour chaque année avec l'Enquête sur les logements locatifs.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>1 ch.</th><th>2 ch.</th><th>3 ch.+</th></tr></thead><tbody>
${villes.map((v) => `<tr><td>${esc(v)}</td>${[0, 1, 2].map((i) => `<td><input class="mini" data-loyer="${esc(v)}" data-ch="${i + 1}" inputmode="numeric" value="${LOYERS[v][i] || ""}"></td>`).join("")}</tr>`).join("")}</tbody></table>
<p class="hint" id="adm-msg" role="status"></p></div>`;
      const msg = (t) => {
        const m = $("#adm-msg");
        if (m) m.textContent = t;
      };
      el()
        .querySelectorAll("[data-sauver]")
        .forEach(
          (b) =>
            (b.onclick = async () => {
              const k = b.dataset.sauver,
                inp = el().querySelector(`[data-param="${k}"]`),
                v = parseFloat(inp.value.replace(",", "."));
              if (!(v > 0)) return msg("Montant invalide.");
              b.disabled = true;
              try {
                await ADM.sauverParametre(k, v);
                PARAMS.find((p) => p.cle === k).set(v);
                b.textContent = "Enregistré";
              } catch (x) {
                b.textContent = "Erreur";
              }
              b.disabled = false;
            }),
        );
      el()
        .querySelectorAll("[data-loyer]")
        .forEach(
          (inp) =>
            (inp.onchange = async () => {
              const v = parseInt(inp.value.replace(/\D/g, ""), 10);
              if (!(v >= 200 && v <= 10000)) return msg("Loyer invalide.");
              try {
                await ADM.sauverLoyer(inp.dataset.loyer, +inp.dataset.ch, v);
                LOYERS[inp.dataset.loyer][+inp.dataset.ch - 1] = v;
                msg(`${inp.dataset.loyer}, ${inp.dataset.ch} ch. : ${m0(v)} enregistré.`);
              } catch (x) {
                msg("Erreur d'enregistrement.");
              }
            }),
        );
    }
  } catch (x) {
    echec();
  }
}

function bindPlus3(v) {
  if (v === "supprimer") lierSupprimer();
  if (v === "admin") lierAdmin();
}
const CSS_PLUS3 = ""; /* styles déplacés dans app.css */
