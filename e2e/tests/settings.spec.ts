import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should display all settings tabs", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible({ timeout: 10_000 });

    /* All 6 tab labels should be visible in the sidebar */
    await expect(page.getByText("General")).toBeVisible();
    await expect(page.getByText("Members")).toBeVisible();
    await expect(page.getByText("Auth")).toBeVisible();
    await expect(page.getByText("Keys")).toBeVisible();
    await expect(page.getByText("API Keys")).toBeVisible();
    await expect(page.getByText("Billing")).toBeVisible();
  });

  test("should edit organization name on General tab", async ({ page }) => {
    /* General tab is active by default — find the Org Name input */
    const orgNameInput = page.locator(
      "input[type='text']",
    ).first();

    await expect(orgNameInput).toBeVisible({ timeout: 10_000 });

    /* Store original value to revert */
    const originalValue = await orgNameInput.inputValue();

    /* Clear and type new name */
    await orgNameInput.fill("Updated Org Name");

    /* Click Save Changes */
    await page.getByRole("button", { name: /Save Changes/ }).click();

    /* Toast confirmation */
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/updated/i, { timeout: 5_000 });

    /* Revert to original name */
    await orgNameInput.fill(originalValue || "Test Org");
    await page.getByRole("button", { name: /Save Changes/ }).click();

    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/updated/i, { timeout: 5_000 });
  });

  test("should show invite member sheet on Members tab", async ({ page }) => {
    /* Click the Members tab */
    await page.getByText("Members").click();

    /* Wait for the Members content to load */
    await expect(
      page.getByRole("button", { name: /Invite Member/ }),
    ).toBeVisible({ timeout: 10_000 });

    /* Open the invite sheet */
    await page.getByRole("button", { name: /Invite Member/ }).click();

    /* The sheet should show an email input */
    await expect(
      page.getByPlaceholder("colleague@example.com"),
    ).toBeVisible({ timeout: 3_000 });
  });
});
