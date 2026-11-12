import { sql } from "kysely";
import { asService, type Services } from "./context.js";

/**
 * Data protection jobs (NDPA 2023 / GDPR storage limitation and erasure).
 *
 * - runRetention: applies the retention schedule in the database (public.run_retention), hourly.
 * - deleteQueuedFiles: removes stored files (recordings, photos, Ebo videos) that erasure, consent
 *   withdrawal or retention queued in private.storage_deletions. A file that keeps failing stays
 *   in the queue and shows up in Admin -> Privacy.
 */
export async function runRetention(svc: Services) {
  const r = await asService(svc, (trx) => sql<{ removed: Record<string, number> }>`select public.run_retention() removed`.execute(trx));
  const removed = r.rows[0]?.removed ?? {};
  const total = Object.values(removed).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total) console.log("retention removed", removed);
  return { removed: total };
}

export async function deleteQueuedFiles(svc: Services, limit = 50) {
  const due = await asService(svc, (trx) => sql<{ id: string; object_key: string; attempts: number }>`
    select id::text, object_key, attempts from private.storage_deletions
     where done_at is null and attempts < 10
       and (attempts = 0 or requested_at < now() - make_interval(mins => least(attempts * attempts * 5, 1440)))
     order by requested_at limit ${limit}`.execute(trx));
  let deleted = 0, failed = 0;
  for (const f of due.rows) {
    try {
      await svc.files.delete(f.object_key);
      await asService(svc, (trx) => sql`update private.storage_deletions set done_at = now(), last_error = null
        where id = ${f.id}::bigint`.execute(trx));
      deleted++;
    } catch (e) {
      failed++;
      await asService(svc, (trx) => sql`update private.storage_deletions set attempts = attempts + 1,
        last_error = ${String((e as Error)?.message ?? e).slice(0, 300)} where id = ${f.id}::bigint`.execute(trx));
    }
  }
  return { sent: deleted, failed };
}
