import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

// Admin → Users: per-person record, insights, notes, messages and sign-out. Admin only, audited.
const ADMIN = "00000000-0000-0000-0000-0000000000aa";
const BABA = "00000000-0000-0000-0000-0000000000ba";
const BIG = "00000000-0000-0000-0000-0000000000c1"; // high value, frequent
const ONCE = "00000000-0000-0000-0000-0000000000c2"; // one booking, long ago
const NONE = "00000000-0000-0000-0000-0000000000c3"; // never booked
let admin: pg.Client;
let dbUrl = "";

async function as<T = Record<string, unknown>>(user: string, q: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows as T[];
  } finally { await c.end(); }
}
const one = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;

async function booking(client: string, daysAgo: number, amount: number, status = "completed") {
  const s = await one<{ id: number }>(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount, created_at)
    values ($1, $2, current_date - $3::int, '10:00', '11:00', $4, 'paid', $5, now() - make_interval(days => $3::int)) returning id`,
    [client, BABA, daysAgo, status, amount]);
  await admin.query(`insert into payments(user_id, session_id, amount, commission_amount, babalawo_amount, payment_gateway, payment_reference, status, created_at)
    values ($1, $2::bigint, $3, 0, $3, 'paystack', 'ref-' || $2::text, 'completed', now() - make_interval(days => $4::int))`, [client, s.id, amount, daysAgo]);
  return Number(s.id);
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_admin_users");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, phone, name, raw_user_meta_data) values
    ('${ADMIN}', 'aa@x.ng', '+2348000000101', 'Ada Admin', '{}'), ('${BABA}', 'ba@x.ng', '+2348000000102', 'Baba Ifa', '{"role":"babalawo"}'),
    ('${BIG}', 'big@x.ng', '+2348000000103', 'Bola Big', '{}'), ('${ONCE}', '2348000000104@phone.ifa.invalid', '+2348000000104', 'Ola Once', '{}'),
    ('${NONE}', 'none@x.ng', '+2348000000105', 'Nike None', '{}')`);
  await admin.query(`update profiles set full_name = u.name from auth.users u where u.id = profiles.id`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin'), ($2, 'babalawo') on conflict do nothing`, [ADMIN, BABA]);
  for (const d of [80, 40, 20, 5]) await booking(BIG, d, 40000);
  await booking(ONCE, 200, 15000);
  await admin.query(`update payments set refunded_amount = 5000, status = 'refunded' where user_id = $1`, [ONCE]);
}, 60_000);
afterAll(() => admin?.end());

describe("admin_user_directory", () => {
  it("is admin only", async () => {
    await expect(as(BIG, `select * from admin_user_directory()`)).rejects.toThrow(/Admin access required/);
    await expect(as(BIG, `select admin_user_detail($1)`, [BIG])).rejects.toThrow(/Admin access required/);
    await expect(as(BIG, `select * from _admin_user_stats()`)).rejects.toThrow(/permission denied/);
    await expect(as(BIG, `select * from admin_user_notes`)).resolves.toEqual([]);
  });

  it("computes spend after refunds, bookings, frequency and labels", async () => {
    const rows = await as<{ id: string; lifetime_spend: string; bookings_total: number; bookings_90d: number; avg_days_between: string; tags: string[]; email: string | null }>(
      ADMIN, `select * from admin_user_directory(p_sort => 'spend')`);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(rows[0].id).toBe(BIG);
    expect(Number(by[BIG].lifetime_spend)).toBe(160000);
    expect(by[BIG].bookings_total).toBe(4);
    expect(by[BIG].bookings_90d).toBe(4);
    expect(Number(by[BIG].avg_days_between)).toBe(25);
    expect(by[BIG].tags).toEqual(expect.arrayContaining(["high_value", "frequent"]));
    expect(Number(by[ONCE].lifetime_spend)).toBe(10000);
    expect(by[ONCE].tags).toContain("one_time");
    expect(by[ONCE].email).toBeNull(); // synthetic phone-login address is hidden
    expect(by[NONE].tags).toContain("never_booked");
    expect(by[BABA].tags).not.toContain("never_booked");
  });

  it("filters, searches by name or phone, sorts and pages", async () => {
    const hv = await as<{ id: string; total_count: string }>(ADMIN, `select id, total_count from admin_user_directory(p_filter => 'high_value')`);
    expect(hv.map((r) => r.id)).toEqual([BIG]);
    const babs = await as<{ id: string }>(ADMIN, `select id from admin_user_directory(p_filter => 'babalawos')`);
    expect(babs.map((r) => r.id)).toEqual([BABA]);
    expect((await as<{ id: string }>(ADMIN, `select id from admin_user_directory(p_search => '0104')`)).map((r) => r.id)).toEqual([ONCE]);
    expect((await as<{ id: string }>(ADMIN, `select id from admin_user_directory(p_search => 'nike')`)).map((r) => r.id)).toEqual([NONE]);
    const page = await as<{ total_count: string }>(ADMIN, `select total_count from admin_user_directory(p_limit => 2, p_offset => 0)`);
    expect(page).toHaveLength(2);
    expect(Number(page[0].total_count)).toBe(5);
    const asc = await as<{ id: string }>(ADMIN, `select id from admin_user_directory(p_sort => 'name', p_desc => false)`);
    expect(asc[0].id).toBe(ADMIN);
    await expect(as(ADMIN, `select * from admin_user_directory(p_sort => 'x; drop table profiles')`)).rejects.toThrow(/Unknown sort/);
  });

  it("summarises insights", async () => {
    const [{ admin_user_insights: i }] = await as<{ admin_user_insights: Record<string, any> }>(ADMIN, `select admin_user_insights()`);
    expect(i.total).toBe(5);
    expect(i.payers).toBe(2);
    expect(Number(i.lifetime_spend)).toBe(170000);
    expect(Number(i.repeat_rate)).toBe(50);
    expect(i.frequency).toMatchObject({ once: 1, four_to_nine: 1 });
    expect(i.top_spenders[0].id).toBe(BIG);
    expect(i.signups_by_month).toHaveLength(6);
  });
});

describe("admin_user_detail", () => {
  it("returns the record without consultation content and logs the access once per 15 minutes", async () => {
    await admin.query(`update sessions set primary_odu = 'Ogbe Meji', notes = 'private' where user_id = $1`, [BIG]);
    const [{ admin_user_detail: d }] = await as<{ admin_user_detail: Record<string, any> }>(ADMIN, `select admin_user_detail($1)`, [BIG]);
    expect(d.stats.id).toBe(BIG);
    expect(d.sessions).toHaveLength(4);
    expect(d.sessions[0].other_name).toBe("Baba Ifa");
    expect(d.payments).toHaveLength(4);
    expect(JSON.stringify(d)).not.toMatch(/Ogbe Meji|private/);
    await as(ADMIN, `select admin_user_detail($1)`, [BIG]);
    const n = await one<{ n: string }>(`select count(*) n from admin_audit_log where action = 'view_user_record' and target_id = $1`, [BIG]);
    expect(Number(n.n)).toBe(1);
    // The Babalawo's record shows their sessions from the other side.
    const [{ admin_user_detail: b }] = await as<{ admin_user_detail: Record<string, any> }>(ADMIN, `select admin_user_detail($1)`, [BABA]);
    expect(b.sessions.every((s: { as_role: string }) => s.as_role === "babalawo")).toBe(true);
    expect(b.babalawo).not.toBeNull();
  });
});

describe("manage actions", () => {
  it("adds, pins and deletes notes with an audit trail, and notes go on erasure", async () => {
    const [{ admin_add_user_note: id }] = await as<{ admin_add_user_note: string }>(ADMIN, `select admin_add_user_note($1, 'Prefers WhatsApp', true)`, [NONE]);
    await expect(as(BIG, `select admin_add_user_note($1, 'x')`, [NONE])).rejects.toThrow(/Admin access required/);
    await expect(as(ADMIN, `insert into admin_user_notes(user_id, body) values ($1, 'x')`, [NONE])).rejects.toThrow(/permission denied/);
    const [{ admin_user_detail: d }] = await as<{ admin_user_detail: Record<string, any> }>(ADMIN, `select admin_user_detail($1)`, [NONE]);
    expect(d.notes[0]).toMatchObject({ body: "Prefers WhatsApp", pinned: true, author_name: "Ada Admin" });
    await as(ADMIN, `select admin_update_user_note($1, false)`, [id]);
    const actions = (await admin.query(`select action from admin_audit_log where target_id = $1 order by created_at`, [NONE])).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["add_user_note", "unpin_user_note", "view_user_record"]));
    await as(ADMIN, `select admin_add_user_note($1, 'second')`, [NONE]);
    await admin.query(`update auth.users set deleted_at = now() where id = $1`, [NONE]);
    expect(Number((await one<{ n: string }>(`select count(*) n from admin_user_notes where user_id = $1`, [NONE])).n)).toBe(0);
  });

  it("messages a person and signs them out; suspending also signs out", async () => {
    await as(ADMIN, `select admin_message_user($1, 'Hello', 'Your refund is on its way')`, [BIG]);
    expect((await one<{ type: string }>(`select type from notifications where user_id = $1 order by created_at desc limit 1`, [BIG])).type).toBe("admin_message");
    await admin.query(`insert into auth.sessions(user_id, token, expires_at) values ($1, 't1', now() + interval '1 day'), ($1, 't2', now() + interval '1 day')`, [BIG]);
    const [{ admin_sign_out_user: n }] = await as<{ admin_sign_out_user: number }>(ADMIN, `select admin_sign_out_user($1)`, [BIG]);
    expect(n).toBe(2);
    await expect(as(ADMIN, `select admin_sign_out_user($1)`, [ADMIN])).rejects.toThrow(/yourself/);
    await admin.query(`insert into auth.sessions(user_id, token, expires_at) values ($1, 't3', now() + interval '1 day')`, [BIG]);
    await as(ADMIN, `select admin_set_user_suspended($1, true, 'chargeback')`, [BIG]);
    expect(Number((await one<{ n: string }>(`select count(*) n from auth.sessions where user_id = $1`, [BIG])).n)).toBe(0);
    const s = await as<{ tags: string[]; is_suspended: boolean }>(ADMIN, `select * from admin_user_directory(p_filter => 'suspended')`);
    expect(s).toHaveLength(1);
  });
});

describe("Babalawo record", () => {
  it("logs Online history, shows practice stats, and features or takes offline with an audit trail", async () => {
    await admin.query(`update babalawos set current_status = 'online' where user_id = $1`, [BABA]);
    await admin.query(`update babalawo_presence_log set started_at = now() - interval '3 hours' where babalawo_id = $1`, [BABA]);
    await as(ADMIN, `select admin_set_babalawo_listing($1, true, true)`, [BABA]);
    const [{ admin_user_detail: d }] = await as<{ admin_user_detail: Record<string, any> }>(ADMIN, `select admin_user_detail($1)`, [BABA]);
    expect(d.practice.completed).toBe(5);
    expect(d.practice.unique_clients).toBe(2);
    expect(d.practice.repeat_clients).toBe(1);
    expect(d.practice.presence).toHaveLength(1);
    expect(d.practice.presence[0].ended_at).not.toBeNull();
    expect(Number(d.practice.online_hours_30d)).toBeCloseTo(3, 0);
    expect(d.practice.profile.is_featured).toBe(true);
    const acts = (await admin.query(`select action from admin_audit_log where target_id = $1`, [BABA])).rows.map((r) => r.action);
    expect(acts).toEqual(expect.arrayContaining(["feature_babalawo", "set_babalawo_offline"]));
    await expect(as(BIG, `select admin_set_babalawo_listing($1, false)`, [BABA])).rejects.toThrow(/Admin access required/);
    await expect(as(BABA, `select * from babalawo_presence_log`)).resolves.toEqual([]);
  });
});
