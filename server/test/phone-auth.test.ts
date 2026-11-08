import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { createAuth, type Auth } from "../src/auth.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { ConsoleMailer, createMailer } from "../src/mailer.js";
import { migrate } from "../src/migrate.js";
import type { Channel, OtpSender } from "../src/services/phoneAuth.js";
import { freshDatabase } from "./helpers.js";

let database: Database;
let auth: Auth;
let app: ReturnType<typeof createApp>;
const ORIGIN = "http://localhost:8080";
const sent: { phone: string; code: string; channel: Channel }[] = [];
const sender: OtpSender = { async send(phone, code, channel) { sent.push({ phone, code, channel }); return channel; } };

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_phone_auth");
  await migrate(url, undefined, () => {});
  const config = loadConfig({ DATABASE_URL: url, NODE_ENV: "test", CORS_ORIGINS: ORIGIN, API_URL: "http://localhost:8787",
    OTP_DEV_MODE: "false" });
  database = createDb(url);
  auth = createAuth(config, new ConsoleMailer(), { otpSender: sender });
  app = createApp({ config, database, auth });
});
afterAll(async () => {
  await database?.close();
  await auth?.close();
});

let ipSeq = 0;
const freshIp = () => `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": headers.ip ?? "10.9.9.9", ...headers },
    body: JSON.stringify(body),
  });
const cookieFrom = (res: Response) =>
  (res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");
const lastCode = (phone: string) => sent.filter((s) => s.phone === phone).at(-1)!.code;
const svc = <T,>(q: ReturnType<typeof sql<T>>) => database.as({ kind: "service" }, (trx) => q.execute(trx));

/** Full first-time flow: phone -> OTP -> PIN. Returns the session cookie. */
async function register(phone: string, pin = "2580", ip = freshIp()) {
  const start = await post("/phone/start", { phone }, { ip });
  expect(start.status).toBe(200);
  const v = await post("/phone/verify-otp", { phone, code: lastCode(phone) }, { ip });
  expect(v.status).toBe(200);
  const body = await v.json();
  const cookie = cookieFrom(v);
  const set = await post("/phone/set-pin", { pin, ticket: body.pin_ticket }, { cookie, ip });
  expect(set.status).toBe(200);
  return { cookie, body };
}

describe("phone + PIN login", () => {
  it("sends a code to a new number, creates the client on verify, and signs them in", async () => {
    const phone = "+2348011112222";
    const s = await (await post("/phone/start", { phone: "+234 801 111 2222", channel: "whatsapp" }, { ip: freshIp() })).json();
    expect(s).toMatchObject({ next: "otp", phone, channel: "whatsapp", isNew: true });
    expect(s.dev_code).toBeUndefined();
    expect(sent.at(-1)).toMatchObject({ phone, channel: "whatsapp" });

    const v = await post("/phone/verify-otp", { phone, code: lastCode(phone) });
    expect(v.status).toBe(200);
    const body = await v.json();
    expect(body).toMatchObject({ is_new: true, has_pin: false, needs_name: true });
    const cookie = cookieFrom(v);
    expect(cookie).toMatch(/ifa\.session_token=/);

    const me = await (await app.request("/v1/me", { headers: { cookie } })).json();
    expect(me).toEqual({ uid: body.user.id, role: "authenticated" });

    const r = await svc(sql<{ role: string; phone: string; wallets: number; roles: string[] }>`
      select p.role::text role, p.phone, (select count(*)::int from wallets w where w.user_id = p.id) wallets,
             array(select role::text from user_roles where user_id = p.id) roles
        from profiles p where p.id = ${body.user.id}`);
    expect(r.rows[0]).toEqual({ role: "user", phone, wallets: 1, roles: ["user"] });

    // First name, through the normal account update endpoint; it flows to the profile.
    const upd = await post("/update-user", { name: "Adé" }, { cookie });
    expect(upd.status).toBe(200);
    const p = await svc(sql<{ full_name: string }>`select full_name from profiles where id = ${body.user.id}`);
    expect(p.rows[0].full_name).toBe("Adé");

    const pin = await post("/phone/set-pin", { pin: "2580", ticket: body.pin_ticket }, { cookie });
    expect(pin.status).toBe(200);
    // The ticket is single use.
    expect((await post("/phone/set-pin", { pin: "1357", ticket: body.pin_ticket }, { cookie })).status).toBe(403);
  });

  it("asks a returning number for its PIN instead of sending a code", async () => {
    const s = await (await post("/phone/start", { phone: "+2348011112222" }, { ip: freshIp() })).json();
    expect(s).toEqual({ next: "pin", phone: "+2348011112222", name: "Adé" });
    const ok = await post("/phone/sign-in-pin", { phone: "+2348011112222", pin: "2580" }, { ip: freshIp() });
    expect(ok.status).toBe(200);
    expect((await ok.json()).needs_name).toBe(false);
    expect(cookieFrom(ok)).toMatch(/ifa\.session_token=/);
  });

  it("stores only a hash of the PIN and of the code", async () => {
    const r = await svc(sql<{ pin_hash: string }>`
      select pin_hash from auth.phone_pins p join auth.users u on u.id = p.user_id where u.phone = '+2348011112222'`);
    expect(r.rows[0].pin_hash).toMatch(/^scrypt\$/);
    expect(r.rows[0].pin_hash).not.toContain("2580");
    const o = await svc(sql<{ n: number }>`select count(*)::int n from auth.phone_otps where code_hash ~ '^[0-9]{6}$'`);
    expect(o.rows[0].n).toBe(0);
  });

  it("locks the PIN after 5 wrong tries, and a code lets the person choose a new one", async () => {
    const phone = "+2348033334444";
    await register(phone, "2580");
    for (let i = 4; i >= 1; i--) {
      const r = await post("/phone/sign-in-pin", { phone, pin: "9999" }, { ip: freshIp() });
      expect(r.status).toBe(401);
      expect((await r.json()).message).toContain(`${i} ${i === 1 ? "try" : "tries"} left`);
    }
    const locked = await post("/phone/sign-in-pin", { phone, pin: "9999" }, { ip: freshIp() });
    expect(locked.status).toBe(423);
    // Even the right PIN is refused while locked.
    expect((await post("/phone/sign-in-pin", { phone, pin: "2580" }, { ip: freshIp() })).status).toBe(423);

    // Forgot PIN: a code, then a new PIN. (Age the sign-up code past the resend wait first.)
    await svc(sql`update auth.phone_otps set created_at = created_at - interval '2 minutes' where phone = ${phone}`);
    const s = await (await post("/phone/start", { phone, forgotPin: true }, { ip: freshIp() })).json();
    expect(s).toMatchObject({ next: "otp", purpose: "reset_pin", isNew: false });
    const v = await post("/phone/verify-otp", { phone, code: lastCode(phone) });
    const body = await v.json();
    expect(body.has_pin).toBe(true);
    expect((await post("/phone/set-pin", { pin: "3691", ticket: body.pin_ticket }, { cookie: cookieFrom(v) })).status).toBe(200);
    expect((await post("/phone/sign-in-pin", { phone, pin: "3691" }, { ip: freshIp() })).status).toBe(200);
  });

  it("rejects wrong codes, and burns the code after 5 wrong tries", async () => {
    const phone = "+2348055556666";
    await post("/phone/start", { phone }, { ip: freshIp() });
    const good = lastCode(phone);
    const wrong = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) expect((await post("/phone/verify-otp", { phone, code: wrong })).status).toBe(400);
    const fifth = await post("/phone/verify-otp", { phone, code: wrong });
    expect((await fifth.json()).code).toBe("OTP_EXPIRED");
    const late = await post("/phone/verify-otp", { phone, code: good });
    expect(late.status).toBe(400);
  });

  it("makes people wait before asking for another code, and caps codes per number", async () => {
    const phone = "+2348077778888";
    expect((await post("/phone/start", { phone }, { ip: freshIp() })).status).toBe(200);
    const again = await post("/phone/start", { phone }, { ip: freshIp() });
    expect(again.status).toBe(429);
    expect((await again.json()).code).toBe("RESEND_TOO_SOON");

    // Pretend the cooldown passed, five times over.
    for (let i = 0; i < 4; i++) {
      await svc(sql`update auth.phone_otps set created_at = created_at - interval '2 minutes' where phone = ${phone}`);
      expect((await post("/phone/start", { phone }, { ip: freshIp() })).status).toBe(200);
    }
    await svc(sql`update auth.phone_otps set created_at = created_at - interval '2 minutes' where phone = ${phone}`);
    const capped = await post("/phone/start", { phone }, { ip: freshIp() });
    expect(capped.status).toBe(429);
    expect((await capped.json()).code).toBe("RATE_LIMITED");
  });

  it("caps codes per network", async () => {
    const ip = freshIp();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await post("/phone/start", { phone: `+44770090${String(i).padStart(4, "0")}` }, { ip })).status;
    expect(last).toBe(429);
  });

  it("refuses weak PINs, bad numbers, and PIN setting without a verified code", async () => {
    const { cookie, body } = await (async () => {
      const phone = "+12025550123";
      await post("/phone/start", { phone }, { ip: freshIp() });
      const v = await post("/phone/verify-otp", { phone, code: lastCode(phone) });
      return { cookie: cookieFrom(v), body: await v.json() };
    })();
    expect((await (await post("/phone/set-pin", { pin: "1111", ticket: body.pin_ticket }, { cookie })).json()).code).toBe("WEAK_PIN");
    expect((await (await post("/phone/set-pin", { pin: "12a4", ticket: body.pin_ticket }, { cookie })).json()).code).toBe("INVALID_PIN");
    expect((await post("/phone/set-pin", { pin: "4826", ticket: "made-up" }, { cookie })).status).toBe(403);
    expect((await post("/phone/set-pin", { pin: "4826", ticket: body.pin_ticket })).status).toBe(401);
    expect((await post("/phone/start", { phone: "12" }, { ip: freshIp() })).status).toBe(400);
  });

  it("does not let suspended people sign in", async () => {
    const phone = "+2348099990000";
    await register(phone, "2580");
    await svc(sql`update profiles set is_suspended = true where phone = ${phone}`);
    expect((await post("/phone/sign-in-pin", { phone, pin: "2580" }, { ip: freshIp() })).status).toBe(403);
  });

  it("keeps email sign-up closed", async () => {
    const r = await post("/sign-up/email", { email: "new@example.com", password: "correct horse battery", name: "X" });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });

  it("never emails placeholder addresses of phone-only accounts", async () => {
    const m = createMailer(undefined, "x@y.z");
    await expect(m.send({ to: "2348011112222@phone.ifa.invalid", subject: "s", text: "t" })).resolves.toBeUndefined();
  });

  it("users cannot read the PIN, code or ticket tables", async () => {
    const r = await svc(sql<{ id: string }>`select id from auth.users where phone = '+2348011112222'`);
    for (const t of ["auth.phone_pins", "auth.phone_otps", "auth.pin_tickets", "auth.rate_events"]) {
      await expect(database.as({ kind: "user", userId: r.rows[0].id }, (trx) =>
        sql.raw(`select * from ${t}`).execute(trx))).rejects.toThrow(/permission denied/);
    }
  });
});

describe("country from the edge", () => {
  it("reads CF-IPCountry", async () => {
    expect(await (await app.request("/v1/geo", { headers: { "cf-ipcountry": "gb" } })).json()).toEqual({ country: "GB" });
    expect(await (await app.request("/v1/geo")).json()).toEqual({ country: null });
  });
});

describe("Babalawo applications", () => {
  it("an applicant joins the waitlist and an admin approval makes them a verified Babalawo", async () => {
    const { body } = await register("+2348012340000", "2580");
    const uid = body.user.id as string;
    const me = { kind: "user" as const, userId: uid };

    const id = await database.as(me, (trx) => sql<{ id: string }>`
      select public.submit_babalawo_application('Babalawo Ifásọlá', 'ifa@example.com', 'Nigeria', 'Ọ̀yọ́',
        'Ilé Ifá Ọ̀rúnmìlà', 22, array['Odù readings','Ẹbọ'], array['Yorùbá','English'], 'yes',
        'Initiated at 14.', 'A friend') id`.execute(trx)).then((r) => r.rows[0].id);
    const mine = await database.as(me, (trx) => sql<{ status: string; phone: string }>`
      select status, phone from babalawo_applications`.execute(trx));
    expect(mine.rows).toEqual([{ status: "waitlisted", phone: "+2348012340000" }]);

    // Applicants can't approve themselves.
    await expect(database.as(me, (trx) => sql`update babalawo_applications set status = 'approved'`.execute(trx)))
      .rejects.toThrow(/permission denied/);
    await expect(database.as(me, (trx) => sql`select public.admin_review_babalawo_application(${id}::bigint, 'approved')`.execute(trx)))
      .rejects.toThrow(/Admin access required/);

    // An admin approves.
    const admin = await register("+2348012349999", "2580");
    await svc(sql`insert into user_roles(user_id, role) values (${admin.body.user.id}::uuid, 'admin')`);
    await database.as({ kind: "user", userId: admin.body.user.id }, (trx) =>
      sql`select public.admin_review_babalawo_application(${id}::bigint, 'approved', null)`.execute(trx));

    const r = await svc(sql<{ status: string; roles: string[]; verified: boolean; review: string; spec: string[]; name: string }>`
      select a.status, array(select role::text from user_roles where user_id = a.user_id order by role) roles,
             b.is_verified verified, b.review_status review, b.specialties spec, p.full_name name
        from babalawo_applications a join babalawos b on b.user_id = a.user_id join profiles p on p.id = a.user_id
       where a.id = ${id}::bigint`);
    expect(r.rows[0]).toMatchObject({ status: "approved", verified: true, review: "approved", name: "Babalawo Ifásọlá",
      spec: ["Odù readings", "Ẹbọ"] });
    expect(r.rows[0].roles).toEqual(expect.arrayContaining(["user", "babalawo"]));
  });
});
