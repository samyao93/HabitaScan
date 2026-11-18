// Recherche d'annonces de logement récentes sur le web, pour l'écran « Trouver un logement ».
// Fournisseur principal : Tavily (1 000 crédits gratuits par mois, sans carte ; 1 crédit par requête « basic »).
// Repli : Brave Search API, si seul le secret BRAVE_API_KEY est configuré.
// Secrets Supabase (Edge Functions > Secrets) : TAVILY_API_KEY (ou BRAVE_API_KEY). Les clés restent sur le serveur.
// L'app reçoit seulement le titre, le lien et l'extrait publics de chaque résultat ; elle fait le tri elle-même.
// Les pages des sites ne sont jamais téléchargées : seuls les résultats du moteur de recherche sont utilisés.

import { createClient } from "npm:@supabase/supabase-js@2";

// Quota anti-abus par utilisateur et par jour (table quotas, fonction consommer_quota).
async function quotaOk(req: Request, fonction: string): Promise<boolean> {
  const cle = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, cle, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc("consommer_quota", { p_fonction: fonction });
  return !error && data === true;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SITES = ["kijiji.ca", "centris.ca", "realtor.ca", "duproprio.com", "rentals.ca", "louer.ca", "kangalou.com",
  "logisquebec.com", "padmapper.com", "lespac.com", "zumper.com", "craigslist.org"];
const VILLE = /^[\p{L} .'-]{2,40}$/u;

type Resultat = { titre: string; url: string; extrait: string; age: string };
const propre = (s: unknown, n: number) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

async function tavily(q: string, cle: string): Promise<Resultat[]> {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cle}` },
    body: JSON.stringify({
      query: q,
      search_depth: "basic",
      max_results: 20,
      time_range: "month",
      include_domains: SITES,
      country: "canada",
    }),
  });
  if (!r.ok) throw new Error("tavily " + r.status);
  const d = await r.json();
  return ((d && d.results) || []).map((x: Record<string, unknown>) => ({
    titre: propre(x.title, 200),
    url: String(x.url || ""),
    extrait: propre(x.content, 600),
    age: propre(x.published_date, 40),
  }));
}

async function brave(q: string, cle: string): Promise<Resultat[]> {
  const u = new URL("https://api.search.brave.com/res/v1/web/search");
  u.searchParams.set("q", q);
  u.searchParams.set("country", "CA");
  u.searchParams.set("search_lang", "fr");
  u.searchParams.set("count", "20");
  u.searchParams.set("freshness", "pm");
  const r = await fetch(u, { headers: { "Accept": "application/json", "X-Subscription-Token": cle } });
  if (!r.ok) throw new Error("brave " + r.status);
  const d = await r.json();
  return ((d.web && d.web.results) || []).map((x: Record<string, unknown>) => ({
    titre: propre(x.title, 200),
    url: String(x.url || ""),
    extrait: propre([x.description, ...((x.extra_snippets as string[]) || [])].filter(Boolean).join(" "), 600),
    age: propre(x.age, 40),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "methode" }, 405);

  const cleTavily = Deno.env.get("TAVILY_API_KEY");
  const cleBrave = Deno.env.get("BRAVE_API_KEY");
  if (!cleTavily && !cleBrave) return json({ error: "non_configure" }, 503);
  if (!(await quotaOk(req, "chercher-annonces"))) return json({ error: "quota" }, 429);

  let ville = "", ch = "";
  try {
    const b = await req.json();
    ville = String(b.ville || "");
    ch = String(b.ch || "");
  } catch {
    return json({ error: "requete" }, 400);
  }
  if (!VILLE.test(ville) || !["", "1", "2", "3"].includes(ch)) return json({ error: "parametres" }, 400);

  const taille = ch ? `${Number(ch) + 2} 1/2` : "";
  const requetes = [
    `logement à louer ${taille} ${ville}`.replace(/\s+/g, " ").trim(),
    `appartement à louer ${ch ? ch + " chambres " : ""}${ville}`.replace(/\s+/g, " ").trim(),
  ];
  const chercher = (q: string) => cleTavily ? tavily(q, cleTavily) : brave(q, cleBrave!);
  try {
    const lots = await Promise.allSettled(requetes.map(chercher));
    const ok = lots.filter((l): l is PromiseFulfilledResult<Resultat[]> => l.status === "fulfilled");
    if (!ok.length) {
      console.error("recherche échouée :", lots.map((l) => l.status === "rejected" ? String(l.reason) : "").join(" | "));
      return json({ error: "recherche" }, 502);
    }
    const vus = new Set<string>();
    const resultats = ok.flatMap((l) => l.value).filter((r) => {
      let h = "";
      try { h = new URL(r.url).hostname.replace(/^(www|m|fr|en)\./, ""); } catch { return false; }
      if (!SITES.some((s) => h === s || h.endsWith("." + s))) return false;
      const k = r.url.split(/[?#]/)[0];
      if (vus.has(k)) return false;
      vus.add(k);
      return true;
    });
    return json({ resultats, fournisseur: cleTavily ? "tavily" : "brave" });
  } catch (e) {
    console.error("recherche :", String(e));
    return json({ error: "recherche" }, 502);
  }
});
