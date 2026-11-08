// Drains the notification outbox and queues reminders. Call every minute with the
// service-role key (pg_cron + pg_net, or Supabase scheduled function). See docs/GOOGLE_MEET.md.
import { handler, json, HttpError } from "../_shared/http.ts";
import { authenticate, serviceClient } from "../_shared/auth.ts";
import { dispatchDue, enqueueReminders } from "../_shared/notify.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  const caller = await authenticate(req, db);
  if (caller.kind !== "service" && !(caller.kind === "user" && caller.isAdmin)) throw new HttpError(403, "Forbidden");
  const queued = await enqueueReminders(db);
  const result = await dispatchDue(db);
  return json({ queued, ...result });
}));
