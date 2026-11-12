import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

let database: Database;
const ADMIN = "00000000-0000-4000-8000-0000000000a1";
const USER = "00000000-0000-4000-8000-0000000000a2";

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_settings");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  await database.as({ kind: "service" }, async (trx) => {
    for (const [id, phone] of [[ADMIN, "+2348000000001"], [USER, "+2348000000002"]]) {
      await sql`insert into auth.users(id, email, phone, name) values (${id}::uuid, ${id + "@x.invalid"}, ${phone}, 'T')`.execute(trx);
    }
    await sql`insert into user_roles(user_id, role) values (${ADMIN}::uuid, 'admin')`.execute(trx);
  });
});
afterAll(async () => { await database?.close(); });

describe("admin settings", () => {
  it("refuses to store anything that looks like a key or password, even for an admin", async () => {
    for (const key of ["paystack_secret_key", "termii_api_key", "smtp_password", "agora_app_certificate", "sentry_dsn"]) {
      await expect(database.as({ kind: "user", userId: ADMIN }, (trx) =>
        sql`insert into admin_settings(setting_key, setting_value) values (${key}, 'x')`.execute(trx))).rejects.toThrow(/server environment/);
    }
  });

  it("shows anonymous visitors and clients only the public rules", async () => {
    await database.as({ kind: "user", userId: ADMIN }, (trx) =>
      sql`insert into admin_settings(setting_key, setting_value) values ('internal_note', 'admin only')`.execute(trx));
    for (const caller of [{ kind: "anon" as const }, { kind: "user" as const, userId: USER }]) {
      const rows = (await database.as(caller, (trx) =>
        sql<{ setting_key: string }>`select setting_key from admin_settings`.execute(trx))).rows.map((r) => r.setting_key);
      expect(rows).toContain("cancellation_full_refund_hours");
      expect(rows).not.toContain("internal_note");
      expect(rows).not.toContain("whatsapp_notifications_enabled");
    }
    const adminRows = (await database.as({ kind: "user", userId: ADMIN }, (trx) =>
      sql<{ setting_key: string }>`select setting_key from admin_settings`.execute(trx))).rows.map((r) => r.setting_key);
    expect(adminRows).toContain("internal_note");
  });

  it("tells admins which providers are configured, never the values", async () => {
    const config = loadConfig({ DATABASE_URL: "postgres://unused", NODE_ENV: "test", PAYSTACK_SECRET_KEY: "sk_live_x", PAYSTACK_PUBLIC_KEY: "pk" });
    const as = (userId: string) => async () => ({ kind: "user" as const, userId });
    const admin = createApp({ config, database, resolveCaller: as(ADMIN) });
    const r = await admin.request("/v1/admin/integrations");
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ paystack: true, flutterwave: false, termii: false });
    expect(JSON.stringify(body)).not.toContain("sk_live_x");
    const user = createApp({ config, database, resolveCaller: as(USER) });
    expect((await user.request("/v1/admin/integrations")).status).toBe(403);
  });
});

describe("error reporting", () => {
  it("turns a Sentry DSN into its envelope endpoint and sends nothing secret", async () => {
    const { parseDsn, envelope } = await import("../src/services/errors.js");
    expect(parseDsn("https://abc123@o42.ingest.sentry.io/77")).toEqual({ url: "https://o42.ingest.sentry.io/api/77/envelope/", key: "abc123" });
    expect(parseDsn("not a dsn")).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
    const lines = envelope(new Error("boom"), { path: "/v1/x" }, "test").trim().split("\n");
    expect(lines).toHaveLength(3);
    const event = JSON.parse(lines[2]);
    expect(event.exception.values[0]).toMatchObject({ type: "Error", value: "boom" });
    expect(event.extra).toEqual({ path: "/v1/x" });
  });
});
