/* Carte image du verdict, à partager à un coloc ou à un parent (« Ne paie pas : 3 signaux »).
   Elle ne montre que le verdict, la ville, les chambres, le loyer et le titre des signaux :
   jamais l'adresse, le lien, le texte de l'annonce ni les coordonnées de l'annonceur. */
import { etat } from "../etat.js";
import { money } from "../utils/dom.js";
import { partagerImageNative } from "../natif.js";

const COULEURS = {
  r: { fond: "#fdf0ed", trait: "#f5c9bf", encre: "#c2301a" },
  y: { fond: "#fff6e8", trait: "#f3d9ae", encre: "#9a5500" },
  g: { fond: "#ecf7f0", trait: "#bfe3cc", encre: "#18703c" },
};
const TITRES = { r: "Ne paie pas", y: "Visite d'abord", g: "Aucun signal d'arnaque" };
const SITE = "habitascan.vercel.app";

/* Titre court d'un signal : le texte en gras s'il y en a, sinon la première phrase, sans HTML. */
export function titreSignal(t) {
  const s = String(t || "");
  const gras = s.match(/<b>([\s\S]*?)<\/b>/);
  const brut = (gras ? gras[1] : s)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  const phrase = gras ? brut : brut.split(/(?<=[.!?])\s/)[0];
  return phrase.replace(/[.:]$/, "").slice(0, 120);
}

/* Ce que montre la carte. */
export function contenuCarte(F) {
  const R = F.res || { c: "g", items: [] };
  const alertes = R.items.filter((i) => i.c === "r" || i.c === "y");
  const n = alertes.length;
  const titre = R.c === "g" ? TITRES.g : `${TITRES[R.c]} : ${n} signa${n > 1 ? "ux" : "l"}`;
  const ch = F.ch === "3" ? "3 ch. et plus" : (F.ch || "?") + " ch.";
  return {
    c: R.c,
    titre,
    sous: [F.ville, ch, F.prixN ? money(F.prixN) : ""].filter(Boolean).join(" · "),
    signaux: alertes.slice(0, 6).map((i) => ({ c: i.c, t: titreSignal(i.t) })),
    reste: Math.max(0, n - 6),
    regle:
      R.c === "g"
        ? "Avant de payer : visite, confirme le propriétaire, puis signe le bail."
        : "Au Québec, aucun dépôt ne peut être exigé.",
  };
}

/* Coupe un texte en lignes qui tiennent dans la largeur donnée. */
function lignes(ctx, texte, largeur) {
  const mots = String(texte).split(" ");
  const out = [];
  let l = "";
  for (const m of mots) {
    const essai = l ? l + " " + m : m;
    if (ctx.measureText(essai).width > largeur && l) {
      out.push(l);
      l = m;
    } else l = essai;
  }
  if (l) out.push(l);
  return out;
}

function rond(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Dessine la carte (1080 × 1350, format portrait des réseaux sociaux) et renvoie le canevas. */
export async function dessinerCarte(F) {
  const k = contenuCarte(F),
    col = COULEURS[k.c];
  try {
    await document.fonts.ready;
  } catch (e) {}
  const W = 1080,
    H = 1350,
    M = 80,
    police = 'Figtree, system-ui, -apple-system, "Segoe UI", sans-serif';
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#f4f6fa";
  ctx.fillRect(0, 0, W, H);

  // En-tête : logo et nom
  rond(ctx, M, M, 84, 84, 20);
  ctx.fillStyle = "#0b3d91";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(M + 42, M + 22);
  ctx.lineTo(M + 66, M + 42);
  ctx.lineTo(M + 66, M + 66);
  ctx.lineTo(M + 18, M + 66);
  ctx.lineTo(M + 18, M + 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0e1726";
  ctx.font = `800 44px ${police}`;
  ctx.textBaseline = "middle";
  ctx.fillText("HabitaScan", M + 108, M + 44);

  // Bloc du verdict
  let y = M + 140;
  ctx.font = `800 76px ${police}`;
  const lt = lignes(ctx, k.titre, W - 2 * M - 80);
  ctx.font = `500 36px ${police}`;
  const hBloc = 70 + lt.length * 88 + (k.sous ? 56 : 0);
  rond(ctx, M, y, W - 2 * M, hBloc, 36);
  ctx.fillStyle = col.fond;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = col.trait;
  ctx.stroke();
  ctx.fillStyle = col.encre;
  ctx.font = `800 76px ${police}`;
  ctx.textBaseline = "top";
  let yy = y + 40;
  for (const l of lt) {
    ctx.fillText(l, M + 40, yy);
    yy += 88;
  }
  if (k.sous) {
    ctx.fillStyle = "#0e1726";
    ctx.font = `500 36px ${police}`;
    ctx.fillText(k.sous, M + 40, yy + 4);
  }
  y += hBloc + 56;

  // Signaux
  ctx.font = `650 40px ${police}`;
  for (const s of k.signaux) {
    const ls = lignes(ctx, s.t, W - 2 * M - 60);
    if (y + ls.length * 52 > H - 260) break;
    ctx.fillStyle = s.c === "r" ? COULEURS.r.encre : COULEURS.y.encre;
    ctx.beginPath();
    ctx.arc(M + 14, y + 22, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0e1726";
    for (const l of ls) {
      ctx.fillText(l, M + 52, y);
      y += 52;
    }
    y += 34;
  }
  if (k.reste) {
    ctx.fillStyle = "#5c6678";
    ctx.font = `500 34px ${police}`;
    ctx.fillText(`+ ${k.reste} autre${k.reste > 1 ? "s" : ""}`, M + 52, y);
  }

  // Pied : règle et adresse du site
  ctx.fillStyle = "#0b3d91";
  ctx.fillRect(0, H - 200, W, 200);
  ctx.fillStyle = "#ffffff";
  ctx.font = `650 36px ${police}`;
  const lr = lignes(ctx, k.regle, W - 2 * M);
  let yr = H - 170;
  for (const l of lr.slice(0, 2)) {
    ctx.fillText(l, M, yr);
    yr += 46;
  }
  ctx.font = `500 32px ${police}`;
  ctx.fillStyle = "#c9d8f5";
  ctx.fillText(`Vérifie une annonce avant de payer : ${SITE}`, M, H - 70);
  return cv;
}

const enBlob = (cv) => new Promise((ok, ko) => cv.toBlob((b) => (b ? ok(b) : ko(new Error("image"))), "image/png"));

/* Partage la carte : app native, puis partage du navigateur, sinon téléchargement. Renvoie ce qui a été fait. */
export async function partagerCarte(F = etat.fiche) {
  const cv = await dessinerCarte(F);
  const k = contenuCarte(F);
  const texte = `${k.titre}. Vérifié avec HabitaScan : https://${SITE}`;
  if (await partagerImageNative(cv.toDataURL("image/png"), texte)) return "natif";
  const blob = await enBlob(cv);
  const fichier = new File([blob], "habitascan-verdict.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: "HabitaScan", text: texte });
      return "partage";
    } catch (e) {
      if (e && e.name === "AbortError") return "annule";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "habitascan-verdict.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return "telecharge";
}
