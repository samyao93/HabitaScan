/* Outils de texte et de dates : accents, chiffres, montants, dates en français. */
import { esc } from "./dom.js";

export const chiffres = (t) => String(t || "").replace(/\D/g, "");

export const formatLicence = (d) => (d.length === 10 ? d.replace(/(\d{4})(\d{4})(\d{2})/, "$1-$2-$3") : d);

export const sansAccent = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(inc|ltee|ltd|enr|senc|la|le|les|de|du|des)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const jourLong = (d) =>
  d.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const aujourdhui = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const nombre = (v) => {
  const n = parseInt(String(v || "").replace(/[^\d]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

export const sansAccents = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const m0 = (n) => Math.round(n).toLocaleString("fr-CA") + " $";

/* Texte enregistré : on échappe tout, puis on ne réautorise que <b>, <strong>, <em> et les liens https */
export function nettoyerHTML(s) {
  let h = esc(String(s || ""));
  h = h.replace(/&lt;(\/?)(b|strong|em)&gt;/g, "<$1$2>");
  h = h
    .replace(
      /&lt;a href=&quot;(https:\/\/[^\s"<>]*?)&quot;.*?&gt;/g,
      (m, u) => `<a href="${u}" target="_blank" rel="noopener">`,
    )
    .replace(/&lt;\/a&gt;/g, "</a>");
  if ((h.match(/<a /g) || []).length > (h.match(/<\/a>/g) || []).length) h += "</a>";
  return h;
}

export const dateCourte = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return "";
  }
};

export const dateLongue = (d) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "short" });
  } catch (e) {
    return "";
  }
};

export const sansAcc = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'");

export const dateId = (s) => {
  if (!s) return "non lue";
  const d = new Date(s + "T12:00:00");
  return isNaN(d) ? esc(s) : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
};
