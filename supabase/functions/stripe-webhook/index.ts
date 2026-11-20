// Webhook Stripe : quand un paiement par lien Stripe est terminé, la demande de vérification passe à « payée ».
// Stripe appelle cette fonction directement (verify_jwt = false) ; la signature Stripe est vérifiée ici.
// Secret à créer : STRIPE_WEBHOOK_SECRET (commence par whsec_), fourni par Stripe à la création du webhook.
// Appel de serveur à serveur : pas d'en-têtes CORS, donc pas de module commun ici (sauf les clients et estUuid).
import { clientServeur, estUuid } from "../_shared/commun.ts";

const enc = new TextEncoder();
async function signatureValide(corps: string, entete: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(entete.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts["t"];
  const v1s = entete.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1s.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // 5 minutes de tolérance
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cle, enc.encode(`${t}.${corps}`)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Comparaison en temps constant
  return v1s.some((v) => v.length === hex.length && [...v].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("methode", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("non configure", { status: 503 });
  const corps = await req.text();
  if (!(await signatureValide(corps, req.headers.get("stripe-signature") || "", secret))) {
    return new Response("signature", { status: 400 });
  }
  const ev = JSON.parse(corps);
  if (ev.type === "checkout.session.completed" && ev.data?.object?.payment_status === "paid") {
    const s = ev.data.object;
    const id = String(s.client_reference_id || "");
    if (estUuid(id)) {
      await clientServeur().from("demandes_verif")
        .update({ statut: "payee", paye_le: new Date().toISOString(), stripe_ref: String(s.id).slice(0, 200), montant: (s.amount_total ?? 0) / 100 })
        .eq("id", id).eq("statut", "a_payer");
    }
  }
  return new Response(JSON.stringify({ recu: true }), { headers: { "Content-Type": "application/json" } });
});
