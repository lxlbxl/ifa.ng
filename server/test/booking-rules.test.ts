import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * Booking rules are enforced in the database (public._assert_bookable), so the
 * browser, the Supabase-style functions and the TypeScript API server all share
 * them. These tests go through the real entry point (book_session_with_wallet)
 * as a signed-in client, so nothing here can be bypassed from the UI.
 */
const BABA = "00000000-0000-0000-0000-00000000000b";
const CLIENT = "00000000-0000-0000-0000-00000000000a";
let admin: pg.Client;
let dayN = 3;

const lagosDate = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(d); // yyyy-MM-dd
};
const dow = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

async function book(date: string, time: string) {
  const c = new pg.Client({ ...(admin as any).connectionParameters });
  await c.connect();
  try {
    await c.query("set role authenticated");
    await c.query("select set_config('request.jwt.claim.sub', $1, false)", [CLIENT]);
    const r = await c.query("select public.book_session_with_wallet($1,$2,$3,false,$4) as id", [BABA, date, time, `k-${Math.random()}`]);
    return { ok: true as const, id: r.rows[0].id };
  } catch (e: any) {
    return { ok: false as const, code: e.code as string, message: e.message as string };
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_booking_rules");
  await migrate(url, undefined, () => {});
  admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${CLIENT}','a@x.ng','{}'), ('${BABA}','b@x.ng','{"role":"babalawo"}')`);
  await admin.query(`update babalawos set hourly_rate=10000, is_verified=true where user_id='${BABA}'`);
  await admin.query(`insert into wallets(user_id,balance) values ('${CLIENT}', 10000000) on conflict (user_id) do update set balance=10000000`);
  await admin.query(`insert into availability(babalawo_id,day_of_week,start_time,end_time)
    select '${BABA}', d, '08:00','18:00' from generate_series(0,6) d`);
  await admin.query(`insert into babalawo_scheduling_settings(babalawo_id,slot_minutes,buffer_minutes,min_notice_hours,max_advance_days)
    values ('${BABA}',60,30,24,30) on conflict (babalawo_id) do update set slot_minutes=60,buffer_minutes=30,min_notice_hours=24,max_advance_days=30,accepting_bookings=true`);
}, 60_000);
afterAll(() => admin?.end());

describe("server-side booking rules", () => {
  it("accepts a valid slot", async () => {
    const r = await book(lagosDate(dayN), "10:00");
    expect(r.ok).toBe(true);
  });

  it("refuses a slot outside weekly hours", async () => {
    const r = await book(lagosDate(dayN), "03:00");
    expect(r).toMatchObject({ ok: false, code: "IF001" });
  });

  it("refuses a slot inside the minimum notice window", async () => {
    const r = await book(lagosDate(0), "23:00");
    expect(r).toMatchObject({ ok: false, code: "IF001" });
  });

  it("refuses a date beyond the advance window", async () => {
    const r = await book(lagosDate(40), "10:00");
    expect(r).toMatchObject({ ok: false, code: "IF001" });
  });

  it("refuses a fully blocked date", async () => {
    const d = lagosDate(5);
    await admin.query(`insert into availability_exceptions(babalawo_id,exception_date,kind) values ($1,$2,'blocked')`, [BABA, d]);
    expect(await book(d, "10:00")).toMatchObject({ ok: false, code: "IF001" });
  });

  it("refuses a partially blocked time but allows the rest of the day", async () => {
    const d = lagosDate(6);
    await admin.query(`insert into availability_exceptions(babalawo_id,exception_date,kind,start_time,end_time) values ($1,$2,'blocked','12:00','14:00')`, [BABA, d]);
    expect(await book(d, "12:00")).toMatchObject({ ok: false, code: "IF001" });
    expect((await book(d, "15:00")).ok).toBe(true);
  });

  it("refuses a day inside time off", async () => {
    await admin.query(`insert into babalawo_time_off(babalawo_id,start_date,end_date) values ($1,$2,$3)`, [BABA, lagosDate(8), lagosDate(10)]);
    expect(await book(lagosDate(9), "10:00")).toMatchObject({ ok: false, code: "IF001" });
  });

  it("allows an extra window outside the weekly hours", async () => {
    const d = lagosDate(12);
    await admin.query(`insert into availability_exceptions(babalawo_id,exception_date,kind,start_time,end_time) values ($1,$2,'extra','19:00','21:00')`, [BABA, d]);
    expect((await book(d, "19:00")).ok).toBe(true);
  });

  it("enforces the buffer between sessions", async () => {
    const d = lagosDate(14);
    expect((await book(d, "10:00")).ok).toBe(true);
    // 11:00 starts right when the 10:00 session ends, but the 30 minute buffer is not respected.
    expect(await book(d, "11:00")).toMatchObject({ ok: false, code: "IF001" });
    expect(await book(d, "10:00")).toMatchObject({ ok: false });
    expect((await book(d, "12:00")).ok).toBe(true);
  });

  it("refuses everything when the babalawo is not accepting bookings", async () => {
    await admin.query(`update babalawo_scheduling_settings set accepting_bookings=false where babalawo_id=$1`, [BABA]);
    expect(await book(lagosDate(16), "10:00")).toMatchObject({ ok: false, code: "IF001" });
    await admin.query(`update babalawo_scheduling_settings set accepting_bookings=true where babalawo_id=$1`, [BABA]);
  });

  it("refuses a direct insert into sessions that skips the rules", async () => {
    const c = new pg.Client({ ...(admin as any).connectionParameters });
    await c.connect();
    try {
      await c.query("set role authenticated");
      await c.query("select set_config('request.jwt.claim.sub', $1, false)", [CLIENT]);
      await expect(
        c.query(
          `insert into sessions(user_id,babalawo_id,session_date,start_time,end_time,status,payment_status,amount)
           values ($1,$2,$3,'03:00','04:00','confirmed','paid',1)`,
          [CLIENT, BABA, lagosDate(20)],
        ),
      ).rejects.toThrow();
    } finally {
      await c.end();
    }
  });
});
