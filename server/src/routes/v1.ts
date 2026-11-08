import type { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { HttpError, isAdmin, requireUser, type Services } from "../services/context.js";
import { createMeetLink } from "../services/meet.js";
import { notificationTick } from "../services/notify.js";
import { handleFlutterwaveWebhook, handlePaystackWebhook, initPayment, verifyForUser } from "../services/payments.js";
import { agoraToken, sessionTranscript } from "../services/video.js";
import { signDataToken } from "../services/dataToken.js";
import { AUDIO_MAX, readAvatar, readSignedFile, recordingLink, uploadAvatar, uploadSessionAudio } from "../services/files.js";
import type { LiveHub } from "../services/live.js";
import { streamSSE } from "hono/streaming";
import { bodyLimit } from "hono/body-limit";

/** The work the old Supabase edge functions did, now inside the API. */
export function registerV1(app: Hono<AppEnv>, svc: Services, live?: LiveHub) {
  const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Short-lived token for PostgREST (/rest/v1). Anonymous callers get none and read as 'anon'.
  app.get("/v1/data-token", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(signDataToken(svc.config.DATA_JWT_SECRET, c.get("caller")) ?? { token: null, expires_at: null });
  });

  // Payments (was payment-init and payment-verify).
  app.post("/v1/payments/init", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await initPayment(svc, user.userId, await body(c.req.raw)));
  });
  app.post("/v1/payments/verify", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await verifyForUser(svc, user.userId, (await body(c.req.raw)).reference));
  });

  // Provider webhooks (was webhook-paystack and webhook-flutterwave). Signed by the provider, not by a login.
  app.post("/webhooks/paystack", async (c) => {
    const raw = await c.req.text();
    const status = await handlePaystackWebhook(svc, raw, c.req.header("x-paystack-signature") ?? "");
    return c.text(status === 200 ? "ok" : status === 401 ? "invalid signature" : "retry", status as 200 | 401 | 500);
  });
  app.post("/webhooks/flutterwave", async (c) => {
    const raw = await c.req.text();
    const status = await handleFlutterwaveWebhook(svc, raw, c.req.header("verif-hash") ?? "");
    return c.text(status === 200 ? "ok" : status === 401 ? "invalid signature" : "retry", status as 200 | 401 | 500);
  });

  // Video (was create-meet-link and generate-agora-token).
  app.post("/v1/sessions/:id/meet-link", async (c) => c.json(await createMeetLink(svc, c.get("caller"), c.req.param("id"))));
  app.post("/v1/sessions/:id/agora-token", async (c) => c.json(await agoraToken(svc, c.get("caller"), c.req.param("id"))));
  app.get("/v1/sessions/:id/transcript", async (c) => c.json(await sessionTranscript(svc, c.get("caller"), c.req.param("id"))));

  // Files (was Supabase Storage).
  const tooBig = bodyLimit({ maxSize: AUDIO_MAX + 1024 * 1024, onError: (c) => c.json({ error: "File too large" }, 413) });
  const fileFrom = async (req: Request) => (await req.formData().catch(() => null))?.get("file") as File | undefined;
  app.post("/v1/me/avatar", bodyLimit({ maxSize: 6 * 1024 * 1024, onError: (c) => c.json({ error: "Images must be 5 MB or smaller" }, 413) }),
    async (c) => c.json(await uploadAvatar(svc, c.get("caller"), await fileFrom(c.req.raw))));
  app.get("/files/avatars/:name", async (c) => {
    const f = await readAvatar(svc, c.req.param("name"));
    if (!f) return c.json({ error: "Not found" }, 404);
    return c.body(Buffer.from(f.body), 200, { "Content-Type": f.contentType, "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff" });
  });
  app.get("/v1/sessions/:id/recording", async (c) => c.json(await recordingLink(svc, c.get("caller"), c.req.param("id"))));
  app.get("/files/signed/:token", async (c) => {
    const f = await readSignedFile(svc, c.req.param("token"));
    if (!f) return c.json({ error: "This link has expired" }, 404);
    return c.body(Buffer.from(f.body), 200, { "Content-Type": f.contentType, "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" });
  });
  app.post("/v1/sessions/:id/audio", tooBig,
    async (c) => c.json(await uploadSessionAudio(svc, c.get("caller"), c.req.param("id"), await fileFrom(c.req.raw))));

  // Live notifications (was Supabase Realtime): Server-Sent Events for the signed-in person.
  app.get("/v1/notifications/stream", async (c) => {
    const user = requireUser(c.get("caller"));
    if (!live) throw new HttpError(503, "Live updates are not available");
    return streamSSE(c, async (stream) => {
      const unsubscribe = live.subscribe(user.userId, (row) => {
        stream.writeSSE({ event: "notification", data: JSON.stringify(row), id: String(row.id) }).catch(() => {});
      });
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "ready", data: "{}" });
      // Keep proxies from closing an idle stream.
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(25_000);
        await stream.writeSSE({ event: "ping", data: "{}" }).catch(() => {});
      }
      unsubscribe();
    });
  });

  // Admin: run the notification job now (it also runs every minute on its own).
  app.post("/v1/admin/notifications/dispatch", async (c) => {
    if (!(await isAdmin(svc, c.get("caller")))) throw new HttpError(403, "Forbidden");
    return c.json(await notificationTick(svc));
  });
}
