import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createECDH, randomBytes } from "node:crypto";
import { sql } from "kysely";
import webpush from "web-push";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { createFileStore } from "../src/services/storage.js";
import { pushNotification, pushPending } from "../src/services/push.js";
import { expireStalePresence } from "../src/services/presence.js";
import type { Services } from "../src/services/context.js";
import { freshDatabase } from "./helpers.js";

/** Babalawo Online/Offline (notifications required) and web push delivery. */

const BABA = "bbbbbbbb-7777-4000-8000-000000000001";
const CLIENT = "aaaaaaaa-7777-4000-8000-000000000002";
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/device-one";

let database: Database;
let url = "";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = (q: any) => database.as({ kind: "service" }, (trx) => q.execute(trx)) as Promise<{ rows: any[] }>;

const pushCalls: { url: string; headers: Record<string, string> }[] = [];
let pushStatus = 201;
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  pushCalls.push({ url: String(input), headers: (init?.headers ?? {}) as Record<string, string> });
  return new Response(null, { status: pushStatus });
}) as typeof fetch;

function makeApp(withPush: boolean) {
  const vapid = webpush.generateVAPIDKeys();
  const config = loadConfig({
    DATABASE_URL: url, NODE_ENV: "test",
    ...(withPush ? { VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey } : {}),
  });
  const files = createFileStore(config);
  const svc: Services = { config, database, fetch: fakeFetch, files };
  const app = createApp({
    config, database, files, fetch: fakeFetch,
    resolveCaller: async (req) => (req.headers.get("x-test-user") ? { kind: "user", userId: req.headers.get("x-test-user")! } : { kind: "anon" }),
  });
  const call = (path: string, user?: string, method = "GET", payload?: unknown) => app.request(path, {
    method, headers: { ...(user ? { "x-test-user": user } : {}), "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  return { svc, call };
}

const browserKeys = () => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
};

beforeAll(async () => {
  url = await freshDatabase("ifa_test_presence_push");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  await service(sql`insert into auth.users(id, email, raw_user_meta_data) values
    (${BABA}, 'b7@example.com', '{"role":"babalawo"}'), (${CLIENT}, 'c7@example.com', '{}')`);
  await service(sql`update babalawos set is_verified = true, is_active = true where user_id = ${BABA}`);
}, 60_000);
afterAll(() => database?.close());

describe("presence without push keys (in-app alerts only)", () => {
  const { call } = { call: (...a: Parameters<ReturnType<typeof makeApp>["call"]>) => makeApp(false).call(...a) };

  it("starts Offline and is public", async () => {
    const r = await call(`/v1/babalawos/${BABA}/presence`);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ status: "offline", available_now: false });
    expect((await call("/v1/babalawos/not-a-uuid/presence")).status).toBe(400);
    expect((await call(`/v1/babalawos/${CLIENT}/presence`)).status).toBe(404);
  });

  it("refuses Online until notifications are allowed", async () => {
    const r = await call("/v1/me/presence", BABA, "POST", { status: "online", permission: "default" });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: "notifications_required" });
    const ok = await call("/v1/me/presence", BABA, "POST", { status: "online", permission: "granted" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ status: "online", available_now: true, push_configured: false });
  });

  it("only lets Babalawos have a status", async () => {
    expect((await call("/v1/me/presence", CLIENT, "POST", { status: "online", permission: "granted" })).status).toBe(403);
    expect((await call("/v1/me/presence", undefined, "POST", { status: "online" })).status).toBe(401);
  });

  it("blocks a Babalawo from flipping the column directly (PostgREST path)", async () => {
    const err = await database.as({ kind: "user", userId: BABA }, (trx) =>
      sql`update public.babalawos set current_status = 'busy' where user_id = ${BABA}`.execute(trx)).catch((e) => e);
    expect(err?.code).toBe("42501");
  });

  it("shows busy, not available, during an instant session", async () => {
    const s = await service(sql`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
      values (${CLIENT}, ${BABA}, current_date, '10:00', '11:00', 'in_progress', 'paid', 1000) returning id`);
    expect(await (await call(`/v1/babalawos/${BABA}/presence`)).json()).toMatchObject({ status: "busy", available_now: false });
    await service(sql`delete from sessions where id = ${s.rows[0].id}`);
  });
});

describe("presence and alerts with push keys", () => {
  let app: ReturnType<typeof makeApp>;
  beforeAll(async () => {
    app = makeApp(true);
    await app.call("/v1/me/presence", BABA, "POST", { status: "offline" });
  });

  it("publishes the public key", async () => {
    expect((await (await app.call("/v1/push/config")).json()).publicKey).toEqual(expect.any(String));
  });

  it("only stores real browser push endpoints", async () => {
    const r = await app.call("/v1/me/push-subscription", BABA, "PUT", { endpoint: "https://evil.example/x", keys: browserKeys() });
    expect(r.status).toBe(400);
    const ok = await app.call("/v1/me/push-subscription", BABA, "PUT", { endpoint: ENDPOINT, keys: browserKeys() });
    expect(ok.status).toBe(200);
  });

  it("needs this device's subscription to go Online", async () => {
    const r = await app.call("/v1/me/presence", BABA, "POST", { status: "online", permission: "granted" });
    expect(r.status).toBe(409);
    const ok = await app.call("/v1/me/presence", BABA, "POST", { status: "online", endpoint: ENDPOINT });
    expect(await ok.json()).toMatchObject({ status: "online", available_now: true });
  });

  it("pushes a Consult Now request once, marked urgent", async () => {
    pushCalls.length = 0;
    const id = (await service(sql`select public.create_notification(${BABA}::uuid, 'instant_session_request', 'New Instant Session',
      'A client has paid', '{"session_id": 42}'::jsonb, 'urgent') id`)).rows[0].id;
    const r = await pushNotification(app.svc, id);
    expect(r).toMatchObject({ sent: 1 });
    expect(pushCalls[0].url).toBe(ENDPOINT);
    expect(pushCalls[0].headers.Urgency ?? pushCalls[0].headers.urgency).toBe("high");
    expect(pushCalls[0].headers.Authorization ?? pushCalls[0].headers.authorization).toMatch(/^vapid /);
    expect(await pushNotification(app.svc, id)).toBeNull();
    expect(pushCalls).toHaveLength(1);
  });

  it("sweeps notifications the live listener missed", async () => {
    pushCalls.length = 0;
    await service(sql`insert into notifications(user_id, type, title, message, created_at)
      values (${BABA}, 'session_booked', 'New booking', 'A client booked', now() - interval '1 minute')`);
    expect(await pushPending(app.svc)).toEqual({ pushed: 1 });
    expect(pushCalls).toHaveLength(1);
  });

  it("drops dead subscriptions and goes Offline when nobody can be reached", async () => {
    pushStatus = 410;
    const r = await app.call("/v1/me/push-test", BABA, "POST", {});
    expect(r.status).toBe(409);
    pushStatus = 201;
    expect((await service(sql`select count(*)::int n from push_subscriptions where user_id = ${BABA}`)).rows[0].n).toBe(0);
    // Re-subscribe, go online, then unsubscribe this (only) device.
    await app.call("/v1/me/push-subscription", BABA, "PUT", { endpoint: ENDPOINT, keys: browserKeys() });
    await app.call("/v1/me/presence", BABA, "POST", { status: "online", endpoint: ENDPOINT });
    const del = await app.call("/v1/me/push-subscription", BABA, "DELETE", { endpoint: ENDPOINT });
    expect(await del.json()).toMatchObject({ went_offline: true });
  });

  it("switches off a stale Online and tells the Babalawo", async () => {
    await service(sql`update babalawos set current_status = 'online', last_seen_at = now() - interval '13 hours' where user_id = ${BABA}`);
    expect(await expireStalePresence(app.svc)).toEqual({ expired: 1 });
    expect(await (await app.call(`/v1/babalawos/${BABA}/presence`)).json()).toMatchObject({ status: "offline" });
    const n = await service(sql`select count(*)::int n from notifications where user_id = ${BABA} and type = 'presence_offline'`);
    expect(n.rows[0].n).toBe(1);
  });
});
