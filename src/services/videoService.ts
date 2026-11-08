import { supabase } from "@/integrations/supabase/client";

export type VideoProvider = "google_meet" | "agora";

export interface SessionConsentRow {
  party: "client" | "babalawo";
  recording_consent: boolean;
  ai_processing_consent: boolean;
  consented_at: string;
  withdrawn_at: string | null;
}

/** Records the caller's own consent decision. Declining (false/false) is a valid answer. */
export async function recordSessionConsent(sessionId: number | string, recording: boolean, ai: boolean) {
  const { data, error } = await supabase.rpc("record_session_consent" as never, {
    p_session_id: String(sessionId), p_recording: recording, p_ai: ai && recording,
  } as never);
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

export async function getSessionConsents(sessionId: number | string): Promise<SessionConsentRow[]> {
  const { data, error } = await (supabase.from("session_consents" as never) as any)
    .select("party, recording_consent, ai_processing_consent, consented_at, withdrawn_at")
    .eq("session_id", String(sessionId));
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionConsentRow[];
}

/**
 * Asks the server to create (or reconcile) the Google Meet link. Idempotent, and only
 * succeeds for paid sessions. Falls back to { provider: "agora" } when Meet is unavailable.
 */
export async function ensureMeetLink(sessionId: number | string): Promise<{ provider: VideoProvider; meet_uri?: string; reason?: string }> {
  const { data, error } = await supabase.functions.invoke("create-meet-link", { body: { session_id: String(sessionId) } });
  if (error) throw new Error(error.message || "Could not prepare the video room");
  return data;
}

export async function getMedia(sessionId: number | string, kind: "recording" | "transcript") {
  const { data, error } = await supabase.functions.invoke("session-media", { body: { session_id: String(sessionId), kind } });
  if (error) throw new Error(error.message);
  return data;
}

/** Babalawo fallback when Meet produced no recording: upload audio recorded on their phone. */
export async function uploadSessionAudio(sessionId: number | string, file: Blob) {
  const { data, error } = await supabase.functions.invoke("session-media", { body: { session_id: String(sessionId), kind: "upload-url" } });
  if (error) throw new Error(error.message);
  const up = await supabase.storage.from("session-recordings").uploadToSignedUrl(data.path, data.token, file);
  if (up.error) throw new Error(up.error.message);
}
