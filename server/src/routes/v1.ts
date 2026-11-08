import type { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { HttpError, isAdmin, requireUser, type Services } from "../services/context.js";
import { createMeetLink } from "../services/meet.js";
import { notificationTick } from "../services/notify.js";
import { handleFlutterwaveWebhook, handlePaystackWebhook, initPayment, verifyForUser } from "../services/payments.js";
import { agoraToken, sessionTranscript } from "../services/video.js";

/** The work the old Supabase edge functions did, now inside the API. */
export function registerV1(app: Hono<AppEnv>, svc: Services) {
  const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;

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

  // Admin: run the notification job now (it also runs every minute on its own).
  app.post("/v1/admin/notifications/dispatch", async (c) => {
    if (!(await isAdmin(svc, c.get("caller")))) throw new HttpError(403, "Forbidden");
    return c.json(await notificationTick(svc));
  });
}
