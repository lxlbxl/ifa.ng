import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(8787),
  /** Comma-separated origins allowed to call the API (the PWA). */
  CORS_ORIGINS: z.string().default("http://localhost:8080,http://localhost:5173"),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return Env.parse(env);
}
