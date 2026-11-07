// Creates (or reconciles) the Google Meet space for a PAID session.
//  - refuses unless sessions.payment_status = 'paid'
//  - idempotent: returns the existing link if there is one
//  - auto-recording is armed only when BOTH parties consented; otherwise OFF
//  - the Babalawo is added as COHOST (so they can start recording manually as a fallback)
//  - if Google is unavailable/unconfigured, the session falls back to Agora
import { handler, json, HttpError } from "../_shared/http.ts";
import { authenticate, loadSessionFor, serviceClient } from "../_shared/auth.ts";
import { meetApi, spaceConfig, SCOPES, RecordingMode } from "../_shared/google.ts";
import { dispatchDue } from "../_shared/notify.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  const caller = await authenticate(req, db);
  const { session_id } = await req.json().catch(() => ({}));
  const s = await loadSessionFor(db, caller, Number(session_id), { allowAdmin: true });

  if (s.payment_status !== "paid") throw new HttpError(409, "Session is not paid");
  if (["cancelled", "completed"].includes(s.status)) throw new HttpError(409, `Session is ${s.status}`);

  const { data: full } = await db.rpc("session_has_full_consent", { p_session_id: s.id });
  const recording: RecordingMode = full ? "ON" : "OFF";
  const recStatus = full ? "scheduled" : "none";

  // 1) Existing space: reconcile recording config with the latest consent.
  if (s.video_provider === "google_meet" && s.meet_space_name) {
    const patch = await meetApi("PATCH",
      `${s.meet_space_name}?updateMask=config.artifactConfig.recordingConfig.autoRecordingGeneration`,
      [SCOPES.meetCreate, SCOPES.meetSettings],
      { config: { artifactConfig: { recordingConfig: { autoRecordingGeneration: recording } } } });
    if (!patch.ok) console.error("meet patch failed", patch.status, patch.data);
    if (!["processing", "transcribed", "notes_drafted", "failed", "unavailable"].includes(s.recording_status)) {
      await db.from("sessions").update({ recording_status: recStatus }).eq("id", s.id);
    }
    return json({ provider: "google_meet", meet_uri: s.meet_uri, recording, reconciled: patch.ok });
  }
  if (s.video_provider === "agora" && s.agora_channel_name && !s.meet_space_name) {
    // Already on the fallback: keep it unless an admin re-enabled Meet.
    return json({ provider: "agora", reason: "already_fallback" });
  }

  // 2) Create the space.
  let warning: string | null = null;
  try {
    const created = await meetApi("POST", "spaces", [SCOPES.meetCreate], { config: spaceConfig(recording) });
    if (!created.ok) throw new HttpError(502, `Meet create failed (${created.status}): ${created.data?.error?.message ?? ""}`);
    const space = created.data as { name: string; meetingUri: string; meetingCode: string };

    // 3) Babalawo as co-host (needs a Google-account email).
    const { data: bab } = await db.from("babalawos").select("google_email").eq("user_id", s.babalawo_id).maybeSingle();
    const { data: prof } = await db.from("profiles").select("email").eq("id", s.babalawo_id).maybeSingle();
    const email = bab?.google_email || prof?.email;
    if (email) {
      const m = await meetApi("POST", `${space.name}/members`, [SCOPES.meetCreate], { email, role: "COHOST" });
      if (!m.ok) { warning = `cohost_not_added: ${m.data?.error?.message ?? m.status}`; console.error(warning); }
    } else warning = "cohost_not_added: no email";

    const { data: updated } = await db.from("sessions").update({
      video_provider: "google_meet", meet_uri: space.meetingUri, meet_code: space.meetingCode,
      meet_space_name: space.name, meet_created_at: new Date().toISOString(),
      recording_status: recStatus, video_fallback_reason: null,
    }).eq("id", s.id).is("meet_space_name", null).select("id").maybeSingle();
    if (!updated) {
      const { data: again } = await db.from("sessions").select("meet_uri").eq("id", s.id).single();
      return json({ provider: "google_meet", meet_uri: again?.meet_uri, recording });
    }
    await db.from("notification_outbox").insert({ session_id: s.id, kind: "meet_link" }).select().maybeSingle();
    dispatchDue(db, 5).catch((e) => console.error("dispatch", e));
    return json({ provider: "google_meet", meet_uri: space.meetingUri, recording, warning });
  } catch (e) {
    // 4) Fallback to Agora so the session can still happen.
    const reason = e instanceof Error ? e.message.slice(0, 300) : String(e);
    console.error("meet unavailable, falling back to agora:", reason);
    await db.from("sessions").update({
      video_provider: "agora", video_fallback_reason: reason,
      agora_channel_name: s.agora_channel_name ?? `session-${s.id}`, recording_status: "unavailable",
    }).eq("id", s.id);
    await db.from("notification_outbox").insert({ session_id: s.id, kind: "fallback_video" }).select().maybeSingle();
    dispatchDue(db, 5).catch(() => {});
    return json({ provider: "agora", reason });
  }
}));
