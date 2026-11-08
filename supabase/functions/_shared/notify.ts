// WhatsApp (Meta Cloud API templates) with SMS (Termii) fallback.
// Queue-driven: rows in notification_outbox are sent with retries, once each.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sessionWindow, SessionRow } from "./auth.ts";

type Kind = "meet_link" | "reminder_24h" | "reminder_1h" | "rescheduled" | "completed" | "notes_ready" | "fallback_video";

const APP_URL = () => (Deno.env.get("APP_URL") ?? "https://ifa.ng").replace(/\/$/, "");
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

async function setting(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from("admin_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value ?? null;
}

async function sendSms(db: SupabaseClient, to: string, text: string): Promise<void> {
  const key = Deno.env.get("TERMII_API_KEY") || (await setting(db, "termii_api_key"));
  const sender = Deno.env.get("TERMII_SENDER_ID") || (await setting(db, "termii_sender_id")) || "IFA";
  if (!key) throw new Error("Termii API key not configured");
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, from: sender, sms: text, type: "plain", channel: "generic", api_key: key }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !(body.message_id || body.code === "ok")) throw new Error(`Termii: ${JSON.stringify(body)}`);
}

async function sendWhatsApp(kind: Kind, to: string, params: string[]): Promise<void> {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new Error("WhatsApp not configured");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
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
  const { start } = sessionWindow(s);
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: tz || s.user_timezone || "Africa/Lagos", weekday: "short", day: "numeric",
    month: "short", hour: "numeric", minute: "2-digit",
  }).format(start);
}

function smsText(kind: Kind, name: string, other: string, at: string, link: string): string {
  switch (kind) {
    case "meet_link": return `IFA.ng: Hi ${name}, your consultation with ${other} is confirmed for ${at}. Join: ${link}`;
    case "reminder_24h": return `IFA.ng: Reminder, ${name}: consultation with ${other} tomorrow, ${at}. Join: ${link}`;
    case "reminder_1h": return `IFA.ng: ${name}, your consultation with ${other} starts in about 1 hour (${at}). Join: ${link}`;
    case "rescheduled": return `IFA.ng: ${name}, your consultation with ${other} is now ${at}. Join: ${link}`;
    case "completed": return `IFA.ng: ${name}, your consultation with ${other} has ended. Notes will appear in your dashboard once approved: ${link}`;
    case "notes_ready": return `IFA.ng: ${name}, your consultation notes from ${other} are ready: ${link}`;
    case "fallback_video": return `IFA.ng: ${name}, please join your consultation with ${other} (${at}) using this link: ${link}`;
  }
}

interface Profile { id: string; full_name: string | null; phone: string | null; whatsapp_opt_in: boolean; sms_opt_in: boolean }

async function deliver(db: SupabaseClient, kind: Kind, s: SessionRow, me: Profile, other: Profile, link: string, tz: string | null) {
  const to = toE164(me.phone);
  if (!to) return { channel: "none", skipped: "no phone number" };
  const name = me.full_name?.split(" ")[0] ?? "there";
  const otherName = other.full_name ?? "your Babalawo";
  const at = when(s, tz);
  const waEnabled = (await setting(db, "whatsapp_notifications_enabled")) !== "false";
  let waError: string | null = null;
  if (me.whatsapp_opt_in && waEnabled && Deno.env.get("WHATSAPP_ACCESS_TOKEN")) {
    try { await sendWhatsApp(kind, to, [name, otherName, at, link]); return { channel: "whatsapp" }; }
    catch (e) { waError = String(e); }
  }
  if (me.sms_opt_in) {
    await sendSms(db, to, smsText(kind, name, otherName, at, link));
    return { channel: "sms", whatsapp_error: waError };
  }
  return { channel: "none", skipped: "opted out" };
}

export async function dispatchDue(db: SupabaseClient, limit = 25) {
  const { data: rows } = await db.from("notification_outbox").select("*")
    .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(limit);
  let sent = 0, failed = 0;
  for (const row of rows ?? []) {
    // claim the row so concurrent runs don't double-send
    const { data: claimed } = await db.from("notification_outbox")
      .update({ attempts: row.attempts + 1, next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString() })
      .eq("id", row.id).eq("attempts", row.attempts).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const { data: s } = await db.from("sessions").select("*").eq("id", row.session_id).single();
      if (!s || s.status === "cancelled" && row.kind !== "rescheduled") {
        await db.from("notification_outbox").update({ status: "skipped" }).eq("id", row.id); continue;
      }
      const { data: profs } = await db.from("profiles")
        .select("id, full_name, phone, whatsapp_opt_in, sms_opt_in").in("id", [s.user_id, s.babalawo_id]);
      const client = profs?.find((p) => p.id === s.user_id) as Profile;
      const bab = profs?.find((p) => p.id === s.babalawo_id) as Profile;
      if (!client || !bab) throw new Error("profiles missing");
      const base = `${APP_URL()}/session/${s.id}`;
      const joinLink = s.video_provider === "google_meet" && s.meet_uri ? s.meet_uri : base;
      const dash = `${APP_URL()}/dashboard`;
      const link = row.kind === "completed" || row.kind === "notes_ready" ? dash : joinLink;
      const { data: babRow } = await db.from("babalawos").select("timezone").eq("user_id", s.babalawo_id).maybeSingle();
      const result: Record<string, unknown> = {};
      result.client = await deliver(db, row.kind, s, client, bab, link, s.user_timezone);
      if (row.kind !== "notes_ready") result.babalawo = await deliver(db, row.kind, s, bab, client, link, babRow?.timezone ?? null);
      await db.from("notification_outbox").update({ status: "sent", sent_at: new Date().toISOString(), result }).eq("id", row.id);
      sent++;
    } catch (e) {
      failed++;
      const dead = row.attempts + 1 >= MAX_ATTEMPTS;
      await db.from("notification_outbox").update({
        status: dead ? "failed" : "pending", last_error: String(e).slice(0, 500),
        next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000).toISOString(),
      }).eq("id", row.id);
    }
  }
  return { sent, failed };
}

/** Queue 24h and 1h reminders for paid, upcoming sessions (idempotent via dedupe). */
export async function enqueueReminders(db: SupabaseClient) {
  const today = new Date(); const from = new Date(today.getTime() - 86400_000).toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 3 * 86400_000).toISOString().slice(0, 10);
  const { data: sessions } = await db.from("sessions").select("*")
    .eq("payment_status", "paid").in("status", ["confirmed", "pending"])
    .gte("session_date", from).lte("session_date", to);
  let queued = 0;
  for (const s of (sessions ?? []) as SessionRow[]) {
    const mins = (sessionWindow(s).start.getTime() - Date.now()) / 60_000;
    const kind: Kind | null = mins > 23 * 60 && mins <= 24 * 60 ? "reminder_24h"
      : mins > 30 && mins <= 60 ? "reminder_1h" : null;
    if (!kind) continue;
    const { error } = await db.from("notification_outbox")
      .insert({ session_id: s.id, kind, dedupe_key: `${s.session_date}T${s.start_time}` });
    if (!error) queued++;
  }
  return queued;
}
