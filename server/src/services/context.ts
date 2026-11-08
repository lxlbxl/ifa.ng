import { sql, type Transaction } from "kysely";
import type { Config } from "../config.js";
import type { FileStore } from "./storage.js";
import type { Caller, Database, DB } from "../db.js";

/** What the business logic needs. Tests swap `fetch` for a fake provider. */
export interface Services {
  config: Config;
  database: Database;
  fetch: typeof fetch;
  files: FileStore;
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const SERVICE: Caller = { kind: "service" };

/** Run SQL as the service role (bypasses RLS). Only for server-side logic that has already checked the caller. */
export function asService<T>(svc: Services, fn: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
  return svc.database.as(SERVICE, fn);
}

export async function isAdmin(svc: Services, caller: Caller): Promise<boolean> {
  if (caller.kind === "service") return true;
  if (caller.kind !== "user") return false;
  const r = await asService(svc, (trx) =>
    sql<{ a: boolean }>`select public.has_role(${caller.userId}::uuid, 'admin') a`.execute(trx));
  return r.rows[0]?.a === true;
}

export function requireUser(caller: Caller): { kind: "user"; userId: string; email?: string } {
  if (caller.kind !== "user") throw new HttpError(401, "Not signed in");
  return caller;
}

export interface SessionRow {
  id: string;
  user_id: string;
  babalawo_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string | null;
  user_timezone: string | null;
  video_provider: string | null;
  meet_uri: string | null;
  meet_code: string | null;
  meet_space_name: string | null;
  recording_status: string | null;
  agora_channel_name: string | null;
}

export async function getSession(svc: Services, id: string): Promise<SessionRow | undefined> {
  const r = await asService(svc, (trx) => sql<SessionRow>`
    select id::text, user_id, babalawo_id, session_date::text, to_char(start_time, 'HH24:MI') start_time,
           to_char(end_time, 'HH24:MI') end_time, status::text, payment_status, user_timezone, video_provider,
           meet_uri, meet_code, meet_space_name, recording_status, agora_channel_name
      from public.sessions where id = ${id}::bigint`.execute(trx));
  return r.rows[0];
}

/** Loads a session and checks the caller is a participant (or, if allowed, an admin). */
export async function loadSessionFor(
  svc: Services, caller: Caller, sessionId: unknown, opts: { allowAdmin?: boolean } = {},
): Promise<SessionRow> {
  const id = typeof sessionId === "number" ? String(sessionId) : sessionId;
  if (typeof id !== "string" || !/^\d{1,18}$/.test(id)) throw new HttpError(400, "Invalid session id");
  if (caller.kind === "anon") throw new HttpError(401, "Not signed in");
  const s = await getSession(svc, id);
  if (!s) throw new HttpError(404, "Session not found");
  if (caller.kind === "user") {
    const participant = caller.userId === s.user_id || caller.userId === s.babalawo_id;
    if (!participant && !(opts.allowAdmin && (await isAdmin(svc, caller)))) throw new HttpError(403, "Not your session");
  }
  return s;
}

/** Start and end instants. A booking stores a date and HH:MM in the client's timezone. */
export function sessionWindow(s: Pick<SessionRow, "session_date" | "start_time" | "end_time" | "user_timezone">) {
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
