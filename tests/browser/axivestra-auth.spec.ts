import { test, expect } from "@playwright/test";
import { mockSupabaseApi, CI_USER, SUPABASE_CI_STORAGE_KEY } from "./auth-fixtures";

test("sign-in is required, the session survives reload, and another browser profile stays signed out", async ({ page, browser }) => {
  await mockSupabaseApi(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in securely" })).toBeVisible();

  await page.getByLabel("Email address").fill(CI_USER.email);
  await page.getByLabel("Password").fill("Test-Only-Password-123!");
  await page.getByRole("button", { name: "Sign in securely" }).click();

  const dashboardHeading = page.getByRole("heading", { name: /Understand assets, capital and exposure/i });
  await expect(dashboardHeading).toBeVisible();
  await expect.poll(() => page.evaluate(key => {
    const stored = window.localStorage.getItem(key);
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return parsed.user?.id === "6f85c1e4-6c7d-4b67-a889-4ca824a3fc10" && Boolean(parsed.refresh_token);
    } catch {
      return false;
    }
  }, SUPABASE_CI_STORAGE_KEY)).toBe(true);

  await page.reload();
  await expect(dashboardHeading).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toHaveCount(0);

  const isolatedContext = await browser.newContext();
  try {
    const isolatedPage = await isolatedContext.newPage();
    await mockSupabaseApi(isolatedPage);
    await isolatedPage.goto("/");
    await expect(isolatedPage.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  } finally {
    await isolatedContext.close();
  }
});
