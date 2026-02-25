import { test, expect } from "@playwright/test";
import { TEST_WORKFLOWS } from "../fixtures/test-data.js";

test.describe("Workflow List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/workflows");
    /* Wait for the list to load */
    await page.waitForLoadState("networkidle");
  });

  test("should display the workflow list page with seeded workflows", async ({
    page,
  }) => {
    await expect(
      page.getByPlaceholder("Search workflows..."),
    ).toBeVisible();

    /* Seeded workflows from global setup */
    await expect(
      page.getByText(TEST_WORKFLOWS.simpleFetch.name),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(TEST_WORKFLOWS.codeTest.name),
    ).toBeVisible();
  });

  test("should filter workflows by search", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search workflows...");
    await searchInput.fill("Simple");

    /* Only matching workflow visible */
    await expect(
      page.getByText(TEST_WORKFLOWS.simpleFetch.name),
    ).toBeVisible();
    await expect(
      page.getByText(TEST_WORKFLOWS.codeTest.name),
    ).not.toBeVisible();
  });

  test("should show empty state for no search results", async ({
    page,
  }) => {
    await page
      .getByPlaceholder("Search workflows...")
      .fill("nonexistent-xyz-123");

    await expect(
      page.getByText(/No workflows match your search/),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("should toggle between grid and list views", async ({ page }) => {
    /* The view toggle is a pair of icon buttons in a border container */
    const toggleGroup = page.locator(
      ".flex.rounded-md.border button",
    );

    /* Click list view (second button) */
    await toggleGroup.nth(1).click();

    const viewMode = await page.evaluate(() =>
      localStorage.getItem("vsync:workflows-view"),
    );
    expect(viewMode).toBe("list");

    /* Switch back to grid */
    await toggleGroup.nth(0).click();

    const gridMode = await page.evaluate(() =>
      localStorage.getItem("vsync:workflows-view"),
    );
    expect(gridMode).toBe("grid");
  });

  test("should create a new workflow via dialog", async ({ page }) => {
    await page.getByRole("button", { name: /New Workflow/ }).click();

    /* Dialog heading */
    await expect(
      page.getByRole("heading", { name: "New Workflow" }),
    ).toBeVisible();

    /* Fill name and create */
    await page.getByPlaceholder("My Workflow").fill("E2E Test Workflow");
    await page.getByRole("button", { name: /^Create$/ }).click();

    /* Navigates to builder */
    await expect(page).toHaveURL(/\/workflows\/[a-zA-Z0-9_-]+/, {
      timeout: 10_000,
    });
  });

  test("should duplicate a workflow via context menu", async ({ page }) => {
    await expect(
      page.getByText(TEST_WORKFLOWS.simpleFetch.name),
    ).toBeVisible({ timeout: 10_000 });

    /* Open the MoreVertical menu on the first workflow */
    const workflowCard = page
      .getByText(TEST_WORKFLOWS.simpleFetch.name)
      .locator("../..");
    await workflowCard.locator("button").last().click();

    /* Click Duplicate */
    await page.getByText("Duplicate").click();

    /* Toast confirmation */
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/duplicated/i, { timeout: 5_000 });
  });

  test("should delete a workflow via context menu", async ({ page }) => {
    /* First create a throwaway workflow */
    await page.getByRole("button", { name: /New Workflow/ }).click();
    await page.getByPlaceholder("My Workflow").fill("Delete Me Workflow");
    await page.getByRole("button", { name: /^Create$/ }).click();
    await expect(page).toHaveURL(/\/workflows\/[a-zA-Z0-9_-]+/);

    /* Go back to list */
    await page.goto("/workflows");
    await expect(page.getByText("Delete Me Workflow")).toBeVisible({
      timeout: 10_000,
    });

    /* Open context menu */
    const card = page.getByText("Delete Me Workflow").locator("../..");
    await card.locator("button").last().click();

    /* Delete */
    await page.getByText("Delete").click();

    /* Should disappear */
    await expect(page.getByText("Delete Me Workflow")).not.toBeVisible({
      timeout: 10_000,
    });
  });

  test("should disable and re-enable a workflow", async ({ page }) => {
    await expect(
      page.getByText(TEST_WORKFLOWS.codeTest.name),
    ).toBeVisible({ timeout: 10_000 });

    /* Open menu on Code Test workflow */
    const card = page
      .getByText(TEST_WORKFLOWS.codeTest.name)
      .locator("../..");
    await card.locator("button").last().click();

    /* Disable */
    await page.getByText(/^Disable$/).click();
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/disabled/i, { timeout: 5_000 });

    /* Re-open menu and enable */
    await card.locator("button").last().click();
    await page.getByText(/^Enable$/).click();
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/enabled/i, { timeout: 5_000 });
  });
});
