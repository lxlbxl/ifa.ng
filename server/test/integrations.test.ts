import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync, createHmac } from "node:crypto";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { toE164 } from "../src/services/notify.js";
import { sessionWindow } from "../src/services/context.js";
import { freshDatabase } from "./helpers.js";

/**
 * The payment, video and notification work that used to live in Supabase edge
 * functions, now in the API. Real Postgres; the outside world (Paystack,
 * Flutterwave, Google, Termii, WhatsApp) is a fake fetch that records calls.
 */

const CLIENT = "aaaaaaaa-1111-4000-8000-000000000001";
const BABA = "bbbbbbbb-1111-4000-8000-000000000002";
const ADMIN = "dddddddd-1111-4000-8000-000000000004";
const OTHER = "cccccccc-1111-4000-8000-000000000003";
const PAYSTACK_SECRET = "sk_test_paystack";
const FLW_HASH = "flw-hash-123";

let database: Database;
let app: ReturnType<typeof createApp>;

// ---- fake outside world
type Call = { url: string; method: string; body: string };
let calls: Call[] = [];
let provider: Record<string, { status: string; amount: number }> = {}; // reference -> what the provider says
let googleUp = true;

const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  const method = init?.method ?? "GET";
  const body = init?.body ? String(init.body) : "";
  calls.push({ url, method, body });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

  let m = url.match(/api\.paystack\.co\/transaction\/verify\/(.+)$/);
  if (m) {
    const p = provider[decodeURIComponent(m[1])];
    if (!p) return json({ status: false }, 404);
    return json({ status: true, data: { status: p.status, amount: p.amount * 100, currency: "NGN", id: 991 } });
  }
  m = url.match(/api\.flutterwave\.com\/v3\/transactions\/verify_by_reference\?tx_ref=(.+)$/);
  if (m) {
    const p = provider[decodeURIComponent(m[1])];
    if (!p) return json({ status: "error" }, 404);
    return json({ status: "success", data: { status: p.status === "success" ? "successful" : p.status, amount: p.amount, currency: "NGN", id: 772 } });
  }
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return googleUp ? json({ access_token: "g-token", expires_in: 3600 }) : json({ error: "unauthorized_client" }, 401);
  }
  if (url === "https://meet.googleapis.com/v2/spaces" && method === "POST") {
    if (!googleUp) return json({ error: { message: "backend unavailable" } }, 503);
    return json({ name: "spaces/abc", meetingUri: "https://meet.google.com/abc-defg-hij", meetingCode: "abc-defg-hij" });
  }
  if (url.startsWith("https://meet.googleapis.com/v2/spaces/abc")) return json({});
  if (url.startsWith("https://api.ng.termii.com/")) return json({ message_id: "t1", code: "ok" });
  if (url.startsWith("https://graph.facebook.com/")) return json({ messages: [{ id: "w1" }] });
  return json({ error: "unexpected " + url }, 500);
}) as typeof fetch;

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_integrations");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const config = loadConfig({
    DATABASE_URL: url, NODE_ENV: "test", APP_URL: "https://ifa.test",
    PAYSTACK_SECRET_KEY: PAYSTACK_SECRET, PAYSTACK_PUBLIC_KEY: "pk_test_paystack",
    FLW_SECRET_KEY: "flw_secret", FLW_PUBLIC_KEY: "flw_public", FLW_SECRET_HASH: FLW_HASH,
    GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: "svc@x.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) }),
    GOOGLE_ORGANIZER_EMAIL: "meet@ifa.test",
    AGORA_APP_ID: "0123456789abcdef0123456789abcdef", AGORA_APP_CERTIFICATE: "fedcba9876543210fedcba9876543210",
    TERMII_API_KEY: "termii-key",
  });
  app = createApp({
    config, database, fetch: fakeFetch,
    resolveCaller: async (req) => (req.headers.get("x-test-user") ? { kind: "user", userId: req.headers.get("x-test-user")! } : { kind: "anon" }),
  });
  await service(sql`
    insert into auth.users(id, email, raw_user_meta_data) values
      (${CLIENT}, 'client@example.com', '{"full_name":"Ade Client"}'),
      (${BABA}, 'baba@example.com', '{"full_name":"Baba Ifa","role":"babalawo"}'),
      (${ADMIN}, 'admin@example.com', '{}'),
      (${OTHER}, 'other@example.com', '{}')`);
  await service(sql`insert into user_roles(user_id, role) values (${ADMIN}, 'admin')`);
  await service(sql`update babalawos set session_price = 20000, is_verified = true, profile_picture_url = 'https://x.invalid/p.jpg', google_email = 'baba@gmail.test' where user_id = ${BABA}`);
  await service(sql`insert into availability(babalawo_id, day_of_week, start_time, end_time)
    select ${BABA}::uuid, d, '00:00', '23:59' from generate_series(0, 6) d`);
  await service(sql`insert into babalawo_scheduling_settings(babalawo_id, min_notice_hours) values (${BABA}, 0) on conflict do nothing`);
  await service(sql`update profiles set phone = '0803 123 4567' where id in (${CLIENT}, ${BABA})`);
});
afterAll(() => database?.close());
beforeEach(() => { calls = []; googleUp = true; });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = (q: any) => database.as({ kind: "service" }, (trx) => q.execute(trx)) as Promise<{ rows: any[] }>;
const call = (path: string, user?: string, body?: unknown, method = "POST") =>
  app.request(path, {
    method, headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) },
    body: body === undefined || method === "GET" ? undefined : JSON.stringify(body),
  });
const signPaystack = (raw: string) => createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
const day = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400_000).toISOString().slice(0, 10);

async function bookAndPay(time: string) {
  const init = await call("/v1/payments/init", CLIENT, {
    gateway: "paystack", kind: "session", babalawo_user_id: BABA, session_date: day(5), start_time: time, amount: 1,
  });
  expect(init.status).toBe(200);
  return (await init.json()) as { reference: string; amount: number };
}

describe("payments", () => {
  it("needs a signed-in person and a supported gateway", async () => {
    expect((await call("/v1/payments/init", undefined, { gateway: "paystack", kind: "wallet_topup", amount: 5000 })).status).toBe(401);
    const bad = await call("/v1/payments/init", CLIENT, { gateway: "stripe", kind: "wallet_topup", amount: 5000 });
    expect(bad.status).toBe(400);
  });

  it("prices a booking on the server and ignores the amount the browser sends", async () => {
    const r = await bookAndPay("09:00");
    expect(r.amount).toBe(20000);
    expect(r.reference).toMatch(/^IFANG-PAY-/);
  });

  it("explains booking problems in plain words", async () => {
    const r = await call("/v1/payments/init", CLIENT, { gateway: "paystack", kind: "session", babalawo_user_id: CLIENT, session_date: day(5), start_time: "09:00" });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/cannot book yourself/);
  });

  it("only the payer can check a payment, and nothing moves until the provider says paid", async () => {
    const { reference } = await bookAndPay("10:00");
    expect((await call("/v1/payments/verify", OTHER, { reference })).status).toBe(404);
    const pending = await (await call("/v1/payments/verify", CLIENT, { reference })).json();
    expect(pending).toEqual({ status: "pending" });
    const n = await service(sql`select count(*)::int n from sessions where user_id = ${CLIENT}`);
    expect(n.rows[0].n).toBe(0);
  });

  it("settles a paid booking once, creates the Meet link and texts both people", async () => {
    const { reference } = await bookAndPay("11:00");
    provider[reference] = { status: "success", amount: 20000 };
    const settled = await (await call("/v1/payments/verify", CLIENT, { reference })).json();
    expect(settled.status).toBe("settled");

    const s = (await service(sql`select payment_status, video_provider, meet_uri, status::text from sessions where id = ${settled.session_id}`)).rows[0];
    expect(s).toMatchObject({ payment_status: "paid", video_provider: "google_meet", meet_uri: "https://meet.google.com/abc-defg-hij" });
    expect(calls.some((c) => c.url.endsWith("spaces/abc/members") && c.body.includes("baba@gmail.test"))).toBe(true);
    // Clients sign in by phone and have no Google account: they walk straight in (admin setting).
    expect(calls.some((c) => c.url === "https://meet.googleapis.com/v2/spaces" && JSON.parse(c.body).config.accessType === "OPEN")).toBe(true);

    const sms = calls.filter((c) => c.url.startsWith("https://api.ng.termii.com/"));
    expect(sms).toHaveLength(2);
    // Links go to the app's session page (records attendance, then opens Meet).
    expect(sms[0].body).toMatch(/\/session\/\d+/);
    const outbox = (await service(sql`select kind, status from notification_outbox where session_id = ${settled.session_id}`)).rows;
    expect(outbox).toEqual([{ kind: "meet_link", status: "sent" }]);

    const again = await (await call("/v1/payments/verify", CLIENT, { reference })).json();
    expect(again.status).toBe("already_settled");
    const count = await service(sql`select count(*)::int n from sessions where user_id = ${CLIENT}`);
    expect(count.rows[0].n).toBe(1);
  });

  it("Paystack webhook: refuses a bad signature and holds an underpayment for review", async () => {
    const init = await (await call("/v1/payments/init", CLIENT, { gateway: "paystack", kind: "wallet_topup", amount: 5000 })).json();
    const raw = JSON.stringify({ event: "charge.success", data: { reference: init.reference, amount: 500000 } });
    const forged = await app.request("/webhooks/paystack", { method: "POST", body: raw, headers: { "x-paystack-signature": "00" } });
    expect(forged.status).toBe(401);

    provider[init.reference] = { status: "success", amount: 50 }; // the provider, not the body, says how much
    const ok = await app.request("/webhooks/paystack", { method: "POST", body: raw, headers: { "x-paystack-signature": signPaystack(raw) } });
    expect(ok.status).toBe(200);
    const intent = (await service(sql`select status from payment_intents where reference = ${init.reference}`)).rows[0];
    expect(intent.status).toBe("needs_review");
    const w = (await service(sql`select balance from wallets where user_id = ${CLIENT}`)).rows[0];
    expect(Number(w.balance)).toBe(0);
  });

  it("Flutterwave webhook: checks the secret hash, then credits a verified top-up", async () => {
    const init = await (await call("/v1/payments/init", CLIENT, { gateway: "flutterwave", kind: "wallet_topup", amount: 5000 })).json();
    const raw = JSON.stringify({ event: "charge.completed", data: { tx_ref: init.reference } });
    expect((await app.request("/webhooks/flutterwave", { method: "POST", body: raw, headers: { "verif-hash": "nope" } })).status).toBe(401);
    provider[init.reference] = { status: "success", amount: 5000 };
    expect((await app.request("/webhooks/flutterwave", { method: "POST", body: raw, headers: { "verif-hash": FLW_HASH } })).status).toBe(200);
    const w = (await service(sql`select balance from wallets where user_id = ${CLIENT}`)).rows[0];
    expect(Number(w.balance)).toBe(5000);
    // A replayed webhook doesn't pay twice.
    await app.request("/webhooks/flutterwave", { method: "POST", body: raw, headers: { "verif-hash": FLW_HASH } });
    expect(Number((await service(sql`select balance from wallets where user_id = ${CLIENT}`)).rows[0].balance)).toBe(5000);
  });
});

/** Wall clock in Lagos (the Babalawo's calendar when they have not set a zone). */
function lagos(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hhmm: `${g("hour")}:${g("minute")}` };
}

describe("video", () => {
  async function paidSessionAt(start: Date, opts: { provider?: string } = {}) {
    const end = new Date(start.getTime() + 3600_000);
    const r = await service(sql`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, user_timezone,
        status, payment_status, amount, video_provider)
      values (${CLIENT}, ${BABA}, ${lagos(start).date}, ${lagos(start).hhmm}, ${lagos(end).hhmm}, 'UTC',
        'confirmed', 'paid', 20000, ${opts.provider ?? "google_meet"}) returning id::text`);
    return r.rows[0].id as string;
  }

  it("falls back to Agora when Google is down, and tells people", async () => {
    googleUp = false;
    const id = await paidSessionAt(new Date(Date.now() + 2 * 86400_000));
    const r = await (await call(`/v1/sessions/${id}/meet-link`, BABA)).json();
    expect(r.provider).toBe("agora");
    const s = (await service(sql`select video_provider, agora_channel_name from sessions where id = ${id}`)).rows[0];
    expect(s).toEqual({ video_provider: "agora", agora_channel_name: `session-${id}` });
    const outbox = (await service(sql`select kind from notification_outbox where session_id = ${id}`)).rows;
    expect(outbox).toEqual([{ kind: "fallback_video" }]);
  });

  it("only participants (or admins) can make a Meet link, and only for paid sessions", async () => {
    const id = await paidSessionAt(new Date(Date.now() + 3 * 86400_000));
    expect((await call(`/v1/sessions/${id}/meet-link`, OTHER)).status).toBe(403);
    expect((await call(`/v1/sessions/${id}/meet-link`)).status).toBe(401);
    expect((await call(`/v1/sessions/${id}/meet-link`, ADMIN)).status).toBe(200);
    await service(sql`update sessions set payment_status = 'pending' where id = ${id}`);
    const unpaid = await paidSessionAt(new Date(Date.now() + 4 * 86400_000));
    await service(sql`update sessions set payment_status = 'pending' where id = ${unpaid}`);
    expect((await call(`/v1/sessions/${unpaid}/meet-link`, CLIENT)).status).toBe(409);
  });

  it("gives an Agora token only to participants, only near the session time", async () => {
    const soon = await paidSessionAt(new Date(Date.now() + 5 * 60_000));
    expect((await call(`/v1/sessions/${soon}/agora-token`, OTHER)).status).toBe(403);
    const ok = await call(`/v1/sessions/${soon}/agora-token`, CLIENT);
    expect(ok.status).toBe(200);
    const t = await ok.json();
    expect(t).toMatchObject({ channel: `session-${soon}`, account: CLIENT });
    expect(t.token).toMatch(/^007/);

    const later = await paidSessionAt(new Date(Date.now() + 3 * 3600_000));
    expect((await call(`/v1/sessions/${later}/agora-token`, CLIENT)).status).toBe(425);
  });

  it("shows the client the transcript only after the Babalawo approves the notes", async () => {
    const id = await paidSessionAt(new Date(Date.now() - 2 * 3600_000));
    // Transcripts exist only when both people agreed to recording and AI notes.
    await service(sql`insert into session_consents(session_id, user_id, party, recording_consent, ai_processing_consent)
      values (${id}, ${CLIENT}, 'client', true, true), (${id}, ${BABA}, 'babalawo', true, true)`);
    await service(sql`insert into session_transcripts(session_id, source, language, text, confidence, needs_review)
      values (${id}, 'stt:openai', 'yo', 'Ifá sọ pé...', 0.82, true)`);
    expect((await call(`/v1/sessions/${id}/transcript`, CLIENT, undefined, "GET")).status).toBe(403);
    const forBaba = await (await call(`/v1/sessions/${id}/transcript`, BABA, undefined, "GET")).json();
    expect(forBaba).toMatchObject({ text: "Ifá sọ pé...", needs_review: true });

    await service(sql`insert into consultation_notes(session_id, status) values (${id}, 'approved')`);
    const forClient = await (await call(`/v1/sessions/${id}/transcript`, CLIENT, undefined, "GET")).json();
    expect(forClient.text).toBe("Ifá sọ pé...");
    expect(forClient).not.toHaveProperty("needs_review");
    expect(forClient).not.toHaveProperty("confidence");
    expect((await call(`/v1/sessions/${id}/transcript`, OTHER, undefined, "GET")).status).toBe(403);
  });
});

describe("notifications", () => {
  it("queues a 1 hour reminder once and sends it; only admins can run the job by hand", async () => {
    const start = new Date(Date.now() + 45 * 60_000);
    const r = await service(sql`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, user_timezone,
        status, payment_status, amount, video_provider, meet_uri)
      values (${CLIENT}, ${BABA}, ${lagos(start).date}, ${lagos(start).hhmm}, ${lagos(new Date(start.getTime() + 3600_000)).hhmm},
        'UTC', 'confirmed', 'paid', 20000, 'google_meet', 'https://meet.google.com/rem-inde-rrr') returning id::text`);
    const id = r.rows[0].id;

    expect((await call("/v1/admin/notifications/dispatch", CLIENT)).status).toBe(403);
    const first = await (await call("/v1/admin/notifications/dispatch", ADMIN)).json();
    expect(first.queued).toBeGreaterThanOrEqual(1);
    const second = await (await call("/v1/admin/notifications/dispatch", ADMIN)).json();
    expect(second.queued).toBe(0);
    const rows = (await service(sql`select kind, status from notification_outbox where session_id = ${id}`)).rows;
    expect(rows).toEqual([{ kind: "reminder_1h", status: "sent" }]);
    expect(calls.some((c) => c.url.startsWith("https://api.ng.termii.com/") && c.body.includes(`/session/${id}`))).toBe(true);
  });

  it("normalises Nigerian phone numbers and converts booking times to UTC", () => {
    expect(toE164("0803 123 4567")).toBe("2348031234567");
    expect(toE164("+234 803 123 4567")).toBe("2348031234567");
    expect(toE164("123")).toBeNull();
    const w = sessionWindow({ session_date: "2026-12-01", start_time: "14:00", end_time: "15:00" });
    expect(w.start.toISOString()).toBe("2026-12-01T13:00:00.000Z");
    const overnight = sessionWindow({ session_date: "2026-12-01", start_time: "23:30", end_time: "00:30" });
    expect(overnight.end.getTime() - overnight.start.getTime()).toBe(3600_000);
    // The stored instants win over the wall-clock fields.
    const stored = sessionWindow({ session_date: "2026-12-01", start_time: "14:00", end_time: "15:00",
      starts_at: new Date("2026-12-01T14:00:00Z"), ends_at: new Date("2026-12-01T15:30:00Z") });
    expect(stored.start.toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(stored.end.toISOString()).toBe("2026-12-01T15:30:00.000Z");
  });
});

describe("data token for PostgREST", () => {
  it("is issued only to signed-in people, as 'authenticated', for ten minutes", async () => {
    const anon = await (await app.request("/v1/data-token")).json();
    expect(anon).toEqual({ token: null, expires_at: null });
    const res = await app.request("/v1/data-token", { headers: { "x-test-user": CLIENT } });
    expect(res.headers.get("cache-control")).toBe("no-store");
    const { token, expires_at } = await res.json();
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(claims).toMatchObject({ sub: CLIENT, role: "authenticated", aud: "authenticated" });
    expect(expires_at - claims.iat).toBe(600);
  });
});
