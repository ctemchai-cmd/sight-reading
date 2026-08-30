import { expect, test } from "@playwright/test";

test("opens the Chrome-first training flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /See the note/i })).toBeVisible();
  await page.getByRole("link", { name: /Start training/i }).click();
  await expect(page.getByRole("heading", { name: /Choose what to practice/i })).toBeVisible();
  await page.getByRole("link", { name: /Reflex/i }).click();
  await expect(page.getByRole("heading", { name: /Configure your session/i })).toBeVisible();
  await page.getByRole("button", { name: /Start training/i }).click();
  await expect(page.getByLabel("Current treble-clef note")).toBeVisible();
  await expect(page.getByLabel("Virtual piano")).toBeVisible();
  await expect(page.getByRole("button", { name: /Connect MIDI/i })).toBeVisible();
});
