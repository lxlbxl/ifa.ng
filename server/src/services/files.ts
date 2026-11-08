import { sql } from "kysely";
import type { Caller } from "../db.js";
import { asService, HttpError, isAdmin, loadSessionFor, requireUser, type Services } from "./context.js";
import { signFileLink, verifyFileLink } from "./storage.js";

const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const AVATAR_MAX = 5 * 1024 * 1024;
const AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/aac", "video/webm"]);
export const AUDIO_MAX = 200 * 1024 * 1024;
const LINK_TTL = 10 * 60;

/** Checks the first bytes so a renamed file can't pose as an image. */
function looksLikeImage(b: Uint8Array, ext: string) {
  if (ext === "png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (ext === "jpg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === "webp") return Buffer.from(b.subarray(0, 4)).toString() === "RIFF" && Buffer.from(b.subarray(8, 12)).toString() === "WEBP";
  return false;
}

/** Saves the caller's profile photo and returns its public URL. Only ever your own. */
export async function uploadAvatar(svc: Services, caller: Caller, file: File | undefined) {
  const user = requireUser(caller);
  if (!file || typeof file === "string") throw new HttpError(400, "Choose an image to upload");
  const ext = AVATAR_TYPES[file.type];
  if (!ext) throw new HttpError(415, "Use a PNG, JPEG or WebP image");
  if (file.size > AVATAR_MAX) throw new HttpError(413, "Images must be 5 MB or smaller");
  const body = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeImage(body, ext)) throw new HttpError(415, "That file is not a valid image");

  for (const other of Object.values(AVATAR_TYPES)) {
    if (other !== ext) await svc.files.delete(`avatars/${user.userId}.${other}`);
  }
  await svc.files.put(`avatars/${user.userId}.${ext}`, body, file.type);
  const url = `${svc.config.API_URL}/files/avatars/${user.userId}.${ext}?v=${Date.now()}`;
  await asService(svc, async (trx) => {
    await sql`update public.profiles set avatar_url = ${url} where id = ${user.userId}::uuid`.execute(trx);
    await sql`update public.babalawos set profile_picture_url = ${url} where user_id = ${user.userId}::uuid`.execute(trx);
  });
  return { url };
}

/** Public avatars, served by the API so the bucket itself stays private. */
export async function readAvatar(svc: Services, name: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp)$/i.test(name)) return null;
  return svc.files.get(`avatars/${name}`);
}

/** A 10 minute link to the session's audio copy. Babalawo and admins only. */
export async function recordingLink(svc: Services, caller: Caller, sessionId: unknown) {
  const s = await loadSessionFor(svc, caller, sessionId, { allowAdmin: true });
  const babalawo = caller.kind === "user" && caller.userId === s.babalawo_id;
  if (!babalawo && !(await isAdmin(svc, caller))) throw new HttpError(403, "Recordings are restricted to the Babalawo and administrators");
  const rec = (await asService(svc, (trx) => sql<{ storage_path: string }>`
    select storage_path from public.session_recordings where session_id = ${s.id}::bigint and storage_path is not null
     order by created_at desc limit 1`.execute(trx))).rows[0];
  if (!rec) throw new HttpError(404, "No recording available");
  await asService(svc, (trx) => sql`insert into public.admin_audit_log(admin_id, action, target_type, target_id, details)
    values (${caller.kind === "user" ? caller.userId : null}::uuid, 'recording_access', 'session', ${s.id}, '{}'::jsonb)`.execute(trx));
  const token = signFileLink(svc.config.AUTH_SECRET, `session-recordings/${rec.storage_path}`, LINK_TTL);
  return { url: `${svc.config.API_URL}/files/signed/${token}`, expires_in: LINK_TTL };
}

export async function readSignedFile(svc: Services, token: string) {
  const key = verifyFileLink(svc.config.AUTH_SECRET, token);
  return key ? svc.files.get(key) : null;
}

/** The Babalawo's fallback when Meet produced no recording: audio recorded on their phone. */
export async function uploadSessionAudio(svc: Services, caller: Caller, sessionId: unknown, file: File | undefined) {
  const user = requireUser(caller);
  const s = await loadSessionFor(svc, user, sessionId);
  if (user.userId !== s.babalawo_id) throw new HttpError(403, "Only the Babalawo can upload session audio");
  if (!file || typeof file === "string") throw new HttpError(400, "Choose an audio file to upload");
  const type = file.type.split(";")[0];
  if (!AUDIO_TYPES.has(type)) throw new HttpError(415, "Use an audio file (webm, ogg, mp3, m4a, wav)");
  if (file.size > AUDIO_MAX) throw new HttpError(413, "Audio must be 200 MB or smaller");
  const consent = (await asService(svc, (trx) =>
    sql<{ ok: boolean }>`select public.session_has_full_consent(${s.id}::bigint) ok`.execute(trx))).rows[0].ok;
  if (!consent) throw new HttpError(403, "Both people must agree to recording before audio can be uploaded");

  const ext = type.split("/")[1].replace("x-", "").replace("mpeg", "mp3");
  const storagePath = `${s.id}/upload-${Date.now()}.${ext}`;
  await svc.files.put(`session-recordings/${storagePath}`, new Uint8Array(await file.arrayBuffer()), type);
  await asService(svc, async (trx) => {
    await sql`insert into public.session_recordings(session_id, source, storage_path, status, recording_resource)
      values (${s.id}::bigint, 'upload', ${storagePath}, 'ready', ${storagePath})`.execute(trx);
    await sql`update public.sessions set recording_status = 'scheduled', recording_next_attempt_at = now()
      where id = ${s.id}::bigint`.execute(trx);
  });
  return { path: storagePath };
}
