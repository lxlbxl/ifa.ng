import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * Fair money rules (migration 20261113000000): Consult Now must be accepted or it is
 * refunded, Babalawo no-shows are refunded, earnings wait out a dispute window.
 */
const BABA = "00000000-0000-0000-0000-0000000000b1";
const CLIENT = "00000000-0000-0000-0000-0000000000c1";
let admin: pg.Client;
let dbUrl = "";

async function as<T>(user: string, q: string, params: unknown[] = []): Promise<T> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows[0] as T;
  } finally { await c.end(); }
}
const one = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;
const balance = () => one<{ balance: string }>(`select balance from wallets where user_id = $1`, [CLIENT]).then((r) => Number(r.balance));
const babaWallet = () => one<{ pending_balance: string; available_balance: string }>(
  `select pending_balance, available_balance from babalawo_wallets where babalawo_id = $1`, [BABA])
  .then((r) => ({ pending: Number(r.pending_balance), available: Number(r.available_balance) }));

async function consultNow(): Promise<number> {
  await admin.query(`update babalawos set current_status = 'online' where user_id = $1`, [BABA]);
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const r = await as<{ id: number }>(CLIENT, `select public.book_session_with_wallet($1, $2::date, '12:00', true, $3) id`,
    [BABA, d, `k-${Math.random()}`]);
  return Number(r.id);
}

/** A booked session that started `hoursAgo` hours ago (session length 60 minutes). */
async function pastBooking(hoursAgo: number): Promise<number> {
  const start = new Date(Date.now() - hoursAgo * 3600e3);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(start);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const r = await one<{ id: number }>(`select public._create_paid_session($1, $2, $3::date, $4, false, 10000, 'wallet', $5) id`,
    [CLIENT, BABA, `${g("year")}-${g("month")}-${g("day")}`, `${g("hour")}:${g("minute")}`, `ref-${Math.random()}`]);
  return Number(r.id);
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_money_rules");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','c@x.ng','{}'), ('${BABA}','b@x.ng','{"role":"babalawo"}')`);
  await admin.query(`update babalawos set hourly_rate = 10000, is_verified = true, profile_picture_url = 'https://x.invalid/p.jpg' where user_id = '${BABA}'`);
  await admin.query(`insert into availability(babalawo_id, day_of_week, start_time, end_time) values ('${BABA}', 1, '09:00', '12:00')`);
  await admin.query(`insert into wallets(user_id, balance) values ('${CLIENT}', 1000000)
    on conflict (user_id) do update set balance = 1000000`);
}, 60_000);
afterAll(() => admin?.end());

describe("Consult Now", () => {
  it("waits for the Babalawo to accept, then starts", async () => {
    const id = await consultNow();
    const s = await one<{ status: string; accept_deadline: Date }>(`select status, accept_deadline from sessions where id = $1`, [id]);
    expect(s.status).toBe("pending");
    expect(s.accept_deadline.getTime()).toBeGreaterThan(Date.now() + 60_000);
    // A second client can't pay while this one waits.
    await expect(consultNow()).rejects.toThrow(/answering another client/);
    // The Babalawo can't skip the accept step with a direct update.
    await expect(as(BABA, `update sessions set status = 'confirmed' where id = $1`, [id])).rejects.toThrow(/Accept/);
    await as(BABA, `select public.accept_instant_session($1)`, [id]);
    expect((await one<{ status: string }>(`select status from sessions where id = $1`, [id])).status).toBe("in_progress");
    await admin.query(`update sessions set status = 'cancelled' where id = $1`, [id]); // tidy up
  });

  it("refunds the client in full if nobody accepts in time", async () => {
    const before = await balance();
    const id = await consultNow();
    expect(await balance()).toBe(before - 10000);
    await admin.query(`update sessions set accept_deadline = now() - interval '1 second' where id = $1`, [id]);
    expect((await one<{ n: number }>(`select public.expire_unaccepted_instant_sessions() n`)).n).toBe(1);
    expect(await balance()).toBe(before);
    expect((await one<{ status: string; payment_status: string }>(`select status, payment_status from sessions where id = $1`, [id])))
      .toEqual({ status: "cancelled", payment_status: "refunded" });
    await expect(as(BABA, `select public.accept_instant_session($1)`, [id])).rejects.toThrow(/no longer waiting/);
  });

  it("refunds a client who gives up while waiting", async () => {
    const before = await balance();
    const id = await consultNow();
    const r = await as<{ r: { refunded: number } }>(CLIENT, `select public.cancel_session($1, 'tired of waiting') r`, [id]);
    expect(Number(r.r.refunded)).toBe(10000);
    expect(await balance()).toBe(before);
  });
});

describe("booked sessions", () => {
  it("won't let the Babalawo complete a session before it starts", async () => {
    const id = await pastBooking(-24);
    await expect(as(BABA, `update sessions set status = 'completed' where id = $1`, [id])).rejects.toThrow(/not started yet/);
  });

  it("refunds the client when the Babalawo never joins", async () => {
    // Created as paid directly (no wallet debit here), so the refund shows as a credit.
    const id = await pastBooking(4);
    const before = await balance();
    await as(CLIENT, `select public.record_session_join($1)`, [id]);
    await admin.query(`select public.auto_complete_sessions()`);
    const s = await one<{ status: string; no_show: string }>(`select status, no_show from sessions where id = $1`, [id]);
    expect(s).toEqual({ status: "cancelled", no_show: "babalawo" });
    expect(await balance()).toBe(before + 10000);
  });

  it("leaves a no-show for the admin when automatic refunds are off", async () => {
    await admin.query(`update admin_settings set setting_value = 'false' where setting_key = 'babalawo_no_show_refund'`);
    const id = await pastBooking(5);
    const before = await balance();
    await admin.query(`select public.auto_complete_sessions()`);
    const s = await one<{ status: string; no_show: string }>(`select status, no_show from sessions where id = $1`, [id]);
    expect(s).toEqual({ status: "confirmed", no_show: "babalawo" });
    expect(await balance()).toBe(before);
    await admin.query(`update admin_settings set setting_value = 'true' where setting_key = 'babalawo_no_show_refund'`);
  });

  it("completes when the Babalawo joined, and holds the earnings until the window passes", async () => {
    const id = await pastBooking(6);
    const w0 = await babaWallet();
    await as(BABA, `select public.record_session_join($1)`, [id]);
    await admin.query(`select public.auto_complete_sessions()`);
    const s = await one<{ status: string; earnings_release_at: Date }>(`select status, earnings_release_at from sessions where id = $1`, [id]);
    expect(s.status).toBe("completed");
    expect(s.earnings_release_at.getTime()).toBeGreaterThan(Date.now() + 47 * 3600e3);
    await admin.query(`select public.release_held_earnings()`);
    expect((await babaWallet()).available).toBe(w0.available);

    // An open dispute keeps the money held even after the window.
    await admin.query(`update sessions set earnings_release_at = now() - interval '1 minute' where id = $1`, [id]);
    await admin.query(`insert into disputes(session_id, raised_by, reason) values ($1, $2, 'The Babalawo never sent the notes they promised')`, [id, CLIENT]);
    await admin.query(`select public.release_held_earnings()`);
    expect((await babaWallet()).available).toBe(w0.available);

    await admin.query(`update disputes set status = 'resolved_dismissed' where session_id = $1`, [id]);
    await admin.query(`select public.release_held_earnings()`);
    const w1 = await babaWallet();
    expect(w1.available).toBe(w0.available + 8000);
    expect(w1.pending).toBe(w0.pending - 8000);
  });
});

describe("slot holds", () => {
  it("keeps one hold per person", async () => {
    const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    await as(CLIENT, `select public.acquire_slot_lock($1, $2::date, '10:00', $3, 10)`, [BABA, d, CLIENT]);
    await as(CLIENT, `select public.acquire_slot_lock($1, $2::date, '11:00', $3, 10)`, [BABA, d, CLIENT]);
    const n = await one<{ n: number }>(`select count(*)::int n from slot_locks where locked_by_user_id = $1 and status = 'locked'`, [CLIENT]);
    expect(n.n).toBe(1);
  });
});
