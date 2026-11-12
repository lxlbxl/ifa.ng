import { sql } from "kysely";
import { asService, sessionWindow, type Services, type SessionRow } from "./context.js";

/**
 * WhatsApp (Meta Cloud API templates) with SMS (Termii) fallback.
 * Queue-driven: rows in notification_outbox are sent with retries, once each.
 */

export type Kind = "meet_link" | "reminder_24h" | "reminder_1h" | "rescheduled" | "completed" | "notes_ready" | "fallback_video"
  | "ebo_sent" | "ebo_paid" | "ebo_performed";

/** Who gets each message. Session messages go to both people unless listed here. */
const ONLY: Partial<Record<Kind, "client" | "babalawo">> = {
  notes_ready: "client", ebo_sent: "client", ebo_performed: "client", ebo_paid: "babalawo",
};
const isEbo = (k: Kind) => k === "ebo_sent" || k === "ebo_paid" || k === "ebo_performed";
const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

const MAX_ATTEMPTS = 5;

export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  else if (p.startsWith("00")) p = p.slice(2);
  else if (p.startsWith("0")) p = "234" + p.slice(1);
  else if (p.length === 10) p = "234" + p;
  return /^\d{11,15}$/.test(p) ? p : null;
}

export async function setting(svc: Services, key: string): Promise<string | null> {
  const r = await asService(svc, (trx) =>
    sql<{ v: string }>`select setting_value v from public.admin_settings where setting_key = ${key}`.execute(trx));
  return r.rows[0]?.v ?? null;
}

async function sendSms(svc: Services, to: string, text: string) {
  const key = svc.config.TERMII_API_KEY;
  if (!key) throw new Error("Termii API key not configured");
  const res = await svc.fetch(`${svc.config.TERMII_BASE_URL.replace(/\/$/, "")}/api/sms/send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, from: svc.config.TERMII_SENDER_ID, sms: text, type: "plain",
      // "dnd" (transactional) reaches Nigerian numbers on the Do-Not-Disturb list; "generic" does not.
      channel: "dnd", api_key: key }),
  });
  const body = (await res.json().catch(() => ({}))) as { message_id?: string; code?: string };
  if (!res.ok || !(body.message_id || body.code === "ok")) throw new Error(`Termii: ${JSON.stringify(body)}`);
}

async function sendWhatsApp(svc: Services, kind: Kind, to: string, params: string[]) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: phoneId } = svc.config;
  if (!token || !phoneId) throw new Error("WhatsApp not configured");
  const res = await svc.fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: `ifa_${kind}`, language: { code: "en" },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp: ${await res.text()}`);
}

function when(s: SessionRow, tz: string | null): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: tz || s.user_timezone || "Africa/Lagos", weekday: "short", day: "numeric",
    month: "short", hour: "numeric", minute: "2-digit",
  }).format(sessionWindow(s).start);
}

export function smsText(kind: Kind, name: string, other: string, at: string, link: string): string {
  switch (kind) {
    case "meet_link": return `IFA.ng: Hi ${name}, your consultation with ${other} is confirmed for ${at}. Join: ${link}`;
    case "reminder_24h": return `IFA.ng: Reminder, ${name}: consultation with ${other} tomorrow, ${at}. Join: ${link}`;
    case "reminder_1h": return `IFA.ng: ${name}, your consultation with ${other} starts in about 1 hour (${at}). Join: ${link}`;
    case "rescheduled": return `IFA.ng: ${name}, your consultation with ${other} is now ${at}. Join: ${link}`;
    case "completed": return `IFA.ng: ${name}, your consultation with ${other} has ended. Notes will appear in your dashboard once approved: ${link}`;
    case "notes_ready": return `IFA.ng: ${name}, your consultation notes from ${other} are ready: ${link}`;
    case "fallback_video": return `IFA.ng: ${name}, please join your consultation with ${other} (${at}) using this link: ${link}`;
    // For Ebo messages, "at" carries the Ebo's title (and amount).
    case "ebo_sent": return `IFA.ng: ${name}, ${other} has prescribed an Ebo: ${at}. See the items and ritual time, then pay or reply: ${link}`;
    case "ebo_paid": return `IFA.ng: ${name}, ${other} has paid for the Ebo: ${at}. Details: ${link}`;
    case "ebo_performed": return `IFA.ng: ${name}, ${other} has performed your Ebo: ${at}. Watch the proof and confirm: ${link}`;
  }
}

interface Person { id: string; full_name: string | null; phone: string | null; whatsapp_opt_in: boolean; sms_opt_in: boolean; timezone: string | null }

async function deliver(svc: Services, kind: Kind, s: SessionRow, me: Person, other: Person, link: string, waEnabled: boolean, atText?: string) {
  const to = toE164(me.phone);
  if (!to) return { channel: "none", skipped: "no phone number" };
  const name = me.full_name?.split(" ")[0] || "there";
  const otherName = other.full_name || "your Babalawo";
  const at = atText ?? when(s, me.timezone);
  let waError: string | null = null;
  if (me.whatsapp_opt_in && waEnabled && svc.config.WHATSAPP_ACCESS_TOKEN) {
    try { await sendWhatsApp(svc, kind, to, [name, otherName, at, link]); return { channel: "whatsapp" }; }
    catch (e) { waError = String(e); }
  }
  if (me.sms_opt_in) {
    await sendSms(svc, to, smsText(kind, name, otherName, at, link));
    return { channel: "sms", whatsapp_error: waError };
  }
  return { channel: "none", skipped: "opted out" };
}

interface OutboxRow { id: string; session_id: string; kind: Kind; attempts: number; ebo_id: string | null }

export async function dispatchDue(svc: Services, limit = 25) {
  const rows = (await asService(svc, (trx) => sql<OutboxRow>`
    select id, session_id::text, kind, attempts, ebo_id::text from public.notification_outbox
     where status = 'pending' and next_attempt_at <= now() order by next_attempt_at limit ${limit}`.execute(trx))).rows;
  const appUrl = svc.config.APP_URL.replace(/\/$/, "");
  const waEnabled = rows.length ? (await setting(svc, "whatsapp_notifications_enabled")) !== "false" : false;
  let sent = 0, failed = 0;
  for (const row of rows) {
    // Claim the row so a concurrent run doesn't send it twice.
    const claimed = await asService(svc, (trx) => sql`
      update public.notification_outbox set attempts = attempts + 1, next_attempt_at = now() + interval '5 minutes'
       where id = ${row.id}::uuid and attempts = ${row.attempts} and status = 'pending' returning id`.execute(trx));
    if (!claimed.rows.length) continue;
    try {
      const s = (await asService(svc, (trx) => sql<SessionRow>`
        select id::text, user_id, babalawo_id, session_date::text, to_char(start_time, 'HH24:MI') start_time,
               to_char(end_time, 'HH24:MI') end_time, status::text, payment_status, user_timezone, starts_at, ends_at, video_provider,
               meet_uri, meet_code, meet_space_name, recording_status, agora_channel_name
          from public.sessions where id = ${row.session_id}::bigint`.execute(trx))).rows[0];
      const ebo = row.ebo_id ? (await asService(svc, (trx) => sql<{ title: string; total: string; amount_due: string; status: string; performed_by: string }>`
        select title, total::text, amount_due::text, status, performed_by from public.ebo_prescriptions where id = ${row.ebo_id}::uuid`.execute(trx))).rows[0] : null;
      const eboGone = isEbo(row.kind) && (!ebo || ["cancelled", "declined", "expired", "refunded"].includes(ebo.status));
      if (!s || eboGone || (s.status === "cancelled" && row.kind !== "rescheduled" && !isEbo(row.kind))) {
        await asService(svc, (trx) => sql`update public.notification_outbox set status = 'skipped' where id = ${row.id}::uuid`.execute(trx));
        continue;
      }
      const people = (await asService(svc, (trx) => sql<Person>`
        select p.id, p.full_name, p.phone, p.whatsapp_opt_in, p.sms_opt_in,
               coalesce(nullif(ss.timezone, ''), nullif(p.timezone, ''), b.timezone) timezone
          from public.profiles p left join public.babalawos b on b.user_id = p.id
          left join public.babalawo_scheduling_settings ss on ss.babalawo_id = p.id
         where p.id in (${s.user_id}::uuid, ${s.babalawo_id}::uuid)`.execute(trx))).rows;
      const client = people.find((p) => p.id === s.user_id);
      const bab = people.find((p) => p.id === s.babalawo_id);
      if (!client || !bab) throw new Error("profiles missing");
      client.timezone = s.user_timezone || client.timezone;
      // Always the app's session page: it records who joined (no-show refunds depend on it),
      // asks for recording consent, and then opens Meet (or the backup video).
      const joinLink = `${appUrl}/session/${s.id}`;
      const link = isEbo(row.kind) ? `${appUrl}/dashboard${row.kind === "ebo_paid" ? "" : "?tab=records"}`
        : row.kind === "completed" || row.kind === "notes_ready" ? `${appUrl}/dashboard` : joinLink;
      const atText = ebo
        ? (ebo.performed_by === "babalawo" && row.kind !== "ebo_performed" ? `${ebo.title} (${naira(Number(row.kind === "ebo_paid" ? ebo.total : ebo.amount_due))})` : ebo.title)
        : undefined;
      const result: Record<string, unknown> = {};
      const only = ONLY[row.kind];
      if (only !== "babalawo") result.client = await deliver(svc, row.kind, s, client, bab, link, waEnabled, atText);
      if (only !== "client") result.babalawo = await deliver(svc, row.kind, s, bab, client, link, waEnabled, atText);
      await asService(svc, (trx) => sql`update public.notification_outbox
        set status = 'sent', sent_at = now(), result = ${JSON.stringify(result)}::jsonb where id = ${row.id}::uuid`.execute(trx));
      sent++;
    } catch (e) {
      failed++;
      const dead = row.attempts + 1 >= MAX_ATTEMPTS;
      const backoffMin = Math.min(60, 2 ** row.attempts);
      await asService(svc, (trx) => sql`update public.notification_outbox
        set status = ${dead ? "failed" : "pending"}, last_error = ${String(e).slice(0, 500)},
            next_attempt_at = now() + make_interval(mins => ${backoffMin}) where id = ${row.id}::uuid`.execute(trx));
    }
  }
  return { sent, failed };
}

/** Queue 24 hour and 1 hour reminders for paid, upcoming sessions. Safe to run every minute. */
export async function enqueueReminders(svc: Services, now = new Date()) {
  const sessions = (await asService(svc, (trx) => sql<SessionRow>`
    select id::text, session_date::text, to_char(start_time, 'HH24:MI') start_time,
           to_char(end_time, 'HH24:MI') end_time, user_timezone, starts_at, ends_at
      from public.sessions
     where payment_status = 'paid' and status::text in ('confirmed', 'pending')
       and starts_at between now() - interval '1 hour' and now() + interval '25 hours'`.execute(trx))).rows;
  let queued = 0;
  for (const s of sessions) {
    const mins = (sessionWindow(s).start.getTime() - now.getTime()) / 60_000;
    const kind: Kind | null = mins > 23 * 60 && mins <= 24 * 60 ? "reminder_24h" : mins > 30 && mins <= 60 ? "reminder_1h" : null;
    if (!kind) continue;
    const r = await asService(svc, (trx) => sql`
      insert into public.notification_outbox(session_id, kind, dedupe_key)
      values (${s.id}::bigint, ${kind}, ${`${s.session_date}T${s.start_time}`}) on conflict do nothing returning id`.execute(trx));
    queued += r.rows.length;
  }
  return queued;
}

/** One tick of the background job: queue reminders, then send what is due. */
export async function notificationTick(svc: Services) {
  const queued = await enqueueReminders(svc);
  const r = await dispatchDue(svc);
  return { queued, ...r };
}
