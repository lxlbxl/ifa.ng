import { sql } from "kysely";
import { asService, type Services } from "./context.js";
import { notificationTick } from "./notify.js";
import { expireStalePresence } from "./presence.js";
import { pushPending } from "./push.js";

/**
 * Scheduled work that pg_cron / Supabase schedules used to run. One API
 * container runs these in-process; each job is safe to run twice.
 */
export const JOBS: { name: string; everySeconds: number; run: (svc: Services) => Promise<unknown> }[] = [
  { name: "notifications", everySeconds: 60, run: notificationTick },
  { name: "push missed notifications", everySeconds: 30, run: pushPending },
  { name: "switch off stale Online", everySeconds: 60, run: expireStalePresence },
  { name: "release expired slot holds", everySeconds: 60,
    run: (svc) => asService(svc, (trx) => sql`select public.cleanup_expired_slot_locks()`.execute(trx)) },
  { name: "complete finished sessions", everySeconds: 300,
    run: (svc) => asService(svc, (trx) => sql`select public.auto_complete_sessions()`.execute(trx)) },
];

export function startJobs(svc: Services) {
  const timers = JOBS.map((job) => {
    let running = false;
    return setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const r = (await job.run(svc)) as { sent?: number; queued?: number; failed?: number } | undefined;
        if (r?.sent || r?.queued || r?.failed) console.log(`job ${job.name}`, r);
      } catch (e) {
        console.error(`job ${job.name} failed`, e);
      } finally {
        running = false;
      }
    }, job.everySeconds * 1000);
  });
  return () => timers.forEach(clearInterval);
}
