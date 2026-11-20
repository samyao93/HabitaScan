/* Message-filtre : messages, signaux de la réponse, verdict. */
import { SIGNAUX_IA } from "../ia/analyse.js";
import { esc } from "../utils/dom.js";
import { sansAcc } from "../utils/texte.js";

export const FILTRE_MSG = {
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
export const FILTRE_SIGNAUX = [
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

export const TEXTES_FILTRE = {
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

export const IA_ROUGES = [
  "argent_avant_bail",
  "depot",
  "paiement_suspect",
  "proprietaire_absent",
  "refus_visite",
  "refus_bail",
  "paiement_autre_personne",
];

/* Combine l'analyse locale et l'analyse IA de la conversation, puis recalcule le verdict. */
export function fusionFiltre(A, r) {
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

export function analyserReponse(t) {
  const x = sansAcc(t);
  const s = FILTRE_SIGNAUX.filter(([, re]) => re.test(x)).map(([c, , m]) => ({ c, m }));
  const r = s.filter((z) => z.c === "r").length,
    y = s.filter((z) => z.c === "y").length,
    g = s.filter((z) => z.c === "g").length;
  const c = r ? "r" : y ? "y" : g ? "g" : "i";
  const t2 = TEXTES_FILTRE[c];
  return { c, t: t2[0], s: t2[1], signaux: s };
}
