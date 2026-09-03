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

test("gates the coach page and refuses its API without a session", async ({ page, request }) => {
  await page.goto("/coach");
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/coach");

  // The page redirects, but the API must refuse in its own voice: a redirect
  // to /login is something fetch follows silently and reads back as HTML.
  const response = await request.post("/api/coach", {
    data: { messages: [{ role: "user", text: "what next?" }] },
  });
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
});

test("keeps Free Play behind private access", async ({ page }) => {
  await page.goto("/play");
  await expect(page).toHaveURL(/\/login/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/play");
});

test("offers a link preview a chat app can render", async ({ page, request }) => {
  await page.goto("/");
  const content = (property: string) =>
    page.locator(`meta[property="${property}"]`).getAttribute("content");

  expect(await content("og:title")).toBeTruthy();
  expect(await content("og:description")).toBeTruthy();
  // Chat apps resolve nothing themselves: a relative image is dropped and the
  // preview arrives as a bare link.
  const image = await content("og:image");
  expect(image).toMatch(/^https?:\/\/.+\/og\.png$/);
  expect(await content("og:image:width")).toBe("1200");
  expect(await content("og:image:height")).toBe("630");

  // The crawler reads the landing page unauthenticated, so it must not redirect.
  const landing = await request.get("/");
  expect(landing.status()).toBe(200);
  const preview = await request.get("/og.png");
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toContain("image/png");
});
