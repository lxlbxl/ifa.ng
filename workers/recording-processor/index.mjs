// Recording processor: polls for finished Meet sessions, pulls the recording from Drive,
// transcribes it, runs accuracy checks, and drafts notes for the Babalawo to approve.
// Run continuously (default) or once (--once) from cron.
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { meetGet, driveDownload } from "./lib/google.mjs";
import { transcribeChunk, providerName } from "./lib/stt.mjs";
import { assessTranscript, overallLanguage, normalizeLanguage } from "./lib/quality.mjs";
import { draftNotes } from "./lib/notes.mjs";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
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
  const { data } = await db.from("admin_settings").select("setting_value").eq("setting_key", "recording_retention_days").maybeSingle();
  return Number(data?.setting_value) || 90;
}

async function fail(session, err, terminal = false) {
  const attempts = (session.recording_attempts || 0) + 1;
  const dead = terminal || attempts >= MAX_ATTEMPTS;
  log(`session ${session.id} ${dead ? "FAILED" : "retry"}:`, err.message || err);
  await db.from("sessions").update({
    recording_attempts: attempts, recording_last_error: String(err.message || err).slice(0, 500),
    recording_status: dead ? "failed" : session.recording_status,
    recording_next_attempt_at: new Date(Date.now() + Math.min(120, 2 ** attempts) * 60_000).toISOString(),
  }).eq("id", session.id);
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
        const { error } = await db.from("session_recordings").upsert({
          session_id: s.id, source: "meet", conference_record: c.name, recording_resource: r.name,
          drive_file_id: r.driveDestination.file, status: "ready",
          retention_until: new Date(Date.now() + days * 86400_000).toISOString(),
        }, { onConflict: "session_id,recording_resource", ignoreDuplicates: true });
        if (error) throw error;
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
    const { data, error } = await db.storage.from("session-recordings").download(rec.storage_path);
    if (error) throw error;
    await pipeline(Readable.fromWeb(data.stream()), createWriteStream(src));
  }
  const audio = join(dir, "audio.mp3");
  await run("ffmpeg", ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audio]);
  const duration = await ffprobeDuration(audio);
  const storagePath = `${s.id}/${rec.id}.mp3`;
  const { error: upErr } = await db.storage.from("session-recordings").upload(storagePath, await readFile(audio), { contentType: "audio/mpeg", upsert: true });
  if (upErr) throw upErr;
  await db.from("session_recordings").update({ storage_path: storagePath, duration_seconds: duration, status: "processing" }).eq("id", rec.id);

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
  const { data: existing, error: e1 } = await db.from("consultation_notes").select("id,status,source").eq("session_id", s.id).maybeSingle();
  if (e1 && e1.code === "42P01") { log("consultation_notes table not present yet; draft kept on the transcript row"); return false; }
  if (e1) throw e1;
  if (existing && !(existing.status === "draft" && existing.source === "ai")) return false; // never overwrite manual/approved
  const row = {
    session_id: s.id, status: "draft", source: "ai", summary: notes.summary, action_points: notes.action_points,
    primary_odu: notes.primary_odu, other_odus: notes.other_odus, ritual_recommendations: notes.ritual_recommendations,
    items_needed: notes.items_needed, warning: notes.warning, deadline: notes.deadline, next_appointment: notes.next_appointment,
    language: language === "yo" || language === "en" ? language : "mixed", transcript_confidence: confidence,
    transcript_id: transcriptId, drafted_at: new Date().toISOString(),
  };
  let { error } = await db.from("consultation_notes").upsert(row, { onConflict: "session_id" });
  if (error && /transcript_id/.test(error.message)) { delete row.transcript_id; ({ error } = await db.from("consultation_notes").upsert(row, { onConflict: "session_id" })); }
  if (error) throw error;
  return true;
}

async function processSession(s) {
  // Consent is re-checked at processing time: withdrawn consent means we do not process.
  const { data: ok } = await db.rpc("session_has_full_consent", { p_session_id: s.id });
  if (!ok) {
    log(`session ${s.id}: consent missing/withdrawn, not processing`);
    await db.from("session_recordings").update({ status: "failed" }).eq("session_id", s.id).in("status", ["pending", "ready"]);
    await db.from("sessions").update({ recording_status: "none" }).eq("id", s.id);
    return;
  }
  if (s.video_provider === "google_meet" && s.meet_space_name) {
    const d = await discoverRecordings(s);
    const { count } = await db.from("session_recordings").select("id", { count: "exact", head: true }).eq("session_id", s.id);
    if (!d.ready && !count) {
      const age = Date.now() - sessionEnd(s).getTime();
      if (d.pending && age < 3 * 3600_000) throw new Error("recording not ready yet");
      // No recording will arrive (nobody pressed record / co-host joined on mobile / meeting never happened).
      await db.from("sessions").update({ recording_status: "unavailable", recording_last_error: d.reason || "no recording produced" }).eq("id", s.id);
      log(`session ${s.id}: no recording; marked unavailable (Babalawo can upload audio or write notes manually)`);
      return;
    }
  }
  const { data: recs } = await db.from("session_recordings").select("*").eq("session_id", s.id).in("status", ["ready", "processing"]);
  if (!recs?.length) return;
  await db.from("sessions").update({ recording_status: "processing" }).eq("id", s.id);

  for (const rec of recs) {
    const dir = await mkdtemp(join(tmpdir(), "rec-"));
    try {
      const t = await transcribeRecording(s, rec, dir);
      const quality = assessTranscript({ text: t.text, segments: t.segments, durationSeconds: t.duration, language: t.language,
        opts: { yorubaAlwaysReview: process.env.YORUBA_ALWAYS_REVIEW !== "false" } });
      const { data: tr, error } = await db.from("session_transcripts").insert({
        session_id: s.id, recording_id: rec.id, source: `stt:${providerName()}`, language: t.language, text: t.text,
        segments: t.segments, confidence: quality.confidence ?? quality.score, quality, needs_review: quality.needs_review,
      }).select("id").single();
      if (error) throw error;
      await db.from("session_recordings").update({ status: "done" }).eq("id", rec.id);
      await db.from("sessions").update({ recording_status: "transcribed" }).eq("id", s.id);

      if (quality.flags.includes("empty_transcript")) { log(`session ${s.id}: empty transcript, skipping notes`); continue; }
      const notes = await draftNotes({ transcript: t.text, language: t.language, sessionDate: s.session_date, quality });
      await db.from("session_transcripts").update({ quality: { ...quality, notes_draft: notes } }).eq("id", tr.id);
      await upsertDraftNotes(s, notes, t.language, quality.confidence ?? quality.score, tr.id);
      await db.from("sessions").update({ recording_status: "notes_drafted", recording_last_error: null }).eq("id", s.id);
      log(`session ${s.id}: notes drafted (score ${quality.score}, review=${quality.needs_review})`);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }
}

async function purgeExpired() {
  const { data } = await db.from("session_recordings").select("id,storage_path").lt("retention_until", new Date().toISOString()).not("storage_path", "is", null).limit(50);
  for (const r of data || []) {
    await db.storage.from("session-recordings").remove([r.storage_path]);
    await db.from("session_recordings").update({ storage_path: null, status: "done" }).eq("id", r.id);
    log("purged expired recording", r.id);
  }
}

async function tick() {
  const { data: due } = await db.from("sessions").select("*")
    .in("recording_status", ["scheduled", "processing"])
    .or(`recording_next_attempt_at.is.null,recording_next_attempt_at.lte.${new Date().toISOString()}`).limit(10);
  for (const s of due || []) {
    // Meet artifacts appear a few minutes after the conference ends.
    if (s.video_provider === "google_meet" && Date.now() < sessionEnd(s).getTime() + 3 * 60_000) continue;
    try { await processSession(s); } catch (e) { await fail(s, e); }
  }
  await purgeExpired().catch((e) => log("purge error", e.message));
}

if (ONCE) { await tick(); process.exit(0); }
log("recording processor started, stt =", providerName());
for (;;) { await tick().catch((e) => log("tick error", e.message)); await new Promise((r) => setTimeout(r, 60_000)); }
