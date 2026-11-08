import webpush from "web-push";
import { sql } from "kysely";
import { z } from "zod";
import type { Config } from "../config.js";
import { asService, HttpError, type Services } from "./context.js";

/**
 * Web push (VAPID). Encryption comes from the web-push library; the HTTP call goes
 * through svc.fetch so tests can stand in for the browser push services.
 */

export const pushConfigured = (c: Config) => Boolean(c.VAPID_PUBLIC_KEY && c.VAPID_PRIVATE_KEY);

/** Browser push services only. Anything else would let a caller make the API fetch arbitrary URLs. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/,
];
export function isPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

export const SubscriptionInput = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "Not a browser push endpoint"),
  keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
});

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  type?: string;
  /** Urgent alerts ring longer, vibrate harder and stay on screen until tapped. */
  urgent?: boolean;
  id?: string;
}

interface SubRow { id: string; endpoint: string; p256dh: string; auth: string }

export async function sendToUser(svc: Services, userId: string, payload: PushPayload) {
  const out = { sent: 0, failed: 0, removed: 0 };
  if (!pushConfigured(svc.config)) return out;
  const subs = (await asService(svc, (trx) => sql<SubRow>`
    select id::text, endpoint, p256dh, auth from public.push_subscriptions where user_id = ${userId}::uuid`.execute(trx))).rows;
  for (const s of subs) {
    if (!isPushEndpoint(s.endpoint)) continue;
    let status = 0;
    try {
      const req = webpush.generateRequestDetails(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        {
          vapidDetails: { subject: svc.config.VAPID_SUBJECT, publicKey: svc.config.VAPID_PUBLIC_KEY!, privateKey: svc.config.VAPID_PRIVATE_KEY! },
          TTL: payload.urgent ? 300 : 6 * 3600,
          urgency: payload.urgent ? "high" : "normal",
          ...(payload.tag ? { topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined } : {}),
        },
      );
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (k.toLowerCase() !== "content-length") headers[k] = String(v);
      const res = await svc.fetch(req.endpoint, { method: req.method, headers, body: req.body ? new Uint8Array(req.body) : undefined });
      status = res.status;
    } catch (e) {
      console.warn("push send failed", (e as Error).message);
    }
    if (status === 404 || status === 410) {
      // The browser dropped this subscription; it will never work again.
      await asService(svc, (trx) => sql`delete from public.push_subscriptions where id = ${s.id}::uuid`.execute(trx));
      out.removed++;
    } else if (status >= 200 && status < 300) {
      await asService(svc, (trx) => sql`update public.push_subscriptions
        set last_success_at = now(), failure_count = 0 where id = ${s.id}::uuid`.execute(trx));
      out.sent++;
    } else {
      await asService(svc, (trx) => sql`update public.push_subscriptions
        set failure_count = failure_count + 1 where id = ${s.id}::uuid`.execute(trx));
      out.failed++;
    }
  }
  return out;
}

interface NotificationRow {
  id: string; user_id: string; type: string; title: string; message: string;
  action_url: string | null; priority: string | null; data: Record<string, unknown> | null;
}

/** What a stored notification looks like on the lock screen. */
export function payloadFor(n: NotificationRow): PushPayload {
  const sessionId = n.data && typeof n.data.session_id !== "undefined" ? String(n.data.session_id) : null;
  const url = n.action_url && n.action_url.startsWith("/") ? n.action_url
    : sessionId ? "/dashboard?tab=consultations" : "/dashboard?tab=notifications";
  const base = { url, type: n.type, id: n.id, tag: sessionId ? `session-${sessionId}` : `n-${n.id}` };
  switch (n.type) {
    case "instant_session_request":
      return { ...base, urgent: true, title: "Consult Now: a client is waiting", body: "A client has paid for a consultation right now. Tap to join." };
    case "session_booked":
      return { ...base, urgent: false, title: "New booking", body: n.message || "A client has booked a consultation." };
    default:
      return { ...base, urgent: n.priority === "urgent", title: n.title, body: n.message };
  }
}

/** Pushes one notification row, once. Safe to call from several places at the same time. */
export async function pushNotification(svc: Services, id: string) {
  if (!pushConfigured(svc.config)) return null;
  const row = (await asService(svc, (trx) => sql<NotificationRow>`
    update public.notifications set pushed_at = now() where id = ${id}::uuid and pushed_at is null
    returning id::text, user_id::text, type, title, message, action_url, priority, data`.execute(trx))).rows[0];
  if (!row) return null;
  return sendToUser(svc, row.user_id, payloadFor(row));
}

/** Catches notifications the live listener missed (API restart, dropped connection). */
export async function pushPending(svc: Services) {
  if (!pushConfigured(svc.config)) return { pushed: 0 };
  const ids = (await asService(svc, (trx) => sql<{ id: string }>`
    select id::text from public.notifications
     where pushed_at is null and created_at > now() - interval '10 minutes' and created_at < now() - interval '5 seconds'
     order by created_at limit 50`.execute(trx))).rows;
  let pushed = 0;
  for (const { id } of ids) if (await pushNotification(svc, id)) pushed++;
  return { pushed };
}

export async function saveSubscription(svc: Services, userId: string, input: unknown, userAgent: string | null) {
  const parsed = SubscriptionInput.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Invalid push subscription");
  const { endpoint, keys } = parsed.data;
  await asService(svc, (trx) => sql`
    insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
    values (${userId}::uuid, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${userAgent?.slice(0, 300) ?? null})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
      user_agent = excluded.user_agent, failure_count = 0, updated_at = now()`.execute(trx));
  return { ok: true };
}
