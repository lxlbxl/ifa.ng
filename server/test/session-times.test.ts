import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * Booked times are the Babalawo's own clock; the real start (starts_at) is what reminders,
 * join windows, refunds and auto-complete use, whatever zone the client is in.
 */
const BABA = "00000000-0000-0000-0000-0000000000b2";
const CLIENT = "00000000-0000-0000-0000-0000000000c2";
let admin: pg.Client;
let dbUrl = "";

const one = async <T,>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_session_times");
  dbUrl = url;
  await migrate(url, undefined, () => {});
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','c2@x.ng','{}'), ('${BABA}','b2@x.ng','{"role":"babalawo"}')`);
  await admin.query(`update babalawos set hourly_rate = 10000, is_verified = true where user_id = '${BABA}'`);
  await admin.query(`update profiles set timezone = 'America/New_York' where id = '${CLIENT}'`);
  await admin.query(`insert into babalawo_scheduling_settings(babalawo_id, timezone, slot_minutes)
    values ('${BABA}', 'Europe/London', 45) on conflict (babalawo_id) do update set timezone = excluded.timezone, slot_minutes = 45`);
}, 60_000);
afterAll(() => admin?.end());

describe("session times", () => {
  it("reads a booked time on the Babalawo's clock and remembers the client's zone", async () => {
    const r = await one<{ id: number }>(`select public._create_paid_session($1, $2, '2027-01-15', '14:00', false, 10000, 'wallet', 'tz-1') id`,
      [CLIENT, BABA]);
    const s = await one<{ starts_at: Date; ends_at: Date; user_timezone: string; start: Date }>(
      `select starts_at, ends_at, user_timezone, public.session_start_at(id) start from sessions where id = $1`, [r.id]);
    // 14:00 in London in January is 14:00 UTC (9:00 am for the client in New York).
    expect(s.starts_at.toISOString()).toBe("2027-01-15T14:00:00.000Z");
    expect(s.start.toISOString()).toBe("2027-01-15T14:00:00.000Z");
    expect(s.ends_at.getTime() - s.starts_at.getTime()).toBe(45 * 60_000);
    expect(s.user_timezone).toBe("America/New_York");
  });

  it("follows summer time on the Babalawo's side", async () => {
    const r = await one<{ id: number }>(`select public._create_paid_session($1, $2, '2027-07-15', '14:00', false, 10000, 'wallet', 'tz-2') id`,
      [CLIENT, BABA]);
    const s = await one<{ starts_at: Date }>(`select starts_at from sessions where id = $1`, [r.id]);
    expect(s.starts_at.toISOString()).toBe("2027-07-15T13:00:00.000Z");
  });

  it("moves the real start when the time changes", async () => {
    const r = await one<{ id: number }>(`select public._create_paid_session($1, $2, '2027-02-01', '10:00', false, 10000, 'wallet', 'tz-3') id`,
      [CLIENT, BABA]);
    await admin.query(`update sessions set start_time = '11:30', end_time = '12:15' where id = $1`, [r.id]);
    const s = await one<{ starts_at: Date; ends_at: Date }>(`select starts_at, ends_at from sessions where id = $1`, [r.id]);
    expect(s.starts_at.toISOString()).toBe("2027-02-01T11:30:00.000Z");
    expect(s.ends_at.toISOString()).toBe("2027-02-01T12:15:00.000Z");
  });

  it("starts Consult Now when it is paid, whatever date the browser sent", async () => {
    const r = await one<{ id: number }>(`select public._create_paid_session($1, $2, '2020-01-01', '03:00', true, 10000, 'wallet', 'tz-4') id`,
      [CLIENT, BABA]);
    const s = await one<{ starts_at: Date; session_date: string; start_time: string }>(
      `select starts_at, session_date::text, to_char(start_time, 'HH24:MI') start_time from sessions where id = $1`, [r.id]);
    expect(Math.abs(s.starts_at.getTime() - Date.now())).toBeLessThan(60_000);
    const london = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    expect(s.session_date).toBe(london);
  });

  it("lets people save their own time zone", async () => {
    const c = new pg.Client({ connectionString: dbUrl });
    await c.connect();
    try {
      await c.query("set role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, false)", [CLIENT]);
      await c.query(`update profiles set timezone = 'Europe/Paris' where id = $1`, [CLIENT]);
    } finally { await c.end(); }
    expect((await one<{ timezone: string }>(`select timezone from profiles where id = $1`, [CLIENT])).timezone).toBe("Europe/Paris");
  });
});
