import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30000,
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "PLAYWRIGHT_PREVIEW=1 npm run build && PLAYWRIGHT_PREVIEW=1 npm run preview -- --port 5173",
    port: 5173,
    timeout: 120 * 1000,
    reuseExistingServer: false,
  },
});
