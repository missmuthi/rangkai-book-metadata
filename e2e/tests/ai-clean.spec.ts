import { test, expect } from "@playwright/test";
import { readFile } from "fs/promises";

const FIXTURE_PATH = new URL(
  "../fixtures/book-9780132350884.json",
  import.meta.url,
);

// Test the AI Clean button updates the UI and returns cleaned metadata
test("AI Clean updates metadata and shows saved state", async ({ page }) => {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf-8"));

  // Ensure all client-side requests include a test-session header so server sets a test-local session
  await page.setExtraHTTPHeaders({ 'x-playwright-test-session': '1' });
  // As a second fallback, set a cookie to indicate test session so server-side hooks can pick it up
  await page.context().addCookies([
    { name: 'test_session', value: '1', url: 'http://127.0.0.1:5173/' },
  ]);
  // Optional debugging: page.on('request', (r) => console.warn('REQ', r.method(), r.url(), 'HEADERS:', JSON.stringify(r.headers())));
  // As a fallback, patch window.fetch to always include the header in client-side fetch calls
  await page.evaluate(() => {
    const globalWindow = window as unknown as Window & { fetch: typeof fetch };
    const orig = globalWindow.fetch;
    globalWindow.fetch = (input: URL | RequestInfo, init?: RequestInit) => {
      init = init || {};
      const headers = new Headers(init.headers as HeadersInit || {});
      headers.set('x-playwright-test-session', '1');
      return orig(input, { ...init, headers });
    };
  });

  // Intercept GET book request to return deterministic data
  await page.route("**/api/book/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });

  // Mock AI Clean POST endpoint
  const cleanedResponse = {
    ...fixture,
    ddc: "005.133",
    lcc: "QA76.73.J38",
    aiWarning: undefined,
    saved: true,
    scan_id: 999,
  };

  await page.route("**/api/ai/clean", async (route) => {
    const request = route.request();
    const body = await request.postDataJSON();
    // Simple validation that request included ISBN/data
    if (!body || (!body.isbn && !body.isbn13 && !body.isbn10)) {
      route.fulfill({ status: 400, body: JSON.stringify({ error: "Missing isbn" }) });
      return;
    }

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cleanedResponse),
    });
  });

  // Use the public search page to avoid auth redirects for /scan/mobile
  await page.goto("/");
  await page.waitForLoadState('networkidle');
  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible();
  await input.fill('9780132350884');
  const harvestBtn = page.locator('button:has-text("Harvest")');
  await expect(harvestBtn).toBeVisible();
  await harvestBtn.click();
  await expect(page.locator('p.text-xl:has-text("Clean Code")')).toBeVisible({ timeout: 10000 });

  // Open detail modal by clicking the card's 'View details' button
  const viewDetailsBtn = page.locator('button[aria-label^="View details for"]');
  await expect(viewDetailsBtn).toBeVisible();
  await viewDetailsBtn.click();

  // Now the modal is open; AI Clean button text appears inside the modal
  const aiCleanBtn = page.locator('button', { hasText: 'AI Clean' });
  await expect(aiCleanBtn).toBeVisible();

  // Click AI Clean and wait for toast or the UI to reflect that the metadata was cleaned
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/ai/clean') && r.status() === 200),
    aiCleanBtn.click(),
  ]);

  // After response, check that the cleaned DDC/LCC values are visible in the UI
  await expect(page.locator('p.font-mono:has-text("005.133")')).toBeVisible();
  await expect(page.locator('p.font-mono:has-text("QA76.73.J38")')).toBeVisible();

  // Check success toast/message
  await expect(page.locator('text=Metadata cleaned by AI ✨')).toBeVisible();
});
