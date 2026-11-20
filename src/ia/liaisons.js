/* Analyse intelligente : liaisons. */
import { analyser } from "../annonce/verdict.js";
import { etat } from "../etat.js";
import { CLE_IA, analyserIA, appliquerIA } from "./analyse.js";
import { fusionContacts } from "../memoire/contacts.js";
import { memoire } from "../memoire/memoire.js";
import { MES } from "../mesure/mesure.js";
import { go } from "../navigation/routeur.js";
import { $, app, keep } from "../utils/dom.js";

export function lierAnalyseIA(v) {
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
export function lancerIA(texteSeul) {
  const n = (etat.fiche.captures || []).length;
  etat.fiche.lu = null;
  const f = $("#f-ver");
  if (f)
    f.insertAdjacentHTML(
      "afterbegin",
      `<p class="lu" role="status">Analyse intelligente ${texteSeul ? "du texte" : n > 1 ? `de ${n} captures` : "de la capture"}…</p>`,
    );
  analyserIA(texteSeul ? [] : etat.fiche.captures, `${etat.fiche.annonce || ""}\n${etat.fiche.txt || ""}`)
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
      etat.fiche.iaOff = true;
      etat.fiche.lu =
        x && x.message === "quota"
          ? "Limite d'analyses IA atteinte pour aujourd'hui : lecture simple utilisée."
          : "L'analyse intelligente n'a pas fonctionné : lecture simple utilisée.";
      if (!texteSeul) etat.fiche.ocr = true;
      if ($("#f-ver")) go("verifier");
    });
}

export function ecouterChoixIA() {
  document.addEventListener("click", async (e) => {
    const t = e.target.closest ? e.target : null;
    if (!t) return;
    const choix = t.closest("[data-ia-choix]");
    if (choix) {
      try {
        localStorage.setItem(CLE_IA, choix.dataset.iaChoix);
      } catch (x) {}
      const v = app.dataset.v;
      if (v === "verifier") keep();
      go(v);
      return;
    }
    const relire = t.closest("#ia-relire");
    if (relire) {
      try {
        localStorage.setItem(CLE_IA, "1");
      } catch (x) {}
      relire.disabled = true;
      relire.textContent = "Lecture par l'IA…";
      try {
        const r = await analyserIA(
          etat.fiche.captures,
          `${etat.fiche.annonce || ""}\n${etat.fiche.txt || ""}\n${etat.fiche.ocrTxt || ""}`,
        );
        etat.fiche.ia = r;
        etat.fiche.contacts = fusionContacts(etat.fiche.contacts, { tels: r.telephones, courriels: r.courriels });
        etat.fiche.mem = await memoire(etat.fiche.contacts, etat.fiche.photos);
        etat.fiche.res = analyser();
        try {
          MES.noter("ia_relecture");
        } catch (x) {}
        go("resultat");
      } catch (x) {
        relire.disabled = false;
        relire.textContent =
          x && x.message === "quota"
            ? "Limite d'analyses IA atteinte pour aujourd'hui"
            : "L'analyse intelligente n'a pas fonctionné. Réessayer";
      }
      return;
    }
    const fgo = t.closest("#f-ia-go");
    if (fgo) {
      try {
        localStorage.setItem(CLE_IA, "1");
      } catch (x) {}
      const b = $("#f-lire");
      if (b) b.click();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "ia-compte")
      try {
        localStorage.setItem(CLE_IA, e.target.checked ? "1" : "0");
      } catch (x) {}
  });
}
