/* Lecture automatique d'une annonce : texte collé, captures (lecture du texte), recherche des photos. */
import { sb } from "../config.js";
import { etat } from "../etat.js";
import { courtCh } from "../prix/reference.js";
import { esc } from "../utils/dom.js";
import { reduireImage } from "../utils/images.js";

/* Notation québécoise : un 4 ½ = 2 chambres (pièces moins 2 : cuisine et salon). Un 1 ½ ou 2 ½ = studio. */
export function extraireAnnonce(brut, villes) {
  const t = String(brut || "").replace(/\u00a0|\u202f/g, " "),
    bas = t.toLowerCase(),
    r = {};
  const url = t.match(/https?:\/\/[^\s]+/i);
  if (url) r.lien = url[0];
  /* Prix : un montant de 300 à 9 999 $ collé à un symbole $ ou à « par mois » / « /mois » / « month ». */
  const prix = [
    ...t.matchAll(
      /(?:\$\s?(\d{1,2}[ ,.]?\d{3}|\d{3,4})(?![\d])|(\d{1,2}[ ,.]?\d{3}|\d{3,4})\s?(?:\$|dollars?\b|par mois|\/\s?mois|\/\s?mo\b|\/\s?month|per month))/gi,
    ),
  ]
    .map((m) => parseInt((m[1] || m[2]).replace(/[ ,.]/g, ""), 10))
    .filter((n) => n >= 300 && n <= 9999);
  if (!prix.length) {
    const l = t.match(/(?:loyer|prix|rent)\s*:?\s*(\d{1,2}[ ,.]?\d{3}|\d{3,4})(?!\d)/i);
    if (l) {
      const n = parseInt(l[1].replace(/[ ,.]/g, ""), 10);
      if (n >= 300 && n <= 9999) prix.push(n);
    }
  }
  if (prix.length) r.prix = String(prix[0]);
  /* Chambres : « 4 1/2 », « 4½ », « 4.5 », « 2 chambres », « 2 cc », « 2 bedrooms », « 2 br » ; studio : « 1 1/2 », « 2 1/2 », « studio ». */
  const demi = bas.match(/\b([1-9])\s?(?:½|1\/2|\.5|,5)(?!\d)/);
  const ch = bas.match(/\b([1-6])\s?(?:chambres?|cc\b|c\.c\.|bedrooms?|beds?\b|br\b|bdr)/);
  if (ch) r.ch = String(Math.min(+ch[1], 3));
  else if (demi && +demi[1] >= 3) r.ch = String(Math.min(+demi[1] - 2, 3));
  else if ((demi && +demi[1] <= 2) || /\b(?:studio|bachelor|loft)\b/.test(bas)) r.ch = "0";
  /* Ville : une des villes de référence nommée dans le texte. */
  const norm = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const nb = norm(t);
  const v = (villes || []).find((x) => new RegExp("\\b" + norm(x).replace(/[-\s]/g, "[-\\s]") + "\\b").test(nb));
  if (v) r.ville = v;
  if (/\bcession\b|\btransfert de bail\b|\blease transfer\b|sous-loca|sous-lou|\bsublet|\bsublease/.test(bas))
    r.cession = "oui";
  return r;
}

function resumeLecture(r) {
  const p = [];
  if (r.prix) p.push(Number(r.prix).toLocaleString("fr-CA") + " $");
  if (r.ch) p.push(courtCh(r.ch));
  if (r.ville) p.push(r.ville);
  if (r.cession) p.push("cession de bail");
  return p.join(" · ");
}

/* Lecture du texte d'une capture d'écran, directement sur le téléphone (Tesseract.js, chargé seulement au besoin). */
let tesseractPret = null;

function chargerTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (tesseractPret) return tesseractPret;
  tesseractPret = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    s.onload = ok;
    s.onerror = () => {
      tesseractPret = null;
      ko(new Error("tesseract"));
    };
    document.head.appendChild(s);
  });
  return tesseractPret;
}

export async function lireCapture(image) {
  await chargerTesseract();
  const { data } = await Tesseract.recognize(image, "fra+eng");
  return (data && data.text) || "";
}

export function appliquerLecture(r) {
  ["prix", "ch", "ville", "cession"].forEach((k) => {
    if (r[k]) etat.fiche[k] = r[k];
  });
  if (r.lien && !etat.fiche.lien) etat.fiche.lien = r.lien;
  const res = resumeLecture(r);
  etat.fiche.lu = res
    ? `<b>Lu :</b> ${esc(res)}. Vérifie et corrige si besoin.`
    : "Je n'ai pas trouvé le prix ni la ville : remplis-les ci-dessous.";
}

export async function rechercheImages(f) {
  try {
    const b64 = await reduireImage(f);
    const appel = sb.functions.invoke("recherche-image", { body: { image: b64 } });
    const { data, error } = await Promise.race([
      appel,
      new Promise((r) => setTimeout(() => r({ error: "delai" }), 9000)),
    ]);
    /* La page de l'annonce elle-même n'est pas une copie : on retire les résultats du même site. */
    const hote = (u) => {
        try {
          return new URL(u).hostname.replace(/^(www|m|web)\./, "");
        } catch (e) {
          return "";
        }
      },
      site = etat.fiche.lienN ? hote(etat.fiche.lienN) : "";
    return error || !data
      ? null
      : {
          ok: true,
          details: ((data && data.details) || []).filter(
            (d) => d && typeof d.url === "string" && /^https?:\/\//.test(d.url) && (!site || hote(d.url) !== site),
          ),
          pages: (data.pages || []).filter((u) => /^https?:\/\//.test(u) && (!site || hote(u) !== site)),
        };
  } catch (e) {
    return null;
  }
}
