import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { createDb, type Database } from "../src/db.js";
import { migrate, DB_DIR } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

// A miniature of the app's real pattern: a table whose RLS policies are
// written in Supabase style with auth.uid(), plus a SECURITY DEFINER helper.
const FIXTURE = `
create table public.notes (
  id bigserial primary key,
  user_id uuid not null references auth.users(id),
  body text not null
);
alter table public.notes enable row level security;
create policy "own notes read"   on public.notes for select using (auth.uid() = user_id);
create policy "own notes write"  on public.notes for insert with check (auth.uid() = user_id);

create function public.my_note_count() returns bigint
language sql stable security definer set search_path = public as $$
  select count(*) from public.notes where user_id = auth.uid()
$$;

-- Supabase-style signup trigger on auth.users.
create table public.profiles (id uuid primary key references auth.users(id), email text);
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for select using (auth.uid() = id);
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, email) values (new.id, new.email); return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
`;

let database: Database;
let dbDir: string;

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_compat");
  dbDir = await mkdtemp(path.join(os.tmpdir(), "ifa-db-"));
  await cp(path.join(DB_DIR, "compat"), path.join(dbDir, "compat"), { recursive: true });
  await mkdir(path.join(dbDir, "migrations"));
  await writeFile(path.join(dbDir, "migrations", "20260101000000_fixture.sql"), FIXTURE);
  await migrate(url, dbDir, () => {});
  database = createDb(url);
  await database.as({ kind: "service" }, async (trx) => {
    await sql`insert into auth.users(id, email) values (${ALICE}, 'alice@example.com'), (${BOB}, 'bob@example.com')`.execute(trx);
    await sql`insert into public.notes(user_id, body) values (${ALICE}, 'a1'), (${ALICE}, 'a2'), (${BOB}, 'b1')`.execute(trx);
  });
});

afterAll(async () => {
  await database?.close();
});

const count = (trx: Parameters<Parameters<Database["as"]>[1]>[0]) =>
  sql<{ n: string }>`select count(*) as n from public.notes`.execute(trx).then((r) => Number(r.rows[0].n));

describe("Supabase compatibility on plain Postgres", () => {
  it("auth.uid() and auth.role() reflect the caller", async () => {
    const r = await database.as({ kind: "user", userId: ALICE }, (trx) =>
      sql<{ uid: string; role: string }>`select auth.uid() as uid, auth.role() as role`.execute(trx));
    expect(r.rows[0]).toEqual({ uid: ALICE, role: "authenticated" });
  });

  it("RLS policies written with auth.uid() filter rows per user", async () => {
    expect(await database.as({ kind: "user", userId: ALICE }, count)).toBe(2);
    expect(await database.as({ kind: "user", userId: BOB }, count)).toBe(1);
  });

  it("anonymous callers see nothing", async () => {
    expect(await database.as({ kind: "anon" }, count)).toBe(0);
  });

  it("the service role bypasses RLS", async () => {
    expect(await database.as({ kind: "service" }, count)).toBe(3);
  });

  it("a user cannot insert rows for someone else", async () => {
    await expect(
      database.as({ kind: "user", userId: BOB }, (trx) =>
        sql`insert into public.notes(user_id, body) values (${ALICE}, 'forged')`.execute(trx)),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot read auth.users directly", async () => {
    await expect(
      database.as({ kind: "user", userId: ALICE }, (trx) => sql`select * from auth.users`.execute(trx)),
    ).rejects.toThrow(/permission denied/);
  });

  it("SECURITY DEFINER functions still see the caller via auth.uid()", async () => {
    const r = await database.as({ kind: "user", userId: BOB }, (trx) =>
      sql<{ n: string }>`select public.my_note_count() as n`.execute(trx));
    expect(Number(r.rows[0].n)).toBe(1);
  });

  it("the signup trigger on auth.users still fires", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    await database.as({ kind: "service" }, (trx) =>
      sql`insert into auth.users(id, email) values (${id}, 'carol@example.com')`.execute(trx));
    const r = await database.as({ kind: "user", userId: id }, (trx) =>
      sql<{ email: string }>`select email from public.profiles`.execute(trx));
    expect(r.rows).toEqual([{ email: "carol@example.com" }]);
  });

  it("identity does not leak between requests on pooled connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, i) => {
        const caller = i % 3 === 0 ? { kind: "anon" as const } : { kind: "user" as const, userId: i % 3 === 1 ? ALICE : BOB };
        return database.as(caller, count).then((n) => ({ i, n }));
      }),
    );
    for (const { i, n } of results) expect(n).toBe(i % 3 === 0 ? 0 : i % 3 === 1 ? 2 : 1);
    // And after a transaction ends, a bare connection has no identity left.
    const bare = await sql<{ uid: string | null }>`select auth.uid() as uid`.execute(database.db);
    expect(bare.rows[0].uid).toBeNull();
  });

  it("rejects a non-uuid user id instead of passing it to SQL", async () => {
    await expect(database.as({ kind: "user", userId: "x' or 1=1 --" }, count)).rejects.toThrow(/uuid/);
  });

  it("migrations are applied once", async () => {
    const url = new URL(database.pool.options.connectionString!);
    expect(await migrate(url.toString(), dbDir, () => {})).toEqual([]);
  });
});
