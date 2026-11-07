import pg from "pg";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";

/**
 * Database access with the caller's identity attached.
 *
 * The app's RLS policies and SQL functions were written for Supabase and read
 * the caller from auth.uid(). db/compat/000_supabase_compat.sql recreates that
 * function on plain Postgres; it reads the `request.jwt.claims` setting. Every
 * request therefore runs in one transaction that first switches to the right
 * database role and sets those claims with SET LOCAL semantics, so nothing
 * leaks to the next request that borrows the same pooled connection.
 */

// The schema type comes later from kysely-codegen against the real database.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = any;

export type Caller =
  | { kind: "anon" }
  | { kind: "user"; userId: string; email?: string }
  | { kind: "service" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });

  /** Run `fn` inside a transaction scoped to `caller`. */
  async function as<T>(caller: Caller, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
    return db.transaction().execute(async (trx) => {
      await applyCaller(trx, caller);
      return fn(trx);
    });
  }

  return { db, pool, as, close: () => db.destroy() };
}

export type Database = ReturnType<typeof createDb>;

export async function applyCaller(trx: Transaction<DB>, caller: Caller): Promise<void> {
  // Role names are fixed literals, never user input.
  const role = caller.kind === "user" ? "authenticated" : caller.kind === "service" ? "service_role" : "anon";
  const claims: Record<string, string> = { role };
  if (caller.kind === "user") {
    if (!UUID.test(caller.userId)) throw new Error("caller.userId must be a uuid");
    claims.sub = caller.userId;
    if (caller.email) claims.email = caller.email;
  }
  await sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`.execute(trx);
  await sql.raw(`set local role ${role}`).execute(trx);
}
