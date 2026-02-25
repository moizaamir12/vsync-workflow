import { defineConfig, devices } from "@playwright/test";

const API_PORT = 3001;
const WEB_PORT = 3000;

/**
 * Playwright E2E configuration for the vsync monorepo.
 *
 * - 3 browser projects (chromium, firefox, webkit) plus a "setup" project
 * - Two webServer entries: API (Hono on 3001), Next.js (3000)
 * - API uses PGlite (in-memory) — no external Postgres needed
 * - E2E=true disables email verification for test signups
 * - Tests run serially because they share in-memory PGlite state
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,

  reporter: [
    ["html", { open: "never", outputFolder: "./playwright-report" }],
    ["list"],
  ],

  outputDir: "./test-results",

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  globalSetup: "./setup/global-setup.ts",
  globalTeardown: "./setup/global-teardown.ts",

  projects: [
    /* Auth setup — runs first, creates storageState */
    {
      name: "setup",
      testMatch: /auth-setup\.ts/,
      testDir: "./setup",
      use: { ...devices["Desktop Chrome"] },
    },

    /* Browser projects — all depend on "setup" for auth state */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: [
    /* API server (Hono + PGlite) */
    {
      command: "node --env-file=.env packages/api/dist/server.js",
      port: API_PORT,
      reuseExistingServer: !process.env["CI"],
      timeout: 30_000,
      env: {
        AUTH_SECRET: "vsync-e2e-test-secret",
        APP_URL: `http://localhost:${WEB_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        PORT: String(API_PORT),
        E2E: "true",
      },
    },
    /* Next.js web app */
    {
      command: `pnpm --filter @vsync/web start --port ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: !process.env["CI"],
      timeout: 60_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
