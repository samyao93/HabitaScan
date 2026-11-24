/* Coût mensuel réel d'un logement : ce que l'annonce dit des dépenses en plus du loyer, les frais ponctuels
   et les questions à poser à la visite. Une dépense dont on ignore le montant n'est jamais comptée 0 $. */

/* Statuts d'une dépense : incluse dans le loyer, à la charge du locataire (montant connu ou non),
   aucune (ex. pas de stationnement), ou non précisée dans l'annonce. */
export const INCLUS = "inclus",
  A_CHARGE = "a_charge",
  AUCUN = "aucun",
  INCONNU = "inconnu";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ | /g, " ");

const NEG = String.raw`(?:non|pas|not|no|sans|without)`;
const EN_PLUS = String.raw`(?:non[- ]inclus\w*|pas inclus\w*|not included|en sus|en plus|extra|a vos frais|a ta charge|a la charge du locataire|aux frais du locataire|paye(?:e|s)? par le locataire|tenant pays|paid by tenant)`;
const INCL = String.raw`(?:inclus\w*|compris\w*|included|includ\w*|fourni\w*|gratuit\w*|free)`;

/* Chaque dépense : son nom, les motifs « aucune » et « à ta charge » écrits avant le mot (« non chauffé »),
   puis ce qui suit le mot (fonction apres), puis les motifs « incluse » (« chauffé », « inclus : chauffage »).
   Le motif « mot » sert à trouver un montant écrit près du mot (« stationnement 75 $/mois »). */
export const POSTES = [
  {
    cle: "chauffage",
    nom: "Chauffage",
    mot: String.raw`chauffage|heating|\bheat\b`,
    charge: [String.raw`\b${NEG}[- ]chauffe`, String.raw`\b${NEG}[- ]heated`, String.raw`\+\s*(?:chauffage|heating)`],
    inclus: [
      String.raw`${INCL}[^.\n]{0,15}?(?:chauffage|heating)`,
      String.raw`\bchauffe\b(?!-eau)`,
      String.raw`\bheated\b`,
    ],
  },
  {
    cle: "electricite",
    nom: "Électricité",
    mot: String.raw`electricite|electricity|hydro(?:-quebec)?\b`,
    charge: [String.raw`\b${NEG}[- ]eclaire`, String.raw`(?:\+|plus)\s*(?:l'|l )?(?:electricite|hydro\b|electricity)`],
    inclus: [String.raw`${INCL}[^.\n]{0,15}?(?:electricite|electricity|hydro\b)`, String.raw`\beclaire\b`],
  },
  {
    cle: "eau_chaude",
    nom: "Eau chaude",
    mot: String.raw`eau chaude|hot water|chauffe-eau|water heater`,
    inclus: [String.raw`${INCL}[^.\n]{0,15}?(?:eau chaude|hot water)`],
  },
  {
    cle: "internet",
    nom: "Internet",
    mot: String.raw`internet|wi-?fi`,
    charge: [String.raw`\b${NEG}\s+(?:internet|wi-?fi)`],
  },
  {
    cle: "stationnement",
    nom: "Stationnement",
    mot: String.raw`stationnement|parking|garage`,
    aucun: [
      String.raw`\b(?:sans|pas de|aucun|no)\s+(?:stationnement|parking)`,
      String.raw`(?:stationnement|parking) (?:dans|sur) la rue`,
      String.raw`street parking`,
    ],
    inclus: [String.raw`${INCL}[^.\n]{0,15}?(?:stationnement|parking)`],
  },
];

/* « Tout inclus » couvre le chauffage, l'électricité et l'eau chaude (pas internet ni le stationnement). */
const TOUT_INCLUS =
  /tout[- ]inclus|toutes? (?:les )?(?:charges|depenses) (?:sont )?inclus|all[- ]inclusive|utilities (?:are )?included|everything included|chauffe[ ,]+eclaire/;

/* Montant mensuel écrit près du mot (5 à 500 $), ex. « stationnement : 75 $ / mois », « parking $50/month ». */
export function montantPres(texte, mot, max = 500) {
  const re = new RegExp(
    String.raw`(?:${mot})[^.\n$\d]{0,30}?(?:\$\s?(\d{1,4}(?:[.,]\d{2})?)|(\d{1,4}(?:[.,]\d{2})?)\s?\$)`,
    "g",
  );
  for (const m of norm(texte).matchAll(re)) {
    const n = Math.round(parseFloat((m[1] || m[2]).replace(",", ".")));
    if (n >= 5 && n <= max) return n;
  }
  return null;
}

/* Lit le texte de l'annonce (et la conversation) : { cle: { statut, montant } } pour chaque dépense. */
/* Ce que dit la suite du mot (« chauffage et eau chaude inclus », « hydro not included ») : le premier
   « inclus » ou « en sus » trouvé dans les 40 caractères qui suivent, sans passer un point. */
const RE_STATUT = new RegExp(`(${EN_PLUS})|(${INCL})`);
function apres(t, mot) {
  for (const m of t.matchAll(new RegExp(`(?:${mot})`, "g"))) {
    const suite = t.slice(m.index + m[0].length, m.index + m[0].length + 40).split(/[.\n]/)[0];
    const s = suite.match(RE_STATUT);
    if (s) return s[1] ? A_CHARGE : INCLUS;
  }
  return null;
}

export function lireDepenses(texte) {
  const t = norm(texte);
  const tout = TOUT_INCLUS.test(t);
  const r = {};
  for (const p of POSTES) {
    const trouve = (liste) => (liste || []).some((m) => new RegExp(m).test(t));
    const statut = trouve(p.aucun)
      ? AUCUN
      : trouve(p.charge)
        ? A_CHARGE
        : apres(t, p.mot) ||
          (trouve(p.inclus) || (tout && ["chauffage", "electricite", "eau_chaude"].includes(p.cle)) ? INCLUS : INCONNU);
    const montant = statut === INCLUS || statut === AUCUN ? null : montantPres(t, p.mot);
    r[p.cle] = { statut: montant != null ? A_CHARGE : statut, montant };
  }
  return r;
}

/* Frais ponctuels mentionnés : leur nom et, si écrit, leur montant. Au Québec, seul le premier mois de loyer
   peut être exigé d'avance (Code civil, art. 1904) : les autres ne peuvent pas être exigés.
   Un « dépôt pour la clé » est compté comme frais de clé, pas comme dépôt de garantie. */
const PONCTUELS = [
  {
    nom: "Dépôt de garantie",
    mot: String.raw`depot(?!\s+(?:pour|de)\s+(?:la\s+)?cle)|(?<!key )deposit|caution`,
  },
  { nom: "Dernier mois payé d'avance", mot: String.raw`dernier mois|last month` },
  {
    nom: "Frais de dossier ou d'enquête de crédit",
    mot: String.raw`frais de dossier|frais d'enquete|enquete de credit|application fee|credit check fee|frais d'application`,
  },
  { nom: "Frais de clé", mot: String.raw`frais de cle|depot (?:pour|de) (?:la )?cle|key (?:fee|deposit)` },
  { nom: "Frais de réservation", mot: String.raw`frais de reservation|reservation fee|holding fee` },
];
export function lireFraisPonctuels(texte) {
  const t = norm(texte);
  const out = [];
  for (const f of PONCTUELS) {
    const re = new RegExp(f.mot);
    const m = t.match(re);
    if (!m) continue;
    // « aucun dépôt », « pas de dépôt », « no deposit » : ce n'est pas un frais
    const avant = t.slice(Math.max(0, m.index - 14), m.index);
    if (/\b(?:aucun|aucune|pas de|sans|no|zero|0)\s*$/.test(avant)) continue;
    const montant = montantPres(t, f.mot, 5000);
    out.push({ nom: f.nom, montant: montant && montant >= 20 ? montant : null });
  }
  return out;
}

/* Total : loyer + dépenses au montant connu. Les dépenses à ta charge sans montant et les non précisées
   sont listées à part : le total est alors un minimum (« au moins »). */
export function calculerCout(loyer, depenses) {
  let total = +loyer || 0;
  const inconnues = [];
  for (const p of POSTES) {
    const d = depenses[p.cle] || { statut: INCONNU };
    if (d.statut === A_CHARGE && d.montant > 0) total += d.montant;
    else if (d.statut === A_CHARGE || d.statut === INCONNU) inconnues.push(p.nom);
  }
  return { total, inconnues, minimum: inconnues.length > 0 };
}

/* Questions à poser à la visite, selon ce que l'annonce ne dit pas. */
export function questionsVisite(depenses, frais, F = {}) {
  const q = [];
  const st = (k) => (depenses[k] || {}).statut || INCONNU;
  const sansMontant = (k) => st(k) === A_CHARGE && !(depenses[k] || {}).montant;
  if (st("chauffage") === INCONNU)
    q.push("Le chauffage est-il inclus ? Sinon, est-il électrique, au gaz ou au mazout ?");
  if (st("chauffage") === A_CHARGE || st("electricite") !== INCLUS)
    q.push(
      "Combien coûtaient les factures d'électricité et de chauffage l'hiver dernier ? Demande à voir une facture ou l'historique de consommation du logement.",
    );
  if (st("eau_chaude") === INCONNU)
    q.push("Le chauffe-eau est-il à ta charge (électricité) ou à celle du propriétaire ?");
  if (st("internet") === INCONNU || sansMontant("internet"))
    q.push("L'internet est-il inclus ? Sinon, quels fournisseurs desservent l'adresse ?");
  if (st("stationnement") === INCONNU || sansMontant("stationnement"))
    q.push("Y a-t-il un stationnement ? Est-il inclus ou payant, et qui déneige l'hiver ?");
  q.push("Quels électroménagers sont fournis (cuisinière, réfrigérateur, laveuse, sécheuse) ?");
  q.push(
    "Quel est le loyer le plus bas payé dans les 12 derniers mois ? Le propriétaire doit l'inscrire à la section G du bail.",
  );
  if (F.cession === "oui") q.push("Quel loyer est inscrit au bail actuel, et à quelle date se termine-t-il ?");
  if (frais.length)
    q.push(
      `Pourquoi ${frais.length > 1 ? "ces frais" : "ce frais"} (${frais.map((f) => f.nom.toLowerCase()).join(", ")}) ? Seul le premier mois de loyer peut être exigé, à la signature du bail.`,
    );
  q.push("Le bail exige-t-il une assurance habitation (responsabilité civile) ?");
  q.push("Qui est le propriétaire, et qui signera le bail ?");
  return q;
}
