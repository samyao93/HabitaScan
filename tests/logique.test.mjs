// Tests de la logique critique de l'app : verdict, mots repérés, budget, lecture des annonces, liens, empreintes.
// Lancement : node --test tests/   (ou, dans outils/ : npm test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerApp } from "./charger-app.mjs";

const hs = chargerApp();
const fn = (nom) => hs(nom);
/** Remplace la fiche de vérification en cours (F) par celle donnée, puis lance l'analyse. */
const verdict = (fiche) => {
  hs("nouveauF")(fiche);
  return fn("analyser")();
};

test("trouverMot : repère un mot, ignore les négations", () => {
  const trouverMot = fn("trouverMot"),
    MOTS = fn("MOTS_ARGENT");
  assert.equal(trouverMot("il faut un dépôt de 500 $", MOTS), "dépôt");
  assert.equal(trouverMot("aucun dépôt demandé", MOTS), null);
  assert.equal(trouverMot("pas de dépôt, premier mois à la signature", MOTS), null);
  assert.equal(trouverMot("no deposit required", MOTS), null);
  // Une négation plus haut dans le texte n'annule pas un mot plus loin
  assert.equal(trouverMot("aucun frais. Plus tard : envoie le dépôt par virement", MOTS), "dépôt");
});

test("verdict : rouge si on demande de l'argent avant le bail ou un paiement typique des fraudes", () => {
  assert.equal(verdict({ argent: "oui", visite: "oui" }).c, "r");
  assert.equal(verdict({ annonce: "Paiement par carte-cadeau seulement", visite: "oui" }).c, "r");
  assert.equal(verdict({ annonce: "payable en bitcoin", visite: "oui" }).c, "r");
});

test("verdict : un mot seul donne au plus du jaune, jamais du rouge", () => {
  const r = verdict({ annonce: "Un dépôt est demandé pour réserver", visite: "oui" });
  assert.equal(r.c, "y");
});

test("verdict : vert quand rien n'est suspect et que la personne a visité", () => {
  const r = verdict({
    annonce: "Beau 4 1/2 lumineux, premier mois à la signature du bail. Aucun dépôt.",
    visite: "oui",
  });
  assert.equal(r.c, "g");
});

test("verdict : pas de visite = prudence", () => {
  assert.equal(verdict({ annonce: "Beau 4 1/2", visite: "non" }).c, "y");
});

test("verdict : cession de bail avec argent demandé = rouge", () => {
  assert.equal(verdict({ cession: "oui", argent: "oui", visite: "oui" }).c, "r");
});

test("lirePrix : lit le loyer sous ses formes courantes et ignore les montants absurdes", () => {
  const lirePrix = fn("lirePrix");
  assert.equal(lirePrix("4 1/2 à 1 250 $ par mois"), 1250);
  assert.equal(lirePrix("Loyer : $1,450/mois"), 1450);
  assert.equal(lirePrix("1450$"), 1450);
  assert.equal(lirePrix("950 $"), 950);
  assert.equal(lirePrix("frais de 50 $"), null);
  assert.equal(lirePrix("aucun prix"), null);
});

test("lireChambres : convertit les tailles québécoises (4 1/2 = 2 chambres)", () => {
  const lireChambres = fn("lireChambres");
  assert.equal(lireChambres("Beau 4 1/2 à louer"), 2);
  assert.equal(lireChambres("3 1/2 rénové"), 1);
  assert.equal(lireChambres("grand 6 1/2"), 3);
  assert.equal(lireChambres("2 chambres fermées"), 2);
  assert.equal(lireChambres("2 bedrooms"), 2);
  assert.equal(lireChambres("studio meublé"), 0);
  assert.equal(lireChambres("2 1/2 à louer"), 0);
  assert.equal(lireChambres("logement à louer"), null);
});

test("calculerBudget : le reste sur la période utilise le salaire net s'il est donné, sinon le brut", () => {
  const calculerBudget = fn("calculerBudget");
  const brut = calculerBudget({ revenu: "4000", unite: "mois", loyer: "1200", mois: 3 });
  assert.equal(brut.baseNet, false);
  assert.equal(brut.base, 4000);
  assert.equal(brut.revPeriode, 12000);
  const net = calculerBudget({ revenu: "4000", unite: "mois", net: "3000", netUnite: "mois", loyer: "1200", mois: 3 });
  assert.equal(net.baseNet, true);
  assert.equal(net.base, 3000);
  assert.equal(net.revPeriode, 9000);
  assert.equal(net.restePeriode, 9000 - net.total);
});

test("calculerBudget : conversions annuelle et aux deux semaines, et loyer maximal à 30 %", () => {
  const calculerBudget = fn("calculerBudget");
  const r = calculerBudget({ revenu: "60000", unite: "an", net: "1500", netUnite: "2sem", elec: "50" });
  assert.equal(r.revMois, 5000);
  assert.equal(r.netMois, (1500 * 26) / 12);
  assert.equal(r.max, Math.floor(5000 * 0.3 - 50));
});

test("lienKijiji : applique la ville, les chambres et le prix maximal", () => {
  const lienKijiji = fn("lienKijiji");
  assert.equal(
    lienKijiji({ ville: "Montréal", ch: "2", max: "1500" }),
    "https://www.kijiji.ca/b-appartement-condo/ville-de-montreal/c37l1700281?numberbedrooms=2&price=__1500",
  );
  // « 3 et plus » = 3 ou 4 chambres
  assert.match(lienKijiji({ ville: "Québec", ch: "3" }), /c37l1700124\?numberbedrooms=3%2C4$/);
  assert.equal(lienKijiji({ ville: "Gatineau" }), "https://www.kijiji.ca/b-appartement-condo/gatineau/c37l1700186");
  assert.equal(lienKijiji({ ville: "Ville inconnue" }), null);
});

test("urlWeb et lienExt : seuls les liens http(s) deviennent cliquables", () => {
  const urlWeb = fn("urlWeb"),
    lienExt = fn("lienExt");
  assert.equal(urlWeb("https://www.kijiji.ca/v-annonce/123"), true);
  assert.equal(urlWeb("  HTTP://exemple.ca"), true);
  assert.equal(urlWeb("javascript:alert(1)"), false);
  assert.equal(urlWeb("data:text/html,<script>"), false);
  assert.equal(urlWeb(""), false);
  assert.equal(urlWeb(null), false);
  assert.equal(lienExt("javascript:alert(1)", "Annonce"), "Annonce");
  assert.match(lienExt("https://exemple.ca", "Annonce"), /^<a href="https:\/\/exemple\.ca"/);
});

test("esc : neutralise le HTML", () => {
  assert.equal(fn("esc")('<img src=x onerror="a">&'), "&lt;img src=x onerror=&quot;a&quot;&gt;&amp;");
});

test("memeEntreprise (rénovation) : compare des noms d'entreprise sans « inc. », « ltée », accents", () => {
  const memeEntreprise = fn("memeEntreprise");
  assert.equal(memeEntreprise("Rénovations Tremblay inc.", "RENOVATIONS TREMBLAY"), true);
  assert.equal(memeEntreprise("Construction Gagnon ltée", "Toitures Roy"), false);
  assert.equal(memeEntreprise("", "Toitures Roy"), false);
});

test("memeNom (propriétaire) : oui, partiel ou non", () => {
  const memeNom = fn("memeNom");
  assert.equal(memeNom("Jean Tremblay", "TREMBLAY JEAN"), "oui");
  assert.equal(memeNom("Jean Tremblay", "Marie Tremblay"), "partiel");
  assert.equal(memeNom("Jean Tremblay", "Paul Roy"), "non");
  assert.equal(memeNom("", "Paul Roy"), null);
});

test("dateLimite : 10 jours, reportés si l'échéance tombe un samedi ou un dimanche", () => {
  const jour = (d) =>
    d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateLimite = (iso) => jour(fn("dateLimite")(iso));
  assert.equal(dateLimite("2026-11-02"), "2026-11-12"); // lundi + 10 = jeudi
  assert.equal(dateLimite("2026-11-04"), "2026-11-16"); // + 10 = samedi 14 → lundi 16
  assert.equal(dateLimite("pas une date"), null);
});

test("extraireContacts : numéros et courriels de l'annonceur, sans doublons", () => {
  const { tels, courriels } = fn("extraireContacts")(
    "Appelle-moi au (514) 555-1234 ou au 514.555.1234, écris à Proprio@Exemple.ca",
  );
  // Tableaux venus du contexte de l'app : comparés par leur contenu
  assert.deepEqual([...tels], ["5145551234"]);
  assert.deepEqual([...courriels], ["proprio@exemple.ca"]);
});

test("empreinteTexte : une annonce recopiée garde presque la même empreinte, une autre annonce non", () => {
  const empreinteTexte = fn("empreinteTexte");
  const distance = (a, b) => {
    let d = 0;
    for (let i = 0; i < 16; i++)
      d += [...(parseInt(a[i], 16) ^ parseInt(b[i], 16)).toString(2)].filter((x) => x === "1").length;
    return d;
  };
  const annonce =
    "Magnifique quatre et demi entièrement rénové situé au coeur du Plateau Mont-Royal près du métro, cuisine moderne avec comptoirs de quartz, grande chambre fermée, balcon arrière, chauffage inclus, disponible dès le premier juillet, animaux acceptés.";
  const copie = annonce.replace("Magnifique", "Superbe").replace("animaux acceptés", "petits animaux acceptés");
  const autre =
    "Chambre à louer dans une maison de banlieue tranquille à Laval, accès à la cuisine et à la buanderie, stationnement inclus, idéal pour étudiant, non fumeur, internet compris, libre immédiatement pour une durée minimale de six mois.";
  const a = empreinteTexte(annonce),
    b = empreinteTexte(copie),
    c = empreinteTexte(autre);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.equal(empreinteTexte(annonce), a, "même texte, même empreinte");
  assert.ok(distance(a, b) <= 8, `copie trop éloignée : ${distance(a, b)} bits`);
  assert.ok(distance(a, c) > 8, `annonces différentes trop proches : ${distance(a, c)} bits`);
  assert.equal(empreinteTexte("trop court pour une empreinte"), null);
});

test("analyserReponse (message-filtre) : refus de visite ou dépôt exigé = rouge, accord = vert", () => {
  const analyserReponse = fn("analyserReponse");
  assert.equal(analyserReponse("Oui, aucun problème, on signe le bail à la visite jeudi.").c, "g");
  assert.notEqual(
    analyserReponse("Je suis à l'étranger, envoie le dépôt par Western Union et je t'envoie les clés.").c,
    "g",
  );
});

test("analyserReponse (message-filtre) : « aucun dépôt » est un bon signe, pas un signal", () => {
  const analyserReponse = fn("analyserReponse");
  assert.equal(analyserReponse("Oui, visite samedi. Pas de dépôt, premier mois à la signature du bail.").c, "g");
  assert.equal(analyserReponse("Sure, visit tomorrow, no deposit needed.").c, "g");
  assert.equal(analyserReponse("Il faut un dépôt de 300 $ pour réserver.").c, "r");
});

test("decouperConversation : un message par ligne, « Moi : » pour le locataire", () => {
  const msgs = fn("decouperConversation")(
    [
      "Moi : Bonjour, votre logement m'intéresse beaucoup.",
      "Marc : Oui, il est disponible.",
      "Vous : Je peux visiter samedi ?",
      "Marc : Je suis à l'étranger.",
      "Rendez-vous à 14:30",
    ].join("\n"),
  );
  assert.equal(
    msgs.map((m) => m.auteur).join(","),
    ["locataire", "annonceur", "locataire", "annonceur", "annonceur"].join(","),
  );
  assert.equal(msgs[1].texte, "Oui, il est disponible.");
  assert.equal(msgs[4].texte, "Rendez-vous à 14:30", "une heure n'est pas un nom d'auteur");
});

test("analyserFil : la pression qui monte, l'autre messagerie puis l'argent, la pièce d'identité", () => {
  const analyserFil = fn("analyserFil"),
    decouper = fn("decouperConversation");
  const fil = analyserFil(
    decouper(
      [
        "Marc : Bonjour, oui il est toujours disponible.",
        "Moi : Je peux visiter cette semaine ?",
        "Marc : Il y a beaucoup de gens intéressés, il faut faire vite.",
        "Marc : Écris-moi plutôt sur WhatsApp au 514 555 0101.",
        "Marc : C'est urgent, envoie le dépôt par Interac pour réserver.",
        "Marc : Envoie aussi une photo de ton passeport.",
      ].join("\n"),
    ),
  );
  assert.equal(fil.nb, 5, "les messages du locataire ne comptent pas");
  assert.equal(fil.etapes.map((e) => e.niveau).join(","), ["i", "y", "y", "r", "r"].join(","));
  const cles = fil.tendances.map((t) => t.cle);
  assert.ok(cles.includes("pression"));
  assert.ok(cles.includes("escalade"));
  assert.ok(cles.includes("identite"));
  const p = fil.tendances.find((t) => t.cle === "plateforme");
  assert.equal(p.c, "r", "autre messagerie suivie d'une demande d'argent = rouge");
  assert.match(p.m, /WhatsApp \(message 3\).*message 4/);
});

test("analyserFil : une conversation saine ne donne aucune tendance, et un seul message ne donne pas de fil", () => {
  const analyserFil = fn("analyserFil");
  const fil = analyserFil([
    { auteur: "annonceur", texte: "Bonjour, oui c'est libre." },
    { auteur: "locataire", texte: "Super, est-ce qu'il faut un dépôt ?" },
    { auteur: "annonceur", texte: "Non, aucun dépôt. Visite samedi à 10 h, on signe le bail sur place." },
  ]);
  assert.equal(fil.nb, 2);
  assert.equal(fil.tendances.length, 0);
  assert.equal(fil.etapes[1].niveau, "g");
  assert.equal(analyserFil([{ auteur: "annonceur", texte: "Oui, visite samedi." }]), null);
});

test("analyserFil : les messages lus par l'IA gardent leurs types, et l'autre messagerie seule reste jaune", () => {
  const fil = fn("analyserFil")(
    fn("messagesIA")([
      { auteur: "annonceur", extrait: "Bonjour !", types: [] },
      { auteur: "annonceur", extrait: "Add me on Telegram", types: ["changement_plateforme"] },
    ]),
  );
  assert.equal(fil.tendances.length, 1);
  assert.equal(fil.tendances[0].c, "y");
  assert.match(fil.tendances[0].m, /Telegram \(message 2\)/);
  const A = fn("appliquerFil")({ c: "g", t: "", s: "", signaux: [] }, fil, fn("TEXTES_FILTRE"));
  assert.equal(A.c, "y", "une tendance jaune retire le vert");
});

test("rtaDe : garde seulement les 3 premiers caractères d'un code postal du Québec", () => {
  const rtaDe = fn("rtaDe");
  assert.equal(rtaDe("h2x 1y4"), "H2X");
  assert.equal(rtaDe(" G1R2J6 "), "G1R");
  assert.equal(rtaDe("J4K"), "J4K");
  assert.equal(rtaDe("K1A 0B1"), ""); // Ontario : hors carte
  assert.equal(rtaDe("123 rue Principale"), "");
  assert.equal(rtaDe(""), "");
  assert.equal(rtaDe(null), "");
});

test("faits sourcés : chaque fait a un texte et une source, et le verdict les attache aux bons signaux", () => {
  for (const [k, f] of Object.entries(fn("FAITS"))) {
    assert.ok(f.t && f.t.length > 40, `fait ${k} sans texte`);
    assert.match(f.src, /<a href="https:\/\//, `fait ${k} sans lien vers sa source`);
  }
  const R = verdict({ argent: "oui", visite: "non", annonce: "Je suis à l'étranger, écris-moi sur WhatsApp" });
  assert.ok(R.items.some((i) => i.fait === fn("FAITS").depot));
  assert.ok(R.items.some((i) => i.fait === fn("FAITS").visite));
  assert.equal(fn("faitScenario")("whatsapp"), fn("FAITS").messagerie);
  assert.equal(fn("faitScenario")("à l'étranger"), fn("FAITS").etranger);
  assert.equal(fn("faitScenario")("beaucoup de demandes"), null);
});

test("carte du verdict : titre court, compte des signaux, aucune adresse ni coordonnée", () => {
  const titreSignal = fn("titreSignal"),
    contenuCarte = fn("contenuCarte");
  assert.equal(titreSignal("<b>Tu n'as pas visité.</b> Ne paie rien."), "Tu n'as pas visité");
  assert.equal(titreSignal("Profil d'apparence normale. Attention : piraté."), "Profil d'apparence normale");
  const R = verdict({ argent: "oui", visite: "non", annonce: "western union" });
  const F = { res: R, ville: "Montréal", ch: "2", prixN: 900, adr: "1234 rue Secrète", contact: "514 555-0123" };
  const k = contenuCarte(F);
  assert.equal(k.c, "r");
  assert.match(k.titre, /^Ne paie pas : \d+ signaux$/);
  const tout = JSON.stringify(k);
  assert.ok(
    !tout.includes("Secrète") && !tout.includes("555-0123"),
    "la carte ne doit jamais montrer l'adresse ni le contact",
  );
  assert.equal(contenuCarte({ res: { c: "g", items: [] } }).titre, "Aucun signal d'arnaque");
});

test("partage natif reçu : texte et lien remplissent la vérification", () => {
  const recevoir = fn("recevoirPartage"),
    etat = fn("etat");
  assert.equal(recevoir({}), false);
  assert.equal(recevoir({ texte: "4 1/2 à louer https://www.kijiji.ca/v-appartement/123?utm=x" }), true);
  assert.equal(etat.fiche.partage, true);
  assert.equal(etat.fiche.lien, "https://kijiji.ca/v-appartement/123");
});

test("traduction anglaise : format du fichier et paires lues", async () => {
  const { lireTraductions } = await import("../outils/construire.mjs");
  const t = lireTraductions('# note\n== src/a.js\nBonjour\nHello\n\n« Oui »\n"Yes"\n');
  assert.deepEqual(t, {
    "src/a.js": [
      ["Bonjour", "Hello"],
      ["« Oui »", '"Yes"'],
    ],
  });
  assert.throws(() => lireTraductions("== src/a.js\nseule\n"), /incomplète/);
  const { readFileSync } = await import("node:fs");
  const table = lireTraductions(readFileSync(new URL("../traductions/en.txt", import.meta.url), "utf8"));
  assert.ok(Object.keys(table).length >= 30, "traductions/en.txt couvre les modules de l'app");
});

test("alertes de signalement : phrase, carte d'accueil, détail et désactivation", () => {
  const etat = hs("etat"),
    texteQuoi = fn("texteQuoi"),
    phrase = fn("phraseAlerte"),
    bloc = fn("blocAlertes"),
    detail = fn("blocAlerteDetail");
  assert.equal(texteQuoi(["photo"]), "les mêmes photos");
  assert.equal(texteQuoi(["photo", "tel", "texte"]), "les mêmes photos, le même numéro de téléphone et le même texte");
  assert.match(phrase({ nb: 1, quoi: ["lien"] }), /une personne .* a signalé cette annonce/);
  assert.match(phrase({ nb: 3, quoi: ["tel"] }), /3 personnes .* ont signalé .* le même numéro de téléphone/);
  const avant = { profil: etat.profil, alertes: etat.alertes, historique: etat.historique };
  try {
    etat.profil = { alertes_signalement: true };
    etat.historique = [{ id: "v1", ville: "Montréal", prix: 1200, created_at: "2026-11-20T12:00:00Z" }];
    etat.alertes = [
      {
        verif: "v1",
        nb: 2,
        quoi: ["lien"],
        motifs: ["argent_avant_bail"],
        dernier: "2026-11-23T12:00:00Z",
        nouvelle: true,
      },
    ];
    assert.match(bloc(), /Une annonce que tu as vérifiée a été signalée/);
    assert.match(bloc(), /data-verif="v1"/);
    assert.match(detail("v1"), /On m'a demandé de l'argent avant le bail/);
    assert.equal(detail("v2"), "");
    // Déjà vue (« Compris ») : plus sur l'accueil, toujours dans le détail
    etat.alertes[0].nouvelle = false;
    assert.equal(bloc(), "");
    assert.notEqual(detail("v1"), "");
    // Désactivée dans Mon compte : rien nulle part
    etat.alertes[0].nouvelle = true;
    etat.profil.alertes_signalement = false;
    assert.equal(bloc(), "");
    assert.equal(detail("v1"), "");
  } finally {
    Object.assign(etat, avant);
  }
});
