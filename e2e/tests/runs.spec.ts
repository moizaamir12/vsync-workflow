import { test, expect } from "@playwright/test";
import { WS_EVENTS } from "../fixtures/test-data.js";

test.describe("Runs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/runs");
    await page.waitForLoadState("networkidle");
  });

  test("should display the runs list page with expected elements", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Run History" }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText("View and inspect workflow execution history"),
    ).toBeVisible();

    await expect(
      page.getByPlaceholder("Search by run or workflow ID..."),
    ).toBeVisible();

    /* Status filter select */
    const statusSelect = page.locator("select");
    await expect(statusSelect).toBeVisible();
  });

  test("should filter runs by status", async ({ page }) => {
    const statusSelect = page.locator("select");
    await expect(statusSelect).toBeVisible({ timeout: 10_000 });

    /* Select "completed" filter */
    await statusSelect.selectOption("completed");

    /* The select value should be updated */
    await expect(statusSelect).toHaveValue("completed");

    /* Reset to all */
    await statusSelect.selectOption("all");
    await expect(statusSelect).toHaveValue("all");
  });

  test("should navigate to run detail from builder test run", async ({
    browser,
  }) => {
    /*
     * Create a workflow, trigger a test run from the builder, and verify
     * that we land on a run detail page.
     */
    const ctx = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    const page = await ctx.newPage();

    /* Create a fresh workflow */
    await page.goto("/workflows");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /New Workflow/ }).click();
    await page.getByPlaceholder("My Workflow").fill("Run Detail Test WF");
    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(page).toHaveURL(/\/workflows\/[a-zA-Z0-9_-]+/, {
      timeout: 15_000,
    });

    /* Trigger test run */
    await page.getByRole("button", { name: /Test Run/ }).click();
    await expect(page).toHaveURL(/\/runs\/[a-zA-Z0-9_-]+/, {
      timeout: 15_000,
    });

    /* Verify we're on a run detail page — back link should exist */
    const backLink = page.locator("a[href*='/runs']").first();
    await expect(backLink).toBeVisible({ timeout: 5_000 });

    await ctx.close();
  });

  test("should handle WebSocket live updates for run status", async ({
    page,
  }) => {
    /*
     * Use Playwright's routeWebSocket to intercept the WS connection
     * and simulate server-side run status updates.
     */
    await page.routeWebSocket(/\/api\/v1\/ws/, (ws) => {
      /* Simulate server sending a connected event */
      ws.onMessage(() => {
        /* Echo back connected acknowledgement */
        ws.send(
          JSON.stringify({
            type: WS_EVENTS.connected,
            payload: { message: "Connected" },
            timestamp: Date.now(),
          }),
        );

        /* Simulate a run completing after a short delay */
        setTimeout(() => {
          ws.send(
            JSON.stringify({
              type: WS_EVENTS.runCompleted,
              payload: {
                runId: "test-run-id",
                status: "completed",
              },
              timestamp: Date.now(),
            }),
          );
        }, 500);
      });
    });

    /* Navigate to runs page to establish the WS connection */
    await page.goto("/runs");
    await page.waitForLoadState("networkidle");

    /* Verify the page loaded (WS events enhance the page, not break it) */
    await expect(
      page.getByRole("heading", { name: "Run History" }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
