// Flutterwave webhook. The verif-hash header must match our secret hash; the charge is then
// re-verified with Flutterwave's API before any money moves. 5xx on transient errors so it is retried.
import { adminClient, confirmAndSettle, getSecret, timingSafeEqual } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = adminClient();
  const secretHash = await getSecret(db, "FLW_SECRET_HASH", "flutterwave_secret_hash");
  if (!secretHash) return new Response("not configured", { status: 500 });
  if (!timingSafeEqual(req.headers.get("verif-hash") ?? "", secretHash)) return new Response("invalid signature", { status: 401 });

  try {
    const evt = await req.json();
    const ref = evt?.data?.tx_ref;
    if (evt?.event === "charge.completed" && typeof ref === "string") {
      const r = await confirmAndSettle(db, ref);
      await db.rpc("log_payment_audit", { p_payment_id: null, p_event_type: "webhook_flutterwave", p_event_data: { reference: ref, result: r.status } });
      if (r.status === "amount_mismatch") console.error("FLUTTERWAVE AMOUNT MISMATCH", ref);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook-flutterwave", e);
    return new Response("retry", { status: 500 });
  }
});
