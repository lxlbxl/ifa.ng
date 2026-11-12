// Provider keys saved in Admin -> Settings -> Integrations (private.integration_secrets), applied over
// this worker's environment. Same encryption as the API's server/src/services/secretBox.ts: keep in step.
import { createDecipheriv, hkdfSync } from "node:crypto";

/** The settings this worker uses. Anything else in the table is ignored here. */
export const WORKER_KEYS = [
  "GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_ORGANIZER_EMAIL",
  "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY",
  "OPENAI_API_KEY", "STT_MODEL", "ANTHROPIC_API_KEY", "NOTES_LLM_MODEL",
];

export function secretKey(env = process.env) {
  const material = env.SETTINGS_ENCRYPTION_KEY?.trim() || env.AUTH_SECRET || "dev-only-secret-change-me-dev-only-secret";
  return Buffer.from(hkdfSync("sha256", material, "ifa.ng", "integration-secrets/v1", 32));
}

/** Returns null when the value cannot be read. */
export function open(key, name, sealed) {
  if (typeof sealed !== "string" || !sealed.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), "base64url");
    const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    d.setAAD(Buffer.from(name));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Returns refresh(): reads the saved values and writes them into `env` (process.env), falling back to
 * what the environment had at start for anything not saved (or no longer saved). Returns changed names.
 */
export function createOverrides(db, env = process.env) {
  const key = secretKey(env);
  const base = Object.fromEntries(WORKER_KEYS.map((k) => [k, env[k]]));
  return async function refresh() {
    let rows = [];
    try {
      rows = await db.q("select env_key, value_enc from private.integration_secrets where env_key = any($1)", [WORKER_KEYS]);
    } catch (e) {
      console.error("could not read integration settings; using environment", e.message);
      return [];
    }
    const saved = new Map();
    for (const r of rows) {
      const v = open(key, r.env_key, r.value_enc);
      if (v === null) console.error(`integration setting ${r.env_key} can't be decrypted; using environment`);
      else saved.set(r.env_key, v);
    }
    const changed = [];
    for (const k of WORKER_KEYS) {
      const v = saved.has(k) ? saved.get(k) : base[k];
      if (env[k] !== v) {
        if (v === undefined) delete env[k]; else env[k] = v;
        changed.push(k);
      }
    }
    return changed;
  };
}
