import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { createAuth, type Auth } from "../src/auth.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { ConsoleMailer } from "../src/mailer.js";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

let database: Database;
let auth: Auth;
let app: ReturnType<typeof createApp>;
const mailer = new ConsoleMailer();
const ORIGIN = "http://localhost:8080";

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_auth");
  await migrate(url, undefined, () => {});
  const config = loadConfig({ DATABASE_URL: url, NODE_ENV: "test", CORS_ORIGINS: ORIGIN, API_URL: "http://localhost:8787" });
  database = createDb(url);
  auth = createAuth(config, mailer);
  app = createApp({ config, database, auth });
});
afterAll(async () => {
  await database?.close();
  await auth?.close();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, ...headers }, body: JSON.stringify(body) });

const cookieFrom = (res: Response) =>
  (res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");

async function signUp(email: string, password: string, extra: Record<string, unknown> = {}) {
  const res = await post("/api/auth/sign-up/email", { email, password, name: "Test Person", ...extra });
  return { res, body: await res.json(), cookie: cookieFrom(res) };
}

describe("login (Better Auth on plain Postgres)", () => {
  it("signs up a client, creates their profile and wallet, and signs them in", async () => {
    const { res, body, cookie } = await signUp("Ade@Example.com", "correct horse battery");
    expect(res.status).toBe(200);
    expect(body.user.email).toBe("ade@example.com");
    expect(cookie).toMatch(/ifa\.session_token=/);

    const me = await (await app.request("/v1/me", { headers: { cookie } })).json();
    expect(me).toEqual({ uid: body.user.id, role: "authenticated" });

    const row = await database.as({ kind: "service" }, (trx) => sql<{ role: string; full_name: string; wallets: number }>`
      select p.role::text role, p.full_name, (select count(*)::int from wallets w where w.user_id = p.id) wallets
      from profiles p where p.id = ${body.user.id}`.execute(trx));
    expect(row.rows[0]).toEqual({ role: "user", full_name: "Test Person", wallets: 1 });
  });

  it("signs up a Babalawo when they choose that role", async () => {
    const { body } = await signUp("baba@example.com", "correct horse battery", { signupRole: "babalawo" });
    const r = await database.as({ kind: "service" }, (trx) => sql<{ role: string; n: number }>`
      select p.role::text role, (select count(*)::int from babalawos b where b.user_id = p.id) n
      from profiles p where p.id = ${body.user.id}`.execute(trx));
    expect(r.rows[0]).toEqual({ role: "babalawo", n: 1 });
  });

  it("never grants admin at signup", async () => {
    const { body } = await signUp("sneaky@example.com", "correct horse battery", { signupRole: "admin" });
    const r = await database.as({ kind: "service" }, (trx) => sql<{ role: string; admin: number }>`
      select p.role::text role, (select count(*)::int from user_roles u where u.user_id = p.id and u.role = 'admin') admin
      from profiles p where p.id = ${body.user.id}`.execute(trx));
    expect(r.rows[0]).toEqual({ role: "user", admin: 0 });
  });

  it("rejects a wrong password and a duplicate email", async () => {
    const bad = await post("/api/auth/sign-in/email", { email: "ade@example.com", password: "wrong password!" });
    expect(bad.status).toBe(401);
    const dup = await signUp("ade@example.com", "another password");
    expect(dup.res.status).toBeGreaterThanOrEqual(400);
  });

  it("supports bearer tokens for the PWA and ends the session on sign-out", async () => {
    const res = await post("/api/auth/sign-in/email", { email: "ade@example.com", password: "correct horse battery" });
    expect(res.status).toBe(200);
    const token = res.headers.get("set-auth-token");
    expect(token).toBeTruthy();
    const headers = { authorization: `Bearer ${token}` };
    expect((await (await app.request("/v1/me", { headers })).json()).role).toBe("authenticated");

    const out = await app.request("/api/auth/sign-out", { method: "POST", headers: { ...headers, origin: ORIGIN } });
    expect(out.status).toBe(200);
    expect((await (await app.request("/v1/me", { headers })).json()).role).toBe("anon");
  });

  it("stores only a password hash, never the password", async () => {
    const r = await database.as({ kind: "service" }, (trx) => sql<{ password: string }>`
      select a.password from auth.accounts a join auth.users u on u.id = a.user_id where u.email = 'ade@example.com'`.execute(trx));
    expect(r.rows[0].password).toBeTruthy();
    expect(r.rows[0].password).not.toContain("correct horse");
  });

  it("users cannot read login tables through the data layer", async () => {
    const r = await database.as({ kind: "service" }, (trx) => sql<{ id: string }>`select id from auth.users limit 1`.execute(trx));
    await expect(database.as({ kind: "user", userId: r.rows[0].id }, (trx) =>
      sql`select * from auth.accounts`.execute(trx))).rejects.toThrow(/permission denied/);
  });

  it("sends a verification email at signup", () => {
    expect(mailer.sent.some((m) => m.to === "ade@example.com" && /Confirm your email/.test(m.subject))).toBe(true);
  });

  it("resets a forgotten password through the emailed link", async () => {
    const req = await post("/api/auth/request-password-reset", { email: "baba@example.com", redirectTo: `${ORIGIN}/reset` });
    expect(req.status).toBe(200);
    const mail = mailer.sent.filter((m) => m.to === "baba@example.com" && /Reset/.test(m.subject)).at(-1)!;
    const token = /reset-password\/([^?\s]+)/.exec(mail.text)?.[1];
    expect(token).toBeTruthy();
    const reset = await post("/api/auth/reset-password", { newPassword: "a brand new passphrase", token });
    expect(reset.status).toBe(200);
    expect((await post("/api/auth/sign-in/email", { email: "baba@example.com", password: "correct horse battery" })).status).toBe(401);
    expect((await post("/api/auth/sign-in/email", { email: "baba@example.com", password: "a brand new passphrase" })).status).toBe(200);
  });
});
