import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { PhoneAuthError, type PhoneAuth } from "./services/phoneAuth.js";

/**
 * Better Auth endpoints for phone + PIN login, under /api/auth/phone/*.
 * The rules live in services/phoneAuth.ts; this file only turns a verified
 * person into a normal Better Auth session (httpOnly cookie, or bearer token
 * for the PWA through the bearer plugin).
 */

/** Client IP as Caddy reports it (it overwrites X-Forwarded-For unless told to trust a proxy). */
export function clientIp(req: Request | undefined): string {
  const h = req?.headers;
  const xff = h?.get("x-forwarded-for");
  if (xff) return xff.split(",").map((s) => s.trim()).filter(Boolean).at(-1) ?? "unknown";
  return h?.get("x-real-ip") ?? "unknown";
}

const fail = (e: unknown): never => {
  if (e instanceof PhoneAuthError) {
    const status = ({ 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 423: "LOCKED", 429: "TOO_MANY_REQUESTS",
      502: "BAD_GATEWAY", 503: "SERVICE_UNAVAILABLE" } as const)[e.status as 400] ?? "INTERNAL_SERVER_ERROR";
    throw new APIError(status as "BAD_REQUEST", { message: e.message, code: e.code, ...e.extra });
  }
  throw e;
};

type Body = Record<string, unknown>;

export function phoneAuthPlugin(phone: PhoneAuth) {
  return {
    id: "phone-pin",
    endpoints: {
      phoneStart: createAuthEndpoint("/phone/start", { method: "POST" }, async (ctx) => {
        try {
          return ctx.json(await phone.start((ctx.body ?? {}) as Body, clientIp(ctx.request)));
        } catch (e) { return fail(e); }
      }),

      phoneVerifyOtp: createAuthEndpoint("/phone/verify-otp", { method: "POST" }, async (ctx) => {
        let result;
        try {
          result = await phone.verifyOtp((ctx.body ?? {}) as Body, clientIp(ctx.request));
        } catch (e) { return fail(e); }
        const user = await ctx.context.internalAdapter.findUserById(result.userId);
        if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Account not found" });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not sign in" });
        await setSessionCookie(ctx, { session, user });
        return ctx.json({
          token: session.token, user: { id: user.id, name: user.name },
          is_new: result.isNew, has_pin: result.hasPin, needs_name: result.needsName, pin_ticket: result.pinTicket,
        });
      }),

      phoneSetPin: createAuthEndpoint("/phone/set-pin", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
        try {
          return ctx.json(await phone.setPin(ctx.context.session.user.id, (ctx.body ?? {}) as Body));
        } catch (e) { return fail(e); }
      }),

      phoneSignInPin: createAuthEndpoint("/phone/sign-in-pin", { method: "POST" }, async (ctx) => {
        let result;
        try {
          result = await phone.verifyPin((ctx.body ?? {}) as Body, clientIp(ctx.request));
        } catch (e) { return fail(e); }
        const user = await ctx.context.internalAdapter.findUserById(result.userId);
        if (!user) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Account not found" });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not sign in" });
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ token: session.token, user: { id: user.id, name: user.name }, needs_name: result.needsName });
      }),
    },
  } satisfies BetterAuthPlugin;
}
