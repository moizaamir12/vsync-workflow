import type { FullConfig } from "@playwright/test";

/**
 * Minimal teardown — servers are stopped by Playwright's webServer
 * config, and PGlite is destroyed when the API process exits.
 */
export default async function globalTeardown(
  _config: FullConfig,
): Promise<void> {
  console.log("[e2e] Teardown complete");
}
