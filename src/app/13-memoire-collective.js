/* ===== Mémoire collective : numéros, courriels et photos déjà signalés par d'autres utilisateurs =====
   Les numéros et courriels sont envoyés au serveur seulement pour être comparés ; il ne les garde qu'en empreinte chiffrée,
   et seulement si la personne les signale. Les photos ne quittent jamais le téléphone : seule leur empreinte visuelle est envoyée. */
const REGLE_PAIEMENT =
  "Paie seulement par chèque ou virement au nom du propriétaire inscrit au Registre foncier. Jamais en argent comptant, par carte-cadeau, cryptomonnaie, ni à une autre personne.";
const RE_TEL = /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})\b/g,
  RE_COURRIEL = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
function extraireContacts(...textes) {
  const t = textes.filter(Boolean).join("\n"),
    tels = new Set(),
    cour = new Set();
  for (const m of t.matchAll(RE_TEL)) tels.add(m[1] + m[2] + m[3]);
  for (const m of t.matchAll(RE_COURRIEL)) cour.add(m[0].toLowerCase());
  return { tels: [...tels].slice(0, 5), courriels: [...cour].slice(0, 5) };
}
function fusionContacts(a, b) {
  a = a || {};
  b = b || {};
  const tels = [...(a.tels || []), ...(b.tels || []).map((x) => String(x).replace(/\D/g, "").slice(-10))].filter((x) =>
    /^\d{10}$/.test(x),
  );
  const cour = [...(a.courriels || []), ...(b.courriels || []).map((x) => String(x).trim().toLowerCase())].filter((x) =>
    /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x),
  );
  return { tels: [...new Set(tels)].slice(0, 5), courriels: [...new Set(cour)].slice(0, 5) };
}
/* Empreinte visuelle (dHash 64 bits) : la même photo, même redimensionnée ou recompressée, garde presque la même empreinte. */
function empreintePhoto(source, rogner) {
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
async function empreintesPhotos(fichiers, rogner) {
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
function empreinteTexte(t) {
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
async function retrouverAnnonce() {
  if (!SESSION || (!F.photos.length && !F.texteEmp)) return null;
  try {
    const { data, error } = await sb.rpc("retrouver_annonce", {
      p_photos: F.photos,
      p_texte: F.texteEmp,
      p_prix: F.prixN || null,
      p_ville: F.ville || null,
      p_lien: F.lienN || null,
    });
    return error ? null : data;
  } catch (e) {
    return null;
  }
}
function itemsRecopie(r) {
  const it = [];
  if (!r || !r.vues) return it;
  const n = +r.vues,
    rg = +r.rouges || 0;
  const pers = (x) => (x > 1 ? `${x} personnes` : "une personne");
  if ((r.autres_prix || []).length)
    it.push({
      c: "y",
      t: `<b>Les mêmes photos ou le même texte apparaissent dans une autre annonce, à un autre prix</b> (${r.autres_prix.map((p) => money(+p)).join(", ")}). Une annonce copiée avec un prix différent est un signe classique de fraude.`,
      law: "Mémoire collective HabitaScan : vérifications faites par d'autres utilisateurs, sur d'autres sites.",
    });
  if ((r.autres_villes || []).length)
    it.push({
      c: "y",
      t: `<b>Les mêmes photos ou le même texte ont été vus dans une annonce d'une autre ville</b> (${r.autres_villes.map(esc).join(", ")}). Les fraudeurs réutilisent les photos d'un logement ailleurs.`,
      law: "Mémoire collective HabitaScan.",
    });
  if (rg)
    it.push({
      c: rg >= 2 ? "r" : "y",
      t: `<b>Cette annonce a déjà été vérifiée ailleurs par ${pers(n)}, dont ${rg} avec le résultat «&nbsp;Ne paie pas&nbsp;».</b> Mêmes photos ou même texte, sur un autre lien.`,
      law: "Mémoire collective HabitaScan.",
    });
  else if (!it.length)
    it.push({
      c: "i",
      t: `<b>Cette annonce (mêmes photos ou même texte, même prix) a déjà été vue sur un autre site par ${pers(n)}.</b> C'est normal si le propriétaire la publie à plusieurs endroits : compare simplement le numéro et le nom de l'annonceur.`,
      law: "Mémoire collective HabitaScan.",
    });
  return it;
}

async function memoire(c, photos) {
  c = c || { tels: [], courriels: [] };
  if (!SESSION || (!c.tels.length && !c.courriels.length && !(photos || []).length)) return null;
  try {
    const { data, error } = await sb.rpc("memoire_collective", {
      p_tels: c.tels,
      p_courriels: c.courriels,
      p_photos: photos || [],
    });
    return error ? null : data;
  } catch (e) {
    return null;
  }
}
function itemsMemoire(m) {
  const it = [];
  if (!m) return it;
  const max = (L) => Math.max(0, ...(L || []).map(Number)),
    nt = max(m.tels),
    nc = max(m.courriels),
    np = +m.photo || 0;
  const item = (n, quoi, fem) => ({
    c: n >= SEUIL_ROUGE ? "r" : "y",
    t: `<b>${quoi} a déjà été signalé${fem ? "e" : ""} ${n} fois</b> par ${n > 1 ? "des utilisateurs" : "un utilisateur"} à l'identité confirmée.${n >= SEUIL_ROUGE ? " Ne paie rien." : " Redouble de prudence."}`,
    law: "Mémoire collective HabitaScan : chaque signalement avertit les personnes suivantes.",
  });
  if (nt) it.push(item(nt, "Ce numéro de téléphone"));
  if (nc) it.push(item(nc, "Ce courriel"));
  if (np) it.push(item(np, "Cette photo", true));
  return it;
}
const peutSignaler = (F) =>
  !!(
    F.lienN ||
    (F.contacts && (F.contacts.tels.length || F.contacts.courriels.length)) ||
    (F.photos && F.photos.length)
  );
function resumeSignal(F) {
  const c = F.contacts || { tels: [], courriels: [] },
    p = F.photos || [],
    L = [];
  if (F.lienN) L.push("le lien de l'annonce");
  if (c.tels.length) L.push(c.tels.length > 1 ? `${c.tels.length} numéros de téléphone` : "le numéro de téléphone");
  if (c.courriels.length) L.push(c.courriels.length > 1 ? `${c.courriels.length} courriels` : "le courriel");
  if (p.length) L.push(p.length > 1 ? `${p.length} photos` : "la photo");
  return L.length
    ? `<p class="lu">Ce signalement portera sur : ${L.join(", ")}. Les numéros et courriels sont gardés seulement sous forme chiffrée, jamais en clair.</p>`
    : "";
}
/* Détecte la zone « photo » d'une capture d'écran : là où les couleurs sont variées
   (une photo), contrairement au texte et aux boutons (deux ou trois couleurs). */
function detecterPhoto(source) {
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
async function empreintesCaptures(fichiers) {
  const L = [];
  F.zonePhoto = null;
  for (const f of (fichiers || []).slice(0, 4)) {
    const z = await detecterPhoto(f);
    if (z) {
      if (!F.zonePhoto) F.zonePhoto = z;
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
async function chercherCopies() {
  if (!SESSION || !CFG.recherche) return null;
  const t = F.annonce && F.annonce.length > 80 ? F.annonce : F.ocrTxt || F.annonce || "";
  const phrase = phraseDistinctive(t);
  if (!phrase) return null;
  try {
    const { data, error } = await sb.functions.invoke("chercher-copies", { body: { phrase } });
    return error || !data || data.error ? null : data;
  } catch (e) {
    return null;
  }
}
function itemsCopiesWeb(F) {
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
