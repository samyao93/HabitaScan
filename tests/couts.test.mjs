// Coût mensuel réel, frais ponctuels, questions de visite, comparaison du prix et import Statistique Canada.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerApp } from "./charger-app.mjs";
import { chambresDe, lireCsv, loyersDe, periodeFr } from "../outils/importer-loyers-annonces.mjs";

const hs = chargerApp();
// Les objets créés dans l'app simulée viennent d'un autre contexte : on les compare comme du JSON.
const plain = (x) => JSON.parse(JSON.stringify(x));
const lire = (t) => plain(hs("lireDepenses")(t));
const st = (t) => Object.fromEntries(Object.entries(lire(t)).map(([k, v]) => [k, v.statut]));

test("lireDepenses : chauffé, éclairé, tout inclus, non chauffé", () => {
  assert.equal(st("Beau 4 1/2 chauffé éclairé").chauffage, "inclus");
  assert.equal(st("Beau 4 1/2 chauffé éclairé").electricite, "inclus");
  assert.equal(st("Tout inclus, près du métro").eau_chaude, "inclus");
  assert.equal(st("Non chauffé, non éclairé").chauffage, "a_charge");
  assert.equal(st("Non chauffé, non éclairé").electricite, "a_charge");
  assert.equal(st("Heating included, hydro not included").chauffage, "inclus");
  assert.equal(st("Heating included, hydro not included").electricite, "a_charge");
  // « chauffe-eau » ne veut pas dire « chauffé »
  assert.equal(st("Chauffe-eau neuf").chauffage, "inconnu");
});

test("lireDepenses : rien de dit = non précisé, jamais inclus ni 0 $", () => {
  const d = lire("Beau 5 1/2 lumineux, 1 400 $ par mois");
  for (const v of Object.values(d)) {
    assert.equal(v.statut, "inconnu");
    assert.equal(v.montant, null);
  }
});

test("lireDepenses : montants écrits, stationnement absent", () => {
  const d = lire("Stationnement 75 $/mois. Internet inclus.");
  assert.deepEqual(d.stationnement, { statut: "a_charge", montant: 75 });
  assert.equal(d.internet.statut, "inclus");
  assert.equal(st("Pas de stationnement, parking dans la rue").stationnement, "aucun");
  assert.equal(lire("Parking $50/month").stationnement.montant, 50);
});

test("calculerCout : un montant inconnu n'est jamais compté 0 $, le total devient un minimum", () => {
  const calc = (...a) => plain(hs("calculerCout")(...a));
  const d = lire("Chauffé éclairé. Stationnement 75 $/mois. Internet inclus.");
  const c = calc(1200, d);
  assert.equal(c.total, 1275);
  assert.equal(c.minimum, false);
  assert.deepEqual(c.inconnues, []);
  const c2 = calc(1200, lire("Non chauffé. Stationnement inclus."));
  assert.equal(c2.total, 1200);
  assert.equal(c2.minimum, true);
  assert.ok(c2.inconnues.includes("Chauffage"), "à ta charge sans montant = non compté, listé");
  assert.ok(c2.inconnues.includes("Internet"), "non précisé = listé");
  assert.ok(!c2.inconnues.includes("Stationnement"));
});

test("lireFraisPonctuels : dépôt, frais de dossier, clé ; « aucun dépôt » ignoré", () => {
  const f = (t) => plain(hs("lireFraisPonctuels")(t));
  assert.deepEqual(
    f("Dépôt de 500 $ demandé et frais de dossier 50 $").map((x) => [x.nom, x.montant]),
    [
      ["Dépôt de garantie", 500],
      ["Frais de dossier ou d'enquête de crédit", 50],
    ],
  );
  assert.deepEqual(f("Aucun dépôt, premier mois à la signature."), []);
  assert.deepEqual(
    f("Dépôt pour la clé : 100 $").map((x) => x.nom),
    ["Frais de clé"],
  );
});

test("questionsVisite : adaptées à ce qui manque, toujours la section G du bail", () => {
  const q = (...a) => plain(hs("questionsVisite")(...a));
  const tout = q(lire("Chauffé éclairé, internet inclus, stationnement inclus"), [], {});
  const rien = q(lire("Beau 4 1/2"), [], {});
  assert.ok(!tout.some((x) => /chauffage est-il inclus/.test(x)));
  assert.ok(rien.some((x) => /chauffage est-il inclus/.test(x)));
  assert.ok(rien.some((x) => /stationnement/.test(x)));
  assert.ok(tout.some((x) => /section G/.test(x)) && rien.some((x) => /section G/.test(x)));
  assert.ok(q(lire(""), [{ nom: "Dépôt de garantie" }], {}).some((x) => /dépôt de garantie/.test(x)));
});

test("comparaison du prix : écart, références absentes dites absentes, source et période toujours là", () => {
  const ecart = hs("ecart"),
    refs = hs("referencesPrix");
  assert.equal(ecart(1100, 1000).t, "10 % au-dessus");
  assert.equal(ecart(900, 1000).t, "10 % sous");
  assert.equal(ecart(1010, 1000).t, "au même niveau");
  assert.equal(ecart(1000, null), null);
  const annonces = {
    source: "Statistique Canada",
    url: "https://www150.statcan.gc.ca/",
    ref: "2026-04",
    periode: "2e trimestre 2026",
    description: "Loyer demandé dans les annonces (moyenne), appartements",
    villes: { Montréal: [null, { loyer: 1480, periode: "2e trimestre 2026" }, null, null] },
  };
  const F = { ville: "Montréal", ch: "1", prixN: 1500, medianeHS: { n: 4, mediane: null, jours: 90, minimum: 10 } };
  const r = refs(
    F,
    { Montréal: [0, 1131, 1346, 1625] },
    { Montréal: { periode: "octobre 2025", source: "SCHL" } },
    annonces,
  );
  assert.equal(r[0].valeur, 1131);
  assert.equal(r[0].periode, "octobre 2025");
  assert.equal(r[1].cle, "schl_mediane");
  assert.equal(r[1].valeur, 1056, "loyer médian SCHL, Montréal, 1 chambre, octobre 2025");
  assert.equal(r[1].periode, "octobre 2025");
  assert.equal(r[2].valeur, 1480);
  assert.match(r[2].type, /appartements, 1 chambre/);
  assert.equal(r[3].valeur, null);
  assert.match(r[3].absent, /4 sur 10/);
  for (const x of r) assert.ok(x.source && x.periode && x.type);
  const r2 = refs({ ...F, ch: "2" }, {}, {}, annonces);
  assert.match(r2[2].absent, /ne publie pas/);
  assert.equal(r2[1].valeur, 1250, "la médiane SCHL ne dépend pas de la table des moyennes");
  assert.match(refs({ ...F, ville: "Gatineau", ch: "3" }, {}, {}, annonces)[1].note, /prudence/);
  assert.match(r2[0].absent, /Pas de loyer SCHL/);
});

test("import Statistique Canada : loyer demandé des appartements, chambres, dernière période", () => {
  assert.equal(chambresDe("Apartment - 3 or more bedrooms"), 3);
  assert.equal(chambresDe("Apartment - No bedroom"), 0);
  assert.equal(chambresDe("Room"), null);
  assert.equal(periodeFr("2026-04"), "2e trimestre 2026");
  assert.equal(periodeFr("2026Q1"), "1er trimestre 2026");
  const csv = [
    '"REF_DATE","GEO","DGUID","Rental unit type","Estimates","UOM","UOM_ID","SCALAR_FACTOR","SCALAR_ID","VECTOR","COORDINATE","VALUE","STATUS"',
    '"2026-01","Montréal, Census metropolitan area (CMA)","x","Apartment - 1 bedroom","Average asking rent","Dollars","81","units","0","v","1","1470",""',
    '"2026-04","Montréal, Census metropolitan area (CMA)","x","Apartment - 1 bedroom","Average asking rent","Dollars","81","units","0","v","1","1480",""',
    '"2026-04","Montréal, Census metropolitan area (CMA)","x","Apartment - No bedroom","Average asking rent","Dollars","81","units","0","v","1","1250",""',
    '"2026-04","Montréal, Census metropolitan area (CMA)","x","Apartment - 1 bedroom","Average paid rent","Dollars","81","units","0","v","1","1200",""',
    '"2026-04","Montréal, Census metropolitan area (CMA)","x","House - 3 or more bedrooms","Average asking rent","Dollars","81","units","0","v","1","2900",""',
    '"2026-04","Montréal, Census metropolitan area (CMA)","x","Apartment - 3 or more bedrooms","Average asking rent","Dollars","81","units","0","v","1","2300",""',
    '"2026-04","Ottawa - Gatineau (Quebec part), Census metropolitan area (CMA)","x","Apartment - 2 bedrooms","Average asking rent","Dollars","81","units","0","v","1","1700",""',
    '"2026-04","Ottawa - Gatineau (Ontario part), Census metropolitan area (CMA)","x","Apartment - 2 bedrooms","Average asking rent","Dollars","81","units","0","v","1","2100",""',
    '"2024-04","Sherbrooke, Census metropolitan area (CMA)","x","Apartment - 2 bedrooms","Average asking rent","Dollars","81","units","0","v","1","1100",""',
  ].join("\n");
  const r = loyersDe(lireCsv(csv));
  assert.equal(r.periode, "2e trimestre 2026");
  assert.match(r.description, /demandé.*moyenne.*appartements/);
  assert.deepEqual(r.villes["Montréal"], [
    { loyer: 1250, periode: "2e trimestre 2026" },
    { loyer: 1480, periode: "2e trimestre 2026" },
    null,
    { loyer: 2300, periode: "2e trimestre 2026" },
  ]);
  assert.equal(r.villes.Gatineau[2].loyer, 1700, "partie québécoise seulement");
  assert.equal(r.villes.Sherbrooke, undefined, "valeur de plus d'un an : écartée");
});

test("loyers-annonces.json : importé, avec source, période et type de logement", async () => {
  const { readFileSync } = await import("node:fs");
  const d = JSON.parse(readFileSync(new URL("../src/prix/loyers-annonces.json", import.meta.url), "utf8"));
  assert.ok(d.source && d.url && d.periode && d.description);
  assert.ok(d.villes["Montréal"].some((x) => x && x.loyer > 500 && x.periode));
});

test("loyer de référence SCHL : la médiane quand elle existe, sinon la moyenne", () => {
  const ref = (...a) => plain(hs("loyerSchl")(...a));
  assert.deepEqual(ref("Montréal", 2, { Montréal: [0, 1131, 1346, 1625] }), {
    loyer: 1250,
    stat: "médian",
    periode: "octobre 2025",
  });
  assert.equal(ref("Montréal", "3", {}).loyer, 1545);
  assert.equal(ref("Ville inconnue", 1, { "Ville inconnue": [0, 900, 0, 0] }).stat, "moyen");
  assert.equal(ref("Ville inconnue", 2, { "Ville inconnue": [0, 900, 0, 0] }), null);
});

test("médiane SCHL saisie dans l'Espace admin : prioritaire sur celle du fichier", () => {
  const etat = hs("etat");
  etat.medianes = { Montréal: [null, null, { loyer: 1300, periode: "octobre 2026" }, null] };
  try {
    const r = plain(hs("loyerSchl")("Montréal", 2, {}));
    assert.deepEqual(r, { loyer: 1300, stat: "médian", periode: "octobre 2026" });
    assert.equal(plain(hs("medianeSchl")("Montréal", 2)).qualite, null, "cote SCHL inconnue pour une valeur saisie");
    assert.equal(plain(hs("loyerSchl")("Montréal", 1, {})).loyer, 1056, "case vide : valeur du fichier");
  } finally {
    etat.medianes = {};
  }
});

test("repère LMM 2026 (SHQ, avec services) : comparé au coût réel, jamais « sous » quand des dépenses manquent", () => {
  const r = (...a) => plain(hs("repereLmm")(...a));
  assert.equal(r("Montréal", "2", 1420, false).lmm, 1420);
  assert.match(r("Montréal", "2", 1420, false).texte, /même niveau/);
  assert.match(r("Montréal", "2", 1600, false).texte, /13 % au-dessus/);
  assert.match(r("Montréal", "2", 1600, true).texte, /déjà au moins 13 %/);
  assert.match(r("Montréal", "2", 1200, false).texte, /15 % sous/);
  assert.match(r("Montréal", "2", 1200, true).texte, /pas encore connues/);
  assert.equal(r("Rivière-du-Loup", "1", 900, false).region, "AR de Matane et de Rivière-du-Loup");
  assert.equal(r("Autre", "1", 900, false), null);
});

test("studio : médiane SCHL, repère LMM, libellés et comparaison", () => {
  assert.equal(plain(hs("loyerSchl")("Montréal", "0", {})).loyer, 950, "médiane SCHL studio, Montréal, octobre 2025");
  assert.equal(plain(hs("medianeSchl")("Gatineau", "0")).qualite, "d");
  assert.equal(plain(hs("repereLmm")("Québec", "0", 900, false)).lmm, 900, "LMM 2026 studio, RMR de Québec");
  assert.equal(hs("indiceCh")("0"), 0);
  assert.equal(hs("indiceCh")(""), 1);
  assert.equal(hs("indiceCh")("5"), 3);
  assert.equal(hs("courtCh")("0"), "Studio");
  assert.equal(hs("courtCh")(undefined), "? ch.");
  assert.equal(hs("libelleCh")(0), "studio");
  const r = plain(hs("referencesPrix")({ ville: "Montréal", ch: "0", prixN: 1000 }, {}, {}));
  assert.equal(r[1].valeur, 950);
  assert.match(r[1].type, /studio/);
  assert.match(r[0].absent, /studios/);
});
