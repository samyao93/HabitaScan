/* Budget : liaisons de l'écran. */
import { resultatBudget } from "./ecrans.js";
import { budgetDefaut, calculerBudget } from "./regles.js";
import { nouveauF } from "../etat.js";
import { go } from "../navigation/routeur.js";
import { $, app } from "../utils/dom.js";

export function lierBudget(F) {
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
