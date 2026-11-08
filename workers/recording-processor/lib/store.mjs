// Database and file access for the worker, on our own Postgres and R2 (no Supabase).
// The worker logs in with the API's database login and acts as service_role,
// the same trusted role the API uses for server-side work.
import pg from "pg";
import { AwsClient } from "aws4fetch";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function createDb(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString, max: 3 });
  pool.on("connect", (c) => { c.query("set role service_role").catch((e) => console.error("set role failed", e.message)); });
  return {
    /** Run one statement; returns rows. */
    async q(text, params = []) { return (await pool.query(text, params)).rows; },
    async one(text, params = []) { return (await pool.query(text, params)).rows[0] ?? null; },
    end: () => pool.end(),
  };
}

const safeKey = (key) => {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,300}$/.test(key) || key.includes("..")) throw new Error("bad file key");
  return key;
};

/** Same layout as the API's store: R2 when S3_* is set, otherwise FILES_DIR. Keys are bucket-relative. */
export function createFiles(env = process.env) {
  if (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    const aws = new AwsClient({ accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
    const url = (k) => `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${safeKey(k).split("/").map(encodeURIComponent).join("/")}`;
    return {
      async put(k, body, contentType) {
        const r = await aws.fetch(url(k), { method: "PUT", body, headers: { "Content-Type": contentType } });
        if (!r.ok) throw new Error(`storage put ${r.status}`);
      },
      async get(k) {
        const r = await aws.fetch(url(k));
        if (!r.ok) throw new Error(`storage get ${r.status}`);
        return Buffer.from(await r.arrayBuffer());
      },
      async remove(k) {
        const r = await aws.fetch(url(k), { method: "DELETE" });
        if (!r.ok && r.status !== 404) throw new Error(`storage delete ${r.status}`);
      },
    };
  }
  const root = env.FILES_DIR || "./data/files";
  const file = (k) => path.join(root, safeKey(k));
  return {
    async put(k, body, contentType) {
      await mkdir(path.dirname(file(k)), { recursive: true });
      await writeFile(file(k), body);
      await writeFile(`${file(k)}.type`, contentType);
    },
    get: (k) => readFile(file(k)),
    async remove(k) { await rm(file(k), { force: true }); await rm(`${file(k)}.type`, { force: true }); },
  };
}
