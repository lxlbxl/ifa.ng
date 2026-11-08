import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "kysely";
import type { Caller, Database } from "./db.js";
import type { Config } from "./config.js";
import type { Auth } from "./auth.js";
import { HttpError } from "./services/context.js";
import { registerV1 } from "./routes/v1.js";
import { createFileStore, type FileStore } from "./services/storage.js";
import type { LiveHub } from "./services/live.js";

export type AppEnv = { Variables: { caller: Caller } };

/**
 * Resolves who is calling. In production this is Better Auth (session cookie
 * or bearer token -> user id); tests can inject their own.
 */
export type ResolveCaller = (req: Request) => Promise<Caller>;

export const anonymousOnly: ResolveCaller = async () => ({ kind: "anon" });

export function createApp(deps: {
  config: Config; database: Database; auth?: Auth; resolveCaller?: ResolveCaller;
  /** Outbound HTTP to payment providers, Google, Agora, Termii. Tests pass a fake. */
  fetch?: typeof fetch;
  /** File storage (R2 in production). Defaults to a local folder. */
  files?: FileStore;
  /** Live notification streams. Without it, the stream endpoint answers 503. */
  live?: LiveHub;
}) {
  const { config, database } = deps;
  const resolveCaller = deps.resolveCaller ?? deps.auth?.resolveCaller ?? anonymousOnly;
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: config.CORS_ORIGINS.split(",").map((s) => s.trim()), credentials: true }));

  // Login, sign-up, sessions, password reset, email verification (Better Auth).
  if (deps.auth) {
    const handler = deps.auth.auth.handler;
    app.on(["GET", "POST"], "/api/auth/*", (c) => handler(c.req.raw));
  }

  app.use("/v1/*", async (c, next) => {
    c.set("caller", await resolveCaller(c.req.raw));
    await next();
  });

  app.get("/health", async (c) => {
    try {
      await sql`select 1`.execute(database.db);
      return c.json({ ok: true, db: "up" });
    } catch {
      return c.json({ ok: false, db: "down" }, 503);
    }
  });

  /** Who the server thinks you are, as the database sees it. */
  app.get("/v1/me", async (c) => {
    const caller = c.get("caller");
    const row = await database.as(caller, async (trx) => {
      const r = await sql<{ uid: string | null; role: string | null }>`select auth.uid() as uid, auth.role() as role`.execute(trx);
      return r.rows[0];
    });
    return c.json(row);
  });

  registerV1(app, { config, database, fetch: deps.fetch ?? globalThis.fetch, files: deps.files ?? createFileStore(config) }, deps.live);

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
