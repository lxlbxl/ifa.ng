import { sql } from "kysely";
import { asService, type Services } from "./context.js";
import { hmacSha512Hex, timingSafeEqual } from "./payments.js";

/**
 * Automated payouts (migration 20261125000000_payout_transfers.sql). An approved withdrawal becomes
 * one transfer per provider part, and each is sent through the provider that received that money.
 *
 * Safety rules:
 * - The reference is ours, unique and reused on every attempt, so the provider refuses a second
 *   transfer with it. A new reference is only made when an admin retries a transfer the provider
 *   has said is finished (failed).
 * - Any unclear answer (timeout, 5xx, unreadable body) leaves the transfer 'pending'. The check job
 *   then asks the provider; only "never heard of it" sends it again, with the same reference.
 * - Webhooks are never trusted on their own: they only make us ask the provider again.
 */

type Transfer = {
  id: string; withdrawal_id: string; babalawo_id: string; provider: "paystack" | "flutterwave";
  amount: string; reference: string; status: string; provider_transfer_id: string | null;
};
type Account = {
  account_number: string; account_name: string; paystack_bank_code: string | null;
  flutterwave_bank_code: string | null; paystack_recipient_code: string | null;
};
/** What a provider says about one transfer, in the words _payout_transfer_update takes. */
export type Outcome = {
  status: "pending" | "success" | "failed" | "reversed" | "not_found";
  providerId?: string | null; fee?: number | null; reason?: string | null;
};

const kobo = (naira: string | number) => Math.round(Number(naira) * 100);
const isDuplicate = (msg: string) => /duplicate|already (exists|been used)|reference.*(exists|used)/i.test(msg);

async function readJson(r: Response): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return (await r.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function recordOutcome(svc: Services, reference: string, o: Outcome): Promise<string> {
  const r = await asService(svc, (trx) => sql<{ r: string }>`
    select public._payout_transfer_update(${reference}, ${o.status}, ${o.providerId ?? null}, ${o.fee ?? null}, ${o.reason ?? null}) r`
    .execute(trx));
  return r.rows[0]?.r ?? "unknown";
}

// ------------------------------------------------------------------ Paystack

function paystackStatus(s: string | undefined): Outcome["status"] {
  switch (s) {
    case "success": return "success";
    case "reversed": return "reversed";
    case "failed": case "abandoned": case "blocked": case "rejected": return "failed";
    default: return "pending"; // pending, received, otp, queued, processing
  }
}

function paystackOutcome(d: Record<string, any> | undefined): Outcome { // eslint-disable-line @typescript-eslint/no-explicit-any
  const status = paystackStatus(d?.status);
  const reason = d?.status === "otp"
    ? "Paystack is waiting for an OTP: switch off transfer OTP in Paystack, then finish this one on the Paystack dashboard"
    : status === "failed" || status === "reversed" ? (d?.reason || d?.gateway_response || `Paystack says ${d?.status}`) : null;
  return {
    status, reason,
    providerId: d?.transfer_code ?? (d?.id != null ? String(d.id) : null),
    fee: typeof d?.fee_charged === "number" ? d.fee_charged / 100 : null,
  };
}

async function paystackRecipientFor(svc: Services, t: Transfer, a: Account): Promise<string> {
  if (a.paystack_recipient_code) return a.paystack_recipient_code;
  const r = await svc.fetch("https://api.paystack.co/transferrecipient", {
    method: "POST", headers: { Authorization: `Bearer ${svc.config.PAYSTACK_SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ type: "nuban", name: a.account_name, account_number: a.account_number, bank_code: a.paystack_bank_code, currency: "NGN" }),
  });
  const j = await readJson(r);
  const code = r.ok && j.status ? j.data?.recipient_code : null;
  if (!code) throw Object.assign(new Error(j.message || `Paystack recipient HTTP ${r.status}`), { definite: r.status >= 400 && r.status < 500 });
  await asService(svc, (trx) => sql`update public.babalawo_bank_details set paystack_recipient_code = ${code}
    where babalawo_id = ${t.babalawo_id}::uuid and account_number = ${a.account_number}`.execute(trx));
  return code;
}

async function sendPaystack(svc: Services, t: Transfer, a: Account): Promise<Outcome> {
  let recipient: string;
  try {
    recipient = await paystackRecipientFor(svc, t, a);
  } catch (e) {
    // Nothing was sent: a refused recipient fails the transfer, anything else tries again later.
    if ((e as { definite?: boolean }).definite) return { status: "failed", reason: `Paystack refused the account: ${(e as Error).message}` };
    return { status: "not_found", reason: (e as Error).message };
  }
  const r = await svc.fetch("https://api.paystack.co/transfer", {
    method: "POST", headers: { Authorization: `Bearer ${svc.config.PAYSTACK_SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ source: "balance", amount: kobo(t.amount), recipient, reference: t.reference, currency: "NGN",
      reason: "IFA.ng earnings" }),
  });
  const j = await readJson(r);
  if (r.ok && j.status) return paystackOutcome(j.data);
  const msg = String(j.message || `HTTP ${r.status}`);
  if (r.status >= 400 && r.status < 500 && !isDuplicate(msg)) return { status: "failed", reason: `Paystack: ${msg}` };
  return { status: "pending" }; // unclear: the check job asks Paystack
}

async function verifyPaystack(svc: Services, t: Transfer): Promise<Outcome | null> {
  const r = await svc.fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(t.reference)}`,
    { headers: { Authorization: `Bearer ${svc.config.PAYSTACK_SECRET_KEY}` } });
  const j = await readJson(r);
  if (r.ok && j.status && j.data) return paystackOutcome(j.data);
  if (r.status === 404 || (r.status === 400 && /not found/i.test(String(j.message)))) return { status: "not_found" };
  return null; // no clear answer: ask again later
}

// ------------------------------------------------------------------ Flutterwave

function flutterwaveOutcome(d: Record<string, any> | undefined): Outcome { // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = String(d?.status ?? "").toUpperCase();
  const status: Outcome["status"] = s === "SUCCESSFUL" ? "success" : s === "FAILED" ? "failed" : "pending";
  return {
    status, providerId: d?.id != null ? String(d.id) : null,
    fee: d?.fee != null && !Number.isNaN(Number(d.fee)) ? Number(d.fee) : null,
    reason: status === "failed" ? (d?.complete_message || "Flutterwave says the transfer failed") : null,
  };
}

async function sendFlutterwave(svc: Services, t: Transfer, a: Account): Promise<Outcome> {
  const r = await svc.fetch("https://api.flutterwave.com/v3/transfers", {
    method: "POST", headers: { Authorization: `Bearer ${svc.config.FLW_SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ account_bank: a.flutterwave_bank_code, account_number: a.account_number, amount: Number(t.amount),
      currency: "NGN", debit_currency: "NGN", reference: t.reference, narration: "IFA.ng earnings" }),
  });
  const j = await readJson(r);
  if (r.ok && j.status === "success") return flutterwaveOutcome(j.data);
  const msg = String(j.message || `HTTP ${r.status}`);
  if (r.status >= 400 && r.status < 500 && !isDuplicate(msg)) return { status: "failed", reason: `Flutterwave: ${msg}` };
  return { status: "pending" };
}

async function verifyFlutterwave(svc: Services, t: Transfer): Promise<Outcome | null> {
  const headers = { Authorization: `Bearer ${svc.config.FLW_SECRET_KEY}` };
  if (t.provider_transfer_id) {
    const r = await svc.fetch(`https://api.flutterwave.com/v3/transfers/${encodeURIComponent(t.provider_transfer_id)}`, { headers });
    const j = await readJson(r);
    if (r.ok && j.status === "success" && j.data?.reference === t.reference) return flutterwaveOutcome(j.data);
    return null;
  }
  const r = await svc.fetch(`https://api.flutterwave.com/v3/transfers?reference=${encodeURIComponent(t.reference)}`, { headers });
  const j = await readJson(r);
  if (!r.ok || j.status !== "success" || !Array.isArray(j.data)) return null;
  const hit = j.data.find((d: { reference?: string }) => d?.reference === t.reference);
  return hit ? flutterwaveOutcome(hit) : j.data.length === 0 ? { status: "not_found" } : null;
}

// ------------------------------------------------------------------ jobs

const hasKey = (svc: Services, p: Transfer["provider"]) =>
  p === "paystack" ? !!svc.config.PAYSTACK_SECRET_KEY : !!svc.config.FLW_SECRET_KEY;

/** Send the transfers that are due. Run every minute. */
export async function sendDuePayouts(svc: Services, limit = 10) {
  const claimed = await asService(svc, (trx) =>
    sql<Transfer>`select * from public._claim_payout_transfers(${limit})`.execute(trx));
  let sent = 0, failed = 0;
  for (const t of claimed.rows) {
    let o: Outcome;
    try {
      if (!hasKey(svc, t.provider)) {
        o = { status: "not_found", reason: "no key" };
      } else {
        const acct = await asService(svc, (trx) => sql<Account>`
          select account_number, account_name, paystack_bank_code, flutterwave_bank_code, paystack_recipient_code
            from public.babalawo_bank_details where babalawo_id = ${t.babalawo_id}::uuid`.execute(trx));
        const a = acct.rows[0];
        o = !a ? { status: "failed", reason: "No payout account" }
          : t.provider === "paystack" ? await sendPaystack(svc, t, a) : await sendFlutterwave(svc, t, a);
      }
    } catch (e) {
      // Network error mid-request: the provider may or may not have it. Let the check job ask.
      console.warn(`[payouts] ${t.provider} send ${t.reference} unclear:`, (e as Error).message);
      o = { status: "pending" };
    }
    if (o.status === "not_found") {
      // Never reached the provider: back in the queue, with the reason shown to admins.
      await asService(svc, (trx) => sql`update public.payout_transfers set status = 'queued',
        hold_reason = ${o.reason === "no key" ? `${t.provider === "paystack" ? "Paystack" : "Flutterwave"} keys are not set up` : "Couldn't reach the provider; trying again"}
        where id = ${t.id}::uuid and status = 'sending'`.execute(trx));
      continue;
    }
    const r = await recordOutcome(svc, t.reference, o);
    if (r === "failed") failed++; else sent++;
  }
  return { sent, failed };
}

/** Ask the providers about transfers still on their way. Run every few minutes. */
export async function checkPendingPayouts(svc: Services, limit = 25) {
  const due = await asService(svc, (trx) => sql<Transfer>`
    select * from public.payout_transfers
     where status in ('sending', 'pending') and coalesce(last_checked_at, sent_at, created_at) < now() - interval '2 minutes'
     order by coalesce(last_checked_at, sent_at, created_at) limit ${limit}`.execute(trx));
  let checked = 0;
  for (const t of due.rows) {
    if (!hasKey(svc, t.provider)) continue;
    try {
      const o = t.provider === "paystack" ? await verifyPaystack(svc, t) : await verifyFlutterwave(svc, t);
      if (o) await recordOutcome(svc, t.reference, o);
      else await asService(svc, (trx) => sql`update public.payout_transfers set last_checked_at = now() where id = ${t.id}::uuid`.execute(trx));
      checked++;
    } catch (e) {
      console.warn(`[payouts] ${t.provider} check ${t.reference} failed:`, (e as Error).message);
    }
  }
  return { checked };
}

/** A transfer webhook names a reference: ask the provider, and record what it says. */
export async function confirmTransfer(svc: Services, provider: Transfer["provider"], reference: string): Promise<string> {
  const r = await asService(svc, (trx) => sql<Transfer>`
    select * from public.payout_transfers where reference = ${reference} and provider = ${provider}`.execute(trx));
  const t = r.rows[0];
  if (!t) return "unknown";
  const o = provider === "paystack" ? await verifyPaystack(svc, t) : await verifyFlutterwave(svc, t);
  if (!o) throw new Error("provider gave no clear answer"); // 5xx: the provider sends the webhook again
  return recordOutcome(svc, reference, o);
}

/**
 * Paystack's transfer approval URL: Paystack asks before sending each transfer. We approve (200)
 * only transfers we started: our reference, on its way, the same amount. Anything else is refused (400).
 */
export async function approvePaystackTransfer(svc: Services, raw: string, signature: string): Promise<number> {
  const secret = svc.config.PAYSTACK_SECRET_KEY;
  if (!secret) return 400;
  if (signature && !timingSafeEqual(hmacSha512Hex(secret, raw), signature)) return 400;
  let body: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { body = JSON.parse(raw); } catch { return 400; }
  const items: { reference?: unknown; amount?: unknown }[] = Array.isArray(body?.transfers) ? body.transfers
    : body?.data && typeof body.data === "object" ? [body.data] : [body];
  if (items.length === 0) return 400;
  for (const it of items) {
    if (typeof it?.reference !== "string") return 400;
    const r = await asService(svc, (trx) => sql<{ amount: string }>`
      select amount from public.payout_transfers
       where reference = ${it.reference} and provider = 'paystack' and status in ('sending', 'pending')`.execute(trx));
    const row = r.rows[0];
    if (!row || Number(it.amount) !== kobo(row.amount)) return 400;
  }
  return 200;
}

// ------------------------------------------------------------------ reconciliation

async function providerBalance(svc: Services, p: Transfer["provider"]): Promise<number | null> {
  if (p === "paystack") {
    const r = await svc.fetch("https://api.paystack.co/balance", { headers: { Authorization: `Bearer ${svc.config.PAYSTACK_SECRET_KEY}` } });
    const j = await readJson(r);
    const ngn = Array.isArray(j.data) ? j.data.find((b: { currency?: string }) => b?.currency === "NGN") : null;
    return r.ok && j.status && ngn && typeof ngn.balance === "number" ? ngn.balance / 100 : null;
  }
  const r = await svc.fetch("https://api.flutterwave.com/v3/balances/NGN", { headers: { Authorization: `Bearer ${svc.config.FLW_SECRET_KEY}` } });
  const j = await readJson(r);
  const v = Number(j.data?.available_balance);
  return r.ok && j.status === "success" && Number.isFinite(v) ? v : null;
}

/** Read each provider's naira balance and store it beside what we owe on it. Admins hear if it is short. */
export async function reconcileBalances(svc: Services) {
  const out: Record<string, unknown>[] = [];
  for (const p of ["paystack", "flutterwave"] as const) {
    if (!hasKey(svc, p)) continue;
    try {
      const bal = await providerBalance(svc, p);
      if (bal == null) { console.warn(`[payouts] ${p} balance unreadable`); continue; }
      const r = await asService(svc, (trx) => sql<{ r: Record<string, unknown> }>`
        select public._record_provider_balance(${p}, ${bal}) r`.execute(trx));
      out.push(r.rows[0].r);
    } catch (e) {
      console.warn(`[payouts] ${p} balance check failed:`, (e as Error).message);
    }
  }
  return { checks: out };
}
