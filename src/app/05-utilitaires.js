/* Lien reçu par « Partager » depuis une autre app (Android) ou par l'adresse ?url= */
try {
  const q = new URLSearchParams(location.search),
    tout = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join("\n");
  if (tout) {
    const l = normaliser(tout);
    if (l) F.lien = l;
    F.annonce = tout;
    F.partage = true;
    history.replaceState(null, "", location.pathname);
  }
} catch (e) {}
const $ = (s) => document.querySelector(s);
const app = $("#app");
const esc = (t) =>
  String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = (n) => Number(n).toLocaleString("fr-CA") + " $";
const top = (back, title) =>
  `<div class="top">${back ? `<button class="back" data-go="${back}">‹ Retour</button>` : ""}${title ? "" : `<svg class="logo-mini" aria-hidden="true"><use href="#logo"/></svg>`}<b>${title || "HabitaScan"}</b><span class="sp"></span><button type="button" class="theme-btn" data-theme-toggle aria-label="Changer de thème"></button></div>`;
const STATUT = {
  aucune: "Identité non confirmée",
  en_attente: "Identité en vérification",
  confirmee: "Identité confirmée",
  refusee: "Identité refusée : recommence",
};
