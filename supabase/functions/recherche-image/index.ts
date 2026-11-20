// Recherche d'image inversée : les photos de l'annonce sont-elles publiées ailleurs sur le web ?
// Utilise Google Cloud Vision (détection web). La clé reste sur le serveur, jamais dans l'app.
// Déploiement : voir LISEZ-MOI (secret GOOGLE_VISION_KEY).
// L'image n'est ni enregistrée ni journalisée : elle est envoyée à Google Vision puis oubliée.
// Renvoie aussi le titre de chaque page (souvent avec le prix) pour repérer une annonce copiée à un autre prix.

import { avantTraitement, json, quotaOk } from "../_shared/commun.ts";

const MAX_BASE64 = 6_000_000; // environ 4,5 Mo d'image

Deno.serve(async (req) => {
  const refus = avantTraitement(req);
  if (refus) return refus;

  const cle = Deno.env.get("GOOGLE_VISION_KEY");
  if (!cle) return json(req, { error: "non_configure" }, 503);
  if (!(await quotaOk(req, "recherche-image"))) return json(req, { error: "quota" }, 429);

  let image = "";
  try {
    ({ image } = await req.json());
  } catch {
    return json(req, { error: "requete" }, 400);
  }
  if (typeof image !== "string" || !image || image.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return json(req, { error: "image" }, 400);
  }

  const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(cle)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: image }, features: [{ type: "WEB_DETECTION", maxResults: 10 }] }],
    }),
  });
  if (!r.ok) return json(req, { error: "vision", status: r.status }, 502);
  const data = await r.json();
  const web = data?.responses?.[0]?.webDetection ?? {};
  const vus = new Set<string>();
  const details = (web.pagesWithMatchingImages ?? [])
    .filter((p: { url?: string }) => typeof p.url === "string" && /^https?:\/\//.test(p.url) && !vus.has(p.url) && vus.add(p.url))
    .slice(0, 10)
    .map((p: { url: string; pageTitle?: string }) => ({
      url: p.url,
      titre: String(p.pageTitle || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200),
    }));
  // « pages » reste pour les anciennes versions de l'app.
  return json(req, { pages: details.map((d: { url: string }) => d.url), details });
});
