import { expect, test } from "@playwright/test";

test("requires private access before opening training", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See the note/i })).toBeVisible();
  await page.getByRole("link", { name: /Start training/i }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/train");
  await expect(page.getByRole("heading", { name: /Private access/i })).toBeVisible();
  await expect(page.getByText(/Supabase is not configured/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Log in/i })).toBeDisabled();
});

test("public sign-up is disabled", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/login\?error=invite-only/);
  await expect(page.getByText(/Public sign-up is disabled/i)).toBeVisible();
});
