import pg from "pg";
import { PostgresDialect } from "kysely";
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { Config } from "./config.js";
import type { Mailer } from "./mailer.js";
import type { Caller } from "./db.js";
import { phoneAuthPlugin } from "./phoneAuthPlugin.js";
import { createPhoneAuth, devSender, otpDevMode, termiiSender, type OtpSender } from "./services/phoneAuth.js";

/**
 * Login, replacing Supabase Auth.
 *
 * Better Auth stores people in auth.users (the same uuid ids the rest of the
 * schema points at) and its sessions, password hashes and tokens in
 * auth.sessions / auth.accounts / auth.verifications. It connects through its
 * own small pool that runs as service_role; browsers never reach those tables.
 *
 * Browsers authenticate with an httpOnly session cookie. The PWA may instead
 * send `Authorization: Bearer <session token>` (bearer plugin).
 */
export function createAuth(config: Config, mailer: Mailer, opts: { otpSender?: OtpSender; fetch?: typeof fetch } = {}) {
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5 });
  pool.on("connect", (client) => {
    client.query("set role service_role").catch((e) => console.error("auth pool: set role failed", e));
  });

  const secure = config.API_URL.startsWith("https://");

  const devMode = otpDevMode(config);
  const phone = createPhoneAuth({
    pool, secret: config.AUTH_SECRET, devMode,
    sender: opts.otpSender ?? (devMode ? devSender : termiiSender(config, opts.fetch ?? globalThis.fetch)),
  });

  const auth = betterAuth({
    appName: "IFA.ng",
    baseURL: config.API_URL,
    basePath: "/api/auth",
    secret: config.AUTH_SECRET,
    trustedOrigins: config.CORS_ORIGINS.split(",").map((s) => s.trim()),
    database: { dialect: new PostgresDialect({ pool }), type: "postgres", schemaName: "auth", transaction: true },
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: secure,
      cookiePrefix: "ifa",
      ...(config.COOKIE_DOMAIN ? { crossSubDomainCookies: { enabled: true, domain: config.COOKIE_DOMAIN } } : {}),
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true, secure },
    },
    user: {
      modelName: "users",
      fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
      additionalFields: {
        // 'user' or 'babalawo'. Anything else is ignored by the database; admin is never granted at signup.
        signupRole: { type: "string", required: false, input: true, fieldName: "signup_role" },
      },
    },
    session: {
      modelName: "sessions",
      fields: { userId: "user_id", expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent",
        createdAt: "created_at", updatedAt: "updated_at" },
      expiresIn: 60 * 60 * 24 * 30,      // 30 days
      updateAge: 60 * 60 * 24,           // refreshed daily while in use
    },
    account: {
      modelName: "accounts",
      fields: { userId: "user_id", accountId: "account_id", providerId: "provider_id", accessToken: "access_token",
        refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at" },
    },
    verification: {
      modelName: "verifications",
      fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
    },
    emailAndPassword: {
      enabled: true,
      // People sign in with phone + PIN (plugin below). Email sign-up stays off unless EMAIL_SIGNUP=true.
      disableSignUp: config.EMAIL_SIGNUP !== "true",
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          subject: "Reset your IFA.ng password",
          text: `Someone asked to reset the password for this account.\n\nTo choose a new password, open:\n${url}\n\nIf this wasn't you, you can ignore this email.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          subject: "Confirm your email for IFA.ng",
          text: `Welcome to IFA.ng.\n\nPlease confirm your email address:\n${url}`,
        });
      },
    },
    rateLimit: { enabled: config.NODE_ENV !== "test", window: 60, max: 30, storage: "memory",
      customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        // Coarse per-IP caps; the precise per-number limits and lockouts are in services/phoneAuth.ts.
        "/phone/start": { window: 60, max: 10 }, "/phone/verify-otp": { window: 60, max: 10 },
        "/phone/sign-in-pin": { window: 60, max: 10 }, "/phone/set-pin": { window: 60, max: 10 },
        "/phone/confirm-pin": { window: 60, max: 10 } } },
    plugins: [bearer(), phoneAuthPlugin(phone)],
  });

  /** Who is calling: a signed-in user (cookie or bearer token) or anonymous. */
  async function resolveCaller(req: Request): Promise<Caller> {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) return { kind: "anon" };
    return { kind: "user", userId: session.user.id, email: session.user.email };
  }

  return { auth, resolveCaller, phone, close: () => pool.end() };
}

export type Auth = ReturnType<typeof createAuth>;
