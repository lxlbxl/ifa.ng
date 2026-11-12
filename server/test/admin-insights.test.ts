import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

// Insight cards on the admin pages: one admin-only RPC, numbers per section.
const ADMIN = "00000000-0000-0000-0000-0000000000e1";
const BABA = "00000000-0000-0000-0000-0000000000e2";
const CLIENT = "00000000-0000-0000-0000-0000000000e3";
let admin: pg.Client;
let dbUrl = "";

type Metric = { value: number | string | null; prev?: number | null; spark?: number[] };
type Insights = { section: string; days: number; metrics: Record<string, Metric> };

async function as(user: string | null, q: string, params: unknown[] = []) {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query(user ? "set role authenticated" : "set role anon");
    if (user) await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows[0];
  } finally { await c.end(); }
}
const insights = async (section: string, days = 30) =>
  (await as(ADMIN, `select public.admin_insights($1, $2) as r`, [section, days])).r as Insights;

const SECTIONS = ["overview", "bookings", "disputes", "ebo", "reviews", "babalawos", "applications", "finance",
  "transactions", "wallet-management", "withdrawal-management", "privacy", "activity"];

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_admin_insights");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, phone, raw_user_meta_data) values
    ('${ADMIN}', 'e1@x.ng', '+2348000000101', '{}'), ('${CLIENT}', 'e3@x.ng', '+2348000000103', '{}'),
    ('${BABA}', 'e2@x.ng', '+2348000000102', '{"role":"babalawo"}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin')`, [ADMIN]);
  // Two completed sessions this period, one in the period before, one cancelled this period.
  for (const [days, status] of [[-2, "completed"], [-5, "completed"], [-40, "completed"], [-3, "cancelled"]] as const) {
    const s = await admin.query(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values ($1, $2, current_date + $3::int, '10:00', '11:00', $4, 'paid', 10000) returning id`, [CLIENT, BABA, days, status]);
    const id = s.rows[0].id;
    const at = `now() + interval '${days} days'`;
    await admin.query(`update sessions set created_at = ${at}, completed_at = case when status = 'completed' then ${at} end where id = $1`, [id]);
    if (status === "completed") {
      await admin.query(`insert into payments(user_id, babalawo_id, session_id, amount, commission_amount, babalawo_amount, payment_gateway, payment_reference, status, created_at)
        values ($1, $2, $3::bigint, 10000, 2000, 8000, 'paystack', 'ref-' || $3::bigint::text, 'completed', ${at})`, [CLIENT, BABA, id]);
    }
  }
}, 60_000);
afterAll(() => admin?.end());

describe("admin insights", () => {
  it("is for admins only", async () => {
    await expect(as(CLIENT, `select public.admin_insights('overview', 30)`)).rejects.toThrow(/Admin only/);
    await expect(as(BABA, `select public.admin_insights('finance', 30)`)).rejects.toThrow(/Admin only/);
    await expect(as(null, `select public.admin_insights('overview', 30)`)).rejects.toThrow();
  });

  it("cannot reach the private helpers directly", async () => {
    await expect(as(ADMIN, `select private.insight_metric('select now() as at, 1 as v', 30)`)).rejects.toThrow();
  });

  it("answers every admin section, and refuses unknown ones", async () => {
    for (const section of SECTIONS) {
      const r = await insights(section);
      expect(r.section).toBe(section);
      expect(Object.keys(r.metrics).length).toBeGreaterThan(2);
    }
    await expect(insights("users")).rejects.toThrow(/Unknown insights section/);
  });

  it("compares this period with the one before, with a 12-point trend", async () => {
    const { metrics } = await insights("overview", 30);
    expect(metrics.gmv.value).toBe(20000);
    expect(metrics.gmv.prev).toBe(10000);
    expect(metrics.platform_revenue.value).toBe(4000);
    expect(metrics.sessions_completed.value).toBe(2);
    expect(metrics.gmv.spark).toHaveLength(12);
    expect(metrics.gmv.spark!.reduce((a, b) => a + b, 0)).toBe(20000);
  });

  it("works out rates as percentages", async () => {
    const { metrics } = await insights("bookings", 30);
    expect(metrics.completion_rate.value).toBeCloseTo(66.67, 1);
    const fin = (await insights("finance", 30)).metrics;
    expect(fin.take_rate.value).toBe(20);
  });

  it("clamps the period to a sane range", async () => {
    expect((await insights("overview", 0)).days).toBe(1);
    expect((await insights("overview", 5000)).days).toBe(366);
  });
});
