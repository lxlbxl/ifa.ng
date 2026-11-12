import { sql } from "kysely";
import { asService, type Services } from "./context.js";
import { notificationTick } from "./notify.js";
import { expireStalePresence } from "./presence.js";
import { pushPending } from "./push.js";
import { eboTick } from "./ebo.js";
import { reportError } from "./errors.js";

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
  { name: "Ebo: expire quotes and release after proof", everySeconds: 300, run: eboTick },
  { name: "refund unaccepted Consult Now requests", everySeconds: 30,
    run: (svc) => asService(svc, (trx) => sql`select public.expire_unaccepted_instant_sessions()`.execute(trx)) },
  { name: "complete finished sessions, refund Babalawo no-shows", everySeconds: 300,
    run: (svc) => asService(svc, (trx) => sql`select public.auto_complete_sessions()`.execute(trx)) },
  { name: "release earnings after the hold", everySeconds: 300,
    run: (svc) => asService(svc, (trx) => sql`select public.release_held_earnings()`.execute(trx)) },
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
        reportError(e, { job: job.name });
      } finally {
        running = false;
      }
    }, job.everySeconds * 1000);
  });
  return () => timers.forEach(clearInterval);
}
