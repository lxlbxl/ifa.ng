import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

export type Caller =
  | { kind: "service" }
  | { kind: "user"; userId: string; isAdmin: boolean };

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Identifies the caller: the service-role key (internal) or a signed-in user. */
export async function authenticate(req: Request, db: SupabaseClient): Promise<Caller> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Missing authorization");
  if (constantTimeEqual(token, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) {
    return { kind: "service" };
  }
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid session");
  // Roles live in user_roles (has_role); fall back to profiles.role on older schemas.
  const { data: viaRole, error: roleErr } = await db.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  let isAdmin = !roleErr && viaRole === true;
  if (roleErr) {
    const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    isAdmin = profile?.role === "admin";
  }
  return { kind: "user", userId: data.user.id, isAdmin };
}

export interface SessionRow {
  id: number;
  user_id: string;
  babalawo_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  user_timezone: string | null;
  video_provider: string;
  meet_uri: string | null;
  meet_code: string | null;
  meet_space_name: string | null;
  recording_status: string;
  agora_channel_name: string | null;
}

/** Loads a session and verifies the caller may act on it. */
export async function loadSessionFor(
  db: SupabaseClient, caller: Caller, sessionId: number,
  opts: { allowAdmin?: boolean } = {},
): Promise<SessionRow> {
  if (!Number.isInteger(sessionId) || sessionId <= 0) throw new HttpError(400, "Invalid session_id");
  const { data: s, error } = await db.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw new HttpError(500, "Could not load session");
  if (!s) throw new HttpError(404, "Session not found");
  if (caller.kind === "user") {
    const participant = caller.userId === s.user_id || caller.userId === s.babalawo_id;
    if (!participant && !(opts.allowAdmin && caller.isAdmin)) throw new HttpError(403, "Not your session");
  }
  return s as SessionRow;
}

/** Start/end instants. Booking stores date + HH:MM in the client's timezone. */
export function sessionWindow(s: SessionRow): { start: Date; end: Date } {
  const tz = s.user_timezone || "Africa/Lagos";
  const toDate = (hhmm: string) => zonedToUtc(`${s.session_date}T${hhmm.slice(0, 5)}:00`, tz);
  const start = toDate(s.start_time);
  let end = toDate(s.end_time);
  if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

function zonedToUtc(local: string, tz: string): Date {
  const asUtc = new Date(local + "Z");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(asUtc);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const shown = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return new Date(asUtc.getTime() - (shown - asUtc.getTime()));
}
