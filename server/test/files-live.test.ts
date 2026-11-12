import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "kysely";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { createLiveHub, type LiveHub } from "../src/services/live.js";
import { JOBS } from "../src/services/jobs.js";
import { createFileStore } from "../src/services/storage.js";
import { freshDatabase } from "./helpers.js";

/** Phase 5: files (avatars, session audio), live notifications and scheduled jobs. */

const CLIENT = "aaaaaaaa-5555-4000-8000-000000000001";
const BABA = "bbbbbbbb-5555-4000-8000-000000000002";
const ADMIN = "dddddddd-5555-4000-8000-000000000004";
const OTHER = "cccccccc-5555-4000-8000-000000000003";

let database: Database;
let app: ReturnType<typeof createApp>;
let live: LiveHub;
let dir: string;
let sessionId: string;
let config: ReturnType<typeof loadConfig>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = (q: any) => database.as({ kind: "service" }, (trx) => q.execute(trx)) as Promise<{ rows: any[] }>;
const as = (user?: string, init: RequestInit = {}) => ({ ...init, headers: { ...(user ? { "x-test-user": user } : {}), ...(init.headers ?? {}) } });

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const form = (bytes: Uint8Array, type: string, name = "f") => {
  const f = new FormData();
  f.set("file", new File([bytes], name, { type }));
  return f;
};

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_files_live");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  dir = await mkdtemp(path.join(tmpdir(), "ifa-files-"));
  config = loadConfig({ DATABASE_URL: url, NODE_ENV: "test", FILES_DIR: dir, API_URL: "http://api.test" });
  const files = createFileStore(config);
  live = createLiveHub({ config, database, fetch, files }, url);
  await live.ready;
  app = createApp({
    config, database, files, live,
    resolveCaller: async (req) => (req.headers.get("x-test-user") ? { kind: "user", userId: req.headers.get("x-test-user")! } : { kind: "anon" }),
  });
  await service(sql`insert into auth.users(id, email, raw_user_meta_data) values
    (${CLIENT}, 'c5@example.com', '{}'), (${BABA}, 'b5@example.com', '{"role":"babalawo"}'),
    (${ADMIN}, 'a5@example.com', '{}'), (${OTHER}, 'o5@example.com', '{}')`);
  await service(sql`insert into user_roles(user_id, role) values (${ADMIN}, 'admin')`);
  const r = await service(sql`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
    values (${CLIENT}, ${BABA}, current_date - 1, '10:00', '11:00', 'confirmed', 'paid', 20000) returning id::text`);
  sessionId = r.rows[0].id;
});
afterAll(async () => {
  await live?.close();
  await database?.close();
  await rm(dir, { recursive: true, force: true });
});

describe("profile photos", () => {
  it("uploads your own photo, serves it publicly, and refuses files that aren't images", async () => {
    expect((await app.request("/v1/me/avatar", { method: "POST", body: form(PNG, "image/png") })).status).toBe(401);
    const fake = await app.request("/v1/me/avatar", as(BABA, { method: "POST", body: form(new TextEncoder().encode("<script>"), "image/png") }));
    expect(fake.status).toBe(415);

    const ok = await app.request("/v1/me/avatar", as(BABA, { method: "POST", body: form(PNG, "image/png") }));
    expect(ok.status).toBe(200);
    const { url } = await ok.json();
    expect(url).toMatch(new RegExp(`^http://api.test/files/avatars/${BABA}\\.png\\?v=`));
    const saved = (await service(sql`select avatar_url from profiles where id = ${BABA}`)).rows[0];
    expect(saved.avatar_url).toBe(url);

    const served = await app.request(new URL(url).pathname);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(PNG);
    expect((await app.request("/files/avatars/..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
  });
});

describe("session audio", () => {
  it("only the Babalawo can upload, and only after both people agreed to recording", async () => {
    const audio = () => form(new Uint8Array([1, 2, 3, 4]), "audio/webm", "a.webm");
    expect((await app.request(`/v1/sessions/${sessionId}/audio`, as(CLIENT, { method: "POST", body: audio() }))).status).toBe(403);
    expect((await app.request(`/v1/sessions/${sessionId}/audio`, as(BABA, { method: "POST", body: audio() }))).status).toBe(403);

    await service(sql`insert into session_consents(session_id, user_id, party, recording_consent, ai_processing_consent) values
      (${sessionId}, ${CLIENT}, 'client', true, true), (${sessionId}, ${BABA}, 'babalawo', true, true)`);
    const ok = await app.request(`/v1/sessions/${sessionId}/audio`, as(BABA, { method: "POST", body: audio() }));
    expect(ok.status).toBe(200);
    const s = (await service(sql`select recording_status from sessions where id = ${sessionId}`)).rows[0];
    expect(s.recording_status).toBe("scheduled");
  });

  it("gives the Babalawo and admins a 10 minute link, never the client", async () => {
    expect((await app.request(`/v1/sessions/${sessionId}/recording`, as(CLIENT))).status).toBe(403);
    expect((await app.request(`/v1/sessions/${sessionId}/recording`, as(OTHER))).status).toBe(403);
    expect((await app.request(`/v1/sessions/${sessionId}/recording`, as(ADMIN))).status).toBe(200);
    const { url, expires_in } = await (await app.request(`/v1/sessions/${sessionId}/recording`, as(BABA))).json();
    expect(expires_in).toBe(600);
    const file = await app.request(new URL(url).pathname);
    expect(file.status).toBe(200);
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));

    const tampered = new URL(url).pathname.replace(/.$/, (ch) => (ch === "A" ? "B" : "A"));
    expect((await app.request(tampered)).status).toBe(404);
    const logged = (await service(sql`select count(*)::int n from admin_audit_log where action = 'recording_access'`)).rows[0];
    expect(logged.n).toBe(2);
  });
});

describe("live notifications", () => {
  it("pushes a new notification to its owner's open stream, and nobody else's", async () => {
    const open = async (user: string) => {
      const res = await app.request("/v1/notifications/stream", as(user));
      expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
      return res.body!.getReader();
    };
    const mine = await open(CLIENT);
    const theirs = await open(OTHER);
    const dec = new TextDecoder();
    const readUntil = async (r: ReadableStreamDefaultReader<Uint8Array>, needle: string, ms = 5000) => {
      let text = "";
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        const chunk = await Promise.race([r.read(), new Promise<null>((res) => setTimeout(() => res(null), 200))]);
        if (chunk && !chunk.done) text += dec.decode(chunk.value);
        if (text.includes(needle)) return text;
      }
      return text;
    };
    await readUntil(mine, "event: ready");
    await readUntil(theirs, "event: ready");

    await service(sql`insert into notifications(user_id, type, title, message) values (${CLIENT}, 'booking', 'Booking confirmed', 'See you soon')`);
    expect(await readUntil(mine, "Booking confirmed")).toContain("event: notification");
    expect(await readUntil(theirs, "Booking confirmed", 1000)).not.toContain("Booking confirmed");
    await mine.cancel();
    await theirs.cancel();

    expect((await app.request("/v1/notifications/stream")).status).toBe(401);
  });
});

describe("scheduled jobs", () => {
  it("each job runs cleanly against the real schema", async () => {
    const files = createFileStore(config);
    for (const job of JOBS) await expect(job.run({ config, database, fetch, files })).resolves.not.toThrow();
  });
});

describe("Ebo proof uploads", () => {
  it("lets only the Babalawo upload once paid, queues videos for compression, and shows links to the client", async () => {
    const e = (await service(sql`insert into ebo_prescriptions(session_id, babalawo_id, client_id, title, status, performed_by, owo_ifa)
      values (${sessionId}::bigint, ${BABA}, ${CLIENT}, 'Ebo test', 'sent', 'babalawo', 1000) returning id::text`)).rows[0].id;
    const video = form(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]), "video/mp4", "ritual.mp4");
    expect((await app.request(`/v1/ebo/${e}/proofs`, as(BABA, { method: "POST", body: video }))).status).toBe(409); // not paid yet
    await service(sql`update ebo_prescriptions set status = 'paid' where id = ${e}::uuid`);
    expect((await app.request(`/v1/ebo/${e}/proofs`, as(CLIENT, { method: "POST", body: form(PNG, "image/png") }))).status).toBe(403);
    expect((await app.request(`/v1/ebo/${e}/proofs`, as(BABA, { method: "POST", body: form(PNG, "application/pdf") }))).status).toBe(415);

    const up = await app.request(`/v1/ebo/${e}/proofs`, as(BABA, { method: "POST", body: video }));
    expect(up.status).toBe(200);
    expect(await up.json()).toMatchObject({ kind: "video", status: "processing" });
    const photo = await app.request(`/v1/ebo/${e}/proofs`, as(BABA, { method: "POST", body: form(PNG, "image/png") }));
    expect(await photo.json()).toMatchObject({ kind: "photo", status: "ready" });

    const list = await app.request(`/v1/ebo/${e}/proofs`, as(CLIENT));
    expect(list.status).toBe(200);
    const proofs = await list.json();
    expect(proofs).toHaveLength(2);
    expect(proofs[0]).toMatchObject({ kind: "video", status: "processing", url: null });
    expect(proofs[1].url).toMatch(/^http:\/\/api\.test\/files\/signed\//);
    const served = await app.request(new URL(proofs[1].url).pathname);
    expect(served.status).toBe(200);
    expect((await app.request(`/v1/ebo/${e}/proofs`, as(OTHER))).status).toBe(403);
    expect((await app.request(`/v1/ebo/${e}/proofs`, as(ADMIN))).status).toBe(200);
  });
});

describe("queued file deletions (erasure and retention)", () => {
  it("removes files the database queued, and keeps failing ones for an admin to see", async () => {
    const files = createFileStore(config);
    await files.put("avatars/queued-test.png", PNG, "image/png");
    await service(sql`insert into private.storage_deletions(object_key, reason) values ('avatars/queued-test.png', 'test')`);
    const { deleteQueuedFiles } = await import("../src/services/privacy.js");
    const r = await deleteQueuedFiles({ config, database, fetch, files } as never);
    expect(r.sent).toBeGreaterThanOrEqual(1);
    expect(await files.get("avatars/queued-test.png")).toBeNull();
    const left = await service(sql`select count(*)::int n from private.storage_deletions where object_key = 'avatars/queued-test.png' and done_at is null`);
    expect(left.rows[0].n).toBe(0);
  });
});
