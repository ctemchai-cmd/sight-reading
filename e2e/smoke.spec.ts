import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("requires private access before opening training", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See the note/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "MIDI connection" }).click();
  await expect(page.getByRole("dialog", { name: "MIDI connection settings" })).toBeVisible();
  await page.getByRole("button", { name: "MIDI connection" }).click();
  if (testInfo.project.name === "mobile-landscape") {
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
  }
  await page.getByRole("link", { name: /Start training/i }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/train");
  await expect(page.getByRole("heading", { name: /Private access/i })).toBeVisible();
  await expect(page.getByText(/Supabase is not configured/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Log in/i })).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  if (testInfo.project.name === "mobile-landscape") {
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
  }
});

test("does not expose a public sign-up route", async ({ page }) => {
  const response = await page.goto("/signup");
  expect(response?.status()).toBe(404);
});
