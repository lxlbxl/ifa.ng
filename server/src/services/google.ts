import { createSign } from "node:crypto";
import { HttpError, type Services } from "./context.js";

/**
 * Google API access through a service account with domain-wide delegation,
 * acting as IFA.ng's own Workspace "organizer" user. No user OAuth screens.
 */

export const SCOPES = {
  meetCreate: "https://www.googleapis.com/auth/meetings.space.created",
  meetSettings: "https://www.googleapis.com/auth/meetings.space.settings",
  meetRead: "https://www.googleapis.com/auth/meetings.space.readonly",
  driveRead: "https://www.googleapis.com/auth/drive.readonly",
};

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

function serviceAccount(svc: Services): ServiceAccount {
  const raw = svc.config.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new HttpError(503, "Google Meet is not configured (GOOGLE_SERVICE_ACCOUNT_JSON)");
  try {
    return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    throw new HttpError(503, "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON or base64");
  }
}

function organizer(svc: Services): string {
  const e = svc.config.GOOGLE_ORGANIZER_EMAIL;
  if (!e) throw new HttpError(503, "Google Meet is not configured (GOOGLE_ORGANIZER_EMAIL)");
  return e;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signDelegationJwt(sa: ServiceAccount, scopes: string[], subject: string, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, sub: subject, scope: scopes.join(" "),
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3600,
  }));
  const sig = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(sa.private_key);
  return `${header}.${claim}.${b64url(sig)}`;
}

const tokenCache = new Map<string, { token: string; exp: number }>();

export async function googleToken(svc: Services, scopes: string[]): Promise<string> {
  const sa = serviceAccount(svc);
  const subject = organizer(svc);
  const key = `${sa.client_email}|${subject}|${scopes.join(" ")}`;
  const hit = tokenCache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const res = await svc.fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signDelegationJwt(sa, scopes, subject),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, string | number>;
  if (!res.ok) {
    console.error("google token error", body);
    throw new HttpError(502, `Google auth failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  tokenCache.set(key, { token: String(body.access_token), exp: Date.now() + Number(body.expires_in) * 1000 });
  return String(body.access_token);
}

export async function meetApi(svc: Services, method: string, path: string, scopes: string[], body?: unknown) {
  const token = await googleToken(svc, scopes);
  const res = await svc.fetch(`https://meet.googleapis.com/v2/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (await res.json().catch(() => ({}))) as any;
  return { ok: res.ok, status: res.status, data };
}

export type RecordingMode = "ON" | "OFF";

export function spaceConfig(recording: RecordingMode) {
  return {
    // TRUSTED: the Babalawo (a member) and IFA.ng staff walk in; guests without a
    // Google account "Ask to join" and are admitted by the Babalawo (co-host).
    accessType: "TRUSTED",
    entryPointAccess: "ALL",
    moderation: "OFF",
    attendanceReportGenerationType: "GENERATE_REPORT",
    artifactConfig: {
      recordingConfig: { autoRecordingGeneration: recording },
      // Meet's own transcription does not support Yorùbá; our pipeline transcribes.
      transcriptionConfig: { autoTranscriptionGeneration: "OFF" },
      smartNotesConfig: { autoSmartNotesGeneration: "OFF" },
    },
  };
}
