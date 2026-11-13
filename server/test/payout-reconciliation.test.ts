import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { reconcileBalances } from "../src/services/payouts.js";
import type { Services } from "../src/services/context.js";
import { freshDatabase, setBabalawoAvailable, setWallet } from "./helpers.js";

/**
 * Payouts part 5 (migration 20261126000000): auto-approval of small withdrawals, provider balance
 * checks against what is owed, slow transfers flagged, and the admin money overview.
 */
const BABA = "00000000-0000-0000-0000-0000000000b9";
const CLIENT = "00000000-0000-0000-0000-0000000000c9";
const ADMIN = "00000000-0000-0000-0000-0000000000a9";
let database: Database;
let admin: pg.Client;
let dbUrl = "";
let svc: Services;
let balances = { paystack: 0, flutterwave: 0 };

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url === "https://api.paystack.co/balance") return json({ status: true, data: [{ currency: "NGN", balance: balances.paystack * 100 }] });
  if (url === "https://api.flutterwave.com/v3/balances/NGN")
    return json({ status: "success", data: { currency: "NGN", available_balance: balances.flutterwave, ledger_balance: balances.flutterwave } });
  return json({ error: "unexpected " + url }, 500);
}) as typeof fetch;

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
const setting = (k: string, v: string) => admin.query(`update admin_settings set setting_value = $2 where setting_key = $1`, [k, v]);
const autoApprove = () => one<{ n: number }>(`select public.auto_approve_withdrawals() n`).then((r) => r.n);
const status = (id: string) => one<{ status: string; auto_approved: boolean }>(`select status, auto_approved from withdrawal_requests where id = $1`, [id]);
async function request(amount: number) {
  await setBabalawoAvailable(admin, BABA, amount);
  return (await as<{ id: string }>(BABA, `select public.request_withdrawal($1) id`, [amount])).id;
}
const rejectIt = (id: string) => as(ADMIN, `select public.admin_process_withdrawal($1, 'reject', null, 'test cleanup')`, [id]);

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_payout_reconciliation");
  await migrate(dbUrl, undefined, () => {});
  database = createDb(dbUrl);
  const config = loadConfig({ DATABASE_URL: dbUrl, NODE_ENV: "test", PAYSTACK_SECRET_KEY: "sk", FLW_SECRET_KEY: "flw" });
  svc = { config, database, fetch: fakeFetch } as unknown as Services;
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, raw_user_meta_data) values
    ('${BABA}', 'b9@x.ng', '{"role":"babalawo","full_name":"Ifá Test"}'), ('${CLIENT}', 'c9@x.ng', '{}'), ('${ADMIN}', 'a9@x.ng', '{}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin') on conflict do nothing`, [ADMIN]);
  await admin.query(`insert into admin_settings(setting_key, setting_value) values ('min_withdrawal_amount', '100')
    on conflict (setting_key) do update set setting_value = '100'`);
  const bank = await one<{ id: number }>(`select id from payout_banks where paystack_code = '044'`);
  await admin.query(`insert into babalawo_bank_details(babalawo_id, bank_name, bank_id, account_number, account_name, status,
      paystack_bank_code, flutterwave_bank_code, usable_from, verified_at)
    values ($1, 'Access Bank', $2, '0123456789', 'IFA TEST', 'verified', '044', '044', now() - interval '30 days', now() - interval '30 days')`,
    [BABA, bank.id]);
}, 60_000);
afterAll(async () => { await admin?.end(); await database?.close(); });

describe("approving small withdrawals automatically", () => {
  it("does nothing while switched off, which is the default", async () => {
    const w = await request(1000);
    expect(await autoApprove()).toBe(0);
    expect((await status(w)).status).toBe("pending");
    await rejectIt(w);
  });

  it("approves small ones from a long-verified account, and queues their transfers", async () => {
    await setting("payout_auto_approve_max", "5000");
    await setting("payouts_auto_enabled", "true");
    const small = await request(4000);
    expect(await autoApprove()).toBe(1);
    expect(await status(small)).toEqual({ status: "approved", auto_approved: true });
    expect(await one(`select count(*)::int n from payout_transfers where withdrawal_id = $1 and status = 'queued'`, [small])).toEqual({ n: 1 });
    await admin.query(`update payout_transfers set status = 'cancelled' where withdrawal_id = $1`, [small]);
    await rejectIt(small);
    await setting("payouts_auto_enabled", "false");

    const big = await request(6000);
    expect(await autoApprove()).toBe(0);
    expect((await status(big)).status).toBe("pending");
    await rejectIt(big);
  });

  it("leaves it to an admin for a new account, an open dispute, or past the daily total", async () => {
    await admin.query(`update babalawo_bank_details set verified_at = now() - interval '2 days' where babalawo_id = $1`, [BABA]);
    let w = await request(1000);
    expect(await autoApprove()).toBe(0);
    await rejectIt(w);
    await admin.query(`update babalawo_bank_details set verified_at = now() - interval '30 days' where babalawo_id = $1`, [BABA]);

    const s = await one<{ id: number }>(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values ($1, $2, current_date - 2, '10:00', '11:00', 'completed', 'paid', 10000) returning id`, [CLIENT, BABA]);
    const d = await one<{ id: string }>(`insert into disputes(session_id, raised_by, reason) values ($1, $2, 'The session did not happen at all') returning id`,
      [s.id, CLIENT]);
    w = await request(1000);
    expect(await autoApprove()).toBe(0);
    await rejectIt(w);
    await admin.query(`update disputes set status = 'resolved_dismissed' where id = $1`, [d.id]);

    await setting("payout_auto_approve_daily_max", "6000"); // 4,000 already auto-approved today
    w = await request(3000);
    expect(await autoApprove()).toBe(0);
    await setting("payout_auto_approve_daily_max", "200000");
    expect(await autoApprove()).toBe(1);
    await rejectIt(w);
  });
});

describe("checking provider balances", () => {
  it("stores each reading beside what is owed, and tells admins once when a balance is short", async () => {
    await setWallet(admin, CLIENT, 20000, "paystack");
    // The Babalawo has ₦3,000 on Paystack from the returned withdrawals above; ₦2,000 more on Flutterwave.
    await setBabalawoAvailable(admin, BABA, 5000, "flutterwave");
    balances = { paystack: 50000, flutterwave: 1000 };
    const r = await reconcileBalances(svc);
    expect(r.checks).toEqual([
      { provider: "paystack", balance: 50000, owed: 23000, short: false },
      { provider: "flutterwave", balance: 1000, owed: 2000, short: true },
    ]);
    await reconcileBalances(svc);
    expect(await one(`select count(*)::int n from notifications where user_id = $1 and type = 'provider_balance_short'`, [ADMIN])).toEqual({ n: 1 });
  });
});

describe("the admin money view", () => {
  it("flags slow transfers once and sums the money by provider, for admins only", async () => {
    const w = await request(2500);
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'approve', null, null)`, [w]);
    await admin.query(`insert into payout_transfers(withdrawal_id, babalawo_id, provider, amount, status, sent_at)
      values ($1, $2, 'paystack', 2500, 'pending', now() - interval '30 hours')`, [w, BABA]);
    expect(await one(`select public.flag_stuck_payout_transfers() n`)).toEqual({ n: 1 });
    expect(await one(`select public.flag_stuck_payout_transfers() n`)).toEqual({ n: 0 });

    const o = await as<{ o: Record<string, any> }>(ADMIN, `select public.admin_payout_overview() o`); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(o.o.providers.paystack.on_the_way).toBe(2500);
    expect(o.o.providers.flutterwave.last_check).toMatchObject({ short: true, balance: 1000 });
    expect(o.o.stuck).toBe(1);
    expect(o.o.auto_approve_max).toBe(5000);
    await expect(as(BABA, `select public.admin_payout_overview()`)).rejects.toThrow(/Admin only/);
    await expect(as(BABA, `select public.auto_approve_withdrawals()`)).rejects.toThrow(/permission denied/);
    expect(await as(BABA, `select count(*)::int n from provider_balance_checks`)).toEqual({ n: 0 });
  });
});
