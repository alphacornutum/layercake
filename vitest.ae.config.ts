import { loadEnvFile } from "node:process";

import { defineConfig } from "vitest/config";

// Pick up local AE_* knobs for host E2E without requiring a manual `source .env`.
try {
  loadEnvFile(".env");
} catch {
  // Optional — CI / machines without a local .env still skip via skipIf gates.
}

export default defineConfig({
  test: {
    include: ["tests/**/*.ae.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Single shared AE GUI session — never run host files in parallel.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
