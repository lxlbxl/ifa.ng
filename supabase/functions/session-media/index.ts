// Access-controlled media/transcript delivery.
//   {session_id, kind: "recording"}   -> 10 min signed URL (audio copy), Babalawo/admin only
//   {session_id, kind: "transcript"}  -> transcript text; client only after notes are approved
//   {session_id, kind: "upload-url"}  -> signed upload URL for the manual audio fallback (Babalawo)
import { handler, json, HttpError } from "../_shared/http.ts";
import { authenticate, loadSessionFor, serviceClient } from "../_shared/auth.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  const caller = await authenticate(req, db);
  const { session_id, kind } = await req.json().catch(() => ({}));
  const s = await loadSessionFor(db, caller, Number(session_id), { allowAdmin: true });
  const isBabalawo = caller.kind === "service" || (caller.kind === "user" && caller.userId === s.babalawo_id);
  const isAdmin = caller.kind === "service" || (caller.kind === "user" && caller.isAdmin);

  if (kind === "recording") {
    if (!isBabalawo && !isAdmin) throw new HttpError(403, "Recordings are restricted to the Babalawo and administrators");
    const { data: rec } = await db.from("session_recordings").select("storage_path")
      .eq("session_id", s.id).not("storage_path", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!rec?.storage_path) throw new HttpError(404, "No recording available");
    const { data, error } = await db.storage.from("session-recordings").createSignedUrl(rec.storage_path, 600);
    if (error) throw new HttpError(500, "Could not sign URL");
    await db.from("admin_audit_log").insert({ action: "recording_access", target: String(s.id), actor: caller.kind === "user" ? caller.userId : "service" });
    return json({ url: data.signedUrl, expires_in: 600 });
  }

  if (kind === "transcript") {
    if (!isBabalawo && !isAdmin) {
      // Client: only once the Babalawo has approved the notes (table owned by the notes feature).
      const { data: notes } = await db.from("consultation_notes").select("status").eq("session_id", s.id).maybeSingle();
      if (!notes || !["approved", "shared"].includes(notes.status)) throw new HttpError(403, "Transcript is available after your Babalawo approves the notes");
    }
    const { data: t } = await db.from("session_transcripts").select("id, language, text, segments, confidence, quality, needs_review, created_at")
      .eq("session_id", s.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!t) throw new HttpError(404, "No transcript");
    // Quality internals are for the Babalawo/admin only.
    if (!isBabalawo && !isAdmin) { delete (t as any).quality; delete (t as any).confidence; delete (t as any).needs_review; }
    return json(t);
  }

  if (kind === "upload-url") {
    if (!isBabalawo) throw new HttpError(403, "Only the Babalawo can upload session audio");
    const { data: consent } = await db.rpc("session_has_full_consent", { p_session_id: s.id });
    if (!consent) throw new HttpError(403, "Both parties must consent to recording before audio can be uploaded");
    const path = `${s.id}/upload-${Date.now()}.webm`;
    const { data, error } = await db.storage.from("session-recordings").createSignedUploadUrl(path);
    if (error) throw new HttpError(500, "Could not create upload URL");
    await db.from("session_recordings").insert({ session_id: s.id, source: "upload", storage_path: path, status: "ready", recording_resource: path });
    await db.from("sessions").update({ recording_status: "scheduled", recording_next_attempt_at: new Date().toISOString() }).eq("id", s.id);
    return json({ ...data, path });
  }
  throw new HttpError(400, "Unknown kind");
}));
