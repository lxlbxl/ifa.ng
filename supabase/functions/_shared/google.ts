// Google API access via a service account with domain-wide delegation,
// impersonating IFA.ng's own Workspace "organizer" user. No user OAuth screens.
import { HttpError } from "./http.ts";

export const SCOPES = {
  meetCreate: "https://www.googleapis.com/auth/meetings.space.created",
  meetSettings: "https://www.googleapis.com/auth/meetings.space.settings",
  meetRead: "https://www.googleapis.com/auth/meetings.space.readonly",
  driveRead: "https://www.googleapis.com/auth/drive.readonly",
};

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new HttpError(503, "Google Meet is not configured (GOOGLE_SERVICE_ACCOUNT_JSON)");
  try {
    return JSON.parse(raw.trim().startsWith("{") ? raw : atob(raw));
  } catch {
    throw new HttpError(503, "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON/base64");
  }
}

export function organizerEmail(): string {
  const e = Deno.env.get("GOOGLE_ORGANIZER_EMAIL");
  if (!e) throw new HttpError(503, "Google Meet is not configured (GOOGLE_ORGANIZER_EMAIL)");
  return e;
}

const b64url = (buf: ArrayBuffer | string) => {
  const bytes = typeof buf === "string" ? new TextEncoder().encode(buf) : new Uint8Array(buf);
  let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function signJwt(sa: ServiceAccount, scopes: string[], subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, sub: subject, scope: scopes.join(" "),
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  return `${header}.${claim}.${b64url(sig)}`;
}

const tokenCache = new Map<string, { token: string; exp: number }>();

export async function googleToken(scopes: string[]): Promise<string> {
  const sa = loadServiceAccount();
  const subject = organizerEmail();
  const k = scopes.join(" ") + "|" + subject;
  const hit = tokenCache.get(k);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const assertion = await signJwt(sa, scopes, subject);
  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("google token error", body);
    throw new HttpError(502, `Google auth failed: ${body.error_description ?? body.error ?? res.status}`);
  }
  tokenCache.set(k, { token: body.access_token, exp: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

export async function meetApi(method: string, path: string, scopes: string[], body?: unknown) {
  const token = await googleToken(scopes);
  const res = await fetch(`https://meet.googleapis.com/v2/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
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
