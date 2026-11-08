import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Applies, in order:
 *   1. db/compat/000_*.sql  (Supabase compatibility: roles, auth.uid(), ...)
 *   2. db/migrations/*.sql  (the app schema, oldest first, each once)
 *   3. db/compat/999_*.sql  (grant fix-ups)
 * Each migration runs in its own transaction and is recorded in
 * public.schema_migrations, so re-running only applies new files.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
export const DB_DIR = path.resolve(here, "../../db");

export async function migrate(connectionString: string, dbDir = DB_DIR, log = console.log): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    const compat = (await readdir(path.join(dbDir, "compat"))).filter((f) => f.endsWith(".sql")).sort();
    const pre = compat.filter((f) => !f.startsWith("999"));
    const post = compat.filter((f) => f.startsWith("999"));

    for (const f of pre) await client.query(await readFile(path.join(dbDir, "compat", f), "utf8"));

    await client.query(`create table if not exists public.schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`);
    await client.query(`revoke all on public.schema_migrations from anon, authenticated`);
    const done = new Set((await client.query<{ name: string }>("select name from public.schema_migrations")).rows.map((r) => r.name));

    const files = (await readdir(path.join(dbDir, "migrations"))).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const body = await readFile(path.join(dbDir, "migrations", f), "utf8");
      await client.query("begin");
      try {
        await client.query(body);
        await client.query("insert into public.schema_migrations(name) values ($1)", [f]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`migration ${f} failed: ${(err as Error).message}`);
      }
      applied.push(f);
      log(`applied ${f}`);
    }

    for (const f of post) await client.query(await readFile(path.join(dbDir, "compat", f), "utf8"));
  } finally {
    await client.end();
  }
  return applied;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Migrations create roles and schemas, so they may need a more privileged
  // login than the API itself uses at runtime.
  const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("MIGRATE_DATABASE_URL or DATABASE_URL is required");
  migrate(url).then((a) => console.log(`${a.length} migration(s) applied`));
}
