import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "kysely";
import type { Caller, Database } from "./db.js";
import type { Config } from "./config.js";

export type AppEnv = { Variables: { caller: Caller } };

/**
 * Resolves who is calling. Phase 3 plugs Better Auth in here (session cookie
 * or bearer token -> user id). Until then every request is anonymous.
 */
export type ResolveCaller = (req: Request) => Promise<Caller>;

export const anonymousOnly: ResolveCaller = async () => ({ kind: "anon" });

export function createApp(deps: { config: Config; database: Database; resolveCaller?: ResolveCaller }) {
  const { config, database } = deps;
  const resolveCaller = deps.resolveCaller ?? anonymousOnly;
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: config.CORS_ORIGINS.split(",").map((s) => s.trim()), credentials: true }));

  app.use("*", async (c, next) => {
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

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
