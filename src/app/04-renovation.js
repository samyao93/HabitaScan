/* ===== Module Vérif-Réno : règles communes (démo et version Supabase) =====
   Sources : RBQ, liste des sous-catégories de licence ; OPC, guide du commerce itinérant
   (LPC art. 55, 59, 60, 60.1, 321 ; Règlement d'application, art. 7). */
const LIENS = {
  rbq: "https://www.rbq.gouv.qc.ca/vous-etes/citoyen/verifier-la-licence-dun-entrepreneur",
  souscat: "https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Publications/francais/AnnexeListeSousCategories.pdf",
  general: "https://www.rbq.gouv.qc.ca/licence/determiner-vos-sous-categories-de-licence/entrepreneur-general/",
  opc: "https://www.opc.gouv.qc.ca/se-renseigner/",
  itinerant: "https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document8.pdf",
  lpc601: "https://cdn.opc.gouv.qc.ca/media/documents/a-propos/AccesInformation/2025/344002584_Document6.pdf",
  art46: "https://www.rbq.gouv.qc.ca/fileadmin/medias/pdf/Decisions/decision_5800-8673_9369-5013-Quebec-inc.pdf",
};
const lien = (href, txt) => `<a href="${href}" target="_blank" rel="noopener">${txt}</a>`;
/* art7 : contrat signé à domicile = commerce itinérant, même si le client a invité l'entrepreneur (Règlement, art. 7). */
const TRAVAUX = {
  toiture: { l: "Toiture, isolation, revêtement extérieur", sc: ["7"], nomSc: "7", art7: true },
  portes: { l: "Portes et fenêtres", sc: ["8"], nomSc: "8", art7: true },
  plomberie: { l: "Plomberie", sc: ["15.5"], nomSc: "15.5", corp: "CMMTQ" },
  chauffage: { l: "Chauffage", sc: ["15.1", "15.2", "15.3", "15.4"], nomSc: "15.1 à 15.4", corp: "CMMTQ" },
  electricite: { l: "Électricité", sc: [], nomSc: "licence de la CMEQ", corp: "CMEQ" },
  general: { l: "Rénovation générale (cuisine, salle de bain…)", sc: ["1.2", "1.3"], nomSc: "1.2 ou 1.3" },
};
const GENERAL = ["1.2", "1.3"];
const chiffres = (t) => String(t || "").replace(/\D/g, "");
const formatLicence = (d) => (d.length === 10 ? d.replace(/(\d{4})(\d{4})(\d{2})/, "$1-$2-$3") : d);
const sansAccent = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(inc|ltee|ltd|enr|senc|la|le|les|de|du|des)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/* Nom d'entreprise sur la soumission ≈ nom inscrit à la RBQ (l'un contient l'autre, sans « inc. », « ltée »…).
   Ne pas confondre avec memeNom (module propriétaire), qui compare des noms de personnes. */
function memeEntreprise(a, b) {
  const x = sansAccent(a),
    y = sansAccent(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}
/* Délai de 10 jours (LPC art. 59) : le jour de départ ne compte pas ; une échéance un samedi, un dimanche,
   le 26 décembre ou le 2 janvier est reportée (LPC art. 269). Les autres jours fériés ne sont pas calculés. */
function dateLimite(iso) {
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d)) return null;
  d.setDate(d.getDate() + 10);
  const ferie = (x) =>
    x.getDay() === 6 ||
    x.getDay() === 0 ||
    (x.getMonth() === 11 && x.getDate() === 26) ||
    (x.getMonth() === 0 && x.getDate() === 2);
  while (ferie(d)) d.setDate(d.getDate() + 1);
  return d;
}
const jourLong = (d) =>
  d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const aujourdhui = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/* R = fiche de la liste des licences actives de la RBQ ({numero,nom,autres_noms,sous_categories,mandataire})
   ou null si introuvable ; R === undefined quand la liste n'est pas disponible (démo, ou pas encore importée). */
function analyserReno(F, R) {
  const it = [],
    T = TRAVAUX[F.travaux],
    lic = chiffres(F.licence);
  const L46 = "Loi sur le bâtiment, art. 46 · " + lien(LIENS.art46, "RBQ"),
    LSC = "Liste des sous-catégories · " + lien(LIENS.souscat, "RBQ");
  if (!lic)
    it.push({
      c: "y",
      t: "<b>Aucun numéro de licence RBQ.</b> Demande-le : la loi exige une licence pour faire des travaux, et sans licence il n'y a pas de cautionnement pour t'indemniser.",
      law: L46,
    });
  else if (R === undefined)
    it.push({
      c: "i",
      t: `<b>Licence ${esc(formatLicence(lic))} :</b> vérifie-la dans le registre officiel (bouton plus bas). Dans la version complète, l'app la compare seule à la liste des licences actives, mise à jour chaque jour.`,
      law: L46,
    });
  else if (R === null)
    it.push({
      c: "r",
      t: `<b>Licence ${esc(formatLicence(lic))} introuvable</b> dans la liste des licences actives de la RBQ. Vérifie le numéro ; s'il est exact, l'entreprise n'a pas de licence en vigueur.`,
      law: L46,
    });
  else {
    it.push({
      c: "g",
      t: `<b>Licence active</b> : ${esc(String(R.nom || formatLicence(lic)).replace(/\.$/, ""))}.`,
      law: "Liste des licences actives, RBQ (données ouvertes)",
    });
    if (F.nom && F.nom.trim() && !memeEntreprise(F.nom, R.nom) && !memeEntreprise(F.nom, R.autres_noms))
      it.push({
        c: "y",
        t: `<b>Le nom sur la soumission (« ${esc(F.nom)} ») ne correspond pas</b> au nom de la licence (« ${esc(R.nom)} »). Utiliser la licence d'une autre entreprise est interdit : demande une explication.`,
        law: L46,
      });
    const sc = String(R.sous_categories || ""),
      aSc = (x) => new RegExp("(^|[^0-9.])" + x.replace(".", "\\.") + "(?![0-9])").test(sc);
    if (
      T.corp &&
      !String(R.mandataire || "")
        .toUpperCase()
        .includes(T.corp) &&
      !T.sc.some(aSc)
    ) {
      if (GENERAL.some(aSc))
        it.push({
          c: "i",
          t: `Entrepreneur général : il peut confier ces travaux (${T.l.toLowerCase()}) à un sous-traitant, qui doit lui aussi avoir sa licence (${T.nomSc}).`,
          law: lien(LIENS.general, "RBQ, entrepreneur général"),
        });
      else
        it.push({
          c: "y",
          t: `<b>Cette licence ne semble pas couvrir : ${T.l.toLowerCase()}.</b> Attendu : ${T.nomSc}.`,
          law: LSC,
        });
    } else if (!T.corp && !T.sc.some(aSc)) {
      if (GENERAL.some(aSc))
        it.push({
          c: "i",
          t: `Entrepreneur général : il peut confier ces travaux à un sous-traitant, qui doit lui aussi avoir sa licence (sous-catégorie ${T.nomSc}).`,
          law: lien(LIENS.general, "RBQ, entrepreneur général"),
        });
      else
        it.push({
          c: "y",
          t: `<b>Cette licence ne couvre pas : ${T.l.toLowerCase()}.</b> Sous-catégorie attendue : ${T.nomSc}.`,
          law: LSC,
        });
    } else it.push({ c: "g", t: `La licence couvre ce type de travaux (${T.nomSc}).`, law: LSC });
  }

  const LIT = "Loi sur la protection du consommateur · " + lien(LIENS.itinerant, "OPC, commerce itinérant");
  F.limite = null;
  if (F.domicile === "oui" && T.art7) {
    const lim = dateLimite(F.recu || aujourdhui());
    F.limite = lim;
    it.push({
      c: "i",
      t: `<b>Contrat itinérant</b> : signé chez toi pour ce type de travaux, c'est un contrat itinérant même si tu as invité l'entrepreneur. Tu peux l'annuler sans frais ni raison jusqu'au <b>${lim ? jourLong(lim) : "10e jour"}</b>.`,
      law: "Règlement d'application de la LPC, art. 7 ; LPC, art. 59 · " + lien(LIENS.itinerant, "OPC"),
    });
    if (F.acompte === "oui")
      it.push({
        c: "r",
        t: "<b>Paiement demandé pendant le délai d'annulation.</b> Un commerçant itinérant ne peut recevoir aucun paiement avant la fin des 10 jours.",
        law: "LPC, art. 60 · " + lien(LIENS.itinerant, "OPC"),
      });
    it.push({
      c: "i",
      t: "Les travaux ne peuvent pas commencer avant la fin du délai, et l'entrepreneur doit détenir un permis de commerçant itinérant de l'OPC (bouton plus bas).",
      law: "LPC, art. 55 et 60.1 · " + lien(LIENS.lpc601, "OPC"),
    });
  } else if (F.domicile === "oui") {
    it.push({
      c: "i",
      t: "<b>Signé chez toi :</b> si c'est l'entrepreneur qui t'a sollicité (porte-à-porte, appel), les règles du commerce itinérant s'appliquent : 10 jours pour annuler sans frais, aucun paiement ni début des travaux avant la fin de ce délai.",
      law: LIT,
    });
    if (F.acompte === "oui")
      it.push({
        c: "y",
        t: "<b>Paiement demandé tout de suite.</b> Si l'entrepreneur t'a sollicité chez toi, il ne peut rien recevoir avant la fin des 10 jours.",
        law: "LPC, art. 60 · " + lien(LIENS.itinerant, "OPC"),
      });
  } else if (F.acompte === "oui")
    it.push({
      c: "i",
      t: "<b>Acompte demandé.</b> Pas illégal ici, mais l'OPC recommande si possible aucun acompte à la signature, sinon une petite somme, puis des paiements selon l'avancement des travaux.",
    });
  if (F.capture) it.push({ c: "i", t: "Lecture automatique du numéro et du nom sur la photo : prochaine version." });
  const c = it.some((i) => i.c === "r") ? "r" : it.some((i) => i.c === "y") ? "y" : "g";
  const ord = { r: 0, y: 1, i: 2, g: 3 };
  it.sort((a, b) => ord[a.c] - ord[b.c]);
  return { c, items: it };
}

/* Écrans communs du module. */
const vueReno = (F, retour) => `${top(retour, "Rénovation")}
<h2>La soumission de l'entrepreneur</h2>
<form class="card" id="f-reno" novalidate>
<label class="drop">${F.captureUrl || (typeof F.capture === "string" && F.capture) ? `<img src="${F.captureUrl || F.capture}" alt="Photo de la soumission">Changer la photo` : "Photographier la soumission (facultatif)"}<input type="file" accept="image/*" capture="environment" data-side="capture"></label>
<div class="grid2"><label>Licence RBQ<input id="licence" inputmode="numeric" autocomplete="off" placeholder="0000-0000-00" value="${esc(F.licence || "")}"></label>
<label>Nom de l'entreprise<input id="nom" autocomplete="off" placeholder="Sur la soumission" value="${esc(F.nom || "")}"></label></div>
<div class="q">Type de travaux<div class="choix" role="group" aria-label="Type de travaux">${Object.entries(TRAVAUX)
  .map(([k, t]) => `<button type="button" data-trav="${k}" aria-pressed="${F.travaux === k}">${t.l}</button>`)
  .join("")}</div></div>
${yn("domicile", "Le contrat est (ou sera) signé chez toi ?")}
<div id="q-recu" ${F.domicile !== "oui" ? "hidden" : ""}><label>Date où tu as reçu ton exemplaire signé<input id="recu" type="date" value="${esc(F.recu || aujourdhui())}"></label></div>
${yn("acompte", "On te demande un acompte ou un paiement maintenant ?")}
<p class="err" id="e" hidden></p>
<button class="btn" id="go">Vérifier</button></form>
<p class="hint">La photo reste sur ton téléphone. Seuls le numéro de licence, le type de travaux et le résultat sont gardés dans ton historique.</p>`;

const vueRenoResultat = (F, retour) => {
  const R = F.res,
    T = TRAVAUX[F.travaux];
  return `${top(retour, "Résultat")}
<div class="verdict ${R.c}"><strong>${{ r: "Ne signe pas, ne paie pas", y: "Prudence", g: "Aucun signal d'alarme" }[R.c]}</strong><span>${esc(T.l)}${F.licence ? ` · licence <span class="num">${esc(formatLicence(chiffres(F.licence)))}</span>` : ""}</span></div>
${F.limite ? `<div class="rule">Annulation possible sans frais jusqu'au <b>${jourLong(F.limite)}</b>.</div>` : ""}
<div class="card"><h2>Ce que l'app a vérifié</h2><ul class="reasons">${R.items.map((i) => `<li><span class="dot ${i.c}"></span><div>${i.t}${i.law ? `<div class="law">${i.law}</div>` : ""}</div></li>`).join("")}</ul></div>
<p class="rule">Paie selon l'avancement des travaux, jamais tout d'avance.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.opc}" target="_blank" rel="noopener" id="opc">Voir les plaintes à l'OPC</a>
<p class="hint">${F.nom ? "En touchant le bouton, le nom de l'entreprise est copié : colle-le dans l'outil de l'OPC. " : ""}Une plainte ne prouve pas une faute : regarde surtout leur nombre et leur sujet.</p>
<a class="btn ghost" style="display:grid;place-items:center;text-decoration:none" href="${LIENS.rbq}" target="_blank" rel="noopener">Ouvrir le registre des licences RBQ</a>
<button class="btn" id="nouv">Vérifier un autre entrepreneur</button>`;
};

/* Liaisons communes du formulaire. */
function lierReno(F) {
  app.querySelectorAll("[data-trav]").forEach(
    (b) =>
      (b.onclick = () => {
        F.travaux = b.dataset.trav;
        app.querySelectorAll("[data-trav]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      }),
  );
  app.querySelectorAll("[data-yn=domicile]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#q-recu").hidden = F.domicile !== "oui";
    }),
  );
}
function lireReno(F) {
  ["licence", "nom", "recu"].forEach((k) => {
    const el = $("#" + k);
    if (el) F[k] = el.value;
  });
}
function validerReno(F) {
  const d = chiffres(F.licence);
  if (d && (d.length < 8 || d.length > 10))
    return "Ce numéro de licence semble incomplet. Recopie-le tel qu'il est sur la soumission, ou laisse le champ vide.";
  if (!F.travaux) return "Choisis le type de travaux.";
  if (!F.domicile || !F.acompte) return "Réponds aux deux questions.";
  if (F.domicile === "oui" && F.recu && isNaN(new Date(F.recu + "T12:00:00"))) return "Entre une date valide.";
  return "";
}
function lierResultatReno(F) {
  const o = $("#opc");
  if (o && F.nom)
    o.addEventListener("click", () => {
      try {
        navigator.clipboard.writeText(F.nom);
      } catch (e) {}
    });
}
