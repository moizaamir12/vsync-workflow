import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /* PGlite tests need more time for WASM initialization */
    testTimeout: 30_000,
  },
});
