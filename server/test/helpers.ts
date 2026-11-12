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

type Q = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

/**
 * Put money in a client's wallet directly (test setup). Wallets are split by the provider that
 * holds the money, and the split must add up to the balance at commit, so both are set together.
 */
export async function setWallet(db: Q, userId: string, amount: number, provider: "paystack" | "flutterwave" = "paystack") {
  await db.query("begin");
  try {
    await db.query(`insert into wallets(user_id, balance) values ($1, $2)
      on conflict (user_id) do update set balance = excluded.balance`, [userId, amount]);
    await db.query("delete from wallet_parts where user_id = $1", [userId]);
    if (amount > 0) await db.query("insert into wallet_parts(user_id, provider, balance) values ($1, $2, $3)", [userId, provider, amount]);
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

/** Give a Babalawo an available balance directly (test setup), held by one provider. */
export async function setBabalawoAvailable(db: Q, babalawoId: string, amount: number, provider: "paystack" | "flutterwave" = "paystack") {
  await db.query("begin");
  try {
    await db.query("select set_config('ifa.bparts', $1, true)", [JSON.stringify({ [provider]: 1 })]);
    await db.query(`insert into babalawo_wallets(babalawo_id) values ($1) on conflict (babalawo_id) do nothing`, [babalawoId]);
    await db.query("select set_config('ifa.bparts', $1, true)", [JSON.stringify({ [provider]: 1 })]);
    await db.query("update babalawo_wallets set available_balance = $2 where babalawo_id = $1", [babalawoId, amount]);
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
