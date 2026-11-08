// Creates a payment intent. The amount is computed in the database from the babalawo's price;
// the browser only says WHAT it wants to pay for, never HOW MUCH.
import { adminClient, corsHeaders, getSecret, json, Gateway } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  try {
    const db = adminClient();
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u, error: uErr } = await db.auth.getUser(token);
    if (uErr || !u?.user) return json(req, { error: "Not signed in" }, 401);

    const b = await req.json();
    const gateway: Gateway = b.gateway;
    if (gateway !== "paystack" && gateway !== "flutterwave") return json(req, { error: "Unsupported gateway" }, 400);
    if (b.kind !== "session" && b.kind !== "wallet_topup") return json(req, { error: "Bad kind" }, 400);

    const publicKey = gateway === "paystack"
      ? await getSecret(db, "PAYSTACK_PUBLIC_KEY", "paystack_public_key")
      : await getSecret(db, "FLW_PUBLIC_KEY", "flutterwave_public_key");
    if (!publicKey) return json(req, { error: `${gateway} is not configured` }, 503);

    const { data, error } = await db.rpc("create_payment_intent", {
      p_user: u.user.id, p_kind: b.kind, p_gateway: gateway,
      p_amount: b.kind === "wallet_topup" ? Number(b.amount) : null,
      p_babalawo_user_id: b.babalawo_user_id ?? null,
      p_session_date: b.session_date ?? null,
      p_start_time: b.start_time ?? null,
      p_is_instant: !!b.is_instant,
    });
    if (error) return json(req, { error: error.message }, 400);
    const row = Array.isArray(data) ? data[0] : data;

    const { data: prof } = await db.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
    return json(req, {
      reference: row.reference, amount: Number(row.amount), currency: "NGN", gateway,
      public_key: publicKey, email: u.user.email, name: prof?.full_name ?? null,
    });
  } catch (e) {
    console.error("payment-init", e);
    return json(req, { error: "Could not start payment" }, 500);
  }
});
