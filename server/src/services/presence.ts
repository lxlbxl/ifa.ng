import { sql } from "kysely";
import type { Caller } from "../db.js";
import { asService, HttpError, requireUser, type Services } from "./context.js";
import { pushConfigured, sendToUser } from "./push.js";

/**
 * Babalawo Online/Offline. Going Online needs notifications on for the device
 * doing it, so a client tapping Consult Now always reaches someone who will hear it.
 */

export interface Presence { status: "online" | "busy" | "offline"; available_now: boolean; last_seen_at: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPresence(svc: Services, babalawoId: string): Promise<Presence> {
  if (!UUID.test(babalawoId)) throw new HttpError(400, "Invalid Babalawo id");
  const row = (await asService(svc, (trx) => sql<Presence>`
    select status, available_now, last_seen_at from public.babalawo_presence(${babalawoId}::uuid)`.execute(trx))).rows[0];
  if (!row) throw new HttpError(404, "Babalawo not found");
  return row;
}

async function requireBabalawo(svc: Services, caller: Caller) {
  const user = requireUser(caller);
  const ok = (await asService(svc, (trx) => sql<{ ok: boolean }>`
    select exists (select 1 from public.babalawos where user_id = ${user.userId}::uuid)
       and public.has_role(${user.userId}::uuid, 'babalawo') ok`.execute(trx))).rows[0]?.ok;
  if (!ok) throw new HttpError(403, "Only Babalawos have an Online status");
  return user.userId;
}

async function hasLiveSubscription(svc: Services, userId: string, endpoint?: unknown) {
  if (typeof endpoint !== "string" || !endpoint) return false;
  const r = await asService(svc, (trx) => sql<{ ok: boolean }>`
    select exists (select 1 from public.push_subscriptions
                    where user_id = ${userId}::uuid and endpoint = ${endpoint} and failure_count < 3) ok`.execute(trx));
  return r.rows[0]?.ok === true;
}

/**
 * body: { status: 'online' | 'offline', endpoint?: push endpoint of this device, permission?: Notification.permission }
 * With VAPID keys set, Online needs this device's push subscription on file. Before the keys exist,
 * it needs the browser's notification permission (in-app alerts only).
 */
export async function setMyPresence(svc: Services, caller: Caller, body: Record<string, unknown>) {
  const userId = await requireBabalawo(svc, caller);
  const status = body.status;
  if (status !== "online" && status !== "offline") throw new HttpError(400, "status must be online or offline");
  const push = pushConfigured(svc.config);
  if (status === "online") {
    const ready = push ? await hasLiveSubscription(svc, userId, body.endpoint) : body.permission === "granted";
    if (!ready) {
      throw new HttpError(409, "Turn on notifications for this device before going Online", "notifications_required");
    }
  }
  await asService(svc, (trx) => sql`update public.babalawos
    set current_status = ${status}, status_changed_at = now(), last_seen_at = now()
    where user_id = ${userId}::uuid`.execute(trx));
  return ownState(svc, userId);
}

/** The Babalawo's own view: their switch position, and whether clients can see them yet. */
async function ownState(svc: Services, userId: string) {
  const r = await asService(svc, (trx) => sql<{ own_status: string; listed: boolean }>`
    select coalesce(current_status, 'offline') own_status, (is_verified and coalesce(is_active, true)) listed
      from public.babalawos where user_id = ${userId}::uuid`.execute(trx));
  return { ...(await getPresence(svc, userId)), ...r.rows[0], push_configured: pushConfigured(svc.config) };
}

/** The open app checks in every couple of minutes so stale Online can be switched off. */
export async function heartbeat(svc: Services, caller: Caller) {
  const userId = await requireBabalawo(svc, caller);
  await asService(svc, (trx) => sql`update public.babalawos set last_seen_at = now() where user_id = ${userId}::uuid`.execute(trx));
  return ownState(svc, userId);
}

/** After a device unsubscribes: with push on, a Babalawo nobody can reach is taken Offline. */
export async function offlineIfUnreachable(svc: Services, userId: string) {
  if (!pushConfigured(svc.config)) return false;
  const r = await asService(svc, (trx) => sql`
    update public.babalawos set current_status = 'offline', status_changed_at = now()
     where user_id = ${userId}::uuid and current_status = 'online'
       and not exists (select 1 from public.push_subscriptions where user_id = ${userId}::uuid and failure_count < 3)
    returning user_id`.execute(trx));
  return r.rows.length > 0;
}

/** Job: switch off stale Online and tell the Babalawo why. */
export async function expireStalePresence(svc: Services) {
  const ids = (await asService(svc, (trx) => sql<{ id: string }>`select id::text from public.expire_stale_presence() id`.execute(trx))).rows;
  for (const { id } of ids) {
    await asService(svc, (trx) => sql`select public.create_notification(${id}::uuid, 'presence_offline', 'You are now Offline',
      'We switched you Offline because your app has not checked in for a while. Open IFA.ng and switch Online when you are ready.',
      '{"action_url":"/dashboard"}'::jsonb, 'normal')`.execute(trx));
  }
  return { expired: ids.length };
}

export async function sendTestAlert(svc: Services, caller: Caller) {
  const user = requireUser(caller);
  if (!pushConfigured(svc.config)) throw new HttpError(409, "Push is not set up on the server yet", "push_not_configured");
  const r = await sendToUser(svc, user.userId, {
    title: "Test alert", body: "This is how a Consult Now request will sound and buzz.", url: "/dashboard",
    tag: "test-alert", type: "test", urgent: true,
  });
  if (!r.sent) throw new HttpError(409, "No device could be reached. Turn notifications on again.", "no_devices");
  return r;
}
