import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createAuth } from "./auth.js";
import { createMailer } from "./mailer.js";
import { startJobs } from "./services/jobs.js";
import { createLiveHub } from "./services/live.js";
import { createFileStore } from "./services/storage.js";

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const auth = createAuth(config, createMailer(config.SMTP_URL, config.MAIL_FROM));
const files = createFileStore(config);
const svc = { config, database, fetch: globalThis.fetch, files };
const live = createLiveHub(svc, config.DATABASE_URL);
// Reminders, WhatsApp/SMS sends, slot-hold cleanup and session completion.
const stopJobs = config.JOBS_ENABLED === "true" ? startJobs(svc) : () => {};
const phoneCleanup = setInterval(() => auth.phone.cleanup().catch((e) => console.error("phone cleanup", e)), 3600_000);
const app = createApp({ config, database, auth, files, live });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`ifa api listening on :${info.port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    stopJobs();
    clearInterval(phoneCleanup);
    await live.close();
    await database.close();
    await auth.close();
    process.exit(0);
  });
}
