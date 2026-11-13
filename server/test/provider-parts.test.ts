import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase, setWallet } from "./helpers.js";

/**
 * Which provider holds every naira (migration 20261122000000). A Babalawo is paid out by the
 * provider that received the client's money, so wallets, payments and Babalawo balances are
 * split into a Paystack part and a Flutterwave part, and the parts must add up at commit.
 */
const BABA = "00000000-0000-0000-0000-0000000000b9";
const CLIENT = "00000000-0000-0000-0000-0000000000c9";
const ADMIN = "00000000-0000-0000-0000-0000000000a9";
let admin: pg.Client;
let dbUrl = "";

const one = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;
async function as<T>(user: string, q: string, params: unknown[] = []): Promise<T> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows[0] as T;
  } finally { await c.end(); }
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
const num = (o: Record<string, unknown> | null | undefined) =>
  Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, Number(v)]));

async function walletParts(user: string) {
  const r = await admin.query(`select provider, balance from wallet_parts where user_id = $1 and balance <> 0`, [user]);
  return Object.fromEntries(r.rows.map((x) => [x.provider, Number(x.balance)]));
}
async function babaParts() {
  const r = await admin.query(`select provider, pending, available, held, paid_out from babalawo_balance_parts where babalawo_id = $1`, [BABA]);
  return Object.fromEntries(r.rows.map((x) => [x.provider,
    { pending: Number(x.pending), available: Number(x.available), held: Number(x.held), paid_out: Number(x.paid_out) }]));
}
async function topUp(provider: "paystack" | "flutterwave", amount: number) {
  const i = await one<{ reference: string }>(
    `select * from public.create_payment_intent($1, 'wallet_topup', $2, $3)`, [CLIENT, provider, amount]);
  await one(`select public.settle_payment_intent($1, $2, 'NGN', 'tx')`, [i.reference, amount]);
}
/** Book a Consult Now session for 10,000, the wallet paying what it can and Paystack the rest. */
async function bookMixed() {
  await admin.query(`update sessions set status = 'cancelled' where babalawo_id = $1 and status <> 'completed'`, [BABA]);
  const i = await one<{ reference: string; amount: string }>(
    `select * from public.create_payment_intent($1, 'session', 'paystack', null, $2, $3::date, '12:00', true, null, null, true)`,
    [CLIENT, BABA, today()]);
  const r = await one<{ r: { status: string; session_id: number } }>(
    `select public.settle_payment_intent($1, $2, 'NGN', 'tx') r`, [i.reference, Number(i.amount)]);
  expect(r.r.status).toBe("settled");
  return { sessionId: Number(r.r.session_id), reference: i.reference };
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_provider_parts");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','c9@x.ng','{}'), ('${BABA}','b9@x.ng','{"role":"babalawo"}'), ('${ADMIN}','a9@x.ng','{}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin') on conflict do nothing`, [ADMIN]);
  await admin.query(`update babalawos set hourly_rate = 10000, is_verified = true, current_status = 'online',
    profile_picture_url = 'https://x.invalid/p.jpg' where user_id = '${BABA}'`);
  await admin.query(`insert into availability(babalawo_id, day_of_week, start_time, end_time) values ('${BABA}', 1, '09:00', '12:00')`);
  await admin.query(`insert into babalawo_wallets(babalawo_id) values ($1) on conflict do nothing`, [BABA]);
  await admin.query(`insert into babalawo_bank_details(babalawo_id, bank_name, account_number, account_name, status)
    values ($1, 'Test Bank', '0123456789', 'Test Babalawo', 'verified')`, [BABA]);
  await admin.query(`insert into admin_settings(setting_key, setting_value) values ('min_withdrawal_amount', '100')
    on conflict (setting_key) do update set setting_value = '100'`);
}, 60_000);
afterAll(() => admin?.end());

describe("provider parts", () => {
  it("puts a top-up in the part of the provider that collected it", async () => {
    await topUp("flutterwave", 4000);
    expect(await walletParts(CLIENT)).toEqual({ flutterwave: 4000 });
    const tx = await one<{ provider_parts: Record<string, string> }>(
      `select provider_parts from wallet_transactions where user_id = $1 order by created_at desc limit 1`, [CLIENT]);
    expect(num(tx.provider_parts)).toEqual({ flutterwave: 4000 });
  });

  it("splits a mixed payment, the Babalawo's earning, its release, a withdrawal and its payout by provider", async () => {
    const { sessionId } = await bookMixed();
    // 4,000 from the Flutterwave-funded wallet, 6,000 by Paystack card
    const p = await one<{ provider_parts: Record<string, string>; babalawo_amount: string }>(
      `select provider_parts, babalawo_amount from payments where session_id = $1`, [sessionId]);
    expect(num(p.provider_parts)).toEqual({ paystack: 6000, flutterwave: 4000 });
    expect(await walletParts(CLIENT)).toEqual({});
    // Babalawo's 80% share is held in the same proportions
    expect(Number(p.babalawo_amount)).toBe(8000);
    expect(await babaParts()).toMatchObject({ paystack: { pending: 4800 }, flutterwave: { pending: 3200 } });

    // completed and past the hold: released to available, still split the same way
    await admin.query(`update sessions set status = 'completed' where id = $1`, [sessionId]);
    await admin.query(`update sessions set earnings_release_at = now() - interval '1 minute' where id = $1`, [sessionId]);
    await one(`select public.release_held_earnings()`);
    expect(await babaParts()).toMatchObject({
      paystack: { pending: 0, available: 4800 }, flutterwave: { pending: 0, available: 3200 } });

    // a withdrawal takes the larger part first
    const w = await as<{ id: string }>(BABA, `select public.request_withdrawal(5000) id`);
    const wr = await one<{ provider_parts: Record<string, string> }>(`select provider_parts from withdrawal_requests where id = $1`, [w.id]);
    expect(num(wr.provider_parts)).toEqual({ paystack: 4800, flutterwave: 200 });
    expect(await babaParts()).toMatchObject({
      paystack: { available: 0, held: 4800 }, flutterwave: { available: 3000, held: 200 } });

    // rejected: back to available, part by part
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'reject', null, 'wrong amount')`, [w.id]);
    expect(await babaParts()).toMatchObject({
      paystack: { available: 4800, held: 0 }, flutterwave: { available: 3200, held: 0 } });

    // a paid withdrawal moves the held parts to paid out
    const w2 = await as<{ id: string }>(BABA, `select public.request_withdrawal(8000) id`);
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'approve')`, [w2.id]);
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'mark_paid', 'BANKREF1')`, [w2.id]);
    expect(await babaParts()).toMatchObject({
      paystack: { available: 0, held: 0, paid_out: 4800 }, flutterwave: { available: 0, held: 0, paid_out: 3200 } });
  });

  it("refunds to the same provider parts the payment came from", async () => {
    await setWallet(admin, CLIENT, 0);
    await topUp("flutterwave", 2500);
    const { sessionId } = await bookMixed();
    expect(await walletParts(CLIENT)).toEqual({});
    await one(`select public._refund_session($1, 'test', null)`, [sessionId]);
    expect(await walletParts(CLIENT)).toEqual({ paystack: 7500, flutterwave: 2500 });
    // the Babalawo's pending earning is reversed out of both parts
    const parts = await babaParts();
    expect(parts.paystack.pending + parts.flutterwave.pending).toBe(0);
  });

  it("spends the larger wallet part first", async () => {
    await setWallet(admin, CLIENT, 0);
    await topUp("paystack", 3000);
    await topUp("flutterwave", 9000);
    await admin.query(`select public._wallet_apply($1, 10000, 'debit', 'session_payment', null, 'spend-1', 'test')`, [CLIENT]);
    expect(await walletParts(CLIENT)).toEqual({ paystack: 2000 });
    await setWallet(admin, CLIENT, 0);
  });

  it("refuses money that no provider holds", async () => {
    await expect(admin.query(`select public._wallet_apply($1, 100, 'credit', 'admin_adjustment', null, null, 'x')`, [CLIENT]))
      .rejects.toThrow(/needs a provider/);
    await expect(as(ADMIN, `select public.admin_adjust_wallet($1, 100, 'credit', 'goodwill')`, [CLIENT]))
      .rejects.toThrow(/Choose which provider/);
    await as(ADMIN, `select public.admin_adjust_wallet($1, 100, 'credit', 'goodwill', 'flutterwave')`, [CLIENT]);
    expect(await walletParts(CLIENT)).toEqual({ flutterwave: 100 });
    await setWallet(admin, CLIENT, 0);
  });

  it("refuses a Babalawo balance change without a provider split", async () => {
    await expect(admin.query(`update babalawo_wallets set available_balance = available_balance + 1 where babalawo_id = $1`, [BABA]))
      .rejects.toThrow(/without a provider split/);
  });

  it("refuses, at commit, a wallet whose parts do not add up", async () => {
    await expect(admin.query(`update wallets set balance = balance + 1 where user_id = $1`, [CLIENT]))
      .rejects.toThrow(/provider parts add up/);
  });

  it("records the fee the provider charged the client on top", async () => {
    await setWallet(admin, CLIENT, 0);
    const { reference } = await bookMixed();
    await one(`select public.record_provider_fee($1, 253.81, 10253.81)`, [reference]);
    const p = await one<{ provider_fee: string; charged_amount: string }>(
      `select provider_fee, charged_amount from payments where payment_reference = $1`, [reference]);
    expect(Number(p.provider_fee)).toBe(253.81);
    expect(Number(p.charged_amount)).toBe(10253.81);
    const l = await as<{ r: Record<string, Record<string, string>> }>(ADMIN, `select public.admin_provider_liabilities() r`);
    expect(Number(l.r.paystack.fees_paid_by_clients)).toBeGreaterThanOrEqual(253.81);
  });
});
