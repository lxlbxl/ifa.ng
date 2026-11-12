import { createHmac, timingSafeEqual as nodeTimingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import { asService, HttpError, type Services } from "./context.js";
import { createMeetLink } from "./meet.js";

/**
 * Payments. The browser says WHAT it is paying for, never HOW MUCH: the amount
 * is computed in the database (create_payment_intent). Money only moves after
 * we ask the provider ourselves whether the reference was paid
 * (verifyWithProvider), whether that check was triggered by the browser
 * returning from checkout or by the provider's webhook. Settlement is
 * idempotent, so whichever arrives first wins and the other is a no-op.
 */

export type Gateway = "paystack" | "flutterwave";

export type Verified =
  /** amount: what counts towards our price; fee/charged: the processing fee the client paid on top. */
  | { state: "paid"; amount: number; currency: string; txId: string; fee?: number; charged?: number }
  | { state: "pending" }
  | { state: "failed"; reason: string };

export function timingSafeEqual(a: string, b: string): boolean {
  const ea = Buffer.from(a), eb = Buffer.from(b);
  return ea.length === eb.length && nodeTimingSafeEqual(ea, eb);
}

export const hmacSha512Hex = (secret: string, body: string) => createHmac("sha512", secret).update(body).digest("hex");

export interface InitRequest {
  gateway: Gateway;
  kind: "session" | "wallet_topup" | "ebo";
  amount?: number;
  ebo_id?: string;
  /** Ebo only: will the client join the ritual live ('present') or not ('absent'). */
  attendance?: "present" | "absent";
  babalawo_user_id?: string;
  session_date?: string;
  start_time?: string;
  is_instant?: boolean;
  /** Session or Ebo: take what the wallet holds first, charge only the rest by card. */
  use_wallet?: boolean;
}

export async function initPayment(svc: Services, userId: string, b: Partial<InitRequest>) {
  if (b.gateway !== "paystack" && b.gateway !== "flutterwave") throw new HttpError(400, "Unsupported gateway");
  if (b.kind !== "session" && b.kind !== "wallet_topup" && b.kind !== "ebo") throw new HttpError(400, "Bad kind");
  const publicKey = b.gateway === "paystack" ? svc.config.PAYSTACK_PUBLIC_KEY : svc.config.FLW_PUBLIC_KEY;
  if (!publicKey) throw new HttpError(503, `${b.gateway} is not configured`);
  const uuid = /^[0-9a-f-]{36}$/i;
  if (b.kind === "session" && (typeof b.babalawo_user_id !== "string" || !uuid.test(b.babalawo_user_id))) {
    throw new HttpError(400, "Choose a Babalawo");
  }
  if (b.kind === "ebo") {
    if (typeof b.ebo_id !== "string" || !uuid.test(b.ebo_id)) throw new HttpError(400, "Choose an Ebo");
    if (b.attendance !== "present" && b.attendance !== "absent") throw new HttpError(400, "Choose whether you will join the ritual");
  }

  try {
    return await asService(svc, async (trx) => {
      const r = await sql<{ reference: string; amount: string; wallet_amount: string; total: string }>`
        select * from public.create_payment_intent(
          ${userId}::uuid, ${b.kind}, ${b.gateway},
          ${b.kind === "wallet_topup" ? Number(b.amount) : null}::numeric,
          ${b.babalawo_user_id ?? null}::uuid, ${b.session_date ?? null}::date,
          ${b.start_time ?? null}::text, ${!!b.is_instant},
          ${b.kind === "ebo" ? b.ebo_id! : null}::uuid, ${b.kind === "ebo" ? b.attendance! : null}::text, ${b.use_wallet === true})`.execute(trx);
      const who = await sql<{ email: string; full_name: string | null }>`
        select u.email, p.full_name from auth.users u left join public.profiles p on p.id = u.id
         where u.id = ${userId}::uuid`.execute(trx);
      return {
        reference: r.rows[0].reference, amount: Number(r.rows[0].amount), currency: "NGN", gateway: b.gateway,
        wallet_amount: Number(r.rows[0].wallet_amount), total: Number(r.rows[0].total),
        public_key: publicKey, email: who.rows[0]?.email ?? null, name: who.rows[0]?.full_name ?? null,
      };
    });
  } catch (e) {
    // Messages raised by the booking rules are meant for people ("That slot is already booked").
    const code = (e as { code?: string }).code;
    if (code === "P0001" || code === "IF001") throw new HttpError(400, (e as Error).message);
    if (code === "22P02" || code === "22007" || code === "22008") throw new HttpError(400, "Invalid date or time");
    throw e;
  }
}

/** Ask the provider (not the browser, not the webhook body) whether this reference was paid, and how much. */
export async function verifyWithProvider(svc: Services, gateway: Gateway, reference: string): Promise<Verified> {
  if (gateway === "paystack") {
    const secret = svc.config.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack secret key not configured");
    const r = await svc.fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (r.status === 404) return { state: "pending" };
    if (!r.ok) throw new Error(`Paystack verify HTTP ${r.status}`);
    const j = (await r.json()) as { status?: boolean; data?: Record<string, unknown> };
    const d = j?.data;
    if (!j?.status || !d) return { state: "pending" };
    if (d.status === "success") {
      // With "Pass fees to customers" on, amount is what the client paid (price + fee) and
      // requested_amount is our price. Either way the fee is in fees.
      const charged = Number(d.amount) / 100;
      const requested = d.requested_amount != null ? Number(d.requested_amount) / 100 : charged;
      return { state: "paid", amount: requested, currency: String(d.currency ?? "NGN"), txId: String(d.id),
               fee: d.fees != null ? Number(d.fees) / 100 : undefined, charged };
    }
    if (d.status === "failed" || d.status === "reversed") return { state: "failed", reason: String(d.gateway_response ?? d.status) };
    return { state: "pending" };
  }
  const secret = svc.config.FLW_SECRET_KEY;
  if (!secret) throw new Error("Flutterwave secret key not configured");
  const r = await svc.fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (r.status === 404) return { state: "pending" };
  if (!r.ok) throw new Error(`Flutterwave verify HTTP ${r.status}`);
  const j = (await r.json()) as { status?: string; data?: Record<string, unknown> };
  const d = j?.data;
  if (j?.status !== "success" || !d) return { state: "pending" };
  if (d.status === "successful") {
    // With "charge my customers" on, charged_amount is price + fee and amount is our price.
    return { state: "paid", amount: Number(d.amount), currency: String(d.currency ?? "NGN"), txId: String(d.id),
             fee: d.app_fee != null ? Number(d.app_fee) : undefined,
             charged: d.charged_amount != null ? Number(d.charged_amount) : undefined };
  }
  if (d.status === "failed") return { state: "failed", reason: String(d.processor_response ?? "failed") };
  return { state: "pending" };
}

export type SettleResult = {
  status: string; kind?: string; session_id?: number | string | null; ebo_id?: string | null; user_id?: string; reason?: string;
};

/** Verify with the provider, then settle in the database. Safe to call any number of times. */
export async function confirmAndSettle(svc: Services, reference: string): Promise<SettleResult> {
  const intent = (await asService(svc, (trx) => sql<{ gateway: Gateway; status: string; kind: string; session_id: string | null; user_id: string }>`
    select gateway, status, kind, session_id::text, user_id from public.payment_intents where reference = ${reference}`.execute(trx))).rows[0];
  if (!intent) return { status: "unknown_reference" };
  if (intent.status === "succeeded") {
    return { status: "already_settled", kind: intent.kind, session_id: intent.session_id, user_id: intent.user_id };
  }

  const v = await verifyWithProvider(svc, intent.gateway, reference);
  if (v.state === "pending") return { status: "pending" };
  if (v.state === "failed") {
    await asService(svc, (trx) => sql`select public.fail_payment_intent(${reference}, ${v.reason})`.execute(trx));
    return { status: "failed", reason: v.reason };
  }
  const settled = (await asService(svc, (trx) => sql<{ r: SettleResult }>`
    select public.settle_payment_intent(${reference}, ${v.amount}, ${v.currency}, ${v.txId}) r`.execute(trx))).rows[0].r;
  if (v.fee !== undefined || v.charged !== undefined) {
    // For the books only: a failure here must not undo or hide a settled payment.
    await asService(svc, (trx) => sql`select public.record_provider_fee(${reference}, ${v.fee ?? null}::numeric, ${v.charged ?? null}::numeric)`.execute(trx))
      .catch((e) => console.warn(`recording the provider fee for ${reference} failed:`, (e as Error).message));
  }
  // A paid session, or the live ritual session of a paid Ebo, gets its Meet link now.
  if (settled.status === "settled" && (settled.kind === "session" || settled.kind === "ebo") && settled.session_id) {
    // Best effort: the client can retry from the session page if Google is slow.
    await createMeetLink(svc, { kind: "service" }, String(settled.session_id))
      .catch((e) => console.warn(`meet link for session ${settled.session_id} failed:`, (e as Error).message));
  }
  return settled;
}

export async function verifyForUser(svc: Services, userId: string, reference: unknown) {
  if (typeof reference !== "string" || reference.length > 80) throw new HttpError(400, "Bad reference");
  const owner = (await asService(svc, (trx) => sql<{ user_id: string }>`
    select user_id from public.payment_intents where reference = ${reference}`.execute(trx))).rows[0];
  if (!owner || owner.user_id !== userId) throw new HttpError(404, "Unknown payment");
  try {
    return await confirmAndSettle(svc, reference);
  } catch (e) {
    console.error("payment verify", e);
    throw new HttpError(502, "Verification failed, please retry");
  }
}

async function audit(svc: Services, event: string, data: Record<string, unknown>) {
  await asService(svc, (trx) => sql`select public.log_payment_audit(null, ${event}, ${JSON.stringify(data)}::jsonb)`.execute(trx));
}

/** Returns the HTTP status to answer the provider with. 5xx makes the provider retry. */
export async function handlePaystackWebhook(svc: Services, raw: string, signature: string): Promise<number> {
  const secret = svc.config.PAYSTACK_SECRET_KEY;
  if (!secret) return 500;
  if (!timingSafeEqual(hmacSha512Hex(secret, raw), signature)) return 401;
  try {
    const evt = JSON.parse(raw);
    const ref = evt?.data?.reference;
    if (evt?.event === "charge.success" && typeof ref === "string") {
      const r = await confirmAndSettle(svc, ref);
      await audit(svc, "webhook_paystack", { reference: ref, result: r.status });
      if (r.status === "amount_mismatch") console.error("PAYSTACK AMOUNT MISMATCH", ref);
    }
    return 200;
  } catch (e) {
    console.error("webhook paystack", e);
    return 500;
  }
}

export async function handleFlutterwaveWebhook(svc: Services, raw: string, verifHash: string): Promise<number> {
  const secretHash = svc.config.FLW_SECRET_HASH;
  if (!secretHash) return 500;
  if (!timingSafeEqual(verifHash, secretHash)) return 401;
  try {
    const evt = JSON.parse(raw);
    const ref = evt?.data?.tx_ref;
    if (evt?.event === "charge.completed" && typeof ref === "string") {
      const r = await confirmAndSettle(svc, ref);
      await audit(svc, "webhook_flutterwave", { reference: ref, result: r.status });
      if (r.status === "amount_mismatch") console.error("FLUTTERWAVE AMOUNT MISMATCH", ref);
    }
    return 200;
  } catch (e) {
    console.error("webhook flutterwave", e);
    return 500;
  }
}
