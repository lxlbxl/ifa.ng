import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase, setBabalawoAvailable, setWallet } from "./helpers.js";

/**
 * Part wallet, part card (migration 20261115000000): the wallet pays what it holds, the
 * gateway the rest. Nothing leaves the wallet until the card part is confirmed.
 */
const BABA = "00000000-0000-0000-0000-0000000000b5";
const CLIENT = "00000000-0000-0000-0000-0000000000c5";
let admin: pg.Client;

const one = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;
const balance = () => one<{ balance: string }>(`select balance from wallets where user_id = $1`, [CLIENT]).then((r) => Number(r?.balance ?? 0));
const setBalance = (n: number) => setWallet(admin, CLIENT, n);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());

type Intent = { reference: string; amount: string; wallet_amount: string; total: string };
const intent = (useWallet: boolean) => one<Intent>(
  `select * from public.create_payment_intent($1, 'session', 'paystack', null, $2, $3::date, '12:00', true, null, null, $4)`,
  [CLIENT, BABA, today(), useWallet]);
const settle = (ref: string, paid: number) =>
  one<{ r: { status: string; session_id?: number } }>(`select public.settle_payment_intent($1, $2, 'NGN', 'tx') r`, [ref, paid]).then((x) => x.r);

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_wallet_part_payment");
  await migrate(url, undefined, () => {});
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','c5@x.ng','{}'), ('${BABA}','b5@x.ng','{"role":"babalawo"}')`);
  await admin.query(`update babalawos set hourly_rate = 10000, is_verified = true, profile_picture_url = 'https://x.invalid/p.jpg' where user_id = '${BABA}'`);
  await admin.query(`insert into availability(babalawo_id, day_of_week, start_time, end_time) values ('${BABA}', 1, '09:00', '12:00')`);
}, 60_000);
afterAll(() => admin?.end());
beforeEach(async () => {
  await admin.query(`update sessions set status = 'cancelled' where babalawo_id = $1`, [BABA]);
  await admin.query(`update babalawos set current_status = 'online' where user_id = $1`, [BABA]);
});

describe("paying part from the wallet and the rest by card", () => {
  it("charges the card only the difference and books the full price", async () => {
    await setBalance(4000);
    const i = await intent(true);
    const total = Number(i.total);
    expect(Number(i.wallet_amount)).toBe(4000);
    expect(Number(i.amount)).toBe(total - 4000);
    expect(await balance()).toBe(4000); // nothing taken before the card is confirmed

    const r = await settle(i.reference, total - 4000);
    expect(r.status).toBe("settled");
    expect(await balance()).toBe(0);
    const s = await one<{ amount: string; payment_status: string }>(`select amount, payment_status from sessions where id = $1`, [r.session_id]);
    expect(Number(s.amount)).toBe(total);
    expect(s.payment_status).toBe("paid");
    const p = await one<{ amount: string; payment_gateway: string }>(`select amount, payment_gateway from payments where session_id = $1`, [r.session_id]);
    expect(Number(p.amount)).toBe(total);
    expect(p.payment_gateway).toBe("paystack");

    // settling twice moves no more money
    expect((await settle(i.reference, total - 4000)).status).toBe("already_settled");
    expect(await balance()).toBe(0);

    // a refund puts the whole price back in the wallet
    await one(`select public._refund_session($1, 'test', null)`, [r.session_id]);
    expect(await balance()).toBe(total);
  });

  it("keeps the card money in the wallet if the wallet was spent meanwhile", async () => {
    await setBalance(4000);
    const i = await intent(true);
    await setBalance(1000);
    const r = await settle(i.reference, Number(i.amount));
    expect(r.status).toBe("wallet_short_credited_to_wallet");
    expect(await balance()).toBe(1000 + Number(i.amount));
    expect(Number((await one<{ n: number }>(`select count(*)::int n from sessions where payment_reference = $1`, [i.reference])).n)).toBe(0);
  });

  it("does not touch the wallet when the slot is gone by the time the card clears", async () => {
    await setBalance(4000);
    const i = await intent(true);
    await admin.query(`update babalawos set current_status = 'offline' where user_id = $1`, [BABA]);
    const r = await settle(i.reference, Number(i.amount));
    expect(r.status).toBe("slot_taken_credited_to_wallet");
    expect(await balance()).toBe(4000 + Number(i.amount));
  });

  it("always leaves at least the card minimum for the card", async () => {
    const probe = await intent(false);
    const total = Number(probe.total);
    await setBalance(total - 50);
    const i = await intent(true);
    expect(Number(i.amount)).toBe(100);
    expect(Number(i.wallet_amount)).toBe(total - 100);
  });

  it("asks to pay from the wallet when it covers everything, and ignores the wallet when not asked", async () => {
    await setBalance(1_000_000);
    await expect(intent(true)).rejects.toThrow(/wallet already covers/);
    const i = await intent(false);
    expect(Number(i.wallet_amount)).toBe(0);
    expect(Number(i.amount)).toBe(Number(i.total));
  });

  it("only charges what is confirmed: a short card payment is held for review", async () => {
    await setBalance(4000);
    const i = await intent(true);
    expect((await settle(i.reference, Number(i.amount) - 1)).status).toBe("amount_mismatch");
    expect(await balance()).toBe(4000);
  });
});
