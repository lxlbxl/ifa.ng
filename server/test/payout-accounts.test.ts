import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { stepUpHash } from "../src/services/phoneAuth.js";
import { refreshBanks } from "../src/services/payoutAccounts.js";
import type { Services } from "../src/services/context.js";
import { freshDatabase, setBabalawoAvailable } from "./helpers.js";

/**
 * Verified payout accounts (migration 20261124000000). The provider names the account holder,
 * the name is compared with the Babalawo's, the PIN is confirmed again before saving, and a changed
 * account waits out a cool-down before withdrawals can go to it.
 */
const BABA = "00000000-0000-0000-0000-0000000000b7";
const CLIENT = "00000000-0000-0000-0000-0000000000c7";
const ADMIN = "00000000-0000-0000-0000-0000000000a7";
let database: Database;
let admin: pg.Client;
let dbUrl = "";
let app: ReturnType<typeof createApp>;
let config: ReturnType<typeof loadConfig>;
const calls: string[] = [];

// Account number -> name on the account at the bank.
const HOLDERS: Record<string, string> = {
  "0123456789": "ADEYEMI BABATUNDE OLA",
  "0987654321": "ADEYEMI B. OLA",
  "1111111111": "CHUKWU EMEKA JOHN",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push(`${init?.method ?? "GET"} ${url}`);
  let m = url.match(/api\.paystack\.co\/bank\/resolve\?account_number=(\d+)&bank_code=(\w+)/);
  if (m) return HOLDERS[m[1]] ? json({ status: true, data: { account_name: HOLDERS[m[1]], account_number: m[1] } })
                              : json({ status: false, message: "Could not resolve account name" }, 422);
  if (url === "https://api.paystack.co/transferrecipient") {
    const b = JSON.parse(String(init?.body));
    return json({ status: true, data: { recipient_code: `RCP_${b.account_number}` } });
  }
  if (url === "https://api.flutterwave.com/v3/accounts/resolve") {
    const b = JSON.parse(String(init?.body));
    return HOLDERS[b.account_number] ? json({ status: "success", data: { account_name: HOLDERS[b.account_number] } })
                                     : json({ status: "error", message: "Sorry, recipient account could not be validated" }, 400);
  }
  if (url.startsWith("https://api.paystack.co/bank?")) {
    return json({ status: true, data: [
      { name: "Access Bank", code: "044", active: true, type: "nuban" },
      { name: "Kuda Bank", code: "50211", active: true, type: "nuban" },
      { name: "Old Bank", code: "999", active: false, type: "nuban" },
    ], meta: { next: null } });
  }
  if (url === "https://api.flutterwave.com/v3/banks/NG") {
    return json({ status: "success", data: [{ id: 1, name: "Access Bank", code: "044" }, { id: 2, name: "Kuda Microfinance Bank", code: "090267" },
      { id: 3, name: "Moniepoint MFB", code: "50515" }] });
  }
  return json({ error: "unexpected " + url }, 500);
}) as typeof fetch;

const call = (method: string, path: string, user: string | null, body?: unknown) =>
  app.request(path, { method, headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
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
let seq = 0;
async function stepUp(user = BABA, purpose = "payout_account", minutes = 10) {
  const token = `tok-${++seq}`;
  await admin.query(`insert into auth.step_ups(token_hash, user_id, purpose, expires_at) values ($1, $2, $3, now() + make_interval(mins => $4))`,
    [stepUpHash(token), user, purpose, minutes]);
  return token;
}
const accessId = async () => (await one<{ id: number }>(`select id from payout_banks where paystack_code = '044'`)).id;
const save = async (account: string, token?: string) =>
  call("PUT", "/v1/payout-account", BABA, { bank_id: await accessId(), account_number: account, step_up: token ?? await stepUp() });

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_payout_accounts");
  await migrate(dbUrl, undefined, () => {});
  database = createDb(dbUrl);
  config = loadConfig({ DATABASE_URL: dbUrl, NODE_ENV: "test", PAYSTACK_SECRET_KEY: "sk_test", FLW_SECRET_KEY: "flw_test" });
  app = createApp({ config, database, fetch: fakeFetch,
    resolveCaller: async (req) => (req.headers.get("x-test-user") ? { kind: "user", userId: req.headers.get("x-test-user")! } : { kind: "anon" }) });
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, raw_user_meta_data) values
    ('${BABA}', 'b7@x.ng', '{"role":"babalawo","full_name":"Babátúndé Ọlá Adéyẹmí"}'), ('${CLIENT}', 'c7@x.ng', '{}'), ('${ADMIN}', 'a7@x.ng', '{}')`);
  await admin.query(`update profiles set full_name = 'Babátúndé Ọlá Adéyẹmí' where id = $1`, [BABA]);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin') on conflict do nothing`, [ADMIN]);
  await admin.query(`insert into admin_settings(setting_key, setting_value) values ('min_withdrawal_amount', '100')
    on conflict (setting_key) do update set setting_value = '100'`);
}, 60_000);
afterAll(async () => { await admin?.end(); await database?.close(); });

describe("matching the name on the account", () => {
  it("ignores tone marks, order, case and initials", async () => {
    const m = (a: string, b: string) => one<{ m: string }>(`select public._name_match($1, $2) m`, [a, b]).then((r) => Number(r.m));
    expect(await m("Babátúndé Ọlá Adéyẹmí", "ADEYEMI BABATUNDE OLA")).toBe(1);
    expect(await m("Babátúndé Ọlá Adéyẹmí", "ADEYEMI B. OLA")).toBe(1);
    expect(await m("Babátúndé Ọlá Adéyẹmí", "CHUKWU EMEKA JOHN")).toBe(0);
  });
});

describe("a Babalawo's payout account", () => {
  it("is only for Babalawos, and shows the provider's name for the account", async () => {
    expect((await call("POST", "/v1/payout-account/resolve", CLIENT, { bank_id: await accessId(), account_number: "0123456789" })).status).toBe(403);
    const r = await call("POST", "/v1/payout-account/resolve", BABA, { bank_id: await accessId(), account_number: "0123456789" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ account_name: "ADEYEMI BABATUNDE OLA", bank_name: "Access Bank" });
    const bad = await call("POST", "/v1/payout-account/resolve", BABA, { bank_id: await accessId(), account_number: "5555555555" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toMatch(/couldn't find that account/);
  });

  it("can't be written directly, only through the checks", async () => {
    await expect(as(BABA, `insert into babalawo_bank_details(babalawo_id, bank_name, account_number, account_name, status)
      values ($1, 'X', '0000000000', 'Me', 'verified')`, [BABA])).rejects.toThrow(/permission denied|row-level security/);
  });

  it("needs a fresh PIN confirmation, used once", async () => {
    const id = await accessId();
    expect((await call("PUT", "/v1/payout-account", BABA, { bank_id: id, account_number: "0123456789" })).status).toBe(403);
    const expired = await stepUp(BABA, "payout_account", -1);
    expect((await save("0123456789", expired)).status).toBe(403);
    const other = await stepUp(CLIENT);
    expect((await save("0123456789", other)).status).toBe(403);
  });

  it("verifies a matching first account at once, with a Paystack recipient ready", async () => {
    const token = await stepUp();
    const r = await save("0123456789", token);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ status: "verified", account_name: "ADEYEMI BABATUNDE OLA", bank_name: "Access Bank" });
    const d = await one<Record<string, unknown>>(`select * from babalawo_bank_details where babalawo_id = $1`, [BABA]);
    expect(d).toMatchObject({ status: "verified", paystack_recipient_code: "RCP_0123456789", resolved_by: "paystack",
      paystack_bank_code: "044", flutterwave_bank_code: "044" });
    expect(new Date(d.usable_from as string).getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect((await save("0123456789", token)).status).toBe(403); // the token is spent

    await setBabalawoAvailable(admin, BABA, 5000);
    const w = await as<{ id: string }>(BABA, `select public.request_withdrawal(1000) id`);
    const snap = await one<{ bank_snapshot: Record<string, string> }>(`select bank_snapshot from withdrawal_requests where id = $1`, [w.id]);
    expect(snap.bank_snapshot).toMatchObject({ account_number: "0123456789", paystack_recipient_code: "RCP_0123456789" });
    await as(ADMIN, `select public.admin_process_withdrawal($1, 'reject', null, 'test')`, [w.id]);
  });

  it("makes a changed account wait out the cool-down, and tells the Babalawo", async () => {
    const r = await save("0987654321");
    expect(await r.json()).toMatchObject({ status: "verified", account_name: "ADEYEMI B. OLA" });
    const d = await one<{ usable_from: Date }>(`select usable_from from babalawo_bank_details where babalawo_id = $1`, [BABA]);
    expect(d.usable_from.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    const n = await one<{ n: number }>(`select count(*)::int n from notifications where user_id = $1 and type = 'bank_account_changed'`, [BABA]);
    expect(n.n).toBe(1);
    await expect(as(BABA, `select public.request_withdrawal(1000)`)).rejects.toThrow(/can receive withdrawals from/);
  });

  it("sends a name that doesn't match to an admin, and blocks withdrawals until approved", async () => {
    const r = await save("1111111111");
    expect(await r.json()).toMatchObject({ status: "pending_review", account_name: "CHUKWU EMEKA JOHN" });
    await expect(as(BABA, `select public.request_withdrawal(1000)`)).rejects.toThrow(/waiting for IFA.ng/);
    const list = await as<{ account_last4: string }>(ADMIN, `select * from public.admin_bank_accounts_to_review()`);
    expect(list.account_last4).toBe("1111");
    await expect(as(BABA, `select public.admin_review_bank_account($1, true)`, [BABA])).rejects.toThrow(/Admin only/);
    await expect(as(ADMIN, `select public.admin_review_bank_account($1, false)`, [BABA])).rejects.toThrow(/Say why/);
    await as(ADMIN, `select public.admin_review_bank_account($1, true, 'Spoke to him: family account')`, [BABA]);
    expect((await one<{ status: string }>(`select status from babalawo_bank_details where babalawo_id = $1`, [BABA])).status).toBe("verified");
    // still inside the cool-down from the change
    await expect(as(BABA, `select public.request_withdrawal(1000)`)).rejects.toThrow(/can receive withdrawals from/);
    await admin.query(`update babalawo_bank_details set usable_from = now() - interval '1 minute' where babalawo_id = $1`, [BABA]);
    await as(BABA, `select public.request_withdrawal(1000)`);
  });

  it("can't be changed while a withdrawal is in progress", async () => {
    const r = await save("0123456789");
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/withdrawal in progress/);
  });

  it("limits account lookups per hour", async () => {
    await admin.query(`update admin_settings set setting_value = '0' where setting_key = 'payout_resolves_per_hour'`);
    const r = await call("POST", "/v1/payout-account/resolve", BABA, { bank_id: await accessId(), account_number: "0123456789" });
    expect(r.status).toBe(429);
    await admin.query(`update admin_settings set setting_value = '10' where setting_key = 'payout_resolves_per_hour'`);
  });
});

describe("the bank list", () => {
  it("merges both providers' lists by code and name, keeping codes already known", async () => {
    const svc = { config, database, fetch: fakeFetch } as unknown as Services;
    await refreshBanks(svc);
    const banks = (await admin.query(`select name, paystack_code, flutterwave_code, active from payout_banks order by name`)).rows;
    expect(banks.find((b) => b.paystack_code === "044")).toMatchObject({ flutterwave_code: "044" });
    expect(banks.find((b) => b.paystack_code === "50211")).toMatchObject({ name: "Kuda Bank", flutterwave_code: "090267" });
    expect(banks.find((b) => b.flutterwave_code === "50515")).toMatchObject({ paystack_code: null });
    expect(banks.find((b) => b.paystack_code === "999")).toBeUndefined();
    expect(banks.find((b) => b.paystack_code === "057")).toMatchObject({ flutterwave_code: "057" }); // seeded Zenith kept
  });
});
