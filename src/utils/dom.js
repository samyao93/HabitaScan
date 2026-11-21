/* Petits outils d'affichage : sélection, échappement HTML, barre du haut, messages, questions oui/non. */
import { etat } from "../etat.js";

export const $ = (s) => document.querySelector(s);

export const app = $("#app");

export const esc = (t) =>
  String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const money = (n) => Number(n).toLocaleString("fr-CA") + " $";

export const top = (back, title) =>
  `<div class="top">${back ? `<button class="back" data-go="${back}">‹ Retour</button>` : ""}${title ? "" : `<svg class="logo-mini" aria-hidden="true"><use href="#logo"/></svg>`}<b>${title || "HabitaScan"}</b><span class="sp"></span>${back ? "" : `<button type="button" class="lang-btn" data-langue="en" lang="en" aria-label="English version">EN</button>`}<button type="button" class="theme-btn" data-theme-toggle aria-label="Changer de thème"></button></div>`;

export function yn(k, q) {
  return `<div class="q">${q}<div class="yn" role="group" aria-label="${esc(q)}"><button type="button" data-yn="${k}" data-v="oui" aria-pressed="${etat.fiche[k] === "oui"}">Oui</button><button type="button" data-yn="${k}" data-v="non" aria-pressed="${etat.fiche[k] === "non"}">Non</button></div></div>`;
}

export const err = (m) => {
  const e = $("#e");
  if (e) {
    e.textContent = m;
    e.hidden = !m;
  }
};

export const busy = (on, label) => {
  const b = $("#go");
  if (b) {
    b.disabled = on;
    if (label) b.textContent = label;
  }
};

export function keep() {
  ["annonce", "lien", "ville", "ch", "prix", "adr", "txt", "contact"].forEach((k) => {
    const el = $("#" + k);
    if (el) etat.fiche[k] = el.value;
  });
}
