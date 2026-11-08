// Called by the browser after the gateway popup closes. The browser's word is never trusted:
// we re-ask the provider and settle in the database. The webhook does the same, so whichever lands first wins.
import { adminClient, confirmAndSettle, corsHeaders, json } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const db = adminClient();
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await db.auth.getUser(token);
    if (uErr || !u?.user) return json(req, { error: "Not signed in" }, 401);

    const { reference } = await req.json();
    if (typeof reference !== "string" || reference.length > 80) return json(req, { error: "Bad reference" }, 400);

    const { data: intent } = await db.from("payment_intents").select("user_id").eq("reference", reference).maybeSingle();
    if (!intent || intent.user_id !== u.user.id) return json(req, { error: "Unknown payment" }, 404);

    const result = await confirmAndSettle(db, reference);
    return json(req, result);
  } catch (e) {
    console.error("payment-verify", e);
    return json(req, { error: "Verification failed, please retry" }, 502);
  }
});
