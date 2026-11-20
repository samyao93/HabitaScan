/* ===== HabitaScan : analyse intelligente de l'annonce et de la conversation (commun démo + Supabase) =====
   L'IA extrait les champs et repère les signaux, avec citation. Le verdict reste calculé par les règles.
   Dépend de : F, $, app, go, esc, keep, LOYERS, appliquerLecture, MES ; adaptateur IA_ADAPT : {dispo, analyser({images, texte})} */
const CLE_IA = "hs_ia";
const iaActif = () => {
  try {
    return localStorage.getItem(CLE_IA) === "1" && IA_ADAPT.dispo;
  } catch (e) {
    return false;
  }
};
const SIGNAUX_IA = {
  argent_avant_bail: "Argent demandé avant la signature du bail",
  depot: "Dépôt ou frais de réservation",
  paiement_suspect: "Moyen de paiement typique des fraudes",
  proprietaire_absent: "Propriétaire « à l'étranger » ou absent",
  refus_visite: "Visite refusée ou repoussée",
  urgence: "Pression pour décider vite",
  changement_plateforme: "Demande de continuer sur une autre messagerie",
  pieces_identite_demandees: "Documents personnels demandés trop tôt",
  prix_anormal_annonce: "Prix présenté comme exceptionnellement bas",
  autre: "Autre élément inhabituel",
};
const blocIA = () =>
  IA_ADAPT.dispo
    ? !iaChoisi()
      ? ""
      : `<label class="ia-opt"><input type="checkbox" id="ia-ok" ${iaActif() ? "checked" : ""}><span><b>Analyse intelligente</b><span class="hint">Comprend mieux les captures et la conversation, aussi en anglais. Les images et le texte sont envoyés à Anthropic pour l'analyse, puis oubliés par HabitaScan.</span></span></label>`
    : `<p class="hint">L'analyse intelligente est offerte dans la vraie app, pas dans cette démo.</p>`;
/* Réduit une capture à 1 280 px de large au maximum, en JPEG, pour limiter l'envoi */
function reduireImage(source) {
  return new Promise((ok, ko) => {
    const im = new Image();
    const dataUrl = typeof source === "string" ? source : URL.createObjectURL(source);
    im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, 1));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    im.onerror = ko;
    im.src = dataUrl;
  });
}
async function analyserIA(captures, texte) {
  const images = [];
  for (const c of (captures || []).slice(0, 4)) images.push(await reduireImage(c));
  return IA_ADAPT.analyser({ images, texte: String(texte || "").slice(0, 8000) });
}
function appliquerIA(r) {
  F.ia = r;
  const villes = Object.keys(LOYERS);
  if (r.prix) F.prix = String(r.prix);
  if (r.chambres) F.ch = String(Math.min(r.chambres, 3));
  if (r.ville) {
    const v = villes.find(
      (x) =>
        x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() ===
        r.ville.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
    );
    F.ville = v || "Autre";
  }
  if (r.cession != null) F.cession = r.cession ? "oui" : "non";
  if (r.adresse && !F.adr) F.adr = r.adresse;
  const lus = [
    r.prix ? `${r.prix} $` : "",
    r.ville || "",
    r.chambres ? `${r.chambres} ch.` : "",
    r.cession ? "cession de bail" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const n = (r.signaux || []).length;
  F.lu = `<b>Lu par l'IA :</b> ${esc((lus || "aucune information claire").replace(/\.$/, ""))}. ${n ? `<b>${n > 1 ? n + " signaux repérés" : "1 signal repéré"}</b> : tu les verras dans le résultat.` : "Aucun signal d'arnaque repéré dans le texte."} Vérifie les champs et réponds aux questions.`;
}
function itemsIA(F) {
  const r = F.ia;
  if (!r) return [];
  const it = (r.signaux || []).map((s) => ({
    c: "y",
    t: `<b>${esc(SIGNAUX_IA[s.type] || "Élément inhabituel")}</b> : « ${esc(s.extrait)} »${s.explication ? ` ${esc(s.explication)}` : ""}`,
    law: "Repéré par l'analyse intelligente. Vérifie dans l'annonce.",
  }));
  if (r.resume) it.push({ c: "i", t: `<b>Résumé de l'IA :</b> ${esc(r.resume)}` });
  return it;
}
function bindPlus6(v) {
  if (v !== "verifier") return;
  const c = $("#ia-ok");
  if (c)
    c.onchange = () => {
      try {
        localStorage.setItem(CLE_IA, c.checked ? "1" : "0");
      } catch (e) {}
    };
}
/* Lance l'analyse IA sur les captures (remplace la lecture locale) ; en cas d'échec, revient à la lecture locale */
function lancerIA(texteSeul) {
  const n = (F.captures || []).length;
  F.lu = null;
  const f = $("#f-ver");
  if (f)
    f.insertAdjacentHTML(
      "afterbegin",
      `<p class="lu" role="status">Analyse intelligente ${texteSeul ? "du texte" : n > 1 ? `de ${n} captures` : "de la capture"}…</p>`,
    );
  analyserIA(texteSeul ? [] : F.captures, `${F.annonce || ""}\n${F.txt || ""}`)
    .then((r) => {
      if ($("#f-ver")) keep();
      appliquerIA(r);
      try {
        MES.noter("ia_analyse");
      } catch (e) {}
      go("verifier");
    })
    .catch((x) => {
      try {
        MES.noter("ia_echec");
      } catch (e) {}
      F.iaOff = true;
      F.lu =
        x && x.message === "quota"
          ? "Limite d'analyses IA atteinte pour aujourd'hui : lecture simple utilisée."
          : "L'analyse intelligente n'a pas fonctionné : lecture simple utilisée.";
      if (!texteSeul) F.ocr = true;
      if ($("#f-ver")) go("verifier");
    });
}
const CSS_PLUS6 = ""; /* styles déplacés dans app.css */

/* Adaptateur IA (Supabase : fonction analyser-annonce → Claude Haiku 5.5) */
const IA_ADAPT = {
  get dispo() {
    return CFG.ia;
  },
  async analyser(p) {
    const { data, error } = await sb.functions.invoke("analyser-annonce", { body: p });
    if (error) {
      if (error.context && error.context.status === 429) throw new Error("quota");
      throw error;
    }
    if (!data || data.error) throw new Error((data && data.error) || "ia");
    return data;
  },
};
document.head.insertAdjacentHTML("beforeend", "<style>" + CSS_PLUS6 + "</style>");
