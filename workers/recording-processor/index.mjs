// Recording processor: polls for finished Meet sessions, pulls the recording from Drive,
// transcribes it, runs accuracy checks, and drafts notes for the Babalawo to approve.
// Run continuously (default) or once (--once) from cron.
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { meetGet, driveDownload } from "./lib/google.mjs";
import { transcribeChunk, providerName } from "./lib/stt.mjs";
import { assessTranscript, overallLanguage, normalizeLanguage } from "./lib/quality.mjs";
import { draftNotes } from "./lib/notes.mjs";
import { createDb, createFiles } from "./lib/store.mjs";
import { checkProof, compressArgs } from "./lib/proof.mjs";

const db = createDb();
const files = createFiles();
const REC = (p) => `session-recordings/${p}`;
// Columns the worker reads, with dates and times as plain text.
const SESSION_COLS = `id::text, session_date::text, to_char(start_time, 'HH24:MI') start_time, to_char(end_time, 'HH24:MI') end_time,
  user_timezone, video_provider, meet_space_name, recording_status, recording_attempts`;
const ONCE = process.argv.includes("--once");
const CHUNK_SECONDS = 600;
const MAX_ATTEMPTS = 6;
const log = (...a) => console.log(new Date().toISOString(), ...a);

const run = (cmd, args) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
  let out = "", err = "";
  p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
  p.on("close", (c) => (c === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-300)}`))));
});

function zonedToUtc(local, tz) {
  const asUtc = new Date(local + "Z");
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(asUtc);
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return new Date(asUtc.getTime() - (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - asUtc.getTime()));
}
// Booking stores date + HH:MM in the client's timezone (default Africa/Lagos).
function sessionEnd(s) {
  const tz = s.user_timezone || "Africa/Lagos";
  const start = zonedToUtc(`${s.session_date}T${s.start_time.slice(0, 5)}:00`, tz);
  let end = zonedToUtc(`${s.session_date}T${s.end_time.slice(0, 5)}:00`, tz);
  if (end <= start) end = new Date(end.getTime() + 86400_000);
  return end;
}

async function retention() {
  const row = await db.one("select setting_value from public.admin_settings where setting_key = 'recording_retention_days'");
  return Number(row?.setting_value) || 90;
}

async function fail(session, err, terminal = false) {
  const attempts = (session.recording_attempts || 0) + 1;
  const dead = terminal || attempts >= MAX_ATTEMPTS;
  log(`session ${session.id} ${dead ? "FAILED" : "retry"}:`, err.message || err);
  await db.q(`update public.sessions set recording_attempts = $2, recording_last_error = $3, recording_status = $4,
      recording_next_attempt_at = now() + make_interval(mins => $5) where id = $1::bigint`,
    [session.id, attempts, String(err.message || err).slice(0, 500), dead ? "failed" : session.recording_status, Math.min(120, 2 ** attempts)]);
}

/** Step 1: find ready Meet recordings for the session and register them. */
async function discoverRecordings(s) {
  const confs = await meetGet(`conferenceRecords?filter=${encodeURIComponent(`space.name="${s.meet_space_name}"`)}`);
  const records = confs.conferenceRecords || [];
  if (!records.length) return { ready: 0, pending: false, reason: "no conference took place" };
  let ready = 0, pending = false;
  for (const c of records) {
    if (!c.endTime) { pending = true; continue; } // still running
    const recs = (await meetGet(`${c.name}/recordings`)).recordings || [];
    for (const r of recs) {
      if (r.state === "FILE_GENERATED" && r.driveDestination?.file) {
        const days = await retention();
        await db.q(`insert into public.session_recordings(session_id, source, conference_record, recording_resource, drive_file_id, status, retention_until)
            values ($1::bigint, 'meet', $2, $3, $4, 'ready', now() + make_interval(days => $5))
            on conflict (session_id, recording_resource) do nothing`,
          [s.id, c.name, r.name, r.driveDestination.file, days]);
        ready++;
      } else if (r.state === "STARTED" || r.state === "ENDED") pending = true; // not downloadable yet
    }
  }
  return { ready, pending };
}

async function ffprobeDuration(file) {
  return Math.round(parseFloat((await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])).trim()) || 0);
}

/** Step 2: download + extract audio + upload audio copy + transcribe chunks. */
async function transcribeRecording(s, rec, dir) {
  const src = join(dir, "source.bin");
  if (rec.source === "meet") {
    await pipeline(Readable.fromWeb(await driveDownload(rec.drive_file_id)), createWriteStream(src));
  } else {
    await writeFile(src, await files.get(REC(rec.storage_path)));
  }
  const audio = join(dir, "audio.mp3");
  await run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
  const duration = await ffprobeDuration(audio);
  const storagePath = `${s.id}/${rec.id}.mp3`;
  await files.put(REC(storagePath), await readFile(audio), "audio/mpeg");
  await db.q("update public.session_recordings set storage_path = $2, duration_seconds = $3, status = 'processing' where id = $1::uuid",
    [rec.id, storagePath, duration]);

  await run("ffmpeg", ["-y", "-i", audio, "-f", "segment", "-segment_time", String(CHUNK_SECONDS), "-c", "copy", join(dir, "chunk_%03d.mp3")]);
  const chunks = (await readdir(dir)).filter((f) => f.startsWith("chunk_")).sort();
  const segments = [], texts = [], langs = [];
  for (const [i, c] of chunks.entries()) {
    const r = await transcribeChunk(join(dir, c));
    const offset = i * CHUNK_SECONDS;
    texts.push(r.text.trim()); langs.push(r.language);
    for (const seg of r.segments) segments.push({ ...seg, start: seg.start + offset, end: seg.end + offset });
  }
  const text = texts.join("\n").trim();
  const language = overallLanguage(langs, text) || normalizeLanguage(langs[0]);
  return { text, segments, language, duration };
}

async function upsertDraftNotes(s, notes, language, confidence, transcriptId) {
  const existing = await db.one("select id, status, source from public.consultation_notes where session_id = $1::bigint", [s.id]);
  if (existing && !(existing.status === "draft" && existing.source === "ai")) return false; // never overwrite manual/approved
  const row = {
    session_id: s.id, status: "draft", source: "ai", summary: notes.summary, action_points: notes.action_points,
    primary_odu: notes.primary_odu, other_odus: notes.other_odus, ritual_recommendations: notes.ritual_recommendations,
    items_needed: notes.items_needed, warning: notes.warning, deadline: notes.deadline, next_appointment: notes.next_appointment,
    language: language === "yo" || language === "en" ? language : "mixed", transcript_confidence: confidence,
    transcript_id: transcriptId, drafted_at: new Date().toISOString(),
  };
  // Column names come from this code, never from input; values travel as one JSON parameter.
  const cols = Object.keys(row);
  await db.q(`insert into public.consultation_notes(${cols.join(", ")})
      select ${cols.map((c) => `r.${c}`).join(", ")} from jsonb_populate_record(null::public.consultation_notes, $1::jsonb) r
      on conflict (session_id) do update set ${cols.filter((c) => c !== "session_id").map((c) => `${c} = excluded.${c}`).join(", ")}`,
    [JSON.stringify(row)]);
  return true;
}

async function processSession(s) {
  // Consent is re-checked at processing time: withdrawn consent means we do not process.
  const { ok } = await db.one("select public.session_has_full_consent($1::bigint) ok", [s.id]);
  if (!ok) {
    log(`session ${s.id}: consent missing/withdrawn, not processing`);
    await db.q("update public.session_recordings set status = 'failed' where session_id = $1::bigint and status in ('pending', 'ready')", [s.id]);
    await db.q("update public.sessions set recording_status = 'none' where id = $1::bigint", [s.id]);
    return;
  }
  if (s.video_provider === "google_meet" && s.meet_space_name) {
    const d = await discoverRecordings(s);
    const { count } = await db.one("select count(*)::int count from public.session_recordings where session_id = $1::bigint", [s.id]);
    if (!d.ready && !count) {
      const age = Date.now() - sessionEnd(s).getTime();
      if (d.pending && age < 3 * 3600_000) throw new Error("recording not ready yet");
      // No recording will arrive (nobody pressed record / co-host joined on mobile / meeting never happened).
      await db.q("update public.sessions set recording_status = 'unavailable', recording_last_error = $2 where id = $1::bigint",
        [s.id, d.reason || "no recording produced"]);
      log(`session ${s.id}: no recording; marked unavailable (Babalawo can upload audio or write notes manually)`);
      return;
    }
  }
  const recs = await db.q("select id::text, source, drive_file_id, storage_path from public.session_recordings where session_id = $1::bigint and status in ('ready', 'processing')", [s.id]);
  if (!recs.length) return;
  await db.q("update public.sessions set recording_status = 'processing' where id = $1::bigint", [s.id]);

  for (const rec of recs) {
    const dir = await mkdtemp(join(tmpdir(), "rec-"));
    try {
      const t = await transcribeRecording(s, rec, dir);
      const quality = assessTranscript({ text: t.text, segments: t.segments, durationSeconds: t.duration, language: t.language,
        opts: { yorubaAlwaysReview: process.env.YORUBA_ALWAYS_REVIEW !== "false" } });
      const tr = await db.one(`insert into public.session_transcripts(session_id, recording_id, source, language, text, segments, confidence, quality, needs_review)
          values ($1::bigint, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8::jsonb, $9) returning id::text`,
        [s.id, rec.id, `stt:${providerName()}`, t.language, t.text, JSON.stringify(t.segments), quality.confidence ?? quality.score,
         JSON.stringify(quality), quality.needs_review]);
      await db.q("update public.session_recordings set status = 'done' where id = $1::uuid", [rec.id]);
      await db.q("update public.sessions set recording_status = 'transcribed' where id = $1::bigint", [s.id]);

      if (quality.flags.includes("empty_transcript")) { log(`session ${s.id}: empty transcript, skipping notes`); continue; }
      const notes = await draftNotes({ transcript: t.text, language: t.language, sessionDate: s.session_date, quality });
      await db.q("update public.session_transcripts set quality = $2::jsonb where id = $1::uuid", [tr.id, JSON.stringify({ ...quality, notes_draft: notes })]);
      const drafted = await upsertDraftNotes(s, notes, t.language, quality.confidence ?? quality.score, tr.id);
      // Ebo heard in the session become unpriced drafts for the Babalawo (never overwrites their own).
      if (drafted && notes.ebo?.length) {
        await db.q("select public.ebo_ai_draft($1::bigint, $2::jsonb)", [s.id, JSON.stringify(notes.ebo)])
          .catch((e) => log(`session ${s.id}: ebo drafts failed`, e.message));
      }
      await db.q("update public.sessions set recording_status = 'notes_drafted', recording_last_error = null where id = $1::bigint", [s.id]);
      log(`session ${s.id}: notes drafted (score ${quality.score}, review=${quality.needs_review})`);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
}

async function purgeExpired() {
  const rows = await db.q("select id::text, storage_path from public.session_recordings where retention_until < now() and storage_path is not null limit 50");
  for (const r of rows) {
    await files.remove(REC(r.storage_path));
    await db.q("update public.session_recordings set storage_path = null, status = 'done' where id = $1::uuid", [r.id]);
    log("purged expired recording", r.id);
  }
}

/** Ebo proof videos: compress for storage and playback, then listen for the client's name and the items. */
async function processProofs() {
  const due = await db.q(`select p.id::text, p.prescription_id::text ebo_id, p.storage_path, p.attempts, e.babalawo_id::text, e.title
      from public.ebo_proofs p join public.ebo_prescriptions e on e.id = p.prescription_id
     where p.status = 'processing' order by p.created_at limit 3`);
  for (const p of due) {
    const dir = await mkdtemp(join(tmpdir(), "ebo-proof-"));
    try {
      const src = join(dir, "original.bin"), out = join(dir, "proof.mp4");
      await writeFile(src, await files.get(p.storage_path));
      await run("ffmpeg", compressArgs(src, out));
      const body = await readFile(out);
      const duration = await ffprobeDuration(out);
      const key = `ebo-proofs/${p.ebo_id}/${p.id}.mp4`;
      await files.put(key, body, "video/mp4");
      await db.q(`update public.ebo_proofs set status = 'ready', storage_path = $2, content_type = 'video/mp4', size_bytes = $3,
          duration_seconds = $4, processed_at = now(), last_error = null where id = $1::uuid`, [p.id, key, body.length, duration]);
      if (key !== p.storage_path) await files.remove(p.storage_path).catch(() => {});
      log(`ebo proof ${p.id}: compressed to ${Math.round(body.length / 1024)} KB, ${duration}s`);

      // The check is best effort: a video is valid proof even if speech-to-text is down.
      try {
        const audio = join(dir, "audio.mp3");
        await run("ffmpeg", ["-y", "-i", out, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-t", "1800", audio]);
        const t = await transcribeChunk(audio);
        const who = await db.one(`select pr.full_name from public.ebo_prescriptions e join public.profiles pr on pr.id = e.client_id
           where e.id = $1::uuid`, [p.ebo_id]);
        const items = await db.q(`select i.name, c.english_name from public.ebo_items i
           left join public.ebo_catalog_items c on c.id = i.catalog_item_id where i.prescription_id = $1::uuid order by i.position`, [p.ebo_id]);
        const check = { ...checkProof(t.text, who?.full_name, items), language: t.language || null };
        await db.q("update public.ebo_proofs set check_result = $2::jsonb where id = $1::uuid", [p.id, JSON.stringify(check)]);
      } catch (e) {
        await db.q("update public.ebo_proofs set check_result = $2::jsonb where id = $1::uuid", [p.id, JSON.stringify({ skipped: String(e.message || e).slice(0, 200) })]);
      }
    } catch (e) {
      const attempts = (p.attempts || 0) + 1;
      const dead = attempts >= 3;
      log(`ebo proof ${p.id} ${dead ? "FAILED" : "retry"}:`, e.message || e);
      await db.q("update public.ebo_proofs set attempts = $2, last_error = $3, status = $4 where id = $1::uuid",
        [p.id, attempts, String(e.message || e).slice(0, 500), dead ? "failed" : "processing"]);
      if (dead) {
        await db.q(`select public.create_notification($1::uuid, 'ebo_proof_failed', 'Ebo video could not be processed',
            $2, jsonb_build_object('ebo_id', $3::text, 'action_url', '/dashboard'), 'high')`,
          [p.babalawo_id, `${p.title}: please upload the video again.`, p.ebo_id]).catch(() => {});
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
}

async function tick() {
  const due = await db.q(`select ${SESSION_COLS} from public.sessions
     where recording_status in ('scheduled', 'processing')
       and (recording_next_attempt_at is null or recording_next_attempt_at <= now()) limit 10`);
  for (const s of due) {
    // Meet artifacts appear a few minutes after the conference ends.
    if (s.video_provider === "google_meet" && Date.now() < sessionEnd(s).getTime() + 3 * 60_000) continue;
    try { await processSession(s); } catch (e) { await fail(s, e); }
  }
  await processProofs().catch((e) => log("proof error", e.message));
  await purgeExpired().catch((e) => log("purge error", e.message));
}

if (ONCE) { await tick(); await db.end(); process.exit(0); }
log("recording processor started, stt =", providerName());
for (;;) { await tick().catch((e) => log("tick error", e.message)); await new Promise((r) => setTimeout(r, 60_000)); }
