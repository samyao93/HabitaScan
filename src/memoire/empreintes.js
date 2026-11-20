/* Empreintes des photos (dHash) et du texte (SimHash), détection de la photo dans une capture. */
import { etat } from "../etat.js";

/* Empreinte visuelle (dHash 64 bits) : la même photo, même redimensionnée ou recompressée, garde presque la même empreinte. */
export function empreintePhoto(source, rogner) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      try {
        const r = rogner ? 0.1 : 0,
          sx = im.width * r,
          sy = im.height * r,
          sw = im.width * (1 - 2 * r),
          sh = im.height * (1 - 2 * r);
        /* Réduction en deux temps (lissée), puis moyenne par blocs : stable malgré le redimensionnement et la compression. */
        const W = 72,
          Hh = 64,
          c = document.createElement("canvas");
        c.width = W;
        c.height = Hh;
        const x = c.getContext("2d");
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        const t = document.createElement("canvas");
        t.width = 288;
        t.height = 256;
        const tx = t.getContext("2d");
        tx.imageSmoothingEnabled = true;
        tx.imageSmoothingQuality = "high";
        tx.drawImage(im, sx, sy, sw, sh, 0, 0, 288, 256);
        x.drawImage(t, 0, 0, W, Hh);
        const d = x.getImageData(0, 0, W, Hh).data,
          v = [];
        for (let by = 0; by < 8; by++)
          for (let bx = 0; bx < 9; bx++) {
            let s = 0;
            for (let yy = 0; yy < 8; yy++)
              for (let xx = 0; xx < 8; xx++) {
                const p = ((by * 8 + yy) * W + bx * 8 + xx) * 4;
                s += d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
              }
            v.push(s);
          }
        let bits = "";
        for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) bits += v[y * 9 + i] > v[y * 9 + i + 1] ? "1" : "0";
        let h = "";
        for (let k = 0; k < 64; k += 4) h += parseInt(bits.slice(k, k + 4), 2).toString(16);
        ok(h);
      } catch (e) {
        ok(null);
      }
    };
    im.onerror = () => ok(null);
    im.src = typeof source === "string" ? source : URL.createObjectURL(source);
  });
}

export async function empreintesPhotos(fichiers, rogner) {
  const L = [];
  for (const f of (fichiers || []).slice(0, 8)) {
    for (const rg of rogner ? [false, true] : [false]) {
      const h = await empreintePhoto(f, rg);
      if (h && !/^0+$|^f+$/.test(h)) L.push(h);
    }
  }
  return [...new Set(L)];
}

/* Empreinte du texte (SimHash 64 bits) : deux textes presque identiques (annonce recopiée) donnent presque la même empreinte. */
export function empreinteTexte(t) {
  const mots = String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length >= 3);
  if (mots.length < 12) return null;
  const v = new Array(64).fill(0);
  const h32 = (s, g) => {
    let h = 2166136261 ^ g;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  for (let i = 0; i + 2 < mots.length; i++) {
    const s = mots[i] + " " + mots[i + 1] + " " + mots[i + 2],
      a = h32(s, 0),
      b = h32(s, 0x9e3779b9);
    for (let k = 0; k < 32; k++) {
      v[k] += (a >>> k) & 1 ? 1 : -1;
      v[32 + k] += (b >>> k) & 1 ? 1 : -1;
    }
  }
  let bits = "";
  for (let k = 0; k < 64; k++) bits += v[k] > 0 ? "1" : "0";
  let h = "";
  for (let k = 0; k < 64; k += 4) h += parseInt(bits.slice(k, k + 4), 2).toString(16);
  return h;
}

/* Détecte la zone « photo » d'une capture d'écran : là où les couleurs sont variées
   (une photo), contrairement au texte et aux boutons (deux ou trois couleurs). */
export function detecterPhoto(source) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      try {
        const W = 180,
          H = Math.max(1, Math.min(480, Math.round((im.height * W) / im.width)));
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const x = c.getContext("2d");
        x.drawImage(im, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H).data;
        const q = (p) => ((d[p] >> 5) << 6) | ((d[p + 1] >> 5) << 3) | (d[p + 2] >> 5);
        const riche = [];
        for (let y = 0; y < H; y++) {
          const s = new Set();
          for (let i = 0; i < W; i++) s.add(q((y * W + i) * 4));
          riche.push(s.size);
        }
        let best = [0, -1],
          deb = -1,
          trou = 0;
        for (let y = 0; y <= H; y++) {
          const photo = y < H && riche[y] >= 20;
          if (photo) {
            if (deb < 0) deb = y;
            trou = 0;
          } else if (deb >= 0) {
            trou++;
            if (trou > 3 || y === H) {
              const fin = y - trou;
              if (fin - deb > best[1] - best[0]) best = [deb, fin];
              deb = -1;
              trou = 0;
            }
          }
        }
        const [y0, y1] = best;
        if (y1 - y0 < Math.max(30, H * 0.18)) {
          ok(null);
          return;
        }
        const col = (i) => {
          const s = new Set();
          for (let y = y0; y <= y1; y++) s.add(q((y * W + i) * 4));
          return s.size;
        };
        let x0 = 0,
          x1 = W - 1;
        while (x0 < x1 && col(x0) < 12) x0++;
        while (x1 > x0 && col(x1) < 12) x1--;
        if (x1 - x0 < W * 0.4) {
          ok(null);
          return;
        }
        const k = im.width / W,
          o = document.createElement("canvas");
        o.width = Math.max(1, Math.round((x1 - x0 + 1) * k));
        o.height = Math.max(1, Math.round((y1 - y0 + 1) * k));
        o.getContext("2d").drawImage(im, x0 * k, y0 * k, o.width, o.height, 0, 0, o.width, o.height);
        ok(o.toDataURL("image/jpeg", 0.9));
      } catch (e) {
        ok(null);
      }
    };
    im.onerror = () => ok(null);
    im.src = typeof source === "string" ? source : URL.createObjectURL(source);
  });
}

/* Empreintes des captures : la photo détectée (entière et recadrée) et la capture entière. */
export async function empreintesCaptures(fichiers) {
  const L = [];
  etat.fiche.zonePhoto = null;
  for (const f of (fichiers || []).slice(0, 4)) {
    const z = await detecterPhoto(f);
    if (z) {
      if (!etat.fiche.zonePhoto) etat.fiche.zonePhoto = z;
      for (const rg of [false, true]) {
        const h = await empreintePhoto(z, rg);
        if (h && !/^0+$|^f+$/.test(h)) L.push(h);
      }
    }
    const h = await empreintePhoto(f);
    if (h && !/^0+$|^f+$/.test(h)) L.push(h);
  }
  return [...new Set(L)];
}
