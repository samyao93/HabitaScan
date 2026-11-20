// Code commun aux fonctions de HabitaScan : en-têtes CORS, réponses JSON, quota quotidien, nettoyage de texte.
// Importé par chaque fonction avec : import { ... } from "../_shared/commun.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Origines autorisées à appeler les fonctions depuis un navigateur :
// le site, ses aperçus Vercel, l'app native (Android : https://localhost, iOS : capacitor://localhost) et le développement local.
const ORIGINES = [
  /^https:\/\/habitascan\.vercel\.app$/,
  /^https:\/\/habitascan-[a-z0-9-]+\.vercel\.app$/,
  /^https:\/\/localhost$/,
  /^capacitor:\/\/localhost$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];
const ORIGINE_PAR_DEFAUT = "https://habitascan.vercel.app";

export function enTetesCors(req: Request): Record<string, string> {
  const origine = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.some((o) => o.test(origine)) ? origine : ORIGINE_PAR_DEFAUT,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/** Réponse JSON avec les en-têtes CORS. */
export function json(req: Request, corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...enTetesCors(req), "Content-Type": "application/json" },
  });
}

/**
 * Traite les cas communs à toutes les fonctions appelées par l'app :
 * la requête préliminaire du navigateur (OPTIONS) et toute méthode autre que POST.
 * Renvoie une réponse à retourner telle quelle, ou null si la requête peut être traitée.
 */
export function avantTraitement(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: enTetesCors(req) });
  if (req.method !== "POST") return json(req, { error: "methode" }, 405);
  return null;
}

/** Client Supabase qui agit au nom de la personne connectée (ses droits, pas ceux du serveur). */
export function clientUtilisateur(req: Request) {
  const cle = Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "";
  return createClient(Deno.env.get("SUPABASE_URL")!, cle, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
}

/** Client Supabase avec tous les droits (clé service_role, fournie par Supabase, jamais envoyée à l'app). */
export function clientServeur() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Quota anti-abus par personne et par jour (table quotas, fonction consommer_quota). */
export async function quotaOk(req: Request, fonction: string): Promise<boolean> {
  const { data, error } = await clientUtilisateur(req).rpc("consommer_quota", { p_fonction: fonction });
  return !error && data === true;
}

/** Texte venu d'un service externe : sans balises HTML, espaces normalisés, longueur limitée. */
export const propre = (s: unknown, n: number) =>
  String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, n);

/** Identifiant de compte ou de demande (UUID). */
export const estUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
