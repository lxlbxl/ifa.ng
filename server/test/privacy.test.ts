import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

// NDPA 2023 / GDPR: consent log, privacy requests, export, erasure, retention, breach register.
const ADMIN = "00000000-0000-0000-0000-0000000000a9";
const BABA = "00000000-0000-0000-0000-0000000000b9";
const CLIENT = "00000000-0000-0000-0000-0000000000c9";
const OTHER = "00000000-0000-0000-0000-0000000000d9";
let admin: pg.Client;
let dbUrl = "";

async function as<T = Record<string, unknown>>(user: string | null, q: string, params: unknown[] = []): Promise<T> {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query(user ? "set role authenticated" : "set role anon");
    if (user) await c.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    return (await c.query(q, params)).rows[0] as T;
  } finally { await c.end(); }
}
const one = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await admin.query(q, params)).rows[0] as T;
const count = async (q: string, params: unknown[] = []) => Number((await one<{ n: string }>(q, params)).n);

let nextDay = 3;
async function session(status = "completed", days = -(nextDay++)): Promise<number> {
  const r = await one<{ id: number }>(`insert into sessions(user_id, babalawo_id, session_date, start_time, end_time, status, payment_status, amount)
    values ($1, $2, current_date + $3::int, '10:00', '11:00', $4, 'paid', 10000) returning id`, [CLIENT, BABA, days, status]);
  return Number(r.id);
}
async function consentBoth(id: number) {
  await admin.query(`insert into session_consents(session_id, user_id, party, recording_consent, ai_processing_consent)
    values ($1, $2, 'client', true, true), ($1, $3, 'babalawo', true, true)`, [id, CLIENT, BABA]);
}

beforeAll(async () => {
  dbUrl = await freshDatabase("ifa_test_privacy");
  await migrate(dbUrl, undefined, () => {});
  admin = new pg.Client({ connectionString: dbUrl });
  await admin.connect();
  await admin.query(`insert into auth.users(id, email, phone, raw_user_meta_data) values
    ('${ADMIN}', 'a9@x.ng', '+2348000000091', '{}'), ('${CLIENT}', 'c9@x.ng', '+2348000000092', '{}'),
    ('${OTHER}', 'd9@x.ng', '+2348000000093', '{}'), ('${BABA}', 'b9@x.ng', '+2348000000094', '{"role":"babalawo"}')`);
  await admin.query(`insert into user_roles(user_id, role) values ($1, 'admin')`, [ADMIN]);
}, 60_000);
afterAll(() => admin?.end());

describe("consent", () => {
  it("asks a new person for age, terms, privacy notice and special-category consent", async () => {
    const s = await as<{ my_privacy_status: { missing: string[] } }>(CLIENT, `select public.my_privacy_status()`);
    expect(s.my_privacy_status.missing).toEqual(["age_confirmed", "terms", "privacy_notice", "special_category"]);
  });

  it("records choices, mirrors message channels, and is append-only", async () => {
    const r = await as<{ record_consents: { missing: string[]; consents: Record<string, { granted: boolean }> } }>(CLIENT,
      `select public.record_consents('{"age_confirmed":true,"terms":true,"privacy_notice":true,"special_category":true,"marketing":false,"whatsapp":false}'::jsonb, 'signup')`);
    expect(r.record_consents.missing).toEqual([]);
    expect(r.record_consents.consents.marketing.granted).toBe(false);
    expect((await one<{ whatsapp_opt_in: boolean }>(`select whatsapp_opt_in from profiles where id = $1`, [CLIENT])).whatsapp_opt_in).toBe(false);
    // Same answer again is not logged twice.
    await as(CLIENT, `select public.record_consents('{"terms":true}'::jsonb)`);
    expect(await count(`select count(*) n from privacy_consents where user_id = $1 and purpose = 'terms'`, [CLIENT])).toBe(1);
    await expect(as(CLIENT, `insert into privacy_consents(user_id, purpose, granted, notice_version) values ($1, 'terms', true, 'x')`, [CLIENT]))
      .rejects.toThrow(/permission denied/);
    await expect(as(CLIENT, `select public.record_consents('{"selling_data":true}'::jsonb)`)).rejects.toThrow(/Unknown consent/);
    await expect(as(null, `select public.record_consents('{"terms":true}'::jsonb)`)).rejects.toThrow(/permission denied/);
  });

  it("asks again for terms and notice when the notice version changes, and never shows others' consents", async () => {
    await admin.query(`update admin_settings set setting_value = '2099-01-01' where setting_key = 'privacy_notice_version'`);
    const s = await as<{ my_privacy_status: { missing: string[] } }>(CLIENT, `select public.my_privacy_status()`);
    expect(s.my_privacy_status.missing).toEqual(["terms", "privacy_notice"]);
    await admin.query(`update admin_settings set setting_value = '2026-11-17' where setting_key = 'privacy_notice_version'`);
    expect(await as<{ n: string }>(OTHER, `select count(*) n from privacy_consents`)).toEqual({ n: "0" });
  });
});

describe("privacy requests", () => {
  it("are due in 30 days, visible to the person and admins only", async () => {
    const r = await as<{ submit_data_request: { id: number; due_at: string } }>(CLIENT, `select public.submit_data_request('rectification', 'My name is spelled wrong')`);
    const due = new Date(r.submit_data_request.due_at).getTime();
    expect(Math.round((due - Date.now()) / 86_400_000)).toBe(30);
    expect(await as<{ n: string }>(OTHER, `select count(*) n from data_subject_requests`)).toEqual({ n: "0" });
    expect(Number((await as<{ n: string }>(ADMIN, `select count(*) n from data_subject_requests`)).n)).toBeGreaterThan(0);
    expect(await count(`select count(*) n from notifications where user_id = $1 and type = 'privacy_request'`, [ADMIN])).toBeGreaterThan(0);
  });

  it("can come from people without an account, and wait for an identity check", async () => {
    const r = await as<{ submit_public_data_request: { id: number } }>(null,
      `select public.submit_public_data_request('erasure', 'Ade Bello', 'ade@example.com', null, 'Please delete my application')`);
    const row = await one<{ status: string; identity_verified_at: string | null }>(`select status, identity_verified_at from data_subject_requests where id = $1`, [r.submit_public_data_request.id]);
    expect(row).toEqual({ status: "verifying", identity_verified_at: null });
    await expect(as(null, `select public.submit_public_data_request('erasure', 'A', null, null, null)`)).rejects.toThrow(/name/);
  });

  it("only admins move them, with an answer, a verified identity and a lawful extension", async () => {
    const { id } = await one<{ id: number }>(`select id from data_subject_requests where source = 'public_form' limit 1`);
    await expect(as(CLIENT, `select public.admin_update_data_request($1, 'completed', null, 'done')`, [id])).rejects.toThrow(/Forbidden/);
    await expect(as(ADMIN, `select public.admin_update_data_request($1, 'completed')`, [id])).rejects.toThrow(/Write the answer/);
    await expect(as(ADMIN, `select public.admin_update_data_request($1, 'completed', null, 'Deleted')`, [id])).rejects.toThrow(/Check who is asking/);
    await expect(as(ADMIN, `select public.admin_update_data_request($1, 'in_progress', 'busy', null, 90)`, [id])).rejects.toThrow(/longer than the law/);
    await expect(as(ADMIN, `select public.admin_update_data_request($1, 'in_progress', null, null, 30)`, [id])).rejects.toThrow(/Say why/);
    await as(ADMIN, `select public.admin_update_data_request($1, 'in_progress', 'Many records to collect', null, 30)`, [id]);
    const r = await one<{ status: string; days: number }>(`select status, extract(day from due_at - received_at)::int days from data_subject_requests where id = $1`, [id]);
    expect(r).toEqual({ status: "extended", days: 60 });
    expect(await count(`select count(*) n from admin_audit_log where target_type = 'data_subject_request' and target_id = $1`, [String(id)])).toBe(1);
  });
});

describe("export", () => {
  it("gives the person their data as JSON, without credentials, and logs it", async () => {
    await admin.query(`insert into auth.sessions(id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
      values (gen_random_uuid(), $1, 'secret-session-token', now() + interval '1 day', '1.2.3.4', 'Phone', now(), now())`, [CLIENT]);
    const id = await session();
    const r = await as<{ export_my_data: { data: Record<string, unknown> } }>(CLIENT, `select public.export_my_data()`);
    const text = JSON.stringify(r.export_my_data);
    expect(text).not.toContain("secret-session-token");
    expect(r.export_my_data.data.account).toMatchObject({ id: CLIENT, phone: "+2348000000092" });
    expect((r.export_my_data.data.sessions as { id: number }[]).some((s) => Number(s.id) === id)).toBe(true);
    expect(r.export_my_data.data.privacy_consents).toBeTruthy();
    expect(r.export_my_data.data.profiles).toBeTruthy();
    expect(await count(`select count(*) n from data_subject_requests where user_id = $1 and source = 'self_service' and request_type = 'portability'`, [CLIENT])).toBe(1);
    await expect(as(CLIENT, `select public._export_user_data($1)`, [OTHER])).rejects.toThrow(/permission denied/);
    await expect(as(CLIENT, `select public.admin_export_user_data($1)`, [OTHER])).rejects.toThrow(/Forbidden/);
  });
});

describe("withdrawing recording consent after a consultation", () => {
  it("deletes the recording and transcript, keeps approved notes, and blocks late transcripts", async () => {
    const id = await session();
    await consentBoth(id);
    await admin.query(`insert into session_recordings(session_id, source, storage_path, status, recording_resource) values ($1, 'upload', $2, 'done', $2)`, [id, `${id}/a.webm`]);
    await admin.query(`insert into session_transcripts(session_id, source, language, text) values ($1, 'stt:openai', 'yo', 'private words')`, [id]);
    await admin.query(`insert into consultation_notes(session_id, status, source, summary) values ($1, 'approved', 'manual', 'kept')`, [id]);
    await expect(as(OTHER, `select public.withdraw_recording_consent($1)`, [id])).rejects.toThrow(/not a participant/);
    const r = await as<{ withdraw_recording_consent: { sessions: number; files: number } }>(CLIENT, `select public.withdraw_recording_consent($1)`, [id]);
    expect(r.withdraw_recording_consent).toEqual({ sessions: 1, files: 1 });
    expect(await count(`select count(*) n from session_transcripts where session_id = $1`, [id])).toBe(0);
    expect(await count(`select count(*) n from session_recordings where session_id = $1 and storage_path is not null`, [id])).toBe(0);
    expect(await count(`select count(*) n from private.storage_deletions where object_key = $1`, [`session-recordings/${id}/a.webm`])).toBe(1);
    expect(await count(`select count(*) n from consultation_notes where session_id = $1`, [id])).toBe(1);
    await expect(admin.query(`insert into session_transcripts(session_id, source, text) values ($1, 'stt:openai', 'late')`, [id]))
      .rejects.toThrow(/consent was withdrawn/);
  });
});

describe("erasure", () => {
  it("removes consultation content and queues files, keeps payments, and records the request", async () => {
    const id = await session();
    await consentBoth(id);
    await admin.query(`update sessions set consultation_topic = 'personal' where id = $1`, [id]);
    await admin.query(`insert into consultation_notes(session_id, status, source, summary) values ($1, 'approved', 'manual', 'about my marriage')`, [id]);
    await admin.query(`insert into session_recordings(session_id, source, storage_path, status, recording_resource) values ($1, 'upload', $2, 'done', $2)`, [id, `${id}/b.webm`]);
    await admin.query(`insert into notifications(user_id, type, title, message) values ($1, 't', 'x', 'y')`, [CLIENT]);
    await admin.query(`update sessions set status = 'completed' where user_id = $1`, [CLIENT]);
    await as(CLIENT, `select public.delete_my_account('DELETE', true)`);
    expect(await count(`select count(*) n from consultation_notes where session_id = $1`, [id])).toBe(0);
    expect((await one<{ consultation_topic: string | null }>(`select consultation_topic from sessions where id = $1`, [id])).consultation_topic).toBeNull();
    expect(await count(`select count(*) n from sessions where user_id = $1`, [CLIENT])).toBeGreaterThan(0);
    expect(await count(`select count(*) n from notifications where user_id = $1`, [CLIENT])).toBe(0);
    expect(await count(`select count(*) n from private.storage_deletions where object_key in ($1, $2)`, [`session-recordings/${id}/b.webm`, `avatars/${CLIENT}.jpg`])).toBe(2);
    expect(await count(`select count(*) n from data_subject_requests where user_id = $1 and request_type = 'erasure' and status = 'completed'`, [CLIENT])).toBe(1);
    expect(await count(`select count(*) n from privacy_consents where user_id = $1`, [CLIENT])).toBeGreaterThan(0); // proof of consent stays
  });

  it("admins erase only against a verified erasure request", async () => {
    const r = await as<{ submit_data_request: { id: number } }>(OTHER, `select public.submit_data_request('access')`);
    await expect(as(ADMIN, `select public.admin_erase_user($1, $2)`, [OTHER, r.submit_data_request.id])).rejects.toThrow(/erasure request/);
    const e = await as<{ submit_data_request: { id: number } }>(OTHER, `select public.submit_data_request('erasure', 'Lost my phone')`);
    await as(ADMIN, `select public.admin_erase_user($1, $2)`, [OTHER, e.submit_data_request.id]);
    expect((await one<{ phone: string | null; status: string }>(`select p.phone, r.status from profiles p, data_subject_requests r
      where p.id = $1 and r.id = $2`, [OTHER, e.submit_data_request.id]))).toEqual({ phone: null, status: "completed" });
    expect(await count(`select count(*) n from admin_audit_log where action = 'account_erased' and target_id = $1`, [OTHER])).toBe(1);
  });
});

describe("retention", () => {
  it("deletes what is past its date, keeps the rest, and logs the run", async () => {
    await admin.query(`insert into notifications(user_id, type, title, message, created_at) values
      ($1, 'old', 'x', 'y', now() - interval '400 days'), ($1, 'new', 'x', 'y', now())`, [BABA]);
    await admin.query(`insert into auth.phone_otps(phone, code_hash, purpose, channel, expires_at, created_at)
      values ('+2348000000099', 'h', 'login', 'sms', now() - interval '60 days', now() - interval '60 days')`);
    const r = await one<{ run_retention: Record<string, number> }>(`select public.run_retention()`);
    expect(r.run_retention.notifications).toBe(1);
    expect(r.run_retention.sign_in_codes).toBe(1);
    expect(await count(`select count(*) n from notifications where user_id = $1`, [BABA])).toBe(1);
    expect(await count(`select count(*) n from retention_runs`)).toBe(1);
    await expect(as(CLIENT, `select public.run_retention()`)).rejects.toThrow(/permission denied/);
  });
});

describe("breach register", () => {
  it("is admin-only, audited, and can't be closed without the NDPC decision", async () => {
    await expect(as(BABA, `insert into data_breaches(title) values ('x')`)).rejects.toThrow(/row-level security/);
    const b = await as<{ id: number }>(ADMIN, `insert into data_breaches(title, risk) values ('Lost laptop', 'high') returning id`);
    expect(await as<{ n: string }>(BABA, `select count(*) n from data_breaches`)).toEqual({ n: "0" });
    await expect(as(ADMIN, `update data_breaches set status = 'closed' where id = $1`, [b.id])).rejects.toThrow(/NDPC/);
    await as(ADMIN, `update data_breaches set status = 'closed', not_reported_reason = 'Laptop encrypted, no risk' where id = $1`, [b.id]);
    expect(await count(`select count(*) n from admin_audit_log where target_type = 'data_breach'`)).toBe(2);
    const o = await as<{ admin_privacy_overview: { open_breaches: number } }>(ADMIN, `select public.admin_privacy_overview()`);
    expect(o.admin_privacy_overview.open_breaches).toBe(0);
  });
});
