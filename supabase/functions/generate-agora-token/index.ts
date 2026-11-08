// Agora fallback token service. Only participants of a PAID session can get a
// token, only near the session window, and the token is bound to the caller's
// user id (string account), so a leaked token cannot impersonate anyone else.
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.7";
import { handler, json, HttpError } from "../_shared/http.ts";
import { authenticate, loadSessionFor, serviceClient, sessionWindow } from "../_shared/auth.ts";

Deno.serve(handler(async (req) => {
  const db = serviceClient();
  const caller = await authenticate(req, db);
  if (caller.kind !== "user") throw new HttpError(403, "User token required");
  const body = await req.json().catch(() => ({}));
  const s = await loadSessionFor(db, caller, body.session_id ?? body.sessionId);

  if (s.payment_status !== "paid") throw new HttpError(402, "Session is not paid");
  if (["cancelled", "completed"].includes(s.status)) throw new HttpError(409, `Session is ${s.status}`);
  const { start, end } = sessionWindow(s);
  const now = Date.now();
  if (now < start.getTime() - 15 * 60_000) throw new HttpError(425, "Too early to join");
  if (now > end.getTime() + 60 * 60_000) throw new HttpError(410, "Session window has passed");

  const { data: rows } = await db.from("admin_settings").select("setting_key, setting_value")
    .in("setting_key", ["agora_app_id", "agora_app_certificate"]);
  const cfg = Object.fromEntries((rows ?? []).map((r) => [r.setting_key, r.setting_value]));
  const appId = Deno.env.get("AGORA_APP_ID") || cfg.agora_app_id;
  const cert = Deno.env.get("AGORA_APP_CERTIFICATE") || cfg.agora_app_certificate;
  if (!appId || !cert) throw new HttpError(503, "Agora is not configured");

  const channel = s.agora_channel_name || `session-${s.id}`;
  if (!s.agora_channel_name) await db.from("sessions").update({ agora_channel_name: channel }).eq("id", s.id);

  // Token lifetime: until 30 minutes after the booked end.
  const expireTs = Math.floor((end.getTime() + 30 * 60_000) / 1000);
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId, cert, channel, caller.userId, RtcRole.PUBLISHER, expireTs, expireTs);
  return json({ token, appId, channel, account: caller.userId });
}));
