import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests run under vitest.config.integration.ts — they
    // need a real Postgres, not the mock-DB setup used here.
    exclude: ["**/node_modules/**", "src/test/integration/**"],
    setupFiles: ["src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
