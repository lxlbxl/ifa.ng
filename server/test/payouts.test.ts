import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { hmacSha512Hex } from "../src/services/payments.js";
import { checkPendingPayouts, sendDuePayouts } from "../src/services/payouts.js";
import type { Services } from "../src/services/context.js";
import { freshDatabase, setBabalawoAvailable } from "./helpers.js";

/**
 * Automated payouts (migration 20261125000000). An approved withdrawal becomes one transfer per
 * provider part, sent through that provider with our own reference; webhooks and the check job
 * finish it; nothing is sent twice.
 */
const BABA = "00000000-0000-0000-0000-0000000000b8";
const ADMIN = "00000000-0000-0000-0000-0000000000a8";
const PS = "sk_test_payouts";
let database: Database;
let admin: pg.Client;
let dbUrl = "";
let app: ReturnType<typeof createApp>;
let svc: Services;

// The fake providers: what each one holds, by our reference.
type Fake = { status: string; id: string; amount: number };
const paystack = new Map<string, Fake>();
const flutterwave = new Map<string, Fake>();
let paystackSend: "ok" | "timeout" | "insufficient" | "otp" = "ok";
const sends: string[] = [];

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url === "https://api.paystack.co/transferrecipient") return json({ status: true, data: { recipient_code: "RCP_new" } });
  if (url === "https://api.paystack.co/transfer") {
    const b = JSON.parse(String(init?.body));
    sends.push(`paystack ${b.reference} ${b.amount} ${b.recipient}`);
    if (paystackSend === "insufficient") return json({ status: false, message: "Your balance is not enough to fulfil this request" }, 400);
    if (paystack.has(b.reference)) return json({ status: false, message: "Duplicate Transfer Reference" }, 400);
    const st = paystackSend === "otp" ? "otp" : "pending";
    paystack.set(b.reference, { status: st, id: `TRF_${paystack.size + 1}`, amount: b.amount });
    if (paystackSend === "timeout") throw new Error("socket hang up");
    return json({ status: true, data: { status: st, transfer_code: `TRF_${paystack.size}`, reference: b.reference } });
  }
  let m = url.match(/api\.paystack\.co\/transfer\/verify\/(.+)$/);
  if (m) {
    const t = paystack.get(decodeURIComponent(m[1]));
    return t ? json({ status: true, data: { status: t.status, transfer_code: t.id, reference: m[1], fee_charged: 1000 } })
             : json({ status: false, message: "Transfer not found" }, 404);
  }
  if (url === "https://api.flutterwave.com/v3/transfers") {
    const b = JSON.parse(String(init?.body));
    sends.push(`flutterwave ${b.reference} ${b.amount} ${b.account_bank}/${b.account_number}`);
    if (flutterwave.has(b.reference)) return json({ status: "error", message: "Transfer with this reference already exists" }, 400);
    const id = String(9000 + flutterwave.size);
    flutterwave.set(b.reference, { status: "NEW", id, amount: b.amount });
    return json({ status: "success", data: { id: Number(id), status: "NEW", reference: b.reference, fee: 26.88 } });
  }
  m = url.match(/api\.flutterwave\.com\/v3\/transfers\/(\d+)$/);
  if (m) {
    const [ref, t] = [...flutterwave.entries()].find(([, v]) => v.id === m![1]) ?? [];
    return t ? json({ status: "success", data: { id: Number(t.id), status: t.status, reference: ref, fee: 26.88 } }) : json({ status: "error" }, 404);
  }
  return json({ error: "unexpected " + url }, 500);
}) as typeof fetch;

const one = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;
const all = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows as T[];
async function as<T>(user: string, q: string, params: unknown[] = []): Promise<T> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows[0] as T;
  } finally { await c.end(); }
}
const setting = (k: string, v: string) => admin.query(`update admin_settings set setting_value = $2 where setting_key = $1`, [k, v]);
const wallet = () => one<{ available_balance: string; held_balance: string; lifetime_paid_out: string }>(
  `select available_balance, held_balance, lifetime_paid_out from babalawo_wallets where babalawo_id = $1`, [BABA]);
const transfers = (w: string) => all<{ id: string; provider: string; amount: string; status: string; reference: string; hold_reason: string | null; failure_reason: string | null }>(
  `select * from payout_transfers where withdrawal_id = $1 order by provider, created_at`, [w]);
const withdrawal = (w: string) => one<{ status: string; payout_reference: string | null }>(`select status, payout_reference from withdrawal_requests where id = $1`, [w]);
const webhook = (path: string, body: unknown, headers: Record<string, string>) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const paystackHook = (body: unknown) => {
  const raw = JSON.stringify(body);
  return app.request("/webhooks/paystack", { method: "POST", headers: { "x-paystack-signature": hmacSha512Hex(PS, raw) }, body: raw });
};

/** A withdrawal of `amount`, held `ps` on Paystack and the rest on Flutterwave, approved by the admin. */
async function approvedWithdrawal(amount: number, ps = amount) {
  await setBabalawoAvailable(admin, BABA, ps, "paystack");
  if (amount > ps) await setBabalawoAvailable(admin, BABA, amount, "flutterwave");
  const w = await as<{ id: string }>(BABA, `select public.request_withdrawal($1) id`, [amount]);
  await as(ADMIN, `select public.admin_process_withdrawal($1, 'approve', null, null)`, [w.id]);
  return w.id;
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_payouts");
  await migrate(dbUrl, undefined, () => {});
  database = createDb(dbUrl);
  const config = loadConfig({ DATABASE_URL: dbUrl, NODE_ENV: "test", PAYSTACK_SECRET_KEY: PS, FLW_SECRET_KEY: "flw_test", FLW_SECRET_HASH: "flwhash" });
  app = createApp({ config, database, fetch: fakeFetch, resolveCaller: async () => ({ kind: "anon" }) });
  svc = { config, database, fetch: fakeFetch } as unknown as Services;
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, raw_user_meta_data) values
    ('${BABA}', 'b8@x.ng', '{"role":"babalawo","full_name":"Ifá Test"}'), ('${ADMIN}', 'a8@x.ng', '{}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin') on conflict do nothing`, [ADMIN]);
  await admin.query(`insert into admin_settings(setting_key, setting_value) values ('min_withdrawal_amount', '100')
    on conflict (setting_key) do update set setting_value = '100'`);
  const bank = await one<{ id: number }>(`select id from payout_banks where paystack_code = '044'`);
  await admin.query(`insert into babalawo_bank_details(babalawo_id, bank_name, bank_id, account_number, account_name, status,
      paystack_bank_code, flutterwave_bank_code, paystack_recipient_code, usable_from)
    values ($1, 'Access Bank', $2, '0123456789', 'IFA TEST', 'verified', '044', '044', 'RCP_saved', now() - interval '1 day')`, [BABA, bank.id]);
}, 60_000);
afterAll(async () => { await admin?.end(); await database?.close(); });
beforeEach(() => { paystackSend = "ok"; sends.length = 0; });

describe("automated payouts", () => {
  it("sends nothing while switched off, which is the default", async () => {
    const w = await approvedWithdrawal(1000);
    expect(await transfers(w)).toEqual([]);
    expect(await sendDuePayouts(svc)).toEqual({ sent: 0, failed: 0 });
    expect(sends).toEqual([]);
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'mark_paid', 'BANK-1', null)`, [w]);
    expect((await withdrawal(w)).status).toBe("completed");
  });

  it("splits a mixed withdrawal into one transfer per provider, and pays each through its own provider", async () => {
    await setting("payouts_auto_enabled", "true");
    const w = await approvedWithdrawal(8000, 5000);
    const ts = await transfers(w);
    expect(ts.map((t) => [t.provider, Number(t.amount), t.status])).toEqual([["flutterwave", 3000, "queued"], ["paystack", 5000, "queued"]]);

    expect(await sendDuePayouts(svc)).toEqual({ sent: 2, failed: 0 });
    const [fw, ps] = await transfers(w);
    expect(sends.sort()).toEqual([`flutterwave ${fw.reference} 3000 044/0123456789`, `paystack ${ps.reference} 500000 RCP_saved`]);
    expect([fw.status, ps.status]).toEqual(["pending", "pending"]);
    expect(Number((await wallet()).held_balance)).toBe(8000);

    // Paystack's webhook: we ask Paystack, which says success.
    paystack.get(ps.reference)!.status = "success";
    expect((await paystackHook({ event: "transfer.success", data: { reference: ps.reference } })).status).toBe(200);
    expect((await transfers(w))[1].status).toBe("success");
    expect((await withdrawal(w)).status).toBe("approved"); // Flutterwave's part is still on its way
    expect(Number((await wallet()).held_balance)).toBe(3000);

    // A forged webhook changes nothing: Flutterwave still says NEW.
    expect((await webhook("/webhooks/flutterwave", { event: "transfer.completed", data: { reference: fw.reference, status: "SUCCESSFUL" } },
      { "verif-hash": "flwhash" })).status).toBe(200);
    expect((await transfers(w))[0].status).toBe("pending");
    flutterwave.get(fw.reference)!.status = "SUCCESSFUL";
    await webhook("/webhooks/flutterwave", { event: "transfer.completed", data: { reference: fw.reference } }, { "verif-hash": "flwhash" });

    expect((await transfers(w)).map((t) => t.status)).toEqual(["success", "success"]);
    expect((await withdrawal(w)).status).toBe("completed");
    const wal = await wallet();
    expect(Number(wal.held_balance)).toBe(0);
    expect(await one(`select count(*)::int n from payouts where reference in ($1, $2)`, [fw.reference, ps.reference])).toEqual({ n: 2 });
    // A repeated webhook pays nothing again.
    await paystackHook({ event: "transfer.success", data: { reference: ps.reference } });
    expect(Number((await wallet()).lifetime_paid_out)).toBe(Number(wal.lifetime_paid_out));
    expect(await one(`select count(*)::int n from babalawo_ledger where note like '%' || $1`, [ps.reference])).toEqual({ n: 1 });
  });

  it("never sends twice after an unclear answer: it asks the provider, and resends only what never arrived", async () => {
    paystackSend = "timeout";
    const w = await approvedWithdrawal(1200);
    await sendDuePayouts(svc);
    let [t] = await transfers(w);
    expect(t.status).toBe("pending");
    // The check job asks Paystack, which did get it.
    await admin.query(`update payout_transfers set last_checked_at = now() - interval '5 minutes' where id = $1`, [t.id]);
    paystack.get(t.reference)!.status = "success";
    await checkPendingPayouts(svc);
    expect((await transfers(w))[0].status).toBe("success");
    expect(sends.length).toBe(1);

    // One Paystack never received: asked, it says "not found", so it is sent again with the same reference.
    paystackSend = "ok";
    sends.length = 0;
    const w2 = await approvedWithdrawal(1300);
    await admin.query(`update payout_transfers set status = 'sending', sent_at = now() - interval '5 minutes' where withdrawal_id = $1`, [w2]);
    await checkPendingPayouts(svc);
    [t] = await transfers(w2);
    expect(t.status).toBe("queued");
    await sendDuePayouts(svc);
    expect(sends).toEqual([`paystack ${t.reference} 130000 RCP_saved`]);
    paystack.get(t.reference)!.status = "success";
    await paystackHook({ event: "transfer.success", data: { reference: t.reference } });
    expect((await withdrawal(w2)).status).toBe("completed");
  });

  it("holds transfers the limits or the account rules stop, with the reason", async () => {
    await setting("payout_single_max", "1000");
    const w = await approvedWithdrawal(1500);
    await sendDuePayouts(svc);
    expect((await transfers(w))[0]).toMatchObject({ status: "queued", hold_reason: expect.stringMatching(/largest automated transfer/) });
    await setting("payout_single_max", "500000");

    await admin.query(`update babalawo_bank_details set account_number = '0999999999' where babalawo_id = $1`, [BABA]);
    await sendDuePayouts(svc);
    expect((await transfers(w))[0].hold_reason).toMatch(/account changed after this withdrawal/);
    await admin.query(`update babalawo_bank_details set account_number = '0123456789' where babalawo_id = $1`, [BABA]);

    await setting("payouts_paystack_enabled", "false");
    await sendDuePayouts(svc);
    expect((await transfers(w))[0].hold_reason).toMatch(/Paystack payouts are switched off/);
    expect(sends).toEqual([]);
    await setting("payouts_paystack_enabled", "true");

    // A rejected withdrawal drops its queued transfer and gives the money back.
    const before = Number((await wallet()).available_balance);
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'reject', null, 'asked by the Babalawo')`, [w]);
    expect((await transfers(w))[0].status).toBe("cancelled");
    expect(Number((await wallet()).available_balance)).toBe(before + 1500);
  });

  it("lets an admin retry a failed transfer or record it paid by hand, and blocks unsafe changes", async () => {
    paystackSend = "insufficient";
    const w = await approvedWithdrawal(2000);
    expect(await sendDuePayouts(svc)).toEqual({ sent: 0, failed: 1 });
    let [t] = await transfers(w);
    expect(t).toMatchObject({ status: "failed", failure_reason: expect.stringMatching(/balance is not enough/) });
    expect(await one(`select count(*)::int n from notifications where type = 'payout_failed' and user_id = $1`, [ADMIN])).toEqual({ n: 1 });
    await expect(as(BABA, `select public.admin_payout_transfer_action($1, 'retry')`, [t.id])).rejects.toThrow(/Admin only/);

    paystackSend = "ok";
    await as(ADMIN, `select public.admin_payout_transfer_action($1, 'retry')`, [t.id]);
    await sendDuePayouts(svc);
    const ts = await transfers(w);
    expect(ts.map((x) => x.status)).toEqual(["cancelled", "pending"]);
    expect(ts[1].reference).not.toBe(t.reference);
    // On its way: it can't be rejected or paid by hand.
    await expect(as(ADMIN, `select public.admin_process_withdrawal($1, 'reject', null, 'not needed')`, [w])).rejects.toThrow(/being paid by bank transfer/);
    await expect(as(ADMIN, `select public.admin_payout_transfer_action($1, 'paid_manually', 'X')`, [ts[1].id])).rejects.toThrow(/Only waiting or failed/);

    paystack.get(ts[1].reference)!.status = "failed";
    await paystackHook({ event: "transfer.failed", data: { reference: ts[1].reference } });
    [, t] = await transfers(w);
    expect(t.status).toBe("failed");
    await expect(as(ADMIN, `select public.admin_payout_transfer_action($1, 'paid_manually', '  ')`, [t.id])).rejects.toThrow(/reference is required/);
    await as(ADMIN, `select public.admin_payout_transfer_action($1, 'paid_manually', 'GTB-778')`, [t.id]);
    expect(await withdrawal(w)).toEqual({ status: "completed", payout_reference: "GTB-778" });
    expect(Number((await wallet()).held_balance)).toBe(0);
  });

  it("gives the money back when the bank reverses a paid transfer", async () => {
    const w = await approvedWithdrawal(900);
    await sendDuePayouts(svc);
    const [t] = await transfers(w);
    paystack.get(t.reference)!.status = "success";
    await paystackHook({ event: "transfer.success", data: { reference: t.reference } });
    const before = await wallet();
    paystack.get(t.reference)!.status = "reversed";
    await paystackHook({ event: "transfer.reversed", data: { reference: t.reference } });
    const after = await wallet();
    expect((await transfers(w))[0].status).toBe("reversed");
    expect(Number(after.available_balance)).toBe(Number(before.available_balance) + 900);
    expect(Number(after.lifetime_paid_out)).toBe(Number(before.lifetime_paid_out) - 900);
    expect(await one(`select count(*)::int n from notifications where type = 'withdrawal_reversed' and user_id = $1`, [BABA])).toEqual({ n: 1 });
  });

  it("keeps an OTP-waiting transfer pending with the reason, so admins can switch OTP off", async () => {
    paystackSend = "otp";
    const w = await approvedWithdrawal(700);
    await sendDuePayouts(svc);
    expect((await transfers(w))[0]).toMatchObject({ status: "pending", hold_reason: expect.stringMatching(/OTP/) });
    paystack.get((await transfers(w))[0].reference)!.status = "success";
    await paystackHook({ event: "transfer.success", data: { reference: (await transfers(w))[0].reference } });
    expect((await withdrawal(w)).status).toBe("completed");
  });

  it("approves on Paystack's approval URL only our own transfers on their way, at the same amount", async () => {
    paystackSend = "timeout";
    const w = await approvedWithdrawal(600);
    await sendDuePayouts(svc);
    const [t] = await transfers(w);
    const ask = (b: unknown) => app.request("/webhooks/paystack/transfer-approval", { method: "POST", body: JSON.stringify(b) });
    expect((await ask({ reference: t.reference, amount: 60000 })).status).toBe(200);
    expect((await ask({ transfers: [{ reference: t.reference, amount: 60000 }] })).status).toBe(200);
    expect((await ask({ reference: t.reference, amount: 6000000 })).status).toBe(400);
    expect((await ask({ reference: "ifa_po_someone_else", amount: 60000 })).status).toBe(400);
    const raw = JSON.stringify({ reference: t.reference, amount: 60000 });
    expect((await app.request("/webhooks/paystack/transfer-approval", { method: "POST", body: raw,
      headers: { "x-paystack-signature": "bad" } })).status).toBe(400);
  });

  it("lets Babalawos read only their own transfers", async () => {
    const other = "00000000-0000-0000-0000-0000000000d8";
    await admin.query(`insert into auth.users(id, email) values ($1, 'd8@x.ng')`, [other]);
    expect(await as(other, `select count(*)::int n from payout_transfers`)).toEqual({ n: 0 });
    expect(Number((await as<{ n: number }>(BABA, `select count(*)::int n from payout_transfers`)).n)).toBeGreaterThan(0);
    await expect(as(BABA, `select * from public._claim_payout_transfers(1)`)).rejects.toThrow(/permission denied/);
    await expect(as(BABA, `update payout_transfers set status = 'success'`)).rejects.toThrow(/permission denied/);
  });
});
