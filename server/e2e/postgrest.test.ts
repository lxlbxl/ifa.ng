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
  // A complete profile (photo, price, hours) is what puts a Babalawo in the directory.
  await db.query(`update babalawos set is_verified = true, hourly_rate = 10000, profile_picture_url = 'https://x.invalid/p.jpg' where user_id = $1`, [BABA]);
  await db.query(`insert into availability(babalawo_id, day_of_week, start_time, end_time) values ($1, 1, '09:00', '12:00')`, [BABA]);
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

describe("Ebo through PostgREST (the web app's calls)", () => {
  it("Babalawo drafts and sends; the client sees the itemised quote, pays from the wallet and nobody else sees it", async () => {
    const s = await db.query(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values ($1, $2, current_date, '09:00', '10:00', 'completed', 'paid', 10000) returning id`, [ALICE, BABA]);
    // wallet balance and its provider part are set together (they must add up at commit)
    await db.query(`with w as (insert into wallets(user_id, balance) values ($1, 100000)
        on conflict (user_id) do update set balance = 100000 returning user_id)
      insert into wallet_parts(user_id, provider, balance) select user_id, 'paystack', 100000 from w
        on conflict (user_id, provider) do update set balance = 100000`, [ALICE]);
    const rpc = (fn: string, body: unknown, tok: string) => send("POST", `/rpc/${fn}`, body, tok);

    const fee = await get("/admin_settings?select=setting_value&setting_key=eq.ebo_platform_fee_percent", token(ALICE));
    expect((await fee.json())[0]?.setting_value).toBe("10");

    const saved = await rpc("ebo_save_draft", {
      p_id: null, p_session_id: s.rows[0].id, p_kind: "ebo", p_title: "Ebo for open roads", p_description: "", p_performed_by: "babalawo",
      p_due_date: null, p_owo_ifa: 5000, p_items: [{ name: "Ẹyẹlé", quantity: 2, unit_price: 2500 }],
      p_ritual_at: new Date(Date.now() + 3 * 864e5).toISOString(), p_ritual_minutes: 60,
    }, token(BABA));
    expect(saved.status).toBe(200);
    const id = await saved.json();
    expect((await (await get(`/ebo_prescriptions?id=eq.${id}`, token(ALICE))).json())).toHaveLength(0); // draft is private
    expect((await rpc("ebo_send", { p_id: id }, token(BABA))).status).toBe(204);

    const mine = await (await get(`/ebo_prescriptions?select=*,ebo_items(*)&id=eq.${id}`, token(ALICE))).json();
    expect(mine[0]).toMatchObject({ total: 10000, platform_fee: 1000, amount_due: 11000 });
    expect(mine[0].ebo_items).toHaveLength(1);
    expect((await (await get(`/ebo_prescriptions?id=eq.${id}`, token(BOB))).json())).toHaveLength(0);
    expect((await send("PATCH", `/ebo_prescriptions?id=eq.${id}`, { owo_ifa: 1 }, token(BABA))).status).toBeGreaterThanOrEqual(400);

    expect((await rpc("pay_ebo_with_wallet", { p_id: id, p_attendance: "present" }, token(BOB))).status).toBeGreaterThanOrEqual(400);
    expect((await rpc("pay_ebo_with_wallet", { p_id: id, p_attendance: "present" }, token(ALICE))).status).toBe(204);
    const after = await (await get(`/ebo_prescriptions?select=status,attendance,ritual_session_id&id=eq.${id}`, token(ALICE))).json();
    expect(after[0]).toMatchObject({ status: "paid", attendance: "present" });
    const ritual = await (await get(`/sessions?select=session_type,amount&id=eq.${after[0].ritual_session_id}`, token(ALICE))).json();
    expect(ritual[0]).toMatchObject({ session_type: "ebo_ritual" });
    expect(Number(ritual[0].amount)).toBe(0);
  });
});
