import { test, expect } from "@playwright/test";
import { readFile } from "fs/promises";

const FIXTURE_PATH = new URL(
  "../fixtures/book-9780132350884.json",
  import.meta.url,
);

/**
 * E2E Test: Login → Scan → AI Clean → Confirm History
 *
 * This test validates the complete workflow using network mocking.
 * For full database-backed tests, see complete-workflow.spec.ts
 *
 * NOTE: This test uses network mocking and may not fully represent
 * real application behavior. Use for UI validation only.
 */
test.describe("Login → Scan → AI Clean → History (Mocked)", () => {
  // Skip these tests as they require more complex setup
  // See complete-workflow.spec.ts for the proper E2E tests
  test.skip("Login → scan → AI clean → confirm history", async ({ page }) => {
    const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf-8"));
    let scanSaved = false;

    // Track API calls to detect duplication issues
    const apiCalls = { book: 0, aiClean: 0, history: 0, saveScans: 0 };

    // Set test session header for authentication bypass
    await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });

    // Mock all API endpoints to avoid database dependencies

    // 1. Book metadata API
    await page.route("**/api/book/**", (route) => {
      apiCalls.book++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...fixture, scan_id: scanSaved ? 101 : null }),
      });
    });

    // 2. Save scan endpoint
    await page.route("**/api/scans", async (route) => {
      const method = route.request().method();
      if (method === "POST") {
        apiCalls.saveScans++;
        scanSaved = true;
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, scan_id: 101 }),
        });
      } else {
        route.continue();
      }
    });

    // 3. AI clean endpoint
    await page.route("**/api/ai/clean", async (route) => {
      apiCalls.aiClean++;
      const cleaned = {
        ...fixture,
        ddc: "005.133",
        lcc: "QA76.73.J38",
        saved: true,
        scan_id: 101,
      };
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(cleaned),
      });
    });

    // 4. History endpoint
    await page.route("**/api/history**", (route) => {
      apiCalls.history++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          scanSaved
            ? [
                {
                  id: 101,
                  isbn13: "9780132350884",
                  title: "Clean Code",
                  author: "Robert C. Martin",
                  ddc: "005.133",
                  lcc: "QA76.73.J38",
                  scanned_at: new Date().toISOString(),
                },
              ]
            : [],
        ),
      });
    });

    // STEP 1: Navigate to home page (implicit login via test session)
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify the scan form is visible (confirms we can access the app)
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();

    // STEP 2: Scan a book - enter ISBN and search
    await input.fill("9780132350884");
    await page
      .locator('button:has-text("Harvest"), button:has-text("Search")')
      .first()
      .click();

    // Wait for search results
    await page.waitForTimeout(1000); // Allow API call to complete

    // Verify book appears in results (may be in a card or list)
    const bookTitle = page.locator('text="Clean Code"').first();
    await expect(bookTitle).toBeVisible({ timeout: 10000 });

    // STEP 3: Open book details and click AI Clean
    // The book detail modal might open automatically or need a click
    const titleClickable = page
      .locator('h2:has-text("Clean Code"), h3:has-text("Clean Code")')
      .first();
    if (await titleClickable.isVisible()) {
      await titleClickable.click();
      await page.waitForTimeout(500);
    }

    // Look for AI Clean button (might be "AI Clean" or similar)
    const aiButton = page
      .locator("button")
      .filter({ hasText: /AI Clean|Enhance/i })
      .first();

    if (await aiButton.isVisible({ timeout: 3000 })) {
      await aiButton.click();

      // Wait for AI processing
      await page.waitForTimeout(1500);

      // Verify success indication (button text changes to "Saved" or shows checkmark)
      const savedIndicator = page
        .locator('button:has-text("Saved"), button:has-text("✓")')
        .first();
      await expect(savedIndicator).toBeVisible({ timeout: 5000 });

      // Verify AI clean was called
      expect(apiCalls.aiClean).toBeGreaterThan(0);
    }

    // STEP 4: Navigate to history page
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    // Verify history page loaded
    await expect(
      page
        .locator("h1, h2")
        .filter({ hasText: /History|Scans/i })
        .first(),
    ).toBeVisible();

    // Verify the scanned book appears in history (no blank state)
    const historyEntry = page.locator('text="Clean Code"').first();
    await expect(historyEntry).toBeVisible({ timeout: 5000 });

    // Verify no data duplication - count how many times "Clean Code" appears in table rows
    const tableRows = page.locator("tr").filter({ hasText: "Clean Code" });
    const count = await tableRows.count();
    expect(count).toBeLessThanOrEqual(1);

    // Log API call summary for debugging
    console.warn("API Call Summary:", apiCalls);
  });

  test.skip("History shows scans immediately without refresh", async ({
    page,
  }) => {
    const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf-8"));

    await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });

    let scanCount = 0;

    await page.route("**/api/book/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixture),
      });
    });

    await page.route("**/api/scans", (route) => {
      if (route.request().method() === "POST") {
        scanCount++;
        route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
      } else {
        route.continue();
      }
    });

    await page.route("**/api/history**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          scanCount > 0
            ? [
                {
                  id: 102,
                  isbn13: "9780132350884",
                  title: "Clean Code",
                  author: "Robert C. Martin",
                  scanned_at: new Date().toISOString(),
                },
              ]
            : [],
        ),
      });
    });

    // Scan a book
    await page.goto("/");
    const input = page.locator('input[type="text"]').first();
    await input.fill("9780132350884");
    await page
      .locator("button")
      .filter({ hasText: /Harvest|Search/i })
      .first()
      .click();
    await page.waitForTimeout(1000);

    // Navigate to history - should show scan immediately
    await page.goto("/history");
    await page.waitForLoadState("networkidle");

    // Verify scan appears (not blank)
    await expect(page.locator('text="Clean Code"').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify no "empty state" message
    await expect(
      page.locator("text=/No (scans|results|data)/i").first(),
    ).not.toBeVisible();
  });
});
