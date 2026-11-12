import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase, setBabalawoAvailable, setWallet } from "./helpers.js";

const BABA = "00000000-0000-0000-0000-0000000000b3";
const CLIENT = "00000000-0000-0000-0000-0000000000c3";
const OTHER = "00000000-0000-0000-0000-0000000000c4";
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

async function completedSession(): Promise<number> {
  const r = await one<{ id: number }>(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
    values ($1, $2, current_date - 3 - (random() * 100)::int, '10:00', '11:00', 'completed', 'paid', 10000) returning id`, [CLIENT, BABA]);
  return Number(r.id);
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_accounts_reviews");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, phone, raw_user_meta_data) values
    ('${CLIENT}', 'c3@x.ng', '+2348000000031', '{}'), ('${OTHER}', 'c4@x.ng', '+2348000000041', '{}'),
    ('${BABA}', 'b3@x.ng', '+2348000000032', '{"role":"babalawo"}')`);
}, 60_000);
afterAll(() => admin?.end());

describe("reviews", () => {
  it("publish straight away, for the session's own Babalawo, and only once", async () => {
    const id = await completedSession();
    await as(CLIENT, `insert into reviews(session_id, user_id, babalawo_id, rating, comment, is_approved)
      values ($1, $2, $3, 5, '  Clear and kind guidance.  ', false)`, [id, CLIENT, OTHER]);
    const r = await one<{ babalawo_id: string; is_approved: boolean; comment: string }>(`select babalawo_id, is_approved, comment from reviews where session_id = $1`, [id]);
    expect(r).toEqual({ babalawo_id: BABA, is_approved: true, comment: "Clear and kind guidance." });
    expect(Number((await one<{ rating: number }>(`select rating from babalawos where user_id = $1`, [BABA])).rating)).toBe(5);
    await expect(as(CLIENT, `insert into reviews(session_id, user_id, rating) values ($1, $2, 4)`, [id, CLIENT])).rejects.toThrow(/duplicate|unique/);
  });

  it("wait for an admin when approval is switched on", async () => {
    await admin.query(`update admin_settings set setting_value = 'true' where setting_key = 'reviews_need_approval'`);
    const id = await completedSession();
    await as(CLIENT, `insert into reviews(session_id, user_id, rating) values ($1, $2, 3)`, [id, CLIENT]);
    expect((await one<{ is_approved: boolean }>(`select is_approved from reviews where session_id = $1`, [id])).is_approved).toBe(false);
    await admin.query(`update admin_settings set setting_value = 'false' where setting_key = 'reviews_need_approval'`);
  });

  it("can't be written for someone else's session", async () => {
    const id = await completedSession();
    await expect(as(OTHER, `insert into reviews(session_id, user_id, rating) values ($1, $2, 1)`, [id, OTHER])).rejects.toThrow(/row-level security/);
  });
});

describe("deleting an account", () => {
  it("needs the word DELETE and an empty wallet (or giving it up)", async () => {
    await setWallet(admin, OTHER, 2500);
    await expect(as(OTHER, `select public.delete_my_account('yes')`)).rejects.toThrow(/Type DELETE/);
    await expect(as(OTHER, `select public.delete_my_account('DELETE')`)).rejects.toThrow(/wallet still has ₦2,500/);
  });

  it("refuses while a paid consultation is still to come", async () => {
    await admin.query(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values ($1, $2, current_date + 5, '10:00', '11:00', 'confirmed', 'paid', 10000)`, [OTHER, BABA]);
    await expect(as(OTHER, `select public.delete_my_account('DELETE', true)`)).rejects.toThrow(/upcoming consultations/);
    await admin.query(`update sessions set status = 'cancelled' where user_id = $1`, [OTHER]);
  });

  it("removes what identifies the person, keeps the money records, frees the phone number", async () => {
    await admin.query(`insert into auth.sessions(id, user_id, token, expires_at, created_at, updated_at)
      values (gen_random_uuid(), $1, 'tok', now() + interval '1 day', now(), now())`, [OTHER]);
    const r = await as<{ r: { deleted: boolean } }>(OTHER, `select public.delete_my_account('DELETE', true) r`);
    expect(r.r.deleted).toBe(true);
    const u = await one<{ phone: string | null; deleted_at: Date | null; email: string }>(`select phone, deleted_at, email from auth.users where id = $1`, [OTHER]);
    expect(u.phone).toBeNull();
    expect(u.deleted_at).not.toBeNull();
    expect(u.email).toMatch(/@deleted\.ifa\.invalid$/);
    expect((await one<{ full_name: string; phone: string | null }>(`select full_name, phone from profiles where id = $1`, [OTHER])))
      .toEqual({ full_name: "Deleted user", phone: null });
    expect((await one<{ n: number }>(`select count(*)::int n from auth.sessions where user_id = $1`, [OTHER])).n).toBe(0);
    expect((await one<{ n: number }>(`select count(*)::int n from sessions where user_id = $1`, [OTHER])).n).toBe(1);
  });

  it("asks a Babalawo to withdraw their earnings first", async () => {
    await setBabalawoAvailable(admin, BABA, 5000);
    await expect(as(BABA, `select public.delete_my_account('DELETE')`)).rejects.toThrow(/Withdraw them first/);
  });
});
