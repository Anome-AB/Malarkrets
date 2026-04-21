// Vitest config for INTEGRATION tests — they talk to a real Postgres
// (CI service container, or local docker compose postgres).
//
// Differences from vitest.config.ts:
//   - Include pattern restricted to src/test/integration/**
//   - No mock setup file (mocks don't help when the point is real SQL)
//   - Longer test timeout (migrations take a few seconds)
//   - Single fork so DB state is predictable across test files

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/integration/**/*.test.ts"],
    globalSetup: "src/test/integration/global-setup.ts",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run integration test files sequentially (not in parallel forks)
    // so they don't race on the shared test DB. Tests WITHIN a file still
    // run sequentially by default in vitest.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
