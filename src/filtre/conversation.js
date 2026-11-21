/* Message-filtre : suivi du risque sur toute la conversation avec l'annonceur.
   Chaque message de l'annonceur reçoit un niveau (vert, jaune, rouge) ; l'app repère ensuite ce qui change
   au fil des messages : la pression qui monte, le passage vers une autre messagerie, la demande de pièce d'identité.
   Les messages viennent de l'IA (captures de la discussion) ou du texte collé, découpé ici, sur le téléphone. */
import { IA_ROUGES, typesLocaux } from "./regles.js";
import { sansAcc } from "../utils/texte.js";

export const MAX_MESSAGES = 40;

/* Types rouges au fil de la conversation : ceux de l'analyse, plus la demande de papiers avant la visite. */
const ROUGES = [...IA_ROUGES, "pieces_identite_demandees"];
const VERTS = ["visite_proposee", "visite_acceptee", "bail_accepte"];
/* Demandes qui font de l'argent ou des papiers la suite d'un changement de messagerie. */
const DEMANDES = [
  "argent_avant_bail",
  "depot",
  "paiement_suspect",
  "paiement_autre_personne",
  "pieces_identite_demandees",
];

const NOMS_PLATEFORME = [
  [/whatsapp/, "WhatsApp"],
  [/telegram/, "Telegram"],
  [/signal/, "Signal"],
  [/texto|sms/, "texto"],
  [/courriel|e-?mail|gmail|hotmail|outlook/, "courriel"],
];

/* Ce qui marque un message du locataire dans un texte collé : « Moi : », « Vous : », « You: », « Vous avez envoyé ». */
const PREFIXE_LOCATAIRE = /^(moi|vous|toi|you|me|je)$/;
const DEBUT_FILTRE = /votre logement m'interesse|i'm very interested in your apartment/;

export const niveauDe = (types) =>
  types.some((t) => ROUGES.includes(t))
    ? "r"
    : types.some((t) => !VERTS.includes(t))
      ? "y"
      : types.some((t) => VERTS.includes(t))
        ? "g"
        : "i";

const POINTS = { r: 3, y: 1, g: 0, i: 0 };

/* Découpe un texte collé en messages, une ligne par message. Les lignes « Nom : texte » donnent l'auteur. */
export function decouperConversation(texte) {
  const lignes = String(texte || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  let suivantLocataire = false;
  for (const l of lignes) {
    const x = sansAcc(l);
    if (/^(vous avez envoye|you sent)\b/.test(x)) {
      suivantLocataire = true;
      const reste = l.replace(/^[^:]*:\s*/, "");
      if (reste !== l && reste) out.push({ auteur: "locataire", texte: reste });
      continue;
    }
    const m = l.match(/^([^\d:][^:]{0,29}?)\s*:\s+(.+)$/);
    let auteur = "annonceur",
      corps = l;
    if (m && !/https?$/i.test(m[1])) {
      corps = m[2];
      if (PREFIXE_LOCATAIRE.test(sansAcc(m[1]).trim())) auteur = "locataire";
    }
    if (suivantLocataire) {
      auteur = "locataire";
      suivantLocataire = false;
    }
    if (DEBUT_FILTRE.test(sansAcc(corps))) auteur = "locataire";
    out.push({ auteur, texte: corps });
    if (out.length >= MAX_MESSAGES) break;
  }
  return out;
}

/* Messages renvoyés par l'IA → même forme que le découpage local. */
export function messagesIA(liste) {
  return (Array.isArray(liste) ? liste : [])
    .filter((m) => m && typeof m.extrait === "string" && m.extrait.trim())
    .slice(0, MAX_MESSAGES)
    .map((m) => ({
      auteur: m.auteur === "locataire" ? "locataire" : "annonceur",
      texte: m.extrait,
      types: Array.isArray(m.types) ? m.types.filter((t) => typeof t === "string") : [],
    }));
}

const liste = (ns) =>
  ns.length > 1 ? `messages ${ns.slice(0, -1).join(", ")} et ${ns[ns.length - 1]}` : `message ${ns[0]}`;

/* Suit le risque message par message et décrit ce qui change. Renvoie null s'il y a moins de deux messages de l'annonceur. */
export function analyserFil(messages) {
  const etapes = [];
  let n = 0;
  for (const m of messages || []) {
    if (m.auteur !== "annonceur") continue;
    n++;
    const types = m.types ? [...new Set([...m.types, ...typesLocaux(m.texte)])] : typesLocaux(m.texte);
    const niveau = niveauDe(types);
    etapes.push({ n, texte: String(m.texte).slice(0, 200), types, niveau, points: POINTS[niveau] });
  }
  if (etapes.length < 2) return null;

  const tendances = [];
  const avec = (t) => etapes.filter((e) => e.types.includes(t));

  /* 1. La pression qui monte : il presse dans plusieurs messages, ou il commence calmement puis demande de l'argent. */
  const presse = avec("urgence");
  const premierRouge = etapes.find((e) => e.niveau === "r");
  const debutCalme = etapes[0].niveau !== "r" && etapes[0].niveau !== "y";
  if (presse.length >= 2)
    tendances.push({
      c: "y",
      cle: "pression",
      m: `<b>La pression monte.</b> Il te presse dans les ${liste(presse.map((e) => e.n))}. Un vrai propriétaire peut attendre que tu visites.`,
    });
  if (premierRouge && debutCalme && premierRouge.n > 1)
    tendances.push({
      c: "r",
      cle: "escalade",
      m: `<b>Le ton a changé au message ${premierRouge.n}.</b> La conversation a commencé normalement, puis il a demandé de l'argent ou des papiers. C'est la façon de faire habituelle des fraudeurs : gagner ta confiance d'abord.`,
    });

  /* 2. Le passage vers une autre messagerie, surtout s'il est suivi d'une demande d'argent ou de papiers. */
  const sortie = avec("changement_plateforme")[0];
  if (sortie) {
    const x = sansAcc(sortie.texte);
    const nom = (NOMS_PLATEFORME.find(([re]) => re.test(x)) || [null, "une autre messagerie"])[1];
    const apres = etapes.find((e) => e.n >= sortie.n && e.types.some((t) => DEMANDES.includes(t)));
    tendances.push(
      apres
        ? {
            c: "r",
            cle: "plateforme",
            m: `<b>Il a voulu passer sur ${nom} (message ${sortie.n}), puis il a demandé de l'argent ou des papiers (message ${apres.n}).</b> Sortir de la plateforme puis demander un paiement : c'est le schéma classique d'arnaque.`,
          }
        : {
            c: "y",
            cle: "plateforme",
            m: `<b>Il veut continuer sur ${nom} (message ${sortie.n}).</b> Garde la conversation sur la plateforme jusqu'à la visite : elle garde une trace et peut bloquer un fraudeur.`,
          },
    );
  }

  /* 3. La demande de pièce d'identité. */
  const papiers = avec("pieces_identite_demandees")[0];
  if (papiers) {
    const visite = etapes.find((e) => e.n < papiers.n && e.types.some((t) => VERTS.includes(t)));
    tendances.push({
      c: "r",
      cle: "identite",
      m: `<b>Il demande une pièce d'identité ou des documents personnels (message ${papiers.n}).</b> ${visite ? "Même s'il a parlé de visite, n" : "N"}'envoie ni passeport, ni NAS, ni relevé bancaire avant d'avoir visité et vu le bail : ces papiers servent au vol d'identité.`,
    });
  }

  const pire = etapes.reduce((a, e) => Math.max(a, e.points), 0);
  return { etapes, tendances, pire, nb: etapes.length };
}

/* Applique au verdict ce que montre le fil : une tendance rouge rend le verdict rouge, une jaune retire le vert. */
export function appliquerFil(A, fil, textes) {
  if (!fil) return A;
  const B = { ...A, fil };
  const c = fil.tendances.some((t) => t.c === "r")
    ? "r"
    : fil.tendances.some((t) => t.c === "y") && (A.c === "g" || A.c === "i")
      ? "y"
      : fil.etapes.some((e) => e.niveau === "r")
        ? "r"
        : A.c;
  if (c !== A.c) {
    B.c = c;
    B.t = textes[c][0];
    B.s = textes[c][1];
  }
  return B;
}
