import pg from "pg";

/**
 * Tests need a real Postgres. TEST_DATABASE_URL must point at a server where
 * the user can create databases (CI uses the postgres:16 service container).
 * Each suite gets its own throwaway database.
 */
export const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/postgres";

export async function freshDatabase(name: string): Promise<string> {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}
