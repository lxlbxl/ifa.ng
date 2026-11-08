import { defineConfig } from "vitest/config";
// End-to-end tests against a running PostgREST (CI starts it). See e2e/postgrest.test.ts.
export default defineConfig({
  test: { include: ["e2e/**/*.test.ts"], fileParallelism: false, testTimeout: 20000, hookTimeout: 60000 },
});
