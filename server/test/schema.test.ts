import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { createDb, type Database } from "../src/db.js";
import { DB_DIR, migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * The live Supabase database is gone, so the schema was rebuilt from the last
 * Supabase-generated type file. This test pins the rebuild to that snapshot:
 * every table, column, type, nullability, enum and function the app was
 * generated against must exist after running db/migrations on plain Postgres.
 */
type Snapshot = {
  tables: Record<string, { columns: Record<string, { ts: string; insertOptional: boolean }> }>;
  enums: Record<string, string[]>;
  functions: Record<string, unknown>;
};

// Deliberate differences from the 2025 snapshot, each explained in the baseline.
const ALLOWED = new Set([
  "session_logs.session_id",   // text in 2025; now bigint like every other session_id
]);
// Functions removed on purpose by later migrations.
const REMOVED_FUNCTIONS = new Set(["update_wallet_balance"]); // dropped by the payments migration if present

let database: Database;
let snapshot: Snapshot;

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_schema");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  snapshot = JSON.parse(await readFile(path.join(DB_DIR, "reference", "supabase-types-2025-08-08.json"), "utf8"));
});
afterAll(() => database?.close());

const TS: Record<string, string> = {
  uuid: "string", text: "string", varchar: "string", date: "string", time: "string", timestamptz: "string",
  int2: "number", int4: "number", int8: "number", numeric: "number", float4: "number", float8: "number",
  bool: "boolean", jsonb: "Json", json: "Json", _text: "string[]", _int4: "number[]",
};

describe("rebuilt schema matches the last Supabase-generated types", () => {
  it("has every table and column with a compatible type and nullability", async () => {
    const rows = (await sql<{ t: string; c: string; udt: string; dt: string; nullable: string; def: string | null; ident: string }>`
      select table_name t, column_name c, udt_name udt, data_type dt, is_nullable nullable,
             column_default def, is_identity ident
      from information_schema.columns where table_schema = 'public'`.execute(database.db)).rows;
    const have = new Map(rows.map((r) => [`${r.t}.${r.c}`, r]));
    const problems: string[] = [];
    for (const [table, def] of Object.entries(snapshot.tables)) {
      for (const [col, want] of Object.entries(def.columns)) {
        const key = `${table}.${col}`;
        if (ALLOWED.has(key)) continue;
        const h = have.get(key);
        if (!h) { problems.push(`missing ${key}`); continue; }
        const base = h.dt === "USER-DEFINED" ? `Database["public"]["Enums"]["${h.udt}"]` : TS[h.udt] ?? h.udt;
        const got = h.nullable === "YES" ? `${base} | null` : base;
        if (got !== want.ts) problems.push(`${key}: ${got} != ${want.ts}`);
        const optional = h.nullable === "YES" || h.def !== null || h.ident === "YES";
        // A column the app may omit on insert must have a default (extra defaults are harmless).
        if (want.insertOptional && !optional) problems.push(`${key}: needs a default`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has every enum with the same values", async () => {
    const rows = (await sql<{ n: string; v: string[] }>`
      select t.typname n, array_agg(e.enumlabel::text order by e.enumsortorder) v
      from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace s on s.oid = t.typnamespace
      where s.nspname = 'public' group by 1`.execute(database.db)).rows;
    for (const [name, values] of Object.entries(snapshot.enums)) {
      expect(rows.find((r) => r.n === name)?.v, name).toEqual(values);
    }
  });

  it("has every function the app calls", async () => {
    const rows = (await sql<{ p: string }>`select proname p from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where nspname = 'public'`.execute(database.db)).rows.map((r) => r.p);
    for (const fn of Object.keys(snapshot.functions)) if (!REMOVED_FUNCTIONS.has(fn)) expect(rows, fn).toContain(fn);
    for (const fn of ["acquire_slot_lock", "release_slot_lock", "complete_slot_lock", "cleanup_expired_slot_locks",
      "create_notification", "get_recent_audit_logs", "check_duplicate_session"]) expect(rows, fn).toContain(fn);
  });
});

const CLIENT = "aaaaaaaa-0000-4000-8000-000000000001";
const BABALAWO = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER = "cccccccc-0000-4000-8000-000000000003";

describe("baseline behaviour on plain Postgres", () => {
  beforeAll(async () => {
    await database.as({ kind: "service" }, (trx) => sql`
      insert into auth.users(id, email, raw_user_meta_data) values
        (${CLIENT}, 'client@example.com', '{"full_name":"Ade"}'),
        (${BABALAWO}, 'baba@example.com', '{"full_name":"Baba","role":"babalawo"}'),
        (${OTHER}, 'evil@example.com', '{"role":"admin"}')`.execute(trx));
  });

  it("signup creates a profile and wallet, a babalawo row only for babalawos, and never an admin", async () => {
    const r = await database.as({ kind: "service" }, (trx) => sql<{ id: string; role: string; wallet: number; baba: number }>`
      select p.id, p.role::text, (select count(*)::int from wallets w where w.user_id = p.id) wallet,
             (select count(*)::int from babalawos b where b.user_id = p.id) baba
      from profiles p order by p.email`.execute(trx));
    expect(r.rows).toEqual([
      { id: BABALAWO, role: "babalawo", wallet: 1, baba: 1 },
      { id: CLIENT, role: "user", wallet: 1, baba: 0 },
      { id: OTHER, role: "user", wallet: 1, baba: 0 },
    ]);
  });

  it("users see only their own profile and cannot promote themselves", async () => {
    const seen = await database.as({ kind: "user", userId: CLIENT }, (trx) =>
      sql<{ id: string }>`select id from profiles`.execute(trx));
    expect(seen.rows).toEqual([{ id: CLIENT }]);
    const admin = await database.as({ kind: "user", userId: OTHER }, (trx) => sql<{ a: boolean }>`select public.is_admin() a`.execute(trx));
    expect(admin.rows[0].a).toBe(false);
  });

  it("browsers cannot move wallet money", async () => {
    await expect(database.as({ kind: "user", userId: CLIENT }, (trx) =>
      sql`select public.update_wallet_balance(${CLIENT}::uuid, 1000000, 'credit', 'hack')`.execute(trx))).rejects.toThrow(/permission denied|does not exist/);
    // Either the privilege is revoked (payments migration) or RLS filters the update to zero rows.
    await database.as({ kind: "user", userId: CLIENT }, (trx) =>
      sql`update wallets set balance = 1000000`.execute(trx)).catch((e: Error) => expect(e.message).toMatch(/permission denied/));
    const b = await database.as({ kind: "service" }, (trx) =>
      sql<{ b: string }>`select balance b from wallets where user_id = ${CLIENT}`.execute(trx));
    expect(Number(b.rows[0].b)).toBe(0);
  });

  it("slot locks hold a slot for one client and refuse to act for someone else", async () => {
    const day = "2030-01-07";
    const first = await database.as({ kind: "user", userId: CLIENT }, (trx) => sql<{ r: { success: boolean; lock_id: string } }>`
      select public.acquire_slot_lock(${BABALAWO}::uuid, ${day}::date, '10:00', ${CLIENT}::uuid, 5) r`.execute(trx));
    expect(first.rows[0].r.success).toBe(true);

    const second = await database.as({ kind: "user", userId: OTHER }, (trx) => sql<{ r: { success: boolean } }>`
      select public.acquire_slot_lock(${BABALAWO}::uuid, ${day}::date, '10:00', ${OTHER}::uuid, 5) r`.execute(trx));
    expect(second.rows[0].r.success).toBe(false);

    await expect(database.as({ kind: "user", userId: OTHER }, (trx) =>
      sql`select public.release_slot_lock(${first.rows[0].r.lock_id}::uuid, ${CLIENT}::uuid)`.execute(trx))).rejects.toThrow(/not allowed/);

    const released = await database.as({ kind: "user", userId: CLIENT }, (trx) => sql<{ ok: boolean }>`
      select public.release_slot_lock(${first.rows[0].r.lock_id}::uuid, ${CLIENT}::uuid) ok`.execute(trx));
    expect(released.rows[0].ok).toBe(true);
  });

  it("sessions are visible only to their participants", async () => {
    await database.as({ kind: "service" }, (trx) => sql`
      insert into sessions(user_id, babalawo_id, session_date, start_time, end_time)
      values (${CLIENT}, ${BABALAWO}, '2030-01-07', '10:00', '11:00')`.execute(trx));
    const count = (u: string) => database.as({ kind: "user", userId: u }, (trx) =>
      sql<{ n: number }>`select count(*)::int n from sessions`.execute(trx)).then((r) => r.rows[0].n);
    expect(await count(CLIENT)).toBe(1);
    expect(await count(BABALAWO)).toBe(1);
    expect(await count(OTHER)).toBe(0);
  });

  it("the public Babalawo directory lists only verified Babalawos with a complete profile", async () => {
    const list = () => database.as({ kind: "anon" }, (trx) => sql<{ id: string }>`select id from public.get_public_babalawos()`.execute(trx));
    const svc = (q: ReturnType<typeof sql>) => database.as({ kind: "service" }, (trx) => q.execute(trx));
    expect((await list()).rows).toEqual([]);
    await svc(sql`update babalawos set is_verified = true where user_id = ${BABALAWO}`);
    expect((await list()).rows).toEqual([]); // no photo, price or hours yet
    await svc(sql`update babalawos set profile_picture_url = 'https://x.invalid/p.jpg', hourly_rate = 10000 where user_id = ${BABALAWO}`);
    expect((await list()).rows).toEqual([]); // still no hours
    await svc(sql`insert into availability(babalawo_id, day_of_week, start_time, end_time) values (${BABALAWO}::uuid, 1, '09:00', '12:00')`);
    expect((await list()).rows).toEqual([{ id: BABALAWO }]);
    const status = await database.as({ kind: "user", userId: BABALAWO }, (trx) =>
      sql<{ o: Record<string, boolean> }>`select public.babalawo_onboarding() o`.execute(trx));
    expect(status.rows[0].o).toMatchObject({ photo: true, price: true, hours: true, bank: false, google_email: false, listed: true });
    // Nobody else can read another Babalawo's checklist.
    await expect(database.as({ kind: "user", userId: CLIENT }, (trx) =>
      sql`select public.babalawo_onboarding(${BABALAWO}::uuid)`.execute(trx))).rejects.toThrow(/Not allowed/);
  });
});
