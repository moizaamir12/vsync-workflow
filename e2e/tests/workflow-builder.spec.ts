import { test, expect } from "@playwright/test";
import { TEST_WORKFLOWS } from "../fixtures/test-data.js";

let builderUrl: string;

test.describe("Workflow Builder", () => {
  test.beforeAll(async ({ browser }) => {
    /* Create a fresh workflow via UI so every builder test has a known page */
    const ctx = await browser.newContext({
      storageState: "e2e/.auth/user.json",
    });
    const page = await ctx.newPage();
    await page.goto("/workflows");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /New Workflow/ }).click();
    await page
      .getByPlaceholder("My Workflow")
      .fill("Builder E2E Workflow");
    await page.getByRole("button", { name: /^Create$/ }).click();

    await expect(page).toHaveURL(/\/workflows\/[a-zA-Z0-9_-]+/, {
      timeout: 15_000,
    });
    builderUrl = page.url();
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(builderUrl);
    await page.waitForLoadState("networkidle");
  });

  test("should render toolbar with all action buttons", async ({ page }) => {
    await expect(page.getByText("Save")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Publish")).toBeVisible();
    await expect(page.getByText("Test Run")).toBeVisible();

    /* Version badge */
    await expect(page.getByText(/^v\d+$/)).toBeVisible();
  });

  test("should navigate back to workflows list via back link", async ({
    page,
  }) => {
    /* Back arrow is the first link in the toolbar */
    const backLink = page.locator("a[href='/workflows']").first();
    await backLink.click();

    await expect(page).toHaveURL(/\/workflows$/, { timeout: 10_000 });
  });

  test("should show canvas with block count", async ({ page }) => {
    await expect(page.getByText("Workflow Canvas")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/\d+ blocks loaded/)).toBeVisible();
    await expect(
      page.getByText("Drag blocks from the palette to get started"),
    ).toBeVisible();
  });

  test("should toggle AI assistant panel", async ({ page }) => {
    /* AI button in toolbar */
    const aiButton = page.getByRole("button", { name: /AI/ });
    await expect(aiButton).toBeVisible({ timeout: 10_000 });

    /* Open AI panel */
    await aiButton.click();

    /* Panel expands to 400px width */
    const panel = page.locator(".w-\\[400px\\]");
    await expect(panel).toBeVisible({ timeout: 3_000 });

    /* Close AI panel */
    await aiButton.click();
    await expect(panel).not.toBeVisible({ timeout: 3_000 });
  });

  test("should trigger test run and navigate to run page", async ({
    page,
  }) => {
    const testRunButton = page.getByRole("button", { name: /Test Run/ });
    await expect(testRunButton).toBeVisible({ timeout: 10_000 });

    await testRunButton.click();

    /* Should navigate to a run detail page */
    await expect(page).toHaveURL(/\/runs\/[a-zA-Z0-9_-]+/, {
      timeout: 15_000,
    });
  });

  test("should save via Cmd+S and show toast", async ({ page }) => {
    /* Wait for page to fully load */
    await expect(page.getByText("Save")).toBeVisible({ timeout: 10_000 });

    /* Trigger Cmd+S (Meta+S on Mac, Ctrl+S elsewhere) */
    await page.keyboard.press("Meta+s");

    /* Auto-save fires after 2s debounce */
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/saved/i, { timeout: 5_000 });
  });

  test("should have undo and redo buttons disabled initially", async ({
    page,
  }) => {
    const undoButton = page.locator('button[title="Undo (Cmd+Z)"]');
    const redoButton = page.locator('button[title="Redo (Cmd+Shift+Z)"]');

    await expect(undoButton).toBeVisible({ timeout: 10_000 });
    await expect(undoButton).toBeDisabled();

    await expect(redoButton).toBeVisible();
    await expect(redoButton).toBeDisabled();
  });
});
