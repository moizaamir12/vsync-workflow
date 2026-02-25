import type { FullConfig } from "@playwright/test";
import { seedViaApi } from "../fixtures/seed.js";
import { TEST_USER, TEST_ORG, TEST_WORKFLOWS } from "../fixtures/test-data.js";

const API_URL = "http://localhost:3001";

/**
 * Poll until the API health endpoint responds 200.
 * The webServer config starts the API, but we wait to be safe.
 */
async function waitForServer(
  url: string,
  timeoutMs: number = 30_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* server not ready */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log("[e2e] Waiting for API server...");
  await waitForServer(`${API_URL}/api/v1/health`);

  console.log("[e2e] Seeding test data...");
  const result = await seedViaApi(
    TEST_USER,
    TEST_ORG.name,
    [TEST_WORKFLOWS.simpleFetch.name, TEST_WORKFLOWS.codeTest.name],
  );

  if (result.orgId) {
    console.log(
      `[e2e] Seed complete — user: ${result.userId}, org: ${result.orgId}, workflows: ${result.workflowIds.length}`,
    );
  } else {
    console.warn("[e2e] Seed may be incomplete — check API logs");
  }
}
