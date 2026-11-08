import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { DB_DIR, migrate } from "../src/migrate.js";
import { freshDatabase } from "./helpers.js";

/**
 * Runs db/tests/roles/10_attacks.sql (written by the roles/admin work) against
 * the full migrated schema on plain Postgres. Every attack must be refused and
 * the script must end with ALL CHECKS PASSED. Needs `psql` on PATH.
 */
describe("roles and sessions attack checks", () => {
  it("refuses every attack on the full schema", async () => {
    const url = await freshDatabase("ifa_test_attacks");
    await migrate(url, undefined, () => {});
    const out = execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", path.join(DB_DIR, "tests", "roles", "10_attacks.sql")], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(out + "").not.toMatch(/ATTACK SUCCEEDED/);
  }, 60_000);
});
