import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { loadConfig, type Config } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { open, seal, secretKey } from "../src/services/secretBox.js";
import { createFileStore } from "../src/services/storage.js";
import { createIntegrationSettings } from "../src/services/integrations.js";
import { freshDatabase } from "./helpers.js";

/**
 * Admin -> Settings -> Integrations: provider keys an admin can set and test. Saved values are
 * encrypted, never readable outside the API, never sent back, override .env, and are audit-logged.
 */

let database: Database;
const ADMIN = "00000000-0000-4000-8000-0000000000b1";
const USER = "00000000-0000-4000-8000-0000000000b2";
const ENV_SECRET = "sk_test_from_env_000000000000";
const ADMIN_SECRET = "sk_live_from_admin_1111111111abcd";

type Call = { url: string; headers: Record<string, string> };
let calls: Call[] = [];
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>));
  calls.push({ url, headers });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (url === "https://api.paystack.co/balance") {
    return headers.Authorization === `Bearer ${ADMIN_SECRET}` || headers.Authorization === "Bearer sk_live_draft_222222222222"
      ? json({ status: true, data: [{ currency: "NGN", balance: 1234500 }] })
      : json({ status: false, message: `Invalid key ${headers.Authorization?.slice(7)}` }, 401);
  }
  if (url.startsWith("https://api.ng.termii.com/api/get-balance")) return json({ user: "IFA", balance: 42, currency: "NGN" });
  return json({ error: "unexpected" }, 500);
}) as typeof fetch;

let config: Config;
const as = (userId: string) => async () => ({ kind: "user" as const, userId });
const appFor = (caller: () => Promise<{ kind: "user"; userId: string } | { kind: "anon" }>) =>
  createApp({ config, database, resolveCaller: caller, fetch: fakeFetch });
const send = (app: ReturnType<typeof appFor>, method: string, url: string, body?: unknown) =>
  app.request(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_integration_settings");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  await database.as({ kind: "service" }, async (trx) => {
    for (const [id, phone] of [[ADMIN, "+2348000000011"], [USER, "+2348000000012"]]) {
      await sql`insert into auth.users(id, email, phone, name) values (${id}::uuid, ${id + "@x.invalid"}, ${phone}, 'Ade')`.execute(trx);
    }
    await sql`insert into user_roles(user_id, role) values (${ADMIN}::uuid, 'admin')`.execute(trx);
  });
  config = loadConfig({ DATABASE_URL: url, NODE_ENV: "test", SETTINGS_ENCRYPTION_KEY: "test-settings-key-0123456789abcdef0123",
    PAYSTACK_SECRET_KEY: ENV_SECRET, PAYSTACK_PUBLIC_KEY: "pk_test_env" });
});
afterAll(async () => { await database?.close(); });

describe("integration keys from admin settings", () => {
  it("only admins can see, change or test them", async () => {
    const user = appFor(as(USER));
    expect((await user.request("/v1/admin/integrations")).status).toBe(403);
    expect((await send(user, "PUT", "/v1/admin/integrations/paystack", { values: { PAYSTACK_SECRET_KEY: ADMIN_SECRET } })).status).toBe(403);
    expect((await send(user, "POST", "/v1/admin/integrations/paystack/test", {})).status).toBe(403);
    const anon = appFor(async () => ({ kind: "anon" }));
    expect((await anon.request("/v1/admin/integrations")).status).toBe(401);
  });

  it("lists every integration with secrets masked and settings from .env marked as such", async () => {
    const r = await appFor(as(ADMIN)).request("/v1/admin/integrations");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const body = await r.json() as { integrations: { id: string; fields: { env: string; source: string; value: string | null; masked: string | null }[] }[] };
    expect(body.integrations.map((i) => i.id)).toEqual(expect.arrayContaining(
      ["paystack", "flutterwave", "google_meet", "agora", "termii", "whatsapp", "email", "web_push", "file_storage", "openai", "anthropic", "error_tracking"]));
    const ps = body.integrations.find((i) => i.id === "paystack")!;
    const sk = ps.fields.find((f) => f.env === "PAYSTACK_SECRET_KEY")!;
    expect(sk).toMatchObject({ source: "server", value: null, masked: "Set, ends in 0000" });
    expect(ps.fields.find((f) => f.env === "PAYSTACK_PUBLIC_KEY")).toMatchObject({ source: "server", value: "pk_test_env" });
    expect(JSON.stringify(body)).not.toContain(ENV_SECRET);
  });

  it("saves a key encrypted, uses it instead of .env, never returns it, and logs who changed it", async () => {
    const admin = appFor(as(ADMIN));
    const r = await send(admin, "PUT", "/v1/admin/integrations/paystack",
      { values: { PAYSTACK_SECRET_KEY: `  ${ADMIN_SECRET} `, PAYSTACK_PUBLIC_KEY: "pk_live_admin" } });
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).not.toContain(ADMIN_SECRET);
    expect(JSON.parse(text).fields.find((f: { env: string }) => f.env === "PAYSTACK_SECRET_KEY"))
      .toMatchObject({ source: "admin", masked: "Set, ends in abcd", updated_by: "Ade" });

    // Applied at once to the running server's settings.
    expect(config.PAYSTACK_SECRET_KEY).toBe(ADMIN_SECRET);
    expect(config.PAYSTACK_PUBLIC_KEY).toBe("pk_live_admin");

    // Stored encrypted, bound to its name.
    const row = (await database.as({ kind: "service" }, (trx) =>
      sql<{ value_enc: string }>`select value_enc from private.integration_secrets where env_key = 'PAYSTACK_SECRET_KEY'`.execute(trx))).rows[0];
    expect(row.value_enc).not.toContain(ADMIN_SECRET);
    expect(open(secretKey(config), "PAYSTACK_SECRET_KEY", row.value_enc)).toBe(ADMIN_SECRET);
    expect(open(secretKey(config), "FLW_SECRET_KEY", row.value_enc)).toBeNull();

    // Audit: names only.
    const log = (await database.as({ kind: "service" }, (trx) => sql<{ admin_id: string; details: unknown }>`
      select admin_id::text, details from admin_audit_log where action = 'integration.update' order by created_at desc limit 1`.execute(trx))).rows[0];
    expect(log.admin_id).toBe(ADMIN);
    expect(log.details).toEqual({ set: ["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"], cleared: [] });
    expect(JSON.stringify(log.details)).not.toContain(ADMIN_SECRET);
  });

  it("a fresh server (restart) picks the saved values up over .env", async () => {
    const restarted = loadConfig({ DATABASE_URL: "postgres://x", NODE_ENV: "test", SETTINGS_ENCRYPTION_KEY: config.SETTINGS_ENCRYPTION_KEY,
      PAYSTACK_SECRET_KEY: ENV_SECRET });
    const s = createIntegrationSettings({ config: restarted, database });
    expect(await s.refresh()).toEqual(expect.arrayContaining(["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY"]));
    expect(restarted.PAYSTACK_SECRET_KEY).toBe(ADMIN_SECRET);

    // With the wrong encryption key the saved value is ignored, not misused.
    const wrong = loadConfig({ DATABASE_URL: "postgres://x", NODE_ENV: "test", SETTINGS_ENCRYPTION_KEY: "another-key-0123456789abcdef0123456789",
      PAYSTACK_SECRET_KEY: ENV_SECRET });
    await createIntegrationSettings({ config: wrong, database }).refresh();
    expect(wrong.PAYSTACK_SECRET_KEY).toBe(ENV_SECRET);
  });

  it("refuses values that are clearly wrong, and settings that are not integration keys", async () => {
    const admin = appFor(as(ADMIN));
    let r = await send(admin, "PUT", "/v1/admin/integrations/paystack", { values: { PAYSTACK_SECRET_KEY: "pk_live_oops" } });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/secret key/);
    r = await send(admin, "PUT", "/v1/admin/integrations/paystack", { values: { DATABASE_URL: "postgres://evil" } });
    expect(r.status).toBe(400);
    r = await send(admin, "PUT", "/v1/admin/integrations/paystack", { values: { AUTH_SECRET: "x".repeat(40) } });
    expect(r.status).toBe(400);
    r = await send(admin, "PUT", "/v1/admin/integrations/termii", { values: { TERMII_BASE_URL: "http://169.254.169.254" } });
    expect(r.status).toBe(400);
    r = await send(admin, "PUT", "/v1/admin/integrations/nope", { values: { X: "y" } });
    expect(r.status).toBe(404);
    expect(config.DATABASE_URL).not.toContain("evil");
  });

  it("tests saved keys, or typed ones before saving, and records the result without the key", async () => {
    const admin = appFor(as(ADMIN));
    let r = await send(admin, "POST", "/v1/admin/integrations/paystack/test", {});
    expect(await r.json()).toEqual({ ok: true, message: "Connected to Paystack (live mode). Balance ₦12,345." });

    // A typed (unsaved) key is tried without being saved; the provider's echo of it is scrubbed.
    r = await send(admin, "POST", "/v1/admin/integrations/paystack/test", { values: { PAYSTACK_SECRET_KEY: "sk_live_wrong_99999999999" } });
    const bad = await r.json();
    expect(bad.ok).toBe(false);
    expect(bad.message).not.toContain("sk_live_wrong_99999999999");
    expect(config.PAYSTACK_SECRET_KEY).toBe(ADMIN_SECRET);

    r = await send(admin, "POST", "/v1/admin/integrations/paystack/test", { values: { PAYSTACK_SECRET_KEY: "sk_test_mismatch_000000" } });
    expect((await r.json()).message).toMatch(/matching pair/);

    // Not set up: says what is missing.
    r = await send(admin, "POST", "/v1/admin/integrations/whatsapp/test", {});
    expect(await r.json()).toEqual({ ok: false, message: "Fill in Access token, Phone number ID first." });

    const list = await (await admin.request("/v1/admin/integrations")).json() as { integrations: { id: string; last_test: { ok: boolean; by: string } | null }[] };
    expect(list.integrations.find((i) => i.id === "paystack")!.last_test).toMatchObject({ ok: false, by: "Ade" });
    const logs = (await database.as({ kind: "service" }, (trx) =>
      sql<{ details: unknown }>`select details from admin_audit_log where action = 'integration.test'`.execute(trx))).rows;
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(JSON.stringify(logs)).not.toMatch(/sk_live_wrong|sk_live_from_admin/);
  });

  it("removing a saved value falls back to .env", async () => {
    const admin = appFor(as(ADMIN));
    const r = await send(admin, "PUT", "/v1/admin/integrations/paystack", { values: { PAYSTACK_SECRET_KEY: null, PAYSTACK_PUBLIC_KEY: null } });
    expect(r.status).toBe(200);
    expect(config.PAYSTACK_SECRET_KEY).toBe(ENV_SECRET);
    expect(config.PAYSTACK_PUBLIC_KEY).toBe("pk_test_env");
    const n = (await database.as({ kind: "service" }, (trx) =>
      sql<{ n: number }>`select count(*)::int n from private.integration_secrets`.execute(trx))).rows[0].n;
    expect(n).toBe(0);
  });

  it("the web app's database roles cannot reach the stored keys at all", async () => {
    await database.as({ kind: "service" }, (trx) => sql`insert into private.integration_secrets(env_key, value_enc)
      values ('TERMII_API_KEY', ${seal(secretKey(config), "TERMII_API_KEY", "termii-secret")})`.execute(trx));
    for (const caller of [{ kind: "anon" as const }, { kind: "user" as const, userId: USER }, { kind: "user" as const, userId: ADMIN }]) {
      await expect(database.as(caller, (trx) => sql`select * from private.integration_secrets`.execute(trx)))
        .rejects.toThrow(/permission denied/);
    }
  });

  it("the recording worker reads the same encrypted values", async () => {
    // @ts-expect-error plain JS module
    const worker = await import("../../workers/recording-processor/lib/secrets.mjs");
    const sealed = seal(secretKey(config), "OPENAI_API_KEY", "sk-proj-abc");
    expect(worker.open(worker.secretKey({ SETTINGS_ENCRYPTION_KEY: config.SETTINGS_ENCRYPTION_KEY }), "OPENAI_API_KEY", sealed)).toBe("sk-proj-abc");
    // Without a dedicated key both sides derive it from AUTH_SECRET.
    const k = secretKey({ AUTH_SECRET: "a".repeat(40) });
    expect(worker.open(worker.secretKey({ AUTH_SECRET: "a".repeat(40) }), "X_KEY", seal(k, "X_KEY", "v"))).toBe("v");
  });

  it("file storage follows a settings change without a restart", async () => {
    const a = await mkdtemp(path.join(tmpdir(), "ifa-a-"));
    const b = await mkdtemp(path.join(tmpdir(), "ifa-b-"));
    const cfg = { FILES_DIR: a } as Config;
    const store = createFileStore(cfg);
    await store.put("x/one.txt", new TextEncoder().encode("1"), "text/plain");
    cfg.FILES_DIR = b;
    expect(await store.get("x/one.txt")).toBeNull();
    cfg.FILES_DIR = a;
    expect(await store.get("x/one.txt")).not.toBeNull();
  });
});
