import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3107",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 3107",
    url: "http://127.0.0.1:3107",
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
