import { sql } from "kysely";
import type { Caller } from "../db.js";
import { asService, HttpError, loadSessionFor, type Services } from "./context.js";
import { meetApi, SCOPES, spaceConfig, type RecordingMode } from "./google.js";
import { dispatchDue, setting } from "./notify.js";
import { isPlaceholderEmail } from "./phoneAuth.js";

/**
 * Creates (or reconciles) the Google Meet space for a PAID session.
 *  - refuses unless sessions.payment_status = 'paid'
 *  - idempotent: returns the existing link if there is one
 *  - auto-recording is armed only when BOTH parties consented; otherwise OFF
 *  - the Babalawo is added as co-host, so they can start recording by hand as a fallback
 *  - if Google is unavailable or not configured, the session falls back to Agora
 */
export async function createMeetLink(svc: Services, caller: Caller, sessionId: unknown) {
  const s = await loadSessionFor(svc, caller, sessionId, { allowAdmin: true });
  if (s.payment_status !== "paid") throw new HttpError(409, "Session is not paid");
  if (["cancelled", "completed"].includes(s.status)) throw new HttpError(409, `Session is ${s.status}`);

  const full = (await asService(svc, (trx) =>
    sql<{ ok: boolean }>`select public.session_has_full_consent(${s.id}::bigint) ok`.execute(trx))).rows[0].ok;
  const recording: RecordingMode = full ? "ON" : "OFF";
  const recStatus = full ? "scheduled" : "none";

  // 1) Existing space: bring its recording setting in line with the latest consent.
  if (s.video_provider === "google_meet" && s.meet_space_name) {
    const patch = await meetApi(svc, "PATCH",
      `${s.meet_space_name}?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration`,
      [SCOPES.meetCreate, SCOPES.meetSettings],
      { config: { artifactConfig: { recordingConfig: { autoRecordingGeneration: recording } } } })
      .catch((e) => ({ ok: false, status: 0, data: String(e) }));
    if (!patch.ok) console.error("meet patch failed", patch.status, patch.data);
    if (!["processing", "transcribed", "notes_drafted", "failed", "unavailable"].includes(s.recording_status ?? "")) {
      await asService(svc, (trx) => sql`update public.sessions set recording_status = ${recStatus} where id = ${s.id}::bigint`.execute(trx));
    }
    return { provider: "google_meet", meet_uri: s.meet_uri, recording, reconciled: patch.ok };
  }
  if (s.video_provider === "agora" && s.agora_channel_name && !s.meet_space_name) {
    return { provider: "agora", reason: "already_fallback" };
  }

  // 2) Create the space.
  try {
    const access = (await setting(svc, "meet_access_type"))?.toUpperCase() === "TRUSTED" ? "TRUSTED" : "OPEN";
    const created = await meetApi(svc, "POST", "spaces", [SCOPES.meetCreate], { config: spaceConfig(recording, access) });
    if (!created.ok) throw new Error(`Meet create failed (${created.status}): ${created.data?.error?.message ?? ""}`);
    const space = created.data as { name: string; meetingUri: string; meetingCode: string };

    // 3) Babalawo as co-host (needs the Google account they use for Meet; a phone sign-in has none).
    let warning: string | null = null;
    const row = (await asService(svc, (trx) => sql<{ email: string | null }>`
      select coalesce(nullif(trim(b.google_email), ''), p.email) email
        from public.profiles p left join public.babalawos b on b.user_id = p.id
       where p.id = ${s.babalawo_id}::uuid`.execute(trx))).rows[0];
    const email = row?.email && !isPlaceholderEmail(row.email) ? row.email : null;
    if (email) {
      const m = await meetApi(svc, "POST", `${space.name}/members`, [SCOPES.meetCreate], { email, role: "COHOST" });
      if (!m.ok) { warning = `cohost_not_added: ${m.data?.error?.message ?? m.status}`; console.error(warning); }
    } else warning = "cohost_not_added: no email";

    const stored = await asService(svc, async (trx) => {
      const u = await sql<{ id: string }>`
        update public.sessions set video_provider = 'google_meet', meet_uri = ${space.meetingUri},
               meet_code = ${space.meetingCode}, meet_space_name = ${space.name}, meet_created_at = now(),
               recording_status = ${recStatus}, video_fallback_reason = null
         where id = ${s.id}::bigint and meet_space_name is null returning id::text`.execute(trx);
      if (!u.rows.length) {
        // Someone else created it first; theirs wins.
        return (await sql<{ meet_uri: string }>`select meet_uri from public.sessions where id = ${s.id}::bigint`.execute(trx)).rows[0].meet_uri;
      }
      await sql`insert into public.notification_outbox(session_id, kind) values (${s.id}::bigint, 'meet_link')
                on conflict do nothing`.execute(trx);
      return null;
    });
    if (stored) return { provider: "google_meet", meet_uri: stored, recording };
    await dispatchDue(svc, 5).catch((e) => console.error("dispatch", e));
    return { provider: "google_meet", meet_uri: space.meetingUri, recording, warning };
  } catch (e) {
    // 4) Fall back to Agora so the session can still happen.
    const reason = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error("meet unavailable, falling back to agora:", reason);
    await asService(svc, async (trx) => {
      await sql`update public.sessions set video_provider = 'agora', video_fallback_reason = ${reason},
                  agora_channel_name = coalesce(agora_channel_name, 'session-' || id), recording_status = 'unavailable'
                where id = ${s.id}::bigint`.execute(trx);
      await sql`insert into public.notification_outbox(session_id, kind) values (${s.id}::bigint, 'fallback_video')
                on conflict do nothing`.execute(trx);
    });
    await dispatchDue(svc, 5).catch((e2) => console.error("dispatch", e2));
    return { provider: "agora", reason };
  }
}
