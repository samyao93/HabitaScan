/* ===== HabitaScan : propriétaire, budget, annonces vérifiées (commun démo + Supabase) =====
   Dépend de : F, $, app, go, esc, money, top, yn, LOYERS, lireCapture, err, et d'un adaptateur ANN propre à chaque version :
   ANN.chercher({ville,ch,max}) → Promise<[{titre,url,extrait,age}]> ; ANN.note : texte affiché sous les résultats */

const L_INFOLOT = "https://appli.foncier.gouv.qc.ca/infolot/";
const L_REGISTRE = "https://www.registrefoncier.gouv.qc.ca";
const L_TARIF = "https://portail-info.foncier.gouv.qc.ca/media/40hfdqo0/grille_tarifaire_janvier_2026.pdf";
const L_ROLE_MTL = "https://montreal.ca/consulter-les-roles-devaluation-fonciere";
const L_RETRAIT_MTL = "https://montreal.ca/articles/confidentialite";
const L_1904 = "https://www.legisquebec.gouv.qc.ca/fr/document/lc/CCQ-1991#se:1904";
const L_SCHL30 =
  "https://www.cmhc-schl.gc.ca/fr/consumers/renting-a-home/i-want-to-rent/things-to-consider-before-renting";
/* Seuls les liens web (http, https) deviennent cliquables : une adresse « javascript: » venue d'une annonce ou d'une recherche reste du texte. */
const urlWeb = (u) => /^https?:\/\//i.test(String(u ?? "").trim());
const lienExt = (u, t) => (urlWeb(u) ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : t);
const nouveauF = (o) => {
  for (const k in F) delete F[k];
  Object.assign(F, o);
};
const villeDefaut = () => (LOYERS["Montréal"] ? "Montréal" : Object.keys(LOYERS)[0]);
const dateFr = (d) => {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  } catch (e) {
    return d;
  }
};
const nombre = (v) => {
  const n = parseInt(String(v || "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

/* ---------- 1. Vérifier le propriétaire ---------- */
const sansAccents = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
const chiffresLot = (t) => String(t || "").replace(/\D/g, "");
const fmtLot = (t) => chiffresLot(t).replace(/^(\d)(\d{3})(\d{3,4})$/, "$1 $2 $3");
// Services publics du gouvernement du Québec (données ouvertes) :
// géocodeur Adresses Québec (MRNF, CC-BY 4.0) et couche des lots du cadastre rénové.
const GEO_URL =
  "https://servicescarto.mern.gouv.qc.ca/pes/rest/services/Territoire/AdressesQuebec_Geocodage/GeocodeServer/findAddressCandidates";
const CAD_URL =
  "https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query";
async function trouverLotDirect(adr) {
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), 10000);
  try {
    const g = await (
      await fetch(`${GEO_URL}?SingleLine=${encodeURIComponent(adr)}&outSR=4326&maxLocations=1&f=json`, {
        signal: ctl.signal,
      })
    ).json();
    const c = g && g.candidates && g.candidates[0];
    if (!c || !c.location || (c.score != null && c.score < 80)) return { trouve: false };
    const q = await (
      await fetch(
        `${CAD_URL}?geometry=${c.location.x},${c.location.y}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=NO_LOT&returnGeometry=false&f=json`,
        { signal: ctl.signal },
      )
    ).json();
    const lots = [
      ...new Set(
        ((q && q.features) || []).map((f) => chiffresLot(f.attributes && f.attributes.NO_LOT)).filter(Boolean),
      ),
    ];
    return { trouve: true, adresse: c.address || adr, lots };
  } finally {
    clearTimeout(t);
  }
}
function memeNom(a, b) {
  const m = (s) =>
    sansAccents(s)
      .split(/[^a-z]+/)
      .filter((x) => x.length >= 3);
  const A = m(a),
    B = m(b);
  if (!A.length || !B.length) return null;
  const com = A.filter((x) => B.includes(x)).length;
  return com === Math.min(A.length, B.length) ? "oui" : com ? "partiel" : "non";
}
function comparerProprio(texte, nom, adr) {
  const T = " " + sansAccents(texte).replace(/[^a-z0-9]+/g, " ") + " ";
  const mots = sansAccents(nom)
    .split(/[^a-z]+/)
    .filter((m) => m.length >= 3);
  const trouves = mots.filter((m) => T.includes(" " + m + " "));
  const no = (String(adr || "").match(/\d+/) || [])[0];
  const rue = sansAccents(adr)
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter(
      (m) => m.length >= 4 && !["rue", "avenue", "boulevard", "chemin", "place", "montee", "rang"].includes(m),
    )[0];
  const m = sansAccents(texte).match(/lot[^0-9]{0,25}(\d[\d ]{5,10}\d)/);
  const lot = m ? m[1].replace(/\s/g, "") : null;
  return {
    nom: mots.length ? (trouves.length === mots.length ? "oui" : trouves.length ? "partiel" : "non") : null,
    adr: no ? (T.includes(" " + no + " ") && (!rue || T.includes(" " + rue + " ")) ? "oui" : "non") : null,
    lot: lot && lot.length >= 7 && lot.length <= 8 ? fmtLot(lot) : null,
  };
}
function verdictProprio(P, F) {
  const ces = F && F.cession === "oui";
  const c = P.cmp || {};
  const doc = ces ? "l'accord écrit" : "le bail";
  if (P.nomReg && P.nomBail) {
    const m = memeNom(P.nomBail, P.nomReg);
    if (m === "oui")
      return ces
        ? {
            c: "g",
            t: "L'accord vient du propriétaire inscrit",
            s: "Tu peux signer la cession. Paie ensuite le loyer au propriétaire, jamais au locataire qui part.",
          }
        : {
            c: "g",
            t: "Le bail est au nom du propriétaire inscrit",
            s: "Tu peux signer. Paie le premier mois à la signature, par un moyen traçable.",
          };
    if (m === "partiel")
      return {
        c: "y",
        t: "Le nom ressemble en partie",
        s: `Vérifie l'orthographe sur ${doc} et au Registre foncier avant de payer (deuxième prénom, entreprise apparentée).`,
      };
    return ces
      ? {
          c: "r",
          t: "Ce n'est pas le propriétaire inscrit",
          s: "L'accord écrit n'est pas signé par le propriétaire inscrit au Registre foncier. Ne paie rien.",
        }
      : {
          c: "y",
          t: "Le bail n'est pas au nom du propriétaire inscrit",
          s: "Si c'est un gestionnaire, exige son mandat écrit signé par le propriétaire inscrit. Sinon, ne paie pas.",
        };
  }
  if (P.nomReg && c.nom) {
    if (c.nom === "non")
      return {
        c: "y",
        t: `Le propriétaire inscrit n'apparaît pas sur ${doc}`,
        s: "Si c'est un gestionnaire, exige son mandat écrit. Sinon, ne paie pas.",
      };
    if (c.adr === "non")
      return {
        c: "y",
        t: `L'adresse n'apparaît pas sur ${doc}`,
        s: `${ces ? "L'accord" : "Le bail"} doit être celui du logement que tu as visité.`,
      };
    if (c.nom === "oui")
      return {
        c: "g",
        t: `Le propriétaire inscrit apparaît sur ${doc}`,
        s: "Tu peux signer. Paie à la signature, par un moyen traçable.",
      };
  }
  return null;
}
function vueProprio(F, back) {
  const P = F.P || (F.P = { adr: F.adr ? F.adr + (F.ville && F.ville !== "Autre" ? ", " + F.ville : "") : "" });
  const V = verdictProprio(P, F),
    c = P.cmp,
    G = P.geo;
  const ligne = (etat, t) => `<li><span class="dot ${etat}"></span><div>${t}</div></li>`;
  const lots = (G && G.lots) || [];
  const ces = F.cession === "oui";
  const doc = ces ? "l'accord écrit du propriétaire" : "le bail";
  return `${top(back, "Propriétaire")}
<h2>Vérifier le propriétaire</h2>
<p class="soft"><b>Aucune question à poser à l'annonceur.</b> L'adresse suffit pour trouver le vrai propriétaire. La comparaison se fait au moment de signer, avant de payer : c'est le seul moment où ton argent est en jeu.</p>
${V ? `<div class="verdict ${V.c}" id="pv"><strong>${V.t}</strong><span>${V.s}</span></div>` : ""}
<form class="card" id="f-pro" novalidate>
<h2>1. L'adresse du logement</h2>
<p class="hint">Dans l'annonce, ou celle qu'on te donne pour la visite.</p>
<label>Adresse<input id="padr" autocomplete="off" placeholder="1234, rue Exemple, Ville" value="${esc(P.adr || "")}"></label>
<button type="button" class="btn ghost" id="b-lot">${P.chercheLot ? "Recherche…" : "Trouver le numéro de lot"}</button>
${
  G
    ? G.trouve
      ? `<ul class="reasons">${ligne("g", `Adresse trouvée : ${esc(G.adresse)}.`)}
${lots.length ? ligne("g", `Numéro de lot : ${lots.map((l) => `<b class="num">${esc(fmtLot(l))}</b>`).join(", ")}.`) : ligne("y", `Numéro de lot non trouvé automatiquement. Cherche l'adresse sur ${lienExt(L_INFOLOT, "Infolot")}.`)}
</ul><p class="hint">Sources : Adresses Québec et cadastre du Québec, données ouvertes du gouvernement.</p>`
      : `<p class="lu">${esc(G.erreur || "Adresse introuvable. Ajoute la ville, ou cherche-la sur la carte Infolot.")} ${lienExt(L_INFOLOT, "Ouvrir Infolot")}</p>`
    : ""
}
</form>
<div class="card"><h2>2. Trouve le vrai propriétaire</h2>
<p class="hint">Le Registre foncier dit à qui appartient l'immeuble. Personne ne peut le falsifier ni le faire retirer.</p>
<ul class="reasons">
${ligne("i", lots.length ? `<b>Ton numéro de lot :</b> <span class="num">${lots.map(fmtLot).join(", ")}</span>.` : `<b>Le numéro de lot</b> : à l'étape 1, ou avec ${lienExt(L_INFOLOT, "Infolot")} (gratuit).`)}
${ligne("i", `<b>Consulte l'index des immeubles</b> de ce lot au ${lienExt(L_REGISTRE, "Registre foncier du Québec")}, puis le dernier acte de vente : 1 $ par document, compte requis.<div class="law">${lienExt(L_TARIF, "Grille tarifaire du Registre foncier, 1er janvier 2026")}</div>`)}
${ligne("i", `<b>Si c'est une entreprise</b>, regarde ses dirigeants au ${lienExt("https://www.registreentreprises.gouv.qc.ca/", "registre des entreprises")} (gratuit).`)}</ul>
<label>Nom du propriétaire inscrit<input id="preg" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomReg || "")}"></label>
<p class="hint">L'app le garde sur ton téléphone pour la comparaison de l'étape 3.${F.ville === "Montréal" ? ` À Montréal, le ${lienExt(L_ROLE_MTL, "rôle d'évaluation en ligne")} donne parfois le nom gratuitement ; s'il n'y est pas, le propriétaire a pu demander son retrait (${lienExt(L_RETRAIT_MTL, "Loi sur la fiscalité municipale")}).` : ""}</p></div>
${carteApprofondie()}
<form class="card" id="f-sig" novalidate><h2>3. Au moment de signer, avant de payer</h2>
${
  ces
    ? `<div class="rule" style="text-align:left"><b>C'est le locataire actuel qui annonce</b> (cession ou sous-location). Le document à comparer est <b>l'accord écrit du propriétaire, avec ton nom</b> : le locataire doit aviser le propriétaire par écrit et obtenir son accord. Le propriétaire a 15 jours pour répondre ; sans réponse, il est réputé avoir accepté. En cession, le locataire qui part ne peut rien te demander en échange.
<span class="law">Code civil du Québec, art. 1870 et 1871 · ${lienExt("https://www.tal.gouv.qc.ca/sites/default/files/notices/TAL_802_E.pdf", "TAL, avis de cession")}</span></div>`
    : `<p class="hint">Le nom du locateur est écrit en haut du bail, dans la section « Entre le locateur et le locataire » du formulaire obligatoire. Tu n'as rien à demander : il suffit de le lire.</p>`
}
<label>Nom du ${ces ? "propriétaire sur l'accord écrit" : "locateur écrit sur le bail"}<input id="pbail" autocomplete="off" placeholder="Prénom Nom, ou nom de l'entreprise" value="${esc(P.nomBail || "")}"></label>
<label class="drop">${P.photo ? `<img src="${P.photo}" alt="Document">Changer la photo` : `Ou prends ${doc} en photo`}<input type="file" accept="image/*" data-taxe="1"></label>
${P.lecture ? `<p class="lu" role="status">${P.lecture}</p>` : ""}
${
  c && P.nomReg
    ? `<ul class="reasons">
${c.nom ? ligne(c.nom === "oui" ? "g" : c.nom === "partiel" ? "y" : "r", c.nom === "oui" ? `Le propriétaire inscrit apparaît sur ${doc}.` : c.nom === "partiel" ? `Une partie seulement du nom du propriétaire inscrit apparaît sur ${doc}.` : `Le propriétaire inscrit n'apparaît pas sur ${doc}.`) : ""}
${c.adr ? ligne(c.adr === "oui" ? "g" : "r", c.adr === "oui" ? `L'adresse du logement est sur ${doc}.` : `L'adresse du logement n'a pas été trouvée sur ${doc}.`) : ""}</ul>`
    : ""
}
${!P.nomReg && (P.nomBail || P.photo) ? `<p class="lu">Inscris d'abord le nom du propriétaire trouvé à l'étape 2, pour que l'app compare.</p>` : ""}
<p class="hint">La photo reste sur ton téléphone. Elle n'est envoyée nulle part.</p></form>
<button class="btn" data-go="${back}">Retour au résultat</button>`;
}
function lierProprio(F) {
  const P = F.P;
  const garder = () => {
    P.adr = $("#padr").value;
    P.nomReg = $("#preg").value.trim();
    P.nomBail = $("#pbail").value.trim();
  };
  const recomparer = () => {
    if (P.texte && P.nomReg) P.cmp = comparerProprio(P.texte, P.nomReg, P.adr);
  };
  ["#padr", "#preg", "#pbail"].forEach(
    (s) =>
      ($(s).onchange = () => {
        const avant = P.adr;
        garder();
        if (P.adr !== avant) P.geo = null;
        recomparer();
        go("proprio");
      }),
  );
  $("#b-lot").onclick = async () => {
    garder();
    if (P.adr.trim().length < 6 || !/\d/.test(P.adr)) {
      P.geo = { trouve: false, erreur: "Entre l'adresse complète, avec le numéro et la ville." };
      return go("proprio");
    }
    P.chercheLot = true;
    go("proprio");
    try {
      MES.noter("lot_cherche");
    } catch (e) {}
    try {
      P.geo = await INFO.adresse(P.adr.trim());
    } catch (e) {
      P.geo = { trouve: false, erreur: "La recherche automatique n'a pas fonctionné ici." };
    }
    P.chercheLot = false;
    if ($("#f-pro")) go("proprio");
  };
  const inp = app.querySelector("input[data-taxe]");
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    garder();
    const r = new FileReader();
    r.onload = () => {
      P.photo = r.result;
      P.cmp = null;
      P.lecture = "Lecture du document…";
      go("proprio");
      lireCapture(P.photo)
        .then((t) => {
          P.texte = t;
          recomparer();
          P.lecture = null;
        })
        .catch(() => {
          P.lecture = "La lecture automatique n'a pas fonctionné ici. Écris le nom toi-même ci-dessus.";
        })
        .finally(() => {
          if ($("#f-sig")) go("proprio");
        });
    };
    r.readAsDataURL(f);
  };
}

/* ---------- 2. Simulateur de budget d'installation 2026 ---------- */
const TRANSIT = {
  // laissez-passer mensuel régulier, tarif 2026
  Montréal: {
    p: 110,
    s: "STM, mensuel tous modes A, juillet 2026",
    u: "https://www.narcity.com/fr/montreal/augmentation-stm-artm-tarifs-2026",
  },
  Québec: {
    p: 115,
    s: "Métropolitain régulier RTC/STLévis, 1er février 2026",
    u: "https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf",
  },
  Lévis: {
    p: 115,
    s: "Métropolitain régulier RTC/STLévis, 1er février 2026",
    u: "https://www.stlevis.ca/sites/default/files/public/assets/tarifs-points-de-vente/documents/2025-11-25_cmquebec_hausse-tarif-metro_communique_vf3.pdf",
  },
  Gatineau: { p: 116.5, s: "STO, mensuel régulier 2026", u: "https://sto.ca/en/fares/echo-program/" },
};
const ASSURANCE = {
  p: 31,
  s: "moyenne citée par la Chambre de l'assurance de dommages (Protégez-vous)",
  u: "https://www.protegez-vous.ca/partenaires/chambre-de-l-assurance/assurance-locataire-quoi-savoir-pour-prendre-une-decision-eclairee",
};
const EPICERIE = {
  p: 366,
  s: "Rapport sur les prix alimentaires 2026 : 17 571,79 $ par an pour une famille de quatre, divisé par 4 et par 12",
  u: "https://www.dal.ca/news/2025/12/04/canada-food-price-report-2026.html",
};
const GARDE = {
  jour: 9.65,
  jours: 21,
  s: "tarif 2026 en service de garde subventionné : 9,65 $ par jour",
  u: "https://www.quebec.ca/famille-et-soutien-aux-personnes/enfance/garderies-et-services-de-garde/soutien-financier-frais-garde",
};
const POSTES = [
  ["loyer", "Loyer"],
  ["elec", "Électricité"],
  ["epicerie", "Épicerie"],
  ["transport", "Transport"],
  ["internet", "Internet et cellulaire"],
  ["garde", "Garde d'enfants"],
  ["assurance", "Assurance locataire"],
  ["abonnements", "Abonnements"],
];
const gardeDefaut = (B) => String(Math.round(GARDE.jour * GARDE.jours * (+B.garderie || 0)));
function budgetDefaut(F) {
  const B = F.B || (F.B = {});
  if (!B.ville) B.ville = F.ville && LOYERS[F.ville] ? F.ville : villeDefaut();
  if (!B.ch) B.ch = F.ch || "1";
  if (!B.unite) B.unite = "an";
  if (!B.netUnite) B.netUnite = "mois";
  if (!B.adultes) B.adultes = "1";
  if (!B.enfants) B.enfants = "0";
  if (!B.garderie) B.garderie = "0";
  if (!B.mois) B.mois = "3";
  if (+B.garderie > +B.enfants) B.garderie = B.enfants;
  if (B.transport == null) {
    const t = TRANSIT[B.ville];
    B.transport = t ? String(Math.round(t.p * (+B.adultes || 1) * 100) / 100).replace(".", ",") : "";
  }
  if (B.assurance == null) B.assurance = String(ASSURANCE.p);
  if (B.epicerie == null) B.epicerie = String(EPICERIE.p * ((+B.adultes || 1) + (+B.enfants || 0)));
  if (B.garde == null) B.garde = gardeDefaut(B);
  if (B.loyer == null) {
    const l = LOYERS[B.ville];
    B.loyer = l ? String(l[Math.min(+B.ch, 3) - 1]) : "";
  }
  return B;
}
const montant = (v) => {
  const n = parseFloat(
    String(v || "")
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  return isNaN(n) ? 0 : n;
};
function calculerBudget(B) {
  const rev = montant(B.revenu),
    revMois = B.unite === "an" ? rev / 12 : rev;
  const net = montant(B.net),
    netMois = B.netUnite === "an" ? net / 12 : B.netUnite === "2sem" ? (net * 26) / 12 : net;
  const loyer = montant(B.loyer),
    elec = montant(B.elec);
  const postes = POSTES.map(([k, n]) => ({ k, n, v: montant(B[k]) })).filter((p) => p.v > 0);
  const mensuel = postes.reduce((a, p) => a + p.v, 0);
  const uniques = montant(B.demenagement) + montant(B.meubles);
  const mois = +B.mois || 3;
  const max = revMois ? Math.max(0, Math.floor(revMois * 0.3 - elec)) : 0;
  const ratio = revMois ? (loyer + elec) / revMois : 0;
  const l = LOYERS[B.ville],
    moy = l && l[Math.min(+B.ch, 3) - 1];
  const base = netMois || revMois,
    total = uniques + mensuel * mois;
  return {
    revMois,
    netMois,
    base,
    baseNet: !!netMois,
    reste: base ? base - mensuel : 0,
    revPeriode: base * mois,
    restePeriode: base ? base * mois - total : 0,
    mensuel,
    postes,
    uniques,
    mois,
    total,
    max,
    ratio,
    moy,
    loyer,
    elec,
  };
}
const m0 = (n) => Math.round(n).toLocaleString("fr-CA") + " $";
function comparerVilles(B, R) {
  const ch = Math.min(+B.ch, 3);
  return `<h3 class="sous">Comparer les villes</h3><p class="hint">Pour ${ch === 3 ? "3 chambres et plus" : ch + " chambre" + (ch > 1 ? "s" : "")}. Loyer moyen SCHL (octobre 2025) et laissez-passer 2026.</p>
<table class="tvilles"><thead><tr><th>Ville</th><th>Loyer moyen</th><th>Transport</th>${R.revMois ? "<th>30 %</th>" : ""}</tr></thead><tbody>
${Object.keys(LOYERS)
  .map((v) => {
    const m = LOYERS[v][ch - 1],
      t = TRANSIT[v],
      ok = R.revMois && m + R.elec <= R.revMois * 0.3;
    return `<tr${v === B.ville ? ' class="ici"' : ""}><td>${esc(v)}</td><td class="num">${m ? m0(m) : "—"}</td><td class="num">${t ? String(t.p).replace(".", ",") + " $" : "—"}</td>${R.revMois ? `<td>${m ? (ok ? '<span class="ok">Oui</span>' : '<span class="non">Non</span>') : "—"}</td>` : ""}</tr>`;
  })
  .join("")}
</tbody></table>${R.revMois ? `<p class="hint">« Oui » : le loyer moyen et ton électricité restent sous 30 % de ton revenu.</p>` : ""}`;
}
function resultatBudget(B) {
  const R = calculerBudget(B);
  if (!R.mensuel) return `<p class="hint">Entre le loyer visé pour voir ton budget.</p>`;
  const c = !R.revMois ? "g" : R.ratio <= 0.3 ? "g" : R.ratio <= 0.4 ? "y" : "r";
  return `<div class="tuiles"><div class="tuile fort"><span>Total pour ${R.mois} mois</span><b class="num">${m0(R.total)}</b></div>
<div class="tuile"><span>Par mois</span><b class="num">${m0(R.mensuel)}</b></div><div class="tuile"><span>Frais uniques</span><b class="num">${m0(R.uniques)}</b></div>${R.base ? `<div class="tuile"><span>${R.baseNet ? "Salaire net" : "Revenu avant impôt"} pour ${R.mois} mois</span><b class="num">${m0(R.revPeriode)}</b></div><div class="tuile"><span>${R.restePeriode < 0 ? "Manque" : "Reste"} après ${R.mois} mois</span><b class="num" style="color:${R.restePeriode < 0 ? "var(--red)" : "inherit"}">${m0(Math.abs(R.restePeriode))}</b></div>` : ""}</div>
${R.base && !R.baseNet ? `<p class="hint">Calculé sur ton revenu <b>avant impôt</b> : l'impôt n'est pas déduit, le reste réel sera plus bas. Ajoute ton salaire net pour un calcul exact.</p>` : ""}
<p class="hint">Total : déménagement et meubles, plus ${R.mois} mois de dépenses. Le premier mois de loyer y est compris. Ne le paie qu'au moment de signer le bail, après avoir confirmé que tu parles au vrai propriétaire, et par un moyen qui laisse une trace (chèque ou virement, avec un reçu). Il ne peut rien exiger d'autre d'avance : aucun dépôt (${lienExt(L_1904, "art. 1904 C.c.Q.")}).</p>
${
  R.base
    ? (() => {
        const cr =
          R.reste < 0
            ? "r"
            : R.reste < R.base * 0.1 || (R.loyer + R.elec) / R.base > (R.baseNet ? 0.5 : 0.3)
              ? "y"
              : "g";
        return `<div class="verdict ${cr}"><strong>${R.reste < 0 ? "Il te manque" : "Il te reste"} <span class="num">${m0(Math.abs(R.reste))}</span> par mois</strong><span>${R.baseNet ? "Salaire net" : "Revenu avant impôt"} de ${m0(R.base)} par mois, moins tes dépenses mensuelles de ${m0(R.mensuel)}${cr === "g" ? " : de la marge pour l'épargne, les imprévus et les loisirs." : cr === "y" ? " : c'est serré, garde une réserve pour les imprévus." : ". Réduis le loyer visé ou pense à une colocation."} Le loyer et l'électricité font ${Math.round(((R.loyer + R.elec) / R.base) * 100)} % de ton ${R.baseNet ? "salaire net" : "revenu avant impôt"}.${R.baseNet ? "" : " Avec l'impôt, il te restera moins : ajoute ton salaire net pour le chiffre exact."}</span></div>`;
      })()
    : ""
}
${R.revMois ? `<div class="verdict ${c}"><strong>Loyer maximum conseillé : <span class="num">${m0(R.max)}</span></strong><span>30 % de ton revenu avant impôt, moins l'électricité (${lienExt(L_SCHL30, "règle de la SCHL")}). Ton loyer visé et l'électricité font ${Math.round(R.ratio * 100)} % de ton revenu${c === "g" ? " : c'est dans la norme." : c === "y" ? " : le budget sera serré." : " : cherche moins cher ou une colocation."}</span></div>` : R.base ? "" : `<p class="hint">Ajoute ton revenu pour connaître le loyer maximum conseillé.</p>`}
<h3 class="sous">Où va ton argent chaque mois</h3>
<div class="barres">${R.postes
    .sort((a, b) => b.v - a.v)
    .map(
      (p) =>
        `<div class="barre"><span>${p.n}</span><span class="num">${m0(p.v)}</span><i style="width:${Math.max(2, Math.round((p.v / R.mensuel) * 100))}%"></i></div>`,
    )
    .join("")}</div>
${R.moy ? `<p class="hint">Loyer moyen à ${esc(B.ville)} : <b class="num">${m0(R.moy)}</b> (SCHL, Enquête sur les logements locatifs, octobre 2025).</p>` : ""}
${R.revMois ? `<button class="btn" id="b-annonces">Chercher des logements jusqu'à ${m0(R.max)}</button>` : `<button class="btn" id="b-annonces">Chercher des logements à ${esc(B.ville)}</button>`}
${comparerVilles(B, R)}`;
}
function vueBudget(F, back) {
  const B = budgetDefaut(F);
  const t = TRANSIT[B.ville];
  const champ = (k, l, ph, aide) =>
    `<label>${l}<input id="b-${k}" data-b="${k}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${esc(B[k] || "")}">${aide ? `<span class="hint">${aide}</span>` : ""}</label>`;
  const choix = (k, l, vals) =>
    `<label>${l}<select id="b-${k}" data-b="${k}">${vals.map(([v, t]) => `<option value="${v}" ${String(B[k]) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const n = (a) => [...Array(a[1] - a[0] + 1)].map((_, i) => [i + a[0], String(i + a[0])]);
  return `${top(back, "Budget")}
<h2>Mon budget d'installation 2026</h2>
<p class="soft">Combien prévoir pour t'installer et combien tu peux payer de loyer. Chaque montant par défaut a sa source, et tu peux le changer.</p>
<div class="card"><h2>Ta situation</h2>
<div class="grid2">${choix(
    "ville",
    "Ville",
    Object.keys(LOYERS).map((v) => [v, v]),
  )}${choix("ch", "Chambres", [
    ["1", "1"],
    ["2", "2"],
    ["3", "3 et plus"],
  ])}</div>
<div class="grid2">${choix("adultes", "Adultes", n([1, 4]))}${choix("enfants", "Enfants", n([0, 5]))}</div>
${+B.enfants ? choix("garderie", "Enfants en garderie (0 à 5 ans)", n([0, +B.enfants])) : ""}
<div class="grid2">${champ("revenu", "Revenu du ménage avant impôt", "45 000")}${choix("unite", "Par", [
    ["an", "année"],
    ["mois", "mois"],
  ])}</div>
<div class="grid2">${champ("net", "Salaire net du ménage (facultatif)", "2 900")}${choix("netUnite", "Par", [
    ["mois", "mois"],
    ["2sem", "2 semaines"],
    ["an", "année"],
  ])}</div>
<p class="hint" style="margin-top:-6px">Le montant qui arrive vraiment dans ton compte, après impôts et retenues (voir ton talon de paie). Il sert à calculer ce qui te reste chaque mois.</p>
${champ("loyer", "Loyer visé par mois", "1 200", "Par défaut : loyer moyen SCHL de la ville.")}
${choix("mois", "Prévoir l'argent pour", [
  ["1", "1 mois"],
  ["3", "3 mois"],
  ["6", "6 mois"],
])}
</div>
<div class="card" id="bres" aria-live="polite">${resultatBudget(B)}</div>
<div class="card"><h2>Chaque mois</h2>
${champ("elec", "Électricité", "80", "Demande au propriétaire le montant des factures d'Hydro-Québec de l'an dernier, ou si le chauffage est inclus.")}
${champ("epicerie", "Épicerie", "366", `Estimation : ${lienExt(EPICERIE.u, EPICERIE.s)} = 366 $ par personne.`)}
${champ("transport", "Transport", t ? String(t.p) : "0", t ? `Un laissez-passer par adulte : ${lienExt(t.u, t.s)}. Mets ton coût d'auto si tu conduis.` : "Mets ton laissez-passer ou ton coût d'auto.")}
${champ("internet", "Internet et cellulaire", "90", "Selon tes forfaits.")}
${+B.garderie ? champ("garde", "Garde d'enfants", "0", `Par défaut : ${lienExt(GARDE.u, GARDE.s)}, × ${GARDE.jours} jours par mois. En garderie non subventionnée, mets ton tarif.`) : ""}
${champ("assurance", "Assurance locataire", "31", `Par défaut : ${lienExt(ASSURANCE.u, ASSURANCE.s)}.`)}
${champ("abonnements", "Abonnements (télé, musique, gym…)", "0")}
</div>
<div class="card"><h2>Une seule fois</h2>
${champ("demenagement", "Déménagement", "500", "Camion, déménageurs, billets ou essence.")}
${champ("meubles", "Meubles et articles de base", "800", "Lit, électroménagers s'ils ne sont pas fournis, vaisselle, vêtements d'hiver.")}
</div>
<button class="btn ghost" data-go="verifier" id="nouv">Vérifier une annonce que j'ai trouvée</button>`;
}
function lierBudget(F) {
  const B = F.B;
  const lierBoutonAnnonces = () => {
    const b = $("#b-annonces");
    if (b)
      b.onclick = () => {
        const R = calculerBudget(B);
        nouveauF({ filtre: { ville: B.ville, ch: B.ch, max: R.max || "" }, B });
        go("trouver");
      };
  };
  const maj = () => {
    const r = $("#bres"),
      h = resultatBudget(B);
    if (r && r.dataset.h !== h) {
      r.dataset.h = h;
      r.innerHTML = h;
      lierBoutonAnnonces();
    }
  };
  app.querySelectorAll("[data-b]").forEach((el) => {
    el[el.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
      const k = el.dataset.b,
        ancien = B[k];
      B[k] = el.value;
      if (el.tagName === "SELECT" && ancien !== el.value) {
        if (k === "ville") {
          B.transport = null;
          B.loyer = null;
        }
        if (k === "ch") B.loyer = null;
        if (k === "adultes" || k === "enfants") B.epicerie = null;
        if (k === "adultes") B.transport = null;
        if (k === "enfants" || k === "garderie") {
          if (+B.garderie > +B.enfants) B.garderie = B.enfants;
          B.garde = null;
        }
        budgetDefaut(F);
        return go("budget");
      }
      maj();
    };
  });
  lierBoutonAnnonces();
}

/* ---------- 3. Trouver : annonces trouvées sur le web, pré-triées par l'app ---------- */
// Sites où l'app cherche. « courtier » : annonce publiée par un courtier immobilier, encadré par l'OACIQ.
const SOURCES = [
  { d: "kijiji.ca", n: "Kijiji" },
  { d: "centris.ca", n: "Centris", courtier: true },
  { d: "realtor.ca", n: "REALTOR.ca", courtier: true },
  { d: "duproprio.com", n: "DuProprio" },
  { d: "rentals.ca", n: "Rentals.ca" },
  { d: "louer.ca", n: "Louer.ca" },
  { d: "kangalou.com", n: "Kangalou" },
  { d: "logisquebec.com", n: "LogisQuébec" },
  { d: "padmapper.com", n: "PadMapper" },
  { d: "lespac.com", n: "LesPAC" },
  { d: "zumper.com", n: "Zumper" },
  { d: "craigslist.org", n: "Craigslist" },
];
const L_OACIQ = "https://www.oaciq.com";
const source = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^(www|m|fr|en)\./, "");
    return SOURCES.find((s) => h === s.d || h.endsWith("." + s.d));
  } catch (e) {
    return null;
  }
};
const estAnnonce = (u) => {
  try {
    const x = new URL(u),
      p = x.pathname;
    if (/\/b-|\/search|\/recherche/i.test(p)) return false;
    return /\/v-/.test(p) || /\d{5,}/.test(p);
  } catch (e) {
    return false;
  }
};
function lirePrix(t) {
  const m = String(t)
    .replace(/ | /g, " ")
    .match(/(?:\$\s?(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?)|(?:(\d{1,2}[ ,]?\d{3}|\d{3,4})(?:[.,]\d{2})?\s?\$)/);
  if (!m) return null;
  const n = parseInt((m[1] || m[2]).replace(/[ ,]/g, ""), 10);
  return n >= 300 && n <= 8000 ? n : null;
}
function lireChambres(t) {
  t = sansAccents(t);
  let m = t.match(/(\d)\s*(?:chambres?|ch\b|cac|bedrooms?|bdr|br\b)/);
  if (m) return Math.min(+m[1], 3);
  m = t.match(/\b([3-7])\s*(?:1\/2|½|\.5|,5|et demi)/);
  if (m) return Math.max(1, Math.min(+m[1] - 2, 3));
  if (/studio|1 1\/2|2 1\/2/.test(t)) return 1;
  return null;
}
const ALERTES_EXTRAIT = [
  [/western union|moneygram|carte[s]? cadeau|gift card|bitcoin|crypto/, "Paiement typique des fraudes mentionné"],
  [/(?<!aucun |pas de |sans |no |zero )(depot|deposit)/, "Un dépôt est mentionné : il est interdit (art. 1904 C.c.Q.)"],
  [/whatsapp|telegram/, "Contact par WhatsApp ou Telegram demandé"],
  [/a l'etranger|hors du pays|out of (the )?country|je suis (en|au) (mission|voyage)/, "Propriétaire « à l'étranger »"],
];
function trierResultats(res, f) {
  const l = LOYERS[f.ville];
  const vus = new Set();
  const sortie = [];
  for (const r of res) {
    const s = source(r.url);
    if (!s || !estAnnonce(r.url)) continue;
    const cle = r.url.split(/[?#]/)[0];
    if (vus.has(cle)) continue;
    vus.add(cle);
    const txt = `${r.titre || ""} ${r.extrait || ""}`;
    const prix = lirePrix(txt),
      ch = lireChambres(txt);
    if (f.max && prix && prix > f.max) continue;
    if (f.ch && ch && (f.ch === "3" ? ch < 3 : ch != +f.ch)) continue;
    const moy = l && l[Math.min(ch || +f.ch || 1, 3) - 1];
    const t = sansAccents(txt);
    const alertes = ALERTES_EXTRAIT.filter(([re]) => re.test(t)).map((a) => a[1]);
    if (prix && moy && prix < moy * 0.6)
      alertes.push(`Prix très bas pour la ville (moyenne SCHL ${m0(moy)}) : vérifie-la avant tout contact`);
    sortie.push({ ...r, url: cle, source: s, prix, ch, moy, alertes });
  }
  return sortie.sort(
    (a, b) =>
      a.alertes.length - b.alertes.length ||
      (b.source.courtier ? 1 : 0) - (a.source.courtier ? 1 : 0) ||
      (a.prix || 99999) - (b.prix || 99999),
  );
}
function carteResultat(r, i) {
  return `<article class="annonce"><div class="ann-corps">
${r.exemple ? `<p class="tag-demo">Exemple (démo)</p>` : ""}
<p class="hint">${esc(r.source.n)}${r.age ? ` · ${esc(r.age)}` : ""}</p>
<h3>${r.prix ? `<span class="num">${m0(r.prix)}</span> / mois` : "Prix non lu"}${r.ch ? ` · ${r.ch >= 3 ? "3 ch. et plus" : r.ch + " ch."}` : ""}</h3>
<p>${esc(r.titre || "")}</p>
<ul class="reasons">
${r.alertes.length ? r.alertes.map((a) => `<li><span class="dot y"></span><div>${esc(a)}</div></li>`).join("") : `<li><span class="dot g"></span><div>Aucun signal dans le texte de l'annonce.</div></li>`}
${r.source.courtier ? `<li><span class="dot g"></span><div>Publiée par un courtier immobilier, encadré par l'${lienExt(L_OACIQ, "OACIQ")}.</div></li>` : ""}
${r.prix && r.moy ? `<li><span class="dot i"></span><div>Loyer moyen SCHL ici : ${m0(r.moy)}.</div></li>` : ""}</ul>
${r.exemple ? `<button class="btn" data-verif="${i}">Vérifier</button>` : `<div class="grid2"><a class="btn ghost lienbouton" href="${urlWeb(r.url) ? esc(r.url) : "#"}" target="_blank" rel="noopener">Ouvrir</a><button class="btn" data-verif="${i}">Vérifier</button></div>`}
</div></article>`;
}
/* Liens vers les sites, avec les critères du formulaire déjà appliqués quand le site le permet.
   Kijiji : adresses vérifiées (catégorie appartements c37, lieu, ?numberbedrooms=, ?price=__max).
   Facebook Marketplace : n'applique pas les filtres passés dans l'adresse ; on affiche les critères à reporter. */
const KIJIJI_LIEUX = {
  Montréal: ["ville-de-montreal", "l1700281"],
  Québec: ["ville-de-quebec", "l1700124"],
  Gatineau: ["gatineau", "l1700186"],
  Sherbrooke: ["sherbrooke-qc", "l1700156"],
  Saguenay: ["saguenay-lac-saint-jean", "l1700178", "Saguenay–Lac-Saint-Jean"],
  Rimouski: ["rimouski-bas-st-laurent", "l1700250", "Bas-Saint-Laurent"],
  "Rivière-du-Loup": ["rimouski-bas-st-laurent", "l1700250", "Bas-Saint-Laurent"],
  "Trois-Rivières": ["mauricie", "l1700147", "Mauricie"],
  Drummondville: ["centre-du-quebec", "l1700121", "Centre-du-Québec"],
};
const FB_VILLES = { Montréal: "montreal" };
function lienKijiji(f) {
  const l = KIJIJI_LIEUX[f.ville];
  if (!l) return null;
  const p = new URLSearchParams();
  if (f.ch) p.set("numberbedrooms", f.ch === "3" ? "3,4" : f.ch);
  if (f.max) p.set("price", "__" + f.max);
  const q = p.toString();
  return `https://www.kijiji.ca/b-appartement-condo/${l[0]}/c37${l[1]}${q ? "?" + q : ""}`;
}
function lienFacebook(f) {
  const v = FB_VILLES[f.ville];
  return `https://www.facebook.com/marketplace/${v ? v + "/propertyrentals" : "category/propertyrentals"}`;
}
function liensSites(f) {
  const ch = f.ch === "3" ? "3 chambres" : f.ch ? f.ch + " chambres" : "";
  const taille = f.ch ? `${+f.ch + 2} 1/2 ` : "";
  const q = `${taille}à louer ${ch} ${f.ville}`.replace(/\s+/g, " ").trim();
  const g = (site) => `https://www.google.com/search?q=${encodeURIComponent(q + " site:" + site)}&tbs=qdr:w`;
  const crit = [f.ville, f.ch ? (f.ch === "3" ? "3 ch. et plus" : f.ch + " ch.") : "", f.max ? "max " + m0(+f.max) : ""]
    .filter(Boolean)
    .join(" · ");
  const kj = lienKijiji(f),
    reg = KIJIJI_LIEUX[f.ville] && KIJIJI_LIEUX[f.ville][2];
  const lien = (href, nom, sous) =>
    `<a class="btn ghost lienbouton" href="${urlWeb(href) ? esc(href) : "#"}" target="_blank" rel="noopener">${nom}<small>${sous}</small></a>`;
  return `<div class="card"><h2>Chercher aussi directement</h2><p class="hint">Kijiji s'ouvre avec tes critères (${esc(crit)}) déjà appliqués ; pour les autres sites, ajoute-les dans leurs filtres. Trouve une annonce, puis reviens la vérifier.</p>
<div class="choix-accueil sites">
${lien(lienFacebook(f), "Facebook Marketplace", `${FB_VILLES[f.ville] ? "Ajoute" : "Choisis " + esc(f.ville) + ", puis ajoute"} dans les filtres : ${esc([f.ch ? (f.ch === "3" ? "3 ch. et plus" : f.ch + " ch.") : "", f.max ? "max " + m0(+f.max) : ""].filter(Boolean).join(" · ") || "tes critères")}`)}
${kj ? lien(kj, "Kijiji", `${reg ? "Région " + esc(reg) : esc(f.ville)} · filtres déjà appliqués`) : lien(g("kijiji.ca"), "Kijiji", "Annonces des 7 derniers jours")}
${[
  ["centris.ca", "Centris (courtiers)"],
  ["kangalou.com", "Kangalou"],
  ["logisquebec.com", "LogisQuébec"],
  ["louer.ca", "Louer.ca"],
  ["lespac.com", "LesPAC"],
]
  .map(([d, n]) => lien(g(d), n, `${esc(taille.trim() || "Logements")} à ${esc(f.ville)} · 7 derniers jours`))
  .join("")}
</div></div>`;
}
function vueTrouver(F, back) {
  const f = F.filtre || (F.filtre = { ville: villeDefaut(), ch: "", max: "" });
  return `${top(back, "Trouver")}
<h2>Trouver un logement</h2>
<p class="soft">L'app cherche les annonces récentes sur Kijiji, Centris, Kangalou et d'autres sites, retire celles hors budget et signale ce qui cloche.</p>
<form class="card" id="f-tr" novalidate>
<div class="grid2"><label>Ville<select id="t-ville">${Object.keys(LOYERS)
    .map((v) => `<option ${f.ville === v ? "selected" : ""}>${v}</option>`)
    .join("")}</select></label>
<label>Chambres<select id="t-ch"><option value="">Toutes</option>${["1", "2", "3"].map((v) => `<option value="${v}" ${f.ch === v ? "selected" : ""}>${v === "3" ? "3 et plus" : v}</option>`).join("")}</select></label></div>
<label>Budget maximum par mois<input id="t-max" inputmode="numeric" placeholder="1 400" value="${f.max ? esc(f.max) : ""}"></label>
${!F.B ? `<p class="hint">Tu ne sais pas combien tu peux payer ? <button type="button" class="lienbtn" data-go="budget">Calcule ton budget</button></p>` : ""}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Chercher</button></form>
<div id="liste" aria-live="polite">${F.resultats ? "" : ""}</div>
<div id="sites"></div>`;
}
function lierTrouver(F) {
  const f = F.filtre;
  const afficher = () => {
    const el = $("#liste");
    if (!el) return;
    const R = F.resultats || [];
    el.innerHTML =
      (F.noteRecherche ? `<p class="demo">${F.noteRecherche}</p>` : "") +
      (R.length
        ? `<p class="hint">${R.length} annonce${R.length > 1 ? "s" : ""} trouvée${R.length > 1 ? "s" : ""}. Le tri lit seulement le titre et l'extrait : ouvre l'annonce, puis touche « Vérifier ».</p>` +
          R.map(carteResultat).join("")
        : `<div class="card"><p>Aucune annonce trouvée pour ces critères.</p><p class="hint">Augmente le budget ou change le nombre de chambres, ou cherche directement sur les sites ci-dessous.</p></div>`);
    el.querySelectorAll("[data-verif]").forEach(
      (b) =>
        (b.onclick = () => {
          const r = R[+b.dataset.verif];
          nouveauF({
            lien: r.url,
            ville: f.ville,
            ch: String(r.ch || f.ch || "2"),
            prix: r.prix ? String(r.prix) : "",
            annonce: `${r.titre || ""}\n${r.extrait || ""}`,
            lu: `<b>Repris de la recherche :</b> ${esc(r.source.n)}${r.prix ? `, ${m0(r.prix)}` : ""}. Ajoute des captures de l'annonce complète et de la conversation pour une vérification complète.`,
          });
          go("verifier");
        }),
    );
    $("#sites").innerHTML = liensSites(f);
  };
  const chercher = async () => {
    f.ville = $("#t-ville").value;
    f.ch = $("#t-ch").value;
    f.max = nombre($("#t-max").value) || "";
    if (!f.max) return err("Entre ton budget maximum.");
    err("");
    try {
      MES.noter("recherche_lancee");
    } catch (e) {}
    const b = $("#go");
    b.disabled = true;
    b.textContent = "Recherche…";
    $("#liste").innerHTML = `<p class="hint">Recherche des annonces récentes…</p>`;
    try {
      const brut = await ANN.chercher(f);
      F.resultats = trierResultats(brut, f);
      F.noteRecherche = ANN.note || "";
    } catch (x) {
      F.resultats = [];
      F.noteRecherche =
        x && x.message === "quota"
          ? "Tu as atteint la limite de recherches pour aujourd'hui. Réessaie demain, ou cherche directement sur les sites ci-dessous."
          : "La recherche n'a pas fonctionné. Réessaie, ou cherche directement sur les sites ci-dessous.";
    }
    if (!$("#f-tr")) return;
    b.disabled = false;
    b.textContent = "Chercher";
    afficher();
  };
  $("#f-tr").onsubmit = (e) => {
    e.preventDefault();
    chercher();
  };
  /* Les liens suivent les critères dès qu'un champ change. */
  const majLiens = () => {
    f.ville = $("#t-ville").value;
    f.ch = $("#t-ch").value;
    f.max = nombre($("#t-max").value) || "";
    const s = $("#sites");
    if (s) s.innerHTML = liensSites(f);
  };
  ["t-ville", "t-ch", "t-max"].forEach((i) => {
    const el = $("#" + i);
    if (el) {
      el.addEventListener("input", majLiens);
      el.addEventListener("change", majLiens);
    }
  });
  if (F.resultats) afficher();
  else if (f.max) chercher();
  else $("#sites").innerHTML = liensSites(f);
}

/* ---------- Liaison ---------- */
function bindPlus(v) {
  if (v === "proprio") lierProprio(F);
  if (v === "budget") lierBudget(F);
  if (v === "trouver") lierTrouver(F);
}
const CSS_PLUS = ""; /* styles déplacés dans app.css */

/* Adaptateur adresse (Supabase : fonction info-adresse, qui appelle les services publics) */
const INFO = {
  async adresse(a) {
    const { data, error } = await sb.functions.invoke("info-adresse", { body: { adresse: a } });
    if (error || !data || data.error) return trouverLotDirect(a);
    return data;
  },
};

/* Adaptateur recherche (Supabase : fonction chercher-annonces → Brave Search API) */
const ANN = {
  note: "",
  async chercher(f) {
    if (!CFG.recherche) return [];
    const { data, error } = await sb.functions.invoke("chercher-annonces", {
      body: { ville: f.ville, ch: f.ch, max: f.max },
    });
    if (error) {
      if (error.context && error.context.status === 429) throw new Error("quota");
      throw error;
    }
    return (data && data.resultats) || [];
  },
};
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS + "</style>");
