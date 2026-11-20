/* ===== HabitaScan : vérification approfondie payante (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, top, err, nouveauF, lienExt, fmtLot, chiffresLot, PARAMS, ADM
   et d'un adaptateur VAP : VAP.creer(d) → id ; VAP.mes() ; VAP.adminListe() ; VAP.adminMaj(id, statut, verdict, note)
   VAP.sauverTexte(cle, valeur) ; VAP.courriel() → courriel du compte ; VAP.demo */
const VCFG = { prix: 15, delai: 24, lien: "" };
PARAMS.push(
  { cle: "prix_verif", n: "Prix de la vérification complète ($)", get: () => VCFG.prix, set: (v) => (VCFG.prix = v) },
  {
    cle: "delai_verif_heures",
    n: "Délai de réponse promis (heures)",
    get: () => VCFG.delai,
    set: (v) => (VCFG.delai = v),
  },
);
const prixTxt = () => String(VCFG.prix).replace(".", ",") + " $";
const VERDICTS = {
  correspond: ["g", "Le nom correspond au propriétaire inscrit au Registre foncier."],
  ne_correspond_pas: [
    "r",
    "Le nom ne correspond pas au propriétaire inscrit. Ne paie rien avant d'avoir une explication et un mandat écrit du propriétaire.",
  ],
  compagnie: [
    "y",
    "Le propriétaire inscrit est une entreprise. Demande la preuve que ton interlocuteur la représente (mandat écrit, registre des entreprises).",
  ],
  introuvable: [
    "y",
    "Nous n'avons pas pu confirmer le propriétaire (lot introuvable ou vente trop récente). Écris-nous pour un remboursement.",
  ],
  trouve: ["g", "Nous avons trouvé le propriétaire inscrit au Registre foncier."],
};
const STATUTS = {
  a_payer: ["i", "Paiement non reçu"],
  payee: ["y", "En cours"],
  terminee: ["g", "Terminée"],
  remboursee: ["i", "Remboursée"],
};

const carteApprofondie = () =>
  typeof CFG !== "undefined" && CFG.approfondie === false
    ? ""
    : `<div class="card offre"><h2>Pas le temps ? On le fait pour toi</h2>
<p>Notre équipe fait toute la vérification et t'envoie un rapport dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="proprio">Vérification complète · ${prixTxt()}</button>
<p class="hint">Paiement par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;

/* Offre visible sur le résultat et l'accueil */
const offreApprofondie = (de) =>
  typeof CFG !== "undefined" && CFG.approfondie === false
    ? ""
    : `<div class="card offre offre-res"><p class="offre-eti">Service HabitaScan</p><h2>Vérification complète · ${prixTxt()}</h2>
<p>Sans que tu aies une seule question à poser, notre équipe vérifie l'annonce à fond et t'envoie un rapport écrit, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<button class="btn" data-va-de="${de}">Demander la vérification · ${prixTxt()}</button>
<p class="hint">Paiement sécurisé par carte de crédit ou de débit. Ce n'est pas une garantie : visite toujours et signe le bail avant de payer.</p></div>`;
function vueApprofondie(F, back) {
  const P = F.P || {};
  const A =
    F.VA ||
    (F.VA = {
      adresse: P.adr || F.adr || "",
      lot: (P.geo && P.geo.lots && P.geo.lots[0]) || (P.cmp && P.cmp.lot && chiffresLot(P.cmp.lot)) || "",
      nom: "",
      role: F.cession === "oui" ? "locataire" : null,
      lien: F.lien || "",
    });
  return `${top(back, "Vérification complète")}
<h2>Vérification complète · ${prixTxt()}</h2>
<p class="soft">Notre équipe vérifie pour toi, puis t'envoie un rapport écrit dans l'app, en ${VCFG.delai} h maximum, sinon remboursé.</p>
<ul class="inclus"><li>Le <b>propriétaire</b> de l'immeuble, au Registre foncier</li><li>Si c'est une <b>entreprise</b> : qu'elle est active, et qui la dirige</li><li>Les <b>photos</b> : copiées d'une autre annonce ou d'un autre site ?</li><li>Le même logement <b>annoncé ailleurs</b>, sous un autre nom ou un autre prix</li><li>Un <b>rapport écrit</b> avec un verdict clair</li></ul>
<form class="card" id="f-va" novalidate>
<label>Adresse du logement<input id="va-adresse" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(A.adresse)}"></label>
<label>Numéro de lot (facultatif)<input id="va-lot" inputmode="numeric" autocomplete="off" placeholder="1 234 567" value="${esc(A.lot ? fmtLot(A.lot) : "")}"></label>
<p class="hint" style="margin-top:0"><b>Aucune question à poser à l'annonceur :</b> l'adresse suffit. Nous trouvons le vrai propriétaire, vérifions les photos et les autres annonces, et te disons quel nom doit figurer sur ${A.role === "locataire" ? "l'accord écrit du propriétaire" : "le bail"}.</p>
<label>Nom de l'annonceur, si tu l'as (facultatif)<input id="va-nom" autocomplete="off" placeholder="Tel qu'il apparaît dans l'annonce ou les messages" value="${esc(A.nom)}"></label>
<label>Lien de l'annonce (facultatif)<input id="va-lien" type="url" inputmode="url" autocomplete="off" value="${esc(A.lien)}"></label>
<label style="flex-direction:row;align-items:flex-start;gap:10px;font-weight:500"><input type="checkbox" id="va-ok" style="width:22px;height:22px;min-height:22px;margin-top:2px;flex-shrink:0;appearance:auto;-webkit-appearance:checkbox;accent-color:var(--blue);padding:0">Je comprends que le rapport se base sur les registres publics et le Web à la date de la vérification. Ce n'est pas une garantie : je visite et je signe le bail avant de payer quoi que ce soit.</label>
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Payer ${prixTxt()} par carte</button>
<p class="hint">En payant, tu acceptes les ${lienConditions}.</p>
<p class="hint">Le paiement se fait sur la page sécurisée de Stripe : HabitaScan ne voit jamais ton numéro de carte. Nous ne te transmettons aucun document sur le propriétaire, seulement le rapport.</p>
</form>${VAP.demo ? `<p class="demo">Démo : aucun paiement réel, tu pourras simuler le paiement.</p>` : ""}`;
}
function lierApprofondie(F) {
  const A = F.VA;
  const garder = () => {
    A.adresse = $("#va-adresse").value;
    A.lot = chiffresLot($("#va-lot").value);
    A.nom = $("#va-nom").value;
    A.lien = $("#va-lien").value;
  };
  $("#f-va").onsubmit = async (e) => {
    e.preventDefault();
    garder();
    if (A.adresse.trim().length < 6 || !/\d/.test(A.adresse))
      return err("Entre l'adresse complète, avec le numéro et la ville.");
    if (A.lot && !/^\d{7,8}$/.test(A.lot))
      return err("Le numéro de lot a 7 chiffres, par exemple 1 234 567. Laisse vide si tu ne l'as pas.");
    if (!$("#va-ok").checked) return err("Coche la case pour continuer.");
    if (!VAP.demo && !VCFG.lien) return err("Le paiement n'est pas encore ouvert. Réessaie bientôt.");
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Préparation du paiement…";
    try {
      const id = await VAP.creer({
        adresse: A.adresse.trim(),
        lot: A.lot || null,
        nom_interlocuteur: A.nom.trim() || null,
        role: A.role,
        lien: A.lien.trim() || null,
      });
      try {
        MES.noter("demande_creee");
      } catch (e) {}
      if (VAP.demo) {
        nouveauF({});
        return go("accueil");
      }
      const u = new URL(VCFG.lien);
      u.searchParams.set("client_reference_id", id);
      const c = VAP.courriel();
      if (c) u.searchParams.set("prefilled_email", c);
      location.href = u.toString();
    } catch (x) {
      b.disabled = false;
      b.textContent = `Payer ${prixTxt()} par carte`;
      err("La demande n'a pas pu être créée. Réessaie.");
    }
  };
}

/* Rapport de la vérification complète */
const RAPPORT = {
  global: {
    continuer: ["g", "Tu peux continuer", "Rien d'anormal n'a été trouvé. Visite, puis signe le bail avant de payer."],
    precautions: [
      "y",
      "Continue avec précaution",
      "Obtiens ce qui est indiqué ci-dessous avant de payer quoi que ce soit.",
    ],
    arreter: ["r", "Arrête", "Ne paie rien et ne donne aucun document à cette personne."],
  },
  entreprise: {
    lie: [
      "g",
      "L'entreprise propriétaire est active ; ses dirigeants sont indiqués ci-dessous. Le bail doit être à son nom.",
    ],
    non_lie: [
      "y",
      "Le nom de l'annonceur ne figure pas parmi les dirigeants de l'entreprise propriétaire. Le bail doit être au nom de l'entreprise ; si quelqu'un d'autre signe, exige un mandat écrit de l'entreprise.",
    ],
    inactive: ["r", "L'entreprise propriétaire n'est pas active au registre des entreprises."],
    non_verifie: ["i", "Lien avec l'entreprise non vérifié."],
  },
  photos: {
    aucune: ["g", "Les photos n'ont pas été trouvées ailleurs sur le Web."],
    reutilisees: ["r", "Les photos apparaissent ailleurs : autre annonce, autre ville ou site d'agence."],
    non_verifie: ["i", "Photos non vérifiées (aucune photo fournie)."],
  },
  doublons: {
    aucun: ["g", "Aucune autre annonce du même logement n'a été trouvée."],
    trouves: ["y", "Le même logement est annoncé ailleurs, sous un autre nom ou à un autre prix."],
    non_verifie: ["i", "Autres annonces non vérifiées."],
  },
};
function htmlRapport(d) {
  const r = d.rapport || {},
    g = RAPPORT.global[d.verdict_global || r.global];
  const L = [];
  const ajout = (m, k, det) => {
    const x = m && m[k];
    if (x)
      L.push(
        `<li><span class="dot ${x[0]}"></span><div>${x[1]}${det ? `<div class="law">${esc(det)}</div>` : ""}</div></li>`,
      );
  };
  const reg = r.registre || {},
    e = r.entreprise || {};
  if (reg.nom)
    L.push(
      `<li><span class="dot i"></span><div><b>Au moment de signer, le bail doit être au nom de : ${esc(reg.nom)}</b>${d.role === "locataire" ? " (c'est aussi ce nom qui doit signer l'accord écrit de cession)" : ""}. Sinon, ne paie pas avant d'avoir un mandat écrit de ce propriétaire.</div></li>`,
    );
  L.push(
    `<li><span class="dot g"></span><div><b>Paie seulement par chèque ou virement au nom ${reg.nom ? `de ${esc(reg.nom)}` : "du propriétaire inscrit au Registre foncier"}.</b> Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne. Si un gestionnaire perçoit les loyers, demande d'abord le mandat écrit du propriétaire.</div></li>`,
  );
  if ((reg.resultat || d.verdict) === "compagnie" && e.applicable)
    L.push(
      `<li><span class="dot i"></span><div>Le propriétaire inscrit au Registre foncier est une entreprise.${reg.details ? `<div class="law">${esc(reg.details)}</div>` : ""}</div></li>`,
    );
  else ajout(VERDICTS, reg.resultat || d.verdict, reg.details);
  if (e.applicable) {
    ajout(RAPPORT.entreprise, e.lien, [e.nom, e.neq ? `NEQ ${e.neq}` : "", e.details].filter(Boolean).join(" · "));
  }
  ajout(RAPPORT.photos, (r.photos || {}).resultat, (r.photos || {}).details);
  ajout(RAPPORT.doublons, (r.doublons || {}).resultat, (r.doublons || {}).details);
  return `${g ? `<div class="verdict ${g[0]}"><strong>${g[1]}</strong><span>${g[2]}</span></div>` : ""}
${L.length ? `<ul class="reasons">${L.join("")}</ul>` : ""}
${r.recommandations || d.note ? `<div class="rule" style="text-align:left"><b>Ce qu'on te recommande</b><br>${esc(r.recommandations || d.note)}</div>` : ""}
${d.termine_le ? `<p class="hint">Rapport du ${esc(new Date(d.termine_le).toLocaleDateString("fr-CA", { dateStyle: "long" }))}, selon les registres publics et le Web à cette date.</p>` : ""}`;
}

/* Liste « Mes vérifications complètes » sur l'accueil */
const blocMesApprofondies = `<div id="mes-approf"></div>`;
async function remplirMesApprofondies() {
  const el = $("#mes-approf");
  if (!el) return;
  const paye = /[?&]paye=1/.test(location.search);
  if (paye)
    try {
      history.replaceState(null, "", location.pathname);
    } catch (e) {}
  let L = [];
  try {
    L = await VAP.mes();
  } catch (e) {}
  if (!$("#mes-approf")) return;
  if (!L.length && !paye) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<div class="card"><h2>Vérifications complètes</h2>${paye ? `<p class="lu">Paiement reçu. Ton rapport arrive ici en ${VCFG.delai} h maximum.</p>` : ""}
${L.map((d) => {
  const s = STATUTS[d.statut] || ["i", d.statut];
  const v = d.verdict && VERDICTS[d.verdict];
  return `<div class="demande"><p><b>${esc(d.adresse)}</b><span class="tag ${s[0]}">${s[1]}</span></p>
${d.statut === "terminee" ? (d.rapport || d.verdict_global ? htmlRapport(d) : v ? `<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note ? `<div class="law">${esc(d.note)}</div>` : ""}</div></li></ul>` : "") : ""}
${d.statut === "payee" ? `<p class="hint">Rapport au plus tard ${VCFG.delai} h après le paiement.</p>${VAP.demo ? `<button type="button" class="lienbtn" data-simrapport="${esc(d.id)}">(Démo) Voir un exemple de rapport</button>` : ""}` : ""}
${d.statut === "a_payer" && VAP.demo ? `<button type="button" class="lienbtn" data-simpaye="${esc(d.id)}">(Démo) Simuler le paiement</button>` : ""}</div>`;
}).join("")}</div>`;
  el.querySelectorAll("[data-simpaye]").forEach(
    (b) =>
      (b.onclick = async () => {
        await VAP.simulerPaiement(b.dataset.simpaye);
        remplirMesApprofondies();
      }),
  );
  el.querySelectorAll("[data-simrapport]").forEach(
    (b) =>
      (b.onclick = async () => {
        await VAP.simulerRapport(b.dataset.simrapport);
        remplirMesApprofondies();
      }),
  );
}

/* Onglet admin « Demandes » */
async function remplirAdminDemandes(el) {
  const L = await VAP.adminListe();
  if (!el.isConnected) return;
  el.innerHTML = L.length
    ? L.map((d) => {
        const s = STATUTS[d.statut] || ["i", d.statut];
        const v = d.verdict && VERDICTS[d.verdict];
        return `<div class="card"><p><b>${esc(d.adresse)}</b> <span class="tag ${s[0]}">${s[1]}</span></p>
<p class="hint">${esc(d.contact || "")} · demandée le ${esc(
          String(d.created_at || "")
            .slice(0, 16)
            .replace("T", " "),
        )}${d.paye_le ? ` · payée le ${esc(String(d.paye_le).slice(0, 16).replace("T", " "))}` : ""}${d.montant ? ` · ${esc(String(d.montant))} $` : ""}</p>
<p>Interlocuteur : <b>${esc(d.nom_interlocuteur)}</b> (${d.role === "gestionnaire" ? "dit être gestionnaire" : d.role === "locataire" ? "propriétaire nommé par le locataire" : "dit être propriétaire"})${d.lot ? ` · lot <span class="num">${esc(fmtLot(d.lot))}</span>` : ""}</p>
${d.lien ? `<p class="hint">${lienExt(esc(d.lien), "Annonce")}</p>` : ""}
${d.statut === "terminee" && (d.rapport || d.verdict_global) ? htmlRapport(d) : v ? `<ul class="reasons"><li><span class="dot ${v[0]}"></span><div>${v[1]}${d.note ? `<div class="law">${esc(d.note)}</div>` : ""}</div></li></ul>` : ""}
${d.statut === "a_payer" ? `<button class="btn ghost" data-maj="${esc(d.id)}" data-statut="payee">Marquer payée (vu dans Stripe)</button>` : ""}
${d.statut === "payee" ? `${ADM.console ? `<a class="btn" href="${ADM.console}" target="_blank" rel="noopener">Remplir le rapport dans la console ↗</a>` : ""}<p class="hint">Le rapport complet (registre, entreprise, photos, autres annonces, verdict) se remplit dans la console, sur ordinateur.</p>` : ""}
${["payee", "terminee"].includes(d.statut) ? `<button type="button" class="lienbtn" data-maj="${esc(d.id)}" data-statut="remboursee">Marquer remboursée</button>` : ""}</div>`;
      }).join("")
    : `<div class="card"><p>Aucune demande.</p></div>`;
  el.querySelectorAll("[data-maj]").forEach(
    (b) =>
      (b.onclick = async () => {
        const id = b.dataset.maj,
          n = el.querySelector(`[data-note="${id}"]`);
        b.disabled = true;
        try {
          await VAP.adminMaj(id, b.dataset.statut, b.dataset.verdict || null, n ? n.value.trim() : "");
          remplirAdminDemandes(el);
        } catch (x) {
          b.disabled = false;
          b.textContent = "Erreur, réessaie";
        }
      }),
  );
}

function bindPlus4(v) {
  if (v === "approfondie") lierApprofondie(F);
  if (v === "accueil") remplirMesApprofondies();
  if (v === "admin" && F.onglet === "demandes") {
    const el = $("#adm");
    if (el)
      remplirAdminDemandes(el).catch(() => {
        el.innerHTML = `<p class="err">Chargement impossible.</p>`;
      });
  }
  if (v === "admin" && (F.onglet || "chiffres") === "montants") {
    setTimeout(() => {
      const el = $("#adm");
      if (!el || el.querySelector("#va-lienpay")) return;
      el.insertAdjacentHTML(
        "afterbegin",
        `<div class="card"><h2>Paiement Stripe</h2><label>Lien de paiement Stripe (Payment Link)<span class="ligne"><input id="va-lienpay" inputmode="url" placeholder="https://buy.stripe.com/…" value="${esc(VCFG.lien)}"><button type="button" class="btn ghost petit" id="va-sauverlien">Enregistrer</button></span></label><p class="hint">Le prix et le délai se changent plus bas, dans « Budget ». Le prix affiché doit être le même que celui du lien Stripe.</p></div>`,
      );
      $("#va-sauverlien").onclick = async () => {
        const val = $("#va-lienpay").value.trim();
        if (val && !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(val)) {
          $("#va-sauverlien").textContent = "Lien invalide";
          return;
        }
        try {
          await VAP.sauverTexte("lien_paiement", val);
          VCFG.lien = val;
          $("#va-sauverlien").textContent = "Enregistré";
        } catch (x) {
          $("#va-sauverlien").textContent = "Erreur";
        }
      };
    }, 0);
  }
}
const CSS_PLUS4 = ""; /* styles déplacés dans app.css */
