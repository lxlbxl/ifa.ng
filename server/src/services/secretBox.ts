import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encrypts integration keys before they go into the database (AES-256-GCM).
 *
 * The key comes from SETTINGS_ENCRYPTION_KEY, or, when that is not set, is derived from
 * AUTH_SECRET. Either way it exists only in the server's environment, so a database dump or
 * backup on its own does not reveal any provider key. The setting's name is bound in as
 * associated data, so a stored value cannot be moved onto another setting.
 *
 * The recording worker has its own copy of this (workers/recording-processor/lib/secrets.mjs);
 * keep the two in step.
 */
export type SecretKey = Buffer;

export function secretKey(cfg: { SETTINGS_ENCRYPTION_KEY?: string; AUTH_SECRET: string }): SecretKey {
  const material = cfg.SETTINGS_ENCRYPTION_KEY?.trim() || cfg.AUTH_SECRET;
  return Buffer.from(hkdfSync("sha256", material, "ifa.ng", "integration-secrets/v1", 32));
}

export function seal(key: SecretKey, name: string, value: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(name));
  const ct = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
}

/** Returns null when the value cannot be read (wrong key, tampered, or another setting's value). */
export function open(key: SecretKey, name: string, sealed: string): string | null {
  if (!sealed.startsWith("v1:")) return null;
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
