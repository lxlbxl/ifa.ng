import type { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { HttpError, isAdmin, requireUser, type Services } from "../services/context.js";
import { createMeetLink } from "../services/meet.js";
import { notificationTick } from "../services/notify.js";
import { handleFlutterwaveWebhook, handlePaystackWebhook, initPayment, verifyForUser } from "../services/payments.js";
import { pricingFor, trustedCountry } from "../services/pricing.js";
import { refreshBanks, resolveForBabalawo, saveForBabalawo } from "../services/payoutAccounts.js";
import { agoraToken, sessionTranscript } from "../services/video.js";
import { signDataToken } from "../services/dataToken.js";
import { AUDIO_MAX, readAvatar, readSignedFile, recordingLink, uploadAvatar, uploadSessionAudio } from "../services/files.js";
import type { LiveHub } from "../services/live.js";
import { streamSSE } from "hono/streaming";
import { getPresence, heartbeat, offlineIfUnreachable, sendTestAlert, setMyPresence } from "../services/presence.js";
import { saveSubscription } from "../services/push.js";
import { EBO_VIDEO_MAX, listEboProofs, uploadEboProof } from "../services/ebo.js";
import { asService } from "../services/context.js";
import { sql } from "kysely";
import { bodyLimit } from "hono/body-limit";

/** The work the old Supabase edge functions did, now inside the API. */
export function registerV1(app: Hono<AppEnv>, svc: Services, live?: LiveHub) {
  const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Short-lived token for PostgREST (/rest/v1). Anonymous callers get none and read as 'anon'.
  app.get("/v1/data-token", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(signDataToken(svc.config.DATA_JWT_SECRET, c.get("caller")) ?? { token: null, expires_at: null });
  });

  // Best guess of the visitor's country (ISO 3166 alpha-2) for the phone number's country code.
  // Read from a header the edge sets (Cloudflare's CF-IPCountry, or GEO_COUNTRY_HEADER behind Caddy).
  app.get("/v1/geo", (c) => {
    c.header("Cache-Control", "private, max-age=3600");
    const names = [svc.config.GEO_COUNTRY_HEADER, "cf-ipcountry", "x-vercel-ip-country", "x-country-code"].filter(Boolean) as string[];
    for (const n of names) {
      const v = c.req.header(n)?.trim().toUpperCase();
      if (v && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") return c.json({ country: v });
    }
    return c.json({ country: null });
  });

  // Payments (was payment-init and payment-verify).
  app.post("/v1/payments/init", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await initPayment(svc, user.userId, await body(c.req.raw), trustedCountry(c.req.raw, svc)));
  });
  // Naira or US dollars: Nigeria by IP and phone pays naira, the diaspora the admin's USD prices.
  app.get("/v1/pricing", async (c) => {
    const caller = c.get("caller");
    c.header("Cache-Control", "private, no-store");
    return c.json(await pricingFor(svc, caller.kind === "user" ? caller.userId : null, trustedCountry(c.req.raw, svc)));
  });
  // Babalawo payout account: the provider tells us the name on it; saving needs a fresh PIN confirmation.
  app.post("/v1/payout-account/resolve", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await resolveForBabalawo(svc, user.userId, await body(c.req.raw)));
  });
  app.put("/v1/payout-account", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await saveForBabalawo(svc, user.userId, await body(c.req.raw)));
  });
  app.post("/v1/admin/payout-banks/refresh", async (c) => {
    if (!(await isAdmin(svc, c.get("caller")))) throw new HttpError(403, "Admin only");
    return c.json(await refreshBanks(svc));
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

  // Ebo proof: the ritual video (compressed by the worker) and optional photos.
  app.post("/v1/ebo/:id/proofs",
    bodyLimit({ maxSize: EBO_VIDEO_MAX + 1024 * 1024, onError: (c) => c.json({ error: "Videos must be 300 MB or smaller" }, 413) }),
    async (c) => c.json(await uploadEboProof(svc, c.get("caller"), c.req.param("id"), await fileFrom(c.req.raw))));
  app.get("/v1/ebo/:id/proofs", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await listEboProofs(svc, c.get("caller"), c.req.param("id")));
  });

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

  // Babalawo presence (Online / Offline). Consult Now reads the public check.
  app.get("/v1/babalawos/:id/presence", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await getPresence(svc, c.req.param("id")));
  });
  app.post("/v1/me/presence", async (c) => c.json(await setMyPresence(svc, c.get("caller"), await body(c.req.raw))));
  app.post("/v1/me/presence/heartbeat", async (c) => c.json(await heartbeat(svc, c.get("caller"))));

  // Web push subscriptions for this device.
  app.get("/v1/push/config", (c) => c.json({ publicKey: svc.config.VAPID_PUBLIC_KEY ?? null }));
  app.put("/v1/me/push-subscription", async (c) => {
    const user = requireUser(c.get("caller"));
    return c.json(await saveSubscription(svc, user.userId, await body(c.req.raw), c.req.header("user-agent") ?? null));
  });
  app.delete("/v1/me/push-subscription", async (c) => {
    const user = requireUser(c.get("caller"));
    const endpoint = (await body(c.req.raw)).endpoint;
    if (typeof endpoint !== "string") throw new HttpError(400, "endpoint is required");
    await asService(svc, (trx) => sql`delete from public.push_subscriptions
      where user_id = ${user.userId}::uuid and endpoint = ${endpoint}`.execute(trx));
    return c.json({ ok: true, went_offline: await offlineIfUnreachable(svc, user.userId) });
  });
  app.post("/v1/me/push-test", async (c) => c.json(await sendTestAlert(svc, c.get("caller"))));

  // Admin -> Settings -> Integrations: provider keys, masked; save; test. Admins only, never cached.
  // Secret values go in, never come back out (see services/integrations.ts).
  app.get("/v1/admin/integrations", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await svc.integrations.list(c.get("caller")));
  });
  app.put("/v1/admin/integrations/:id", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "Too large" }, 413) }), async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(await svc.integrations.save(c.get("caller"), c.req.param("id"), (await body(c.req.raw)).values));
  });
  app.post("/v1/admin/integrations/:id/test", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "Too large" }, 413) }), async (c) => {
    c.header("Cache-Control", "no-store");
    const b = await body(c.req.raw);
    return c.json(await svc.integrations.test(c.get("caller"), c.req.param("id"), b.values, b.to));
  });

  // Admin: run the notification job now (it also runs every minute on its own).
  app.post("/v1/admin/notifications/dispatch", async (c) => {
    if (!(await isAdmin(svc, c.get("caller")))) throw new HttpError(403, "Forbidden");
    return c.json(await notificationTick(svc));
  });
}
