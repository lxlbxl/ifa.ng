// Paystack webhook. Signature (HMAC-SHA512 of the raw body) is checked, then the charge is
// re-verified directly with Paystack before any money moves. Responds 5xx on transient errors so Paystack retries.
import { adminClient, confirmAndSettle, getSecret, hmacSha512Hex, timingSafeEqual } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = adminClient();
  const raw = await req.text();
  const secret = await getSecret(db, "PAYSTACK_SECRET_KEY", "paystack_secret_key");
  if (!secret) return new Response("not configured", { status: 500 });

  const sig = req.headers.get("x-paystack-signature") ?? "";
  if (!timingSafeEqual(await hmacSha512Hex(secret, raw), sig)) return new Response("invalid signature", { status: 401 });

  try {
    const evt = JSON.parse(raw);
    const ref = evt?.data?.reference;
    if (evt?.event === "charge.success" && typeof ref === "string") {
      const r = await confirmAndSettle(db, ref);
      await db.rpc("log_payment_audit", { p_payment_id: null, p_event_type: "webhook_paystack", p_event_data: { reference: ref, result: r.status } });
      if (r.status === "amount_mismatch") console.error("PAYSTACK AMOUNT MISMATCH", ref);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("webhook-paystack", e);
    return new Response("retry", { status: 500 });
  }
});
