import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDb, type Database } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

let database: Database;
let app: ReturnType<typeof createApp>;
const config = { DATABASE_URL: "", PORT: 0, CORS_ORIGINS: "http://localhost:8080" };
const USER = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  const url = await freshDatabase("ifa_test_app");
  await migrate(url, undefined, () => {});
  database = createDb(url);
  app = createApp({
    config,
    database,
    resolveCaller: async (req) =>
      req.headers.get("x-test-user") ? { kind: "user", userId: req.headers.get("x-test-user")! } : { kind: "anon" },
  });
});
afterAll(() => database?.close());

describe("API skeleton", () => {
  it("reports health with the database up", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "up" });
  });

  it("carries the resolved caller into the database", async () => {
    const anon = await (await app.request("/v1/me")).json();
    expect(anon).toEqual({ uid: null, role: "anon" });
    const user = await (await app.request("/v1/me", { headers: { "x-test-user": USER } })).json();
    expect(user).toEqual({ uid: USER, role: "authenticated" });
  });
});
