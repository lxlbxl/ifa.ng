import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { trustedCountry } from "../src/services/pricing.js";
import type { Services } from "../src/services/context.js";
import { freshDatabase, setWallet } from "./helpers.js";

/**
 * Price parity (migration 20261123000000): Nigeria pays naira, the diaspora pays an admin-set
 * USD price through Flutterwave. The Babalawo earns the same naira share either way; the books
 * stay in naira, with the dollars paid kept beside them.
 */
const BABA = "00000000-0000-0000-0000-0000000000ba";
const NG = "00000000-0000-0000-0000-0000000000c1";     // +234 phone
const UK = "00000000-0000-0000-0000-0000000000c2";     // +44 phone
const ADMIN = "00000000-0000-0000-0000-0000000000ad";
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
const currency = (user: string | null, ip: string | null) =>
  one<{ c: string }>(`select public._client_currency($1, $2) c`, [user, ip]).then((r) => r.c);
type Intent = { reference: string; amount: string; wallet_amount: string; total: string; currency: string };
const sessionIntent = (user: string, gateway: string, ip: string | null, useWallet = false) => one<Intent>(
  `select * from public.create_payment_intent($1, 'session', $2, null, $3, $4::date, '12:00', true, null, null, $5, $6)`,
  [user, gateway, BABA, today(), useWallet, ip]);
const settle = (ref: string, paid: number, cur: string) =>
  one<{ r: { status: string; session_id: number } }>(`select public.settle_payment_intent($1, $2, $3, 'tx') r`, [ref, paid, cur]).then((x) => x.r);
const freeSlot = () => admin.query(`update sessions set status = 'cancelled' where babalawo_id = $1 and status <> 'completed'`, [BABA]);

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_price_parity");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, phone, raw_user_meta_data) values
    ('${NG}', 'ng@x.ng', '+2348030000001', '{}'), ('${UK}', 'uk@x.ng', '+447700900001', '{}'),
    ('${ADMIN}', 'ad@x.ng', null, '{}'), ('${BABA}', 'b@x.ng', '+2348030000002', '{"role":"babalawo"}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin') on conflict do nothing`, [ADMIN]);
  await admin.query(`update babalawos set hourly_rate = 10000, is_verified = true, current_status = 'online',
    profile_picture_url = 'https://x.invalid/p.jpg' where user_id = '${BABA}'`);
  await admin.query(`insert into availability(babalawo_id, day_of_week, start_time, end_time) values ('${BABA}', 1, '09:00', '12:00')`);
  await admin.query(`update admin_settings set setting_value = '1600' where setting_key = 'usd_ngn_rate'`);
}, 60_000);
afterAll(() => admin?.end());

describe("who pays in which currency", () => {
  it("Nigeria by phone and IP pays naira; abroad by IP or a foreign phone pays dollars", async () => {
    expect(await currency(NG, "NG")).toBe("NGN");
    expect(await currency(NG, null)).toBe("NGN");
    expect(await currency(NG, "GB")).toBe("USD");     // a +234 number used from London
    expect(await currency(UK, null)).toBe("USD");
    expect(await currency(UK, "NG")).toBe("USD");     // foreign number
    expect(await currency(null, "US")).toBe("USD");   // visitor not signed in
    expect(await currency(null, "NG")).toBe("NGN");
  });

  it("an admin override wins, but not while the wallet holds the other currency", async () => {
    await as(ADMIN, `select public.admin_set_pricing_currency($1, 'NGN')`, [UK]);
    expect(await currency(UK, "GB")).toBe("NGN");
    await as(ADMIN, `select public.admin_set_pricing_currency($1, null)`, [UK]);
    expect(await currency(UK, "GB")).toBe("USD");
    await expect(as(UK, `update profiles set pricing_currency_override = 'NGN' where id = $1`, [UK]))
      .rejects.toThrow(/decided by IFA.ng/);
  });

  it("tells an admin which currency a person pays in, and why", async () => {
    const i = await as<{ r: { currency: string; override: string | null; babalawo: unknown } }>(ADMIN, `select public.admin_pricing_info($1) r`, [UK]);
    expect(i.r).toMatchObject({ currency: "USD", override: null, babalawo: null });
    const b = await as<{ r: { babalawo: { session_price: string; usd_price: string } } }>(ADMIN, `select public.admin_pricing_info($1) r`, [BABA]);
    expect(Number(b.r.babalawo.session_price)).toBe(10000);
    await expect(as(UK, `select public.admin_pricing_info($1)`, [UK])).rejects.toThrow(/Admin only/);
  });

  it("only trusts the configured country header", () => {
    const req = new Request("https://x.invalid", { headers: { "cf-ipcountry": "NG", "x-geo": "GB" } });
    expect(trustedCountry(req, { config: {} } as unknown as Services)).toBeNull();
    expect(trustedCountry(req, { config: { GEO_COUNTRY_HEADER: "x-geo" } } as unknown as Services)).toBe("GB");
  });
});

describe("diaspora prices", () => {
  it("derives the USD price from the naira price, or uses the admin's", async () => {
    // 10,000 / 1,600 x 1.5 = 9.375, rounded up to a multiple of $5
    expect(Number((await one<{ p: string }>(`select public.get_session_price_usd($1, false) p`, [BABA])).p)).toBe(10);
    const listed = await one<{ usd_price: string; session_price: string }>(
      `select usd_price, session_price from public.get_public_babalawos() where id = $1`, [BABA]);
    expect(Number(listed.usd_price)).toBe(10);
    expect(Number(listed.session_price)).toBe(10000);
    await as(ADMIN, `select public.admin_set_usd_prices($1, 40, null)`, [BABA]);
    expect(Number((await one<{ p: string }>(`select public.get_session_price_usd($1, true) p`, [BABA])).p)).toBe(40);
    await expect(as(BABA, `update babalawos set usd_session_price = 1 where user_id = $1`, [BABA])).rejects.toThrow(/set by the admin/);
  });

  it("charges the diaspora in dollars through Flutterwave only, and pays the Babalawo their usual naira share", async () => {
    await freeSlot();
    await expect(sessionIntent(UK, "paystack", "GB")).rejects.toThrow(/go through Flutterwave/);
    const i = await sessionIntent(UK, "flutterwave", "GB");
    expect(i.currency).toBe("USD");
    expect(Number(i.amount)).toBe(40);
    const r = await settle(i.reference, 40, "USD");
    expect(r.status).toBe("settled");

    const p = await one<Record<string, string>>(`select * from payments where session_id = $1`, [r.session_id]);
    expect(p.currency).toBe("USD");
    expect(Number(p.paid_amount)).toBe(40);
    expect(Number(p.amount)).toBe(64000);             // naira value: 40 x 1,600
    expect(Number(p.babalawo_amount)).toBe(8000);     // 80% of the Babalawo's 10,000 naira price
    expect(Number(p.commission_amount)).toBe(56000);  // the dollar premium stays with the platform
    const s = await one<Record<string, string>>(`select amount, paid_amount, currency from sessions where id = $1`, [r.session_id]);
    expect(s).toMatchObject({ currency: "USD" });
    expect(Number(s.paid_amount)).toBe(40);
    const part = await one<{ pending: string }>(
      `select pending from babalawo_balance_parts where babalawo_id = $1 and provider = 'flutterwave'`, [BABA]);
    expect(Number(part.pending)).toBe(8000);

    // a refund goes back to the client's wallet in dollars
    await one(`select public._refund_session($1, 'test', null)`, [r.session_id]);
    const w = await one<{ balance: string; currency: string }>(`select balance, currency from wallets where user_id = $1`, [UK]);
    expect(w.currency).toBe("USD");
    expect(Number(w.balance)).toBe(40);
  });

  it("lets a dollar wallet pay part and the card the rest, in dollars", async () => {
    await freeSlot();
    await admin.query(`select public._wallet_apply($1, 15, 'debit', 'session_payment', null, 'spend-usd', 'test')`, [UK]);
    const i = await sessionIntent(UK, "flutterwave", "GB", true);
    expect(i.currency).toBe("USD");
    // the wallet holds $25 of the $40 price; the card pays $15
    expect(Number(i.wallet_amount)).toBe(25);
    expect(Number(i.amount)).toBe(15);
    expect((await settle(i.reference, 15, "USD")).status).toBe("settled");
    expect(Number((await one<{ balance: string }>(`select balance from wallets where user_id = $1`, [UK])).balance)).toBe(0);
  });

  it("keeps Nigerians on naira prices with either provider", async () => {
    await freeSlot();
    const i = await sessionIntent(NG, "paystack", "NG");
    expect(i.currency).toBe("NGN");
    expect(Number(i.amount)).toBe(10000);
    const r = await settle(i.reference, 10000, "NGN");
    const p = await one<Record<string, string>>(`select * from payments where session_id = $1`, [r.session_id]);
    expect(p.currency).toBe("NGN");
    expect(Number(p.amount)).toBe(10000);
    expect(Number(p.paid_amount)).toBe(10000);
  });

  it("keeps a wallet that holds money in its own currency, wherever the person is", async () => {
    await freeSlot();
    await setWallet(admin, NG, 5000);
    expect((await sessionIntent(NG, "flutterwave", "US")).currency).toBe("NGN");
    await setWallet(admin, NG, 0);
    expect(await currency(NG, "US")).toBe("USD");
  });

  it("charges a diaspora Ebo in dollars from the dollar wallet", async () => {
    // a past consultation between them, then a sent Ebo of 35,200 naira due
    const s = await one<{ id: string }>(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values ($1, $2, current_date, '10:00', '11:00', 'completed', 'paid', 15000) returning id::text`, [UK, BABA]);
    const d = await as<{ id: string }>(BABA, `select public.ebo_save_draft(null, $1, 'ebo', 'Ebo for open roads', 'x', 'babalawo', null, 20000,
      '[{"name":"Eyele","quantity":2,"unit_price":5000},{"name":"Obi","quantity":4,"unit_price":500}]'::jsonb, now() + interval '2 days', 60) id`, [s.id]);
    await as(BABA, `select public.ebo_send($1)`, [d.id]);
    const due = Number((await one<{ amount_due: string }>(`select amount_due from ebo_prescriptions where id = $1`, [d.id])).amount_due);
    const usd = Math.ceil((due / 1600) * 100) / 100;
    await admin.query(`select public._wallet_apply($1, 100, 'credit', 'payment_gateway', 'flutterwave', 'topup-x', 'test')`, [UK]);
    const before = Number((await one<{ balance: string }>(`select balance from wallets where user_id = $1`, [UK])).balance);
    await as(UK, `select public.pay_ebo_with_wallet($1, 'absent')`, [d.id]);
    const e = await one<Record<string, string>>(`select paid_currency, paid_amount, status from ebo_prescriptions where id = $1`, [d.id]);
    expect(e).toMatchObject({ paid_currency: "USD", status: "paid" });
    expect(Number(e.paid_amount)).toBe(usd);
    const w = Number((await one<{ balance: string }>(`select balance from wallets where user_id = $1`, [UK])).balance);
    expect(w).toBeCloseTo(before - usd, 2);
    // a full refund returns the dollars paid
    await as(ADMIN, `select public.admin_resolve_ebo($1, 'refund_full', 'test refund')`, [d.id]);
    expect(Number((await one<{ balance: string }>(`select balance from wallets where user_id = $1`, [UK])).balance)).toBeCloseTo(before, 2);
  });
});
