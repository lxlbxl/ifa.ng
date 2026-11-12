import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createAuth } from "./auth.js";
import { createMailer } from "./mailer.js";
import { startJobs } from "./services/jobs.js";
import { createLiveHub } from "./services/live.js";
import { createFileStore } from "./services/storage.js";
import { pushNotification } from "./services/push.js";
import { initErrorReporting, reportError } from "./services/errors.js";
import { createIntegrationSettings } from "./services/integrations.js";

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
// Keys saved in Admin -> Settings -> Integrations take priority over .env. They are applied to
// `config` itself, so everything that reads config at use time follows changes without a restart.
const integrations = createIntegrationSettings({ config, database });
await integrations.refresh().catch((e) => console.error("could not load integration settings; using .env only", e));
integrations.onChange((changed) => {
  if (changed.includes("SENTRY_DSN")) initErrorReporting({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV });
});
// Another API instance (or a restore) may change them too.
const settingsRefresh = setInterval(() => integrations.refresh().catch((e) => console.error("integration settings refresh", e)), 60_000);
initErrorReporting({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV });
process.on("unhandledRejection", (e) => reportError(e, { kind: "unhandledRejection" }));
const auth = createAuth(config, createMailer(() => config.SMTP_URL, () => config.MAIL_FROM));
const files = createFileStore(config);
const svc = { config, database, fetch: globalThis.fetch, files, integrations };
// Every new notification row is also sent as a web push (when VAPID keys are set).
const live = createLiveHub(svc, config.DATABASE_URL, {
  onNotification: (id) => { pushNotification(svc, id).catch((e) => console.error("push", e)); },
});
// Reminders, WhatsApp/SMS sends, slot-hold cleanup and session completion.
const stopJobs = config.JOBS_ENABLED === "true" ? startJobs(svc) : () => {};
const phoneCleanup = setInterval(() => auth.phone.cleanup().catch((e) => console.error("phone cleanup", e)), 3600_000);
const app = createApp({ config, database, auth, files, live, integrations });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`ifa api listening on :${info.port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    stopJobs();
    clearInterval(phoneCleanup);
    clearInterval(settingsRefresh);
    await live.close();
    await database.close();
    await auth.close();
    process.exit(0);
  });
}
