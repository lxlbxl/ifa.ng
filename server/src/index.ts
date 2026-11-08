import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { createAuth } from "./auth.js";
import { createMailer } from "./mailer.js";

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const auth = createAuth(config, createMailer(config.SMTP_URL, config.MAIL_FROM));
const app = createApp({ config, database, auth });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`ifa api listening on :${info.port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await database.close();
    await auth.close();
    process.exit(0);
  });
}
