import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(8787),
  /** Comma-separated origins allowed to call the API (the PWA). */
  CORS_ORIGINS: z.string().default("http://localhost:8080,http://localhost:5173"),
  /** Public URL of this API, e.g. https://api.ifa.ng */
  API_URL: z.string().url().default("http://localhost:8787"),
  /** Public URL of the web app, used in email links. */
  APP_URL: z.string().url().default("http://localhost:8080"),
  /** Signs session cookies. At least 32 random characters in production. */
  AUTH_SECRET: z.string().min(32).default("dev-only-secret-change-me-dev-only-secret"),
  /** Parent domain for cookies shared by app and API, e.g. ifa.ng. Empty in development. */
  COOKIE_DOMAIN: z.string().optional(),
  SMTP_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  MAIL_FROM: z.string().default("IFA.ng <no-reply@ifa.ng>"),
  NODE_ENV: z.string().default("development"),
  /**
   * Signs the short-lived tokens the web app sends to PostgREST (/rest/v1). Must equal
   * PGRST_JWT_SECRET in deploy/.env. At least 32 random characters in production.
   */
  DATA_JWT_SECRET: z.string().min(32).default("dev-only-data-secret-change-me-dev-only"),

  // Payments. Keys live only in the server's environment, never in the database.
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  FLW_SECRET_KEY: z.string().optional(),
  FLW_PUBLIC_KEY: z.string().optional(),
  /** The "secret hash" set in the Flutterwave dashboard; sent back in the verif-hash header. */
  FLW_SECRET_HASH: z.string().optional(),

  // Google Meet: a service account with domain-wide delegation acting as our organizer user.
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_ORGANIZER_EMAIL: z.string().optional(),

  // Agora (video fallback).
  AGORA_APP_ID: z.string().optional(),
  AGORA_APP_CERTIFICATE: z.string().optional(),

  // WhatsApp (Meta Cloud API) with SMS (Termii) fallback.
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  TERMII_API_KEY: z.string().optional(),
  TERMII_SENDER_ID: z.string().default("IFA"),
  TERMII_BASE_URL: z.string().url().default("https://api.ng.termii.com"),
  /**
   * Phone login codes. "auto" (default): outside production, with no Termii key, codes are not
   * sent but returned to the app and logged, so the flow can be tried end to end. Never in production.
   */
  OTP_DEV_MODE: z.enum(["auto", "true", "false"]).default("auto"),
  /** Request header carrying the visitor's country code, if the edge proxy adds one. */
  GEO_COUNTRY_HEADER: z.string().optional(),
  /** Email + password sign-up. Off: people sign in with phone + PIN. Kept for tests and staff tooling. */
  EMAIL_SIGNUP: z.enum(["true", "false"]).default("false"),

  // File storage: a private S3-compatible bucket (Cloudflare R2). Without these, files go to FILES_DIR.
  S3_ENDPOINT: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  FILES_DIR: z.string().default("./data/files"),

  // Web push (VAPID). Generate once with `npx web-push generate-vapid-keys`.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  /** Contact for push services, a mailto: or https: URL. */
  VAPID_SUBJECT: z.string().default("mailto:support@ifa.ng"),

  /**
   * Proxies in front of the API that append to X-Forwarded-For (rate limits read the visitor's IP
   * that many entries from the end). Read directly from process.env by phoneAuthPlugin.clientIp.
   */
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).default(1),
  /**
   * Encrypts the provider keys saved in Admin -> Settings -> Integrations. 32+ random characters,
   * e.g. `openssl rand -base64 32`. Without it the key is derived from AUTH_SECRET (then changing
   * AUTH_SECRET means re-entering those keys). The recording worker needs the same value.
   */
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),

  // AI notes (used by the recording worker; here so the admin screen can test them).
  OPENAI_API_KEY: z.string().optional(),
  STT_MODEL: z.string().default("whisper-1"),
  ANTHROPIC_API_KEY: z.string().optional(),
  NOTES_LLM_MODEL: z.string().default("claude-sonnet-5-5"),

  /** Run the once-a-minute notification job inside the API process. */
  JOBS_ENABLED: z.enum(["true", "false"]).default("true"),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = Env.parse(env);
  if (c.NODE_ENV === "production" && c.AUTH_SECRET.startsWith("dev-only")) {
    throw new Error("AUTH_SECRET must be set in production");
  }
  if (c.NODE_ENV === "production" && c.DATA_JWT_SECRET.startsWith("dev-only")) {
    throw new Error("DATA_JWT_SECRET must be set in production");
  }
  return c;
}
