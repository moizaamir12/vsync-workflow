import { test as setup, expect } from "@playwright/test";
import { TEST_USER } from "../fixtures/test-data.js";

/**
 * Authenticates the test user via the browser login flow and
 * persists the session cookies as `storageState` so all other
 * test projects can skip re-logging in.
 */
setup("authenticate test user", async ({ page }) => {
  /* ── Navigate to login ──────────────────────────── */
  await page.goto("/login");

  /* ── Fill credentials ───────────────────────────── */
  await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
  await page.getByPlaceholder("Enter your password").fill(TEST_USER.password);

  /* ── Submit ─────────────────────────────────────── */
  await page.getByRole("button", { name: "Sign in" }).click();

  /* ── Wait for redirect away from /login ─────────── */
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  /* ── Handle org selection if needed ─────────────── */
  if (page.url().includes("/select-org")) {
    /* Wait for the page to load orgs */
    await page.waitForLoadState("networkidle");

    /* Try to select the seeded Test Org */
    const orgButton = page.getByText(TEST_USER.name).or(
      page.getByText("Test Org"),
    );

    if (await orgButton.isVisible({ timeout: 5_000 })) {
      await orgButton.click();
    } else {
      /* Create a new org through the UI */
      await page
        .getByRole("button", { name: /create new organization/i })
        .click();
      await page.getByPlaceholder("My Organization").fill("Test Org");
      await page
        .getByRole("button", { name: /create & continue/i })
        .click();
    }

    /* Wait for redirect to dashboard */
    await expect(page).not.toHaveURL(/\/select-org/, { timeout: 10_000 });
  }

  /* ── Verify session cookie ──────────────────────── */
  const cookies = await page.context().cookies();
  const hasSession = cookies.some(
    (c) =>
      c.name === "session_token" ||
      c.name === "better-auth.session_token",
  );
  expect(hasSession).toBe(true);

  /* ── Save auth state for other projects ─────────── */
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
