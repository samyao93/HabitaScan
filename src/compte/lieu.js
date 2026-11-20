/* Lieu de connexion (avec accord) et appareil. */
import { rpc } from "../admin/api.js";
import { sb } from "../config.js";
import { etat } from "../etat.js";

const PROVINCES = {
  QC: "Québec",
  ON: "Ontario",
  NB: "Nouveau-Brunswick",
  NS: "Nouvelle-Écosse",
  PE: "Île-du-Prince-Édouard",
  NL: "Terre-Neuve-et-Labrador",
  MB: "Manitoba",
  SK: "Saskatchewan",
  AB: "Alberta",
  BC: "Colombie-Britannique",
  YT: "Yukon",
  NT: "Territoires du Nord-Ouest",
  NU: "Nunavut",
};

export const lieuTexte = (x) =>
  [x.ville, x.pays === "CA" ? PROVINCES[x.region] || x.region : x.region, x.pays && x.pays !== "CA" ? x.pays : ""]
    .filter(Boolean)
    .join(", ") || "Inconnu";

/* Invitation unique et non cochée (Loi 25, art. 8.1) */
export const CLE_LIEU_REP = "hs_lieu_rep";

export function blocInvitationLieu() {
  if (!LIEU.dispo || LIEU.actif()) return "";
  try {
    if (localStorage.getItem(CLE_LIEU_REP)) return "";
  } catch (e) {
    return "";
  }
  return `<div class="card invite" id="inv-lieu"><p><b>Protéger ton compte</b></p><p class="soft">Veux-tu partager ta ville approximative de connexion ? Elle nous aide à repérer une connexion inhabituelle. Pas de GPS, gardée 90 jours au plus, visible seulement par les administrateurs. C'est désactivé tant que tu ne l'actives pas.</p>
<div class="duo"><button class="btn" id="inv-oui">Activer</button><button class="btn ghost" id="inv-non">Non merci</button></div></div>`;
}

const appareilCourt = () => {
  const u = navigator.userAgent;
  const os = /iPhone|iPad/.test(u)
    ? /iPad/.test(u)
      ? "iPad"
      : "iPhone"
    : /Android/.test(u)
      ? "Android"
      : /Mac OS X/.test(u)
        ? "Mac"
        : /Windows/.test(u)
          ? "Windows"
          : /Linux/.test(u)
            ? "Linux"
            : "Autre";
  const nav = /Edg\//.test(u)
    ? "Edge"
    : /SamsungBrowser/.test(u)
      ? "Samsung"
      : /Firefox|FxiOS/.test(u)
        ? "Firefox"
        : /Chrome|CriOS/.test(u)
          ? "Chrome"
          : /Safari/.test(u)
            ? "Safari"
            : "Autre";
  return os + " · " + nav;
};

export const LIEU = {
  dispo: true,
  demo: false,
  actif: () => !!(etat.profil && etat.profil.partage_lieu),
  async definir(b) {
    await rpc("definir_partage_lieu", { p_actif: b });
    if (etat.profil) etat.profil.partage_lieu = b;
    if (b) {
      etat.lieuNote = false;
      return noterLieu();
    }
    return null;
  },
};

export async function noterLieu() {
  if (etat.lieuNote || !etat.session || !LIEU.actif()) return null;
  etat.lieuNote = true;
  try {
    const base = document.documentElement.dataset.natif ? "https://habitascan.vercel.app" : "";
    const r = await fetch(base + "/api/lieu", { cache: "no-store" });
    if (!r.ok) return null;
    const g = await r.json();
    await sb.rpc("noter_connexion", {
      p_pays: g.pays || "",
      p_region: g.region || "",
      p_ville: g.ville || "",
      p_appareil: appareilCourt(),
    });
    return g;
  } catch (e) {
    return null;
  }
}
