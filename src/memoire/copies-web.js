/* La même annonce publiée ailleurs sur le web. */
import { CFG } from "../admin/parametres.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { esc, money } from "../utils/dom.js";

/* Recherche des copies de l'annonce sur le web, même si personne ne l'a vérifiée dans l'app. */
const hoteDe = (u) => {
  try {
    return new URL(u).hostname.replace(/^(www|m|fr|en)\./, "");
  } catch (e) {
    return "";
  }
};

function phraseDistinctive(t) {
  const phr = String(t || "")
    .split(/\n|(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.split(" ").length >= 8 && !/https?:|@|\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(s));
  if (!phr.length) return null;
  phr.sort((a, b) => b.length - a.length);
  return phr[0].split(" ").slice(0, 16).join(" ");
}

function prixDans(t) {
  const m = String(t || "").match(/(\d{1,2}[\s  ,.]?\d{3}|\d{3,4})\s*\$|\$\s*(\d{1,2},?\d{3}|\d{3,4})/);
  if (!m) return null;
  const n = +String(m[1] || m[2]).replace(/\D/g, "");
  return n >= 300 && n <= 10000 ? n : null;
}

export async function chercherCopies() {
  if (!etat.session || !CFG.recherche) return null;
  const t =
    etat.fiche.annonce && etat.fiche.annonce.length > 80
      ? etat.fiche.annonce
      : etat.fiche.ocrTxt || etat.fiche.annonce || "";
  const phrase = phraseDistinctive(t);
  if (!phrase) return null;
  try {
    const { data, error } = await sb.functions.invoke("chercher-copies", { body: { phrase } });
    return error || !data || data.error ? null : data;
  } catch (e) {
    return null;
  }
}

export function itemsCopiesWeb(F) {
  const it = [],
    actuel = (F.lienN || "").split(/[?#]/)[0];
  const copies = ((F.copiesWeb || {}).resultats || []).filter((r) => r && r.url && r.url.split(/[?#]/)[0] !== actuel);
  const imgs = (F.images || {}).details || [];
  const tout = [
    ...copies.map((r) => ({ url: r.url, txt: (r.titre || "") + " " + (r.extrait || "") })),
    ...imgs.map((r) => ({ url: r.url, txt: r.titre || "" })),
  ];
  const autrePrix = tout
    .map((x) => ({ ...x, p: prixDans(x.txt) }))
    .filter((x) => x.p && F.prixN && Math.abs(x.p - F.prixN) > Math.max(50, F.prixN * 0.1));
  const lien = (x) => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(hoteDe(x.url))}</a>`;
  if (autrePrix.length)
    it.push({
      c: "y",
      t: `<b>La même annonce apparaît ailleurs sur le web à un autre prix</b> : ${autrePrix
        .slice(0, 3)
        .map((x) => `${money(x.p)} sur ${lien(x)}`)
        .join(", ")}. Une annonce copiée avec un prix différent est un signe classique de fraude.`,
      law: "Recherche des photos et du texte de l'annonce sur le web",
    });
  else if (copies.length)
    it.push({
      c: "i",
      t: `<b>Le même texte apparaît aussi sur ${copies.slice(0, 3).map(lien).join(", ")}.</b> C'est normal si le propriétaire publie à plusieurs endroits : compare le numéro et le nom de l'annonceur.`,
      law: "Recherche du texte de l'annonce sur le web",
    });
  return it;
}
