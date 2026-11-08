import { createHmac } from "node:crypto";
import type { Caller } from "../db.js";

/**
 * The web app reads and writes tables through PostgREST, exactly as it did on
 * Supabase. PostgREST trusts an HS256 token signed with DATA_JWT_SECRET and
 * runs each request as the token's `role` with `request.jwt.claims` set, so
 * auth.uid() and every RLS policy work unchanged. Only this endpoint signs
 * those tokens, only for the signed-in person, only as 'authenticated', and
 * only for a few minutes. A service_role token is never issued to a browser.
 */
export const DATA_TOKEN_TTL_SECONDS = 10 * 60;

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function signDataToken(secret: string, caller: Caller, nowSec = Math.floor(Date.now() / 1000)) {
  if (caller.kind !== "user") return null;
  const exp = nowSec + DATA_TOKEN_TTL_SECONDS;
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    sub: caller.userId, email: caller.email ?? null, role: "authenticated", aud: "authenticated", iat: nowSec, exp,
  }));
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${sig}`, expires_at: exp };
}
