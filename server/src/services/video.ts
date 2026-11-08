import { sql } from "kysely";
import agora from "agora-token";
import type { Caller } from "../db.js";
import { asService, HttpError, isAdmin, loadSessionFor, requireUser, sessionWindow, type Services } from "./context.js";

const { RtcTokenBuilder, RtcRole } = agora;

/**
 * Agora fallback token. Only a participant of a PAID session gets one, only
 * near the session window, and the token is bound to the caller's user id, so
 * a leaked token cannot be used to pose as someone else.
 */
export async function agoraToken(svc: Services, caller: Caller, sessionId: unknown, now = Date.now()) {
  const user = requireUser(caller);
  const s = await loadSessionFor(svc, user, sessionId);
  if (s.payment_status !== "paid") throw new HttpError(402, "Session is not paid");
  if (["cancelled", "completed"].includes(s.status)) throw new HttpError(409, `Session is ${s.status}`);
  const { start, end } = sessionWindow(s);
  if (now < start.getTime() - 15 * 60_000) throw new HttpError(425, "Too early to join");
  if (now > end.getTime() + 60 * 60_000) throw new HttpError(410, "Session window has passed");

  const { AGORA_APP_ID: appId, AGORA_APP_CERTIFICATE: cert } = svc.config;
  if (!appId || !cert) throw new HttpError(503, "Agora is not configured");

  const channel = s.agora_channel_name || `session-${s.id}`;
  if (!s.agora_channel_name) {
    await asService(svc, (trx) => sql`update public.sessions set agora_channel_name = ${channel}
      where id = ${s.id}::bigint and agora_channel_name is null`.execute(trx));
  }
  // Valid until 30 minutes after the booked end.
  const expireTs = Math.floor((end.getTime() + 30 * 60_000) / 1000);
  const token = RtcTokenBuilder.buildTokenWithUserAccount(appId, cert, channel, user.userId, RtcRole.PUBLISHER, expireTs, expireTs);
  return { token, appId, channel, account: user.userId };
}

/**
 * Transcript of a session. The Babalawo and admins always; the client only
 * once the Babalawo has approved the notes, and without quality internals.
 * (Recording playback and the manual audio upload move with file storage, phase 5.)
 */
export async function sessionTranscript(svc: Services, caller: Caller, sessionId: unknown) {
  const s = await loadSessionFor(svc, caller, sessionId, { allowAdmin: true });
  const privileged = caller.kind === "service" || (caller.kind === "user" && caller.userId === s.babalawo_id) || (await isAdmin(svc, caller));
  return asService(svc, async (trx) => {
    if (!privileged) {
      const notes = (await sql<{ status: string }>`select status from public.consultation_notes
        where session_id = ${s.id}::bigint`.execute(trx)).rows[0];
      if (!notes || !["approved", "shared"].includes(notes.status)) {
        throw new HttpError(403, "The transcript is available after your Babalawo approves the notes");
      }
    }
    const t = (await sql<Record<string, unknown>>`select id, language, text, segments, confidence, quality, needs_review, created_at
      from public.session_transcripts where session_id = ${s.id}::bigint order by created_at desc limit 1`.execute(trx)).rows[0];
    if (!t) throw new HttpError(404, "No transcript");
    if (!privileged) { delete t.quality; delete t.confidence; delete t.needs_review; }
    return t;
  });
}
