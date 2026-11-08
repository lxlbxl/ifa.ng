import { createHmac } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signDataToken } from "../src/services/dataToken.js";

/**
 * End-to-end check of the data path the web app uses: a real PostgREST in front
 * of the migrated database, logged in as ifa_rest, trusting tokens the API signs.
 * CI starts PostgREST (see .github/workflows/server.yml) and sets:
 *   POSTGREST_URL, DATABASE_URL (migrated), DATA_JWT_SECRET (same as PostgREST's).
 */
const REST = process.env.POSTGREST_URL!;
const SECRET = process.env.DATA_JWT_SECRET!;
const DB = process.env.DATABASE_URL!;

const ALICE = "a1a1a1a1-0000-4000-8000-0000000000a1";
const BOB = "b2b2b2b2-0000-4000-8000-0000000000b2";
const BABA = "c3c3c3c3-0000-4000-8000-0000000000c3";

let db: pg.Client;
const token = (userId: string) => signDataToken(SECRET, { kind: "user", userId })!.token;
const get = (path: string, tok?: string) =>
  fetch(`${REST}${path}`, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} });
const send = (method: string, path: string, body: unknown, tok?: string) =>
  fetch(`${REST}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Prefer: "return=representation", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: JSON.stringify(body),
  });

function forge(claims: Record<string, unknown>, secret = SECRET) {
  const b = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const head = `${b({ alg: "HS256", typ: "JWT" })}.${b(claims)}`;
  return `${head}.${createHmac("sha256", secret).update(head).digest("base64url")}`;
}

beforeAll(async () => {
  db = new pg.Client({ connectionString: DB });
  await db.connect();
  await db.query(`insert into auth.users(id, email, raw_user_meta_data) values
    ($1, 'alice@example.com', '{"full_name":"Alice"}'),
    ($2, 'bob@example.com', '{"full_name":"Bob"}'),
    ($3, 'baba@example.com', '{"full_name":"Baba","role":"babalawo"}') on conflict do nothing`, [ALICE, BOB, BABA]);
  await db.query(`update babalawos set is_verified = true where user_id = $1`, [BABA]);
  // Wait for PostgREST to pick up the migrated schema.
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${REST}/rpc/get_public_babalawos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    if (r?.ok) break;
    await db.query(`notify pgrst, 'reload schema'`);
    await new Promise((res) => setTimeout(res, 1000));
  }
});
afterAll(() => db?.end());

describe("PostgREST with API-signed tokens", () => {
  it("anonymous visitors see the public Babalawo directory but no profiles", async () => {
    const dir = await fetch(`${REST}/rpc/get_public_babalawos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(dir.status).toBe(200);
    expect((await dir.json()).map((r: { id: string }) => r.id)).toContain(BABA);
    const profiles = await get("/profiles?select=id");
    expect(profiles.ok ? await profiles.json() : []).toEqual([]);
  });

  it("a signed-in person sees only their own profile", async () => {
    const r = await get("/profiles?select=id", token(ALICE));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([{ id: ALICE }]);
  });

  it("cannot change someone else's profile or their own role", async () => {
    await send("PATCH", `/profiles?id=eq.${BOB}`, { full_name: "Hacked" }, token(ALICE));
    const bob = await db.query(`select full_name from profiles where id = $1`, [BOB]);
    expect(bob.rows[0].full_name).toBe("Bob");
    await send("PATCH", `/profiles?id=eq.${ALICE}`, { role: "admin" }, token(ALICE));
    const roles = await db.query(`select count(*)::int n from user_roles where user_id = $1 and role = 'admin'`, [ALICE]);
    expect(roles.rows[0].n).toBe(0);
  });

  it("cannot move wallet money directly", async () => {
    const r = await send("PATCH", `/wallets?user_id=eq.${ALICE}`, { balance: 1000000 }, token(ALICE));
    expect(r.ok).toBe(false);
    const w = await db.query(`select balance from wallets where user_id = $1`, [ALICE]);
    expect(Number(w.rows[0].balance)).toBe(0);
  });

  it("refuses forged, expired and service-role tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const wrongKey = forge({ sub: ALICE, role: "authenticated", aud: "authenticated", exp: now + 60 }, "x".repeat(40));
    expect((await get("/profiles?select=id", wrongKey)).status).toBe(401);
    const expired = forge({ sub: ALICE, role: "authenticated", aud: "authenticated", exp: now - 60 });
    expect((await get("/profiles?select=id", expired)).status).toBe(401);
    // Even a correctly signed service_role token gets nowhere: ifa_rest cannot become service_role.
    const svc = forge({ role: "service_role", aud: "authenticated", exp: now + 60 });
    const r = await get("/profiles?select=id", svc);
    expect(r.ok).toBe(false);
  });
});
