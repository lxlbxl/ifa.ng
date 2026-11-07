import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const app = createApp({ config, database });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`ifa api listening on :${info.port}`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await database.close();
    process.exit(0);
  });
}
