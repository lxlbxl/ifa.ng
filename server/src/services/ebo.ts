import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import type { Caller } from "../db.js";
import { asService, HttpError, isAdmin, requireUser, type Services } from "./context.js";
import { signFileLink } from "./storage.js";

/**
 * Proof that an Ebo was performed. Videos are stored as uploaded and marked
 * 'processing'; the recording worker compresses them (H.264 720p, AAC) for
 * storage and smooth playback in the app, then checks the audio for the
 * client's name and the items. Photos are extra and never replace the video.
 */

const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp",
  "video/x-matroska": "mkv", "video/x-m4v": "m4v",
};
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const EBO_VIDEO_MAX = 300 * 1024 * 1024;
const PHOTO_MAX = 10 * 1024 * 1024;
const MAX_PROOFS = 6;
const LINK_TTL = 30 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EboRow { id: string; babalawo_id: string; client_id: string; status: string }

async function loadEbo(svc: Services, id: unknown): Promise<EboRow> {
  if (typeof id !== "string" || !UUID.test(id)) throw new HttpError(400, "Invalid Ebo id");
  const e = (await asService(svc, (trx) => sql<EboRow>`
    select id::text, babalawo_id::text, client_id::text, status from public.ebo_prescriptions where id = ${id}::uuid`.execute(trx))).rows[0];
  if (!e) throw new HttpError(404, "Ebo not found");
  return e;
}

export async function uploadEboProof(svc: Services, caller: Caller, eboId: unknown, file: File | undefined) {
  const user = requireUser(caller);
  const e = await loadEbo(svc, eboId);
  if (e.babalawo_id !== user.userId) throw new HttpError(403, "Only the Babalawo can add proof");
  if (!["paid", "in_progress", "performed"].includes(e.status)) throw new HttpError(409, "Proof can be added once the Ebo is paid");
  if (!file || typeof file === "string") throw new HttpError(400, "Choose a video or photo");
  const type = file.type.split(";")[0].toLowerCase();
  const videoExt = VIDEO_TYPES[type];
  const photoExt = PHOTO_TYPES[type];
  if (!videoExt && !photoExt) throw new HttpError(415, "Use a video (mp4, mov, webm) or a photo (jpg, png, webp)");
  if (videoExt && file.size > EBO_VIDEO_MAX) throw new HttpError(413, "Videos must be 300 MB or smaller");
  if (photoExt && file.size > PHOTO_MAX) throw new HttpError(413, "Photos must be 10 MB or smaller");
  const count = (await asService(svc, (trx) => sql<{ n: number }>`
    select count(*)::int n from public.ebo_proofs where prescription_id = ${e.id}::uuid and status <> 'failed'`.execute(trx))).rows[0].n;
  if (count >= MAX_PROOFS) throw new HttpError(409, `An Ebo can have at most ${MAX_PROOFS} proof files`);

  const id = randomUUID();
  const path = `ebo-proofs/${e.id}/${id}${videoExt ? "-original" : ""}.${videoExt ?? photoExt}`;
  await svc.files.put(path, new Uint8Array(await file.arrayBuffer()), type);
  await asService(svc, async (trx) => {
    await sql`insert into public.ebo_proofs(id, prescription_id, kind, status, storage_path, content_type, size_bytes, original_size_bytes, uploaded_by)
      values (${id}::uuid, ${e.id}::uuid, ${videoExt ? "video" : "photo"}, ${videoExt ? "processing" : "ready"}, ${path}, ${type},
              ${file.size}, ${file.size}, ${user.userId}::uuid)`.execute(trx);
    await sql`insert into public.ebo_events(prescription_id, actor, event, data)
      values (${e.id}::uuid, ${user.userId}::uuid, 'proof_added', ${JSON.stringify({ kind: videoExt ? "video" : "photo", size: file.size })}::jsonb)`.execute(trx);
  });
  return { id, kind: videoExt ? "video" : "photo", status: videoExt ? "processing" : "ready" };
}

interface ProofRow {
  id: string; kind: string; status: string; storage_path: string; content_type: string; size_bytes: string;
  duration_seconds: number | null; check_result: unknown; created_at: string;
}

/** Proof files with 30 minute links. The Ebo's Babalawo, its client (once paid) and admins. */
export async function listEboProofs(svc: Services, caller: Caller, eboId: unknown) {
  const user = requireUser(caller);
  const e = await loadEbo(svc, eboId);
  const party = user.userId === e.babalawo_id || (user.userId === e.client_id && e.status !== "draft");
  if (!party && !(await isAdmin(svc, caller))) throw new HttpError(403, "Not your Ebo");
  const rows = (await asService(svc, (trx) => sql<ProofRow>`
    select id::text, kind, status, storage_path, content_type, size_bytes::text, duration_seconds, check_result, created_at::text
      from public.ebo_proofs where prescription_id = ${e.id}::uuid order by created_at`.execute(trx))).rows;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, status: r.status, content_type: r.content_type, size_bytes: Number(r.size_bytes),
    duration_seconds: r.duration_seconds, check: r.check_result, created_at: r.created_at,
    url: r.status === "ready" ? `${svc.config.API_URL}/files/signed/${signFileLink(svc.config.AUTH_SECRET, r.storage_path, LINK_TTL)}` : null,
  }));
}

/** Expire unpaid quotes and release money after the confirmation window. */
export async function eboTick(svc: Services) {
  return (await asService(svc, (trx) => sql<{ r: { expired: number; auto_completed: number } }>`select public.ebo_tick() r`.execute(trx))).rows[0].r;
}
