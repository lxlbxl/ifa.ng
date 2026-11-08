import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createAuth } from "./auth.js";
import { createMailer } from "./mailer.js";
import { notificationTick } from "./services/notify.js";

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const auth = createAuth(config, createMailer(config.SMTP_URL, config.MAIL_FROM));
const app = createApp({ config, database, auth });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`ifa api listening on :${info.port}`);
});

// Reminders and WhatsApp/SMS sends, once a minute. One API container runs this;
// the claim on each outbox row keeps a second runner from double-sending.
let ticking = false;
const timer = config.JOBS_ENABLED === "true"
  ? setInterval(async () => {
      if (ticking) return;
      ticking = true;
      try {
        const r = await notificationTick({ config, database, fetch: globalThis.fetch });
        if (r.queued || r.sent || r.failed) console.log("notifications", r);
      } catch (e) {
        console.error("notification job", e);
      } finally {
        ticking = false;
      }
    }, 60_000)
  : undefined;

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    if (timer) clearInterval(timer);
    await database.close();
    await auth.close();
    process.exit(0);
  });
}
