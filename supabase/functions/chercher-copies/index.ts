// Cherche sur les sites d'annonces d'autres copies d'une annonce, à partir d'une phrase distinctive de son texte.
// Retrouve une annonce recopiée ailleurs même si personne ne l'a encore vérifiée dans HabitaScan.
// Fournisseur : Tavily (secret TAVILY_API_KEY), même quota que « Trouver un logement ». 1 à 3 crédits par recherche.
// La phrase n'est ni enregistrée ni journalisée. Seuls le titre, le lien et l'extrait publics des résultats sont renvoyés.
import { createClient } from "npm:@supabase/supabase-js@2";

async function quotaOk(req: Request): Promise<boolean> {
  const cle = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, cle, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc("consommer_quota", { p_fonction: "chercher-annonces" });
  return !error && data === true;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SITES = ["kijiji.ca", "centris.ca", "realtor.ca", "duproprio.com", "rentals.ca", "louer.ca", "kangalou.com",
  "logisquebec.com", "padmapper.com", "lespac.com", "zumper.com", "craigslist.org", "liv.rent"];
const propre = (s: unknown, n: number) => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "methode" }, 405);
  const cle = Deno.env.get("TAVILY_API_KEY");
  if (!cle) return json({ error: "non_configure" }, 503);

  let phrase = "";
  try {
    const b = await req.json();
    phrase = propre(b.phrase, 220).replace(/["“”«»]/g, "");
  } catch {
    return json({ error: "requete" }, 400);
  }
  if (phrase.length < 25 || phrase.split(" ").length < 6) return json({ error: "phrase" }, 400);
  if (!(await quotaOk(req))) return json({ error: "quota" }, 429);

  // 1) phrase exacte (recherche simple, 1 crédit) ; 2) si rien, recherche avancée sans ponctuation (2 crédits).
  //    On ne garde que les pages qui contiennent vraiment le même texte (évite les annonces simplement semblables).
  const chercher = async (q: string, profondeur: string) => {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cle}` },
      body: JSON.stringify({ query: q, search_depth: profondeur, max_results: 10, include_domains: SITES }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!r || !r.ok) return null;
    const d = await r.json();
    return (d && d.results) || [];
  };
  // Texte recopié : au moins la moitié des suites de 3 mots consécutifs de la phrase se retrouvent dans la page.
  const norm = (t: string) => " " + String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim() + " ";
  const mots = norm(phrase).trim().split(" ");
  const suites: string[] = [];
  for (let i = 0; i + 2 < mots.length; i++) suites.push(" " + mots.slice(i, i + 3).join(" ") + " ");
  const proche = (x: Record<string, unknown>) => {
    const t = norm(`${x.title || ""} ${x.content || ""}`);
    return suites.length > 0 && suites.filter((s) => t.includes(s)).length / suites.length >= 0.5;
  };
  let bruts = await chercher(`"${phrase}"`, "basic");
  if (bruts === null) return json({ error: "recherche" }, 502);
  if (!bruts.filter(proche).length) {
    const large = phrase.replace(/[^\p{L}\p{N}\s$\/-]/gu, " ").replace(/\s+/g, " ").trim();
    bruts = (await chercher(large, "advanced")) || [];
  }
  const vus = new Set<string>();
  const resultats = bruts.filter(proche)
    .map((x: Record<string, unknown>) => ({ url: String(x.url || ""), titre: propre(x.title, 200), extrait: propre(x.content, 400) }))
    .filter((x: { url: string }) => {
      let h = "";
      try { h = new URL(x.url).hostname.replace(/^(www|m|fr|en)\./, ""); } catch { return false; }
      const k = x.url.split(/[?#]/)[0];
      if (!SITES.some((s) => h === s || h.endsWith("." + s)) || vus.has(k)) return false;
      vus.add(k);
      return true;
    });
  return json({ resultats });
});
