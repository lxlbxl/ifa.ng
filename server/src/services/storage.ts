import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { AwsClient } from "aws4fetch";
import type { Config } from "../config.js";

/**
 * File storage (replaces Supabase Storage).
 *
 * Production uses a private Cloudflare R2 bucket (any S3-compatible store works).
 * Without S3 settings, files go to a local folder (development and tests).
 * Nothing in the bucket is public: avatars are served by the API, and private
 * files (session audio) only through short-lived signed links the API issues
 * after checking who is asking.
 */
export interface FileStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

export function createFileStore(config: Config): FileStore {
  if (config.S3_ENDPOINT && config.S3_BUCKET && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY) {
    return new S3Store(config.S3_ENDPOINT, config.S3_BUCKET, config.S3_ACCESS_KEY_ID, config.S3_SECRET_ACCESS_KEY);
  }
  return new DiskStore(config.FILES_DIR);
}

const safeKey = (key: string) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,300}$/.test(key) || key.includes("..")) throw new Error("bad file key");
  return key;
};

class S3Store implements FileStore {
  private aws: AwsClient;
  constructor(private endpoint: string, private bucket: string, accessKeyId: string, secretAccessKey: string) {
    this.aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  }
  private url(key: string) {
    return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${safeKey(key).split("/").map(encodeURIComponent).join("/")}`;
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    const r = await this.aws.fetch(this.url(key), { method: "PUT", body: Buffer.from(body), headers: { "Content-Type": contentType } });
    if (!r.ok) throw new Error(`storage put ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  async get(key: string) {
    const r = await this.aws.fetch(this.url(key));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`storage get ${r.status}`);
    return { body: new Uint8Array(await r.arrayBuffer()), contentType: r.headers.get("content-type") ?? "application/octet-stream" };
  }
  async delete(key: string) {
    const r = await this.aws.fetch(this.url(key), { method: "DELETE" });
    if (!r.ok && r.status !== 404) throw new Error(`storage delete ${r.status}`);
  }
}

class DiskStore implements FileStore {
  constructor(private root: string) {}
  private file(key: string) { return path.join(this.root, safeKey(key)); }
  async put(key: string, body: Uint8Array, contentType: string) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, body);
    await writeFile(`${f}.type`, contentType);
  }
  async get(key: string) {
    try {
      const body = await readFile(this.file(key));
      const contentType = await readFile(`${this.file(key)}.type`, "utf8").catch(() => "application/octet-stream");
      return { body: new Uint8Array(body), contentType };
    } catch { return null; }
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true });
    await rm(`${this.file(key)}.type`, { force: true });
  }
}

// ---- signed links for private files

export function signFileLink(secret: string, key: string, ttlSeconds: number, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ k: safeKey(key), e: now + ttlSeconds })).toString("base64url");
  const sig = createHmac("sha256", secret).update(`file:${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyFileLink(secret: string, token: string, now = Math.floor(Date.now() / 1000)): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(createHmac("sha256", secret).update(`file:${payload}`).digest("base64url"));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { k, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof k === "string" && typeof e === "number" && e >= now ? k : null;
  } catch { return null; }
}
