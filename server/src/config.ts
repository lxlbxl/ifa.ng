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
  MAIL_FROM: z.string().default("IFA.ng <no-reply@ifa.ng>"),
  NODE_ENV: z.string().default("development"),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = Env.parse(env);
  if (c.NODE_ENV === "production" && c.AUTH_SECRET.startsWith("dev-only")) {
    throw new Error("AUTH_SECRET must be set in production");
  }
  return c;
}
