// Service account + domain-wide delegation, impersonating the IFA.ng organizer user.
import { createSign } from "node:crypto";

const SCOPES = {
  meetRead: "https://www.googleapis.com/auth/meetings.space.readonly",
  driveRead: "https://www.googleapis.com/auth/drive.readonly",
  // Only used when GOOGLE_DRIVE_DELETE=true: the organizer's domain-wide delegation must also allow this scope.
  drive: "https://www.googleapis.com/auth/drive",
};
export { SCOPES };

const cache = new Map();

function serviceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
}

const b64u = (b) => Buffer.from(b).toString("base64url");

export async function token(scopes) {
  const sa = serviceAccount();
  const sub = process.env.GOOGLE_ORGANIZER_EMAIL;
  if (!sub) throw new Error("GOOGLE_ORGANIZER_EMAIL is not set");
  const key = scopes.join(" ") + "|" + sub;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify({
    iss: sa.client_email, sub, scope: scopes.join(" "),
    aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${body.error_description || body.error}`);
  cache.set(key, { token: body.access_token, exp: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

export async function meetGet(path) {
  const res = await fetch(`https://meet.googleapis.com/v2/${path}`, {
    headers: { Authorization: `Bearer ${await token([SCOPES.meetRead])}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meet ${path} -> ${res.status} ${data?.error?.message || ""}`);
  return data;
}

/** Streams a Drive file to a response body (caller pipes it to disk). */
export async function driveDownload(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${await token([SCOPES.driveRead])}` },
  });
  if (!res.ok || !res.body) throw new Error(`Drive download ${fileId} -> ${res.status}`);
  return res.body;
}

/** Deletes a Drive file for good (retention, consent withdrawn, erasure). Missing files count as deleted. */
export async function driveDelete(fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE", headers: { Authorization: `Bearer ${await token([SCOPES.drive])}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Drive delete ${fileId} -> ${res.status}`);
}
