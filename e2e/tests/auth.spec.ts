import { test, expect } from "@playwright/test";
import { TEST_USER } from "../fixtures/test-data.js";

test.describe("Authentication", () => {
  /* Fresh context — no saved session cookies */
  test.use({ storageState: { cookies: [], origins: [] } });

  test("should show login page with all expected elements", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Sign in to your account" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(
      page.getByPlaceholder("Enter your password"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in" }),
    ).toBeVisible();
    await expect(page.getByText("Forgot password?")).toBeVisible();
    await expect(page.getByText("Google")).toBeVisible();
    await expect(page.getByText("Microsoft")).toBeVisible();
    await expect(page.getByText("Sign up")).toBeVisible();
  });

  test("should redirect unauthenticated users to /login", async ({
    page,
  }) => {
    await page.goto("/workflows");

    /* Middleware appends ?redirect=<original-path> */
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("should show validation error for invalid email", async ({
    page,
  }) => {
    await page.goto("/login");

    const emailInput = page.getByPlaceholder("you@example.com");
    await emailInput.fill("not-an-email");
    await emailInput.blur();

    /* Validator message from validators.ts line 8 */
    await expect(
      page.getByText("Please enter a valid email address"),
    ).toBeVisible({ timeout: 3_000 });
  });

  test("should sign in with valid credentials and redirect", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
    await page
      .getByPlaceholder("Enter your password")
      .fill(TEST_USER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    /* Should navigate away from login to dashboard or select-org */
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("should show error toast for wrong credentials", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByPlaceholder("you@example.com").fill("wrong@vsync.dev");
    await page
      .getByPlaceholder("Enter your password")
      .fill("wrongpassword123");
    await page.getByRole("button", { name: "Sign in" }).click();

    /* Sonner toast renders in [data-sonner-toaster] */
    await expect(
      page.locator("[data-sonner-toaster]"),
    ).toContainText(/failed|invalid|error/i, { timeout: 10_000 });
  });

  test("should navigate to signup page from login", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Sign up" }).click();

    await expect(page).toHaveURL(/\/signup/);
    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();
  });
});
