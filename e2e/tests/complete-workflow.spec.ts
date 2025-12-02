import { test, expect } from "@playwright/test";

/**
 * Complete E2E Workflow Test: Login → Scan → AI Clean → Confirm History
 *
 * This test validates the full user journey through the application:
 * 1. User authentication (login)
 * 2. Scanning a book by ISBN
 * 3. Using AI to clean/enhance metadata (DDC/LCC classification)
 * 4. Verifying the scanned book appears in history with cleaned data
 *
 * KNOWN ISSUES THIS TEST VALIDATES:
 * - After login, user should NOT need to refresh browser to see login status
 * - After clicking AI clean, changes MUST appear in history
 * - After AI clean, data should NOT become blank or duplicated
 * - After scan, clicking history should NOT show blank - data must appear immediately
 *
 * NOTE: This test requires a test database to run successfully.
 * Currently skipped in CI/preview mode. Run locally with test database.
 */

test.describe("Complete Workflow: Login → Scan → AI Clean → History", () => {
  test.skip(({ _browserName }) => {
    // Skip if no database is available
    return !process.env.TEST_DATABASE_URL;
  }, "Requires test database");

  test("should complete full workflow without refresh issues", async ({
    page,
  }) => {
    // STEP 1: Login
    await page.goto("/login");

    // Fill login form (adjust selectors based on actual implementation)
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Verify login successful - should see user status WITHOUT refresh
    await expect(page).toHaveURL(/\/(dashboard|home|$)/);
    await expect(page.locator("text=/logged in|welcome|profile/i")).toBeVisible(
      {
        timeout: 5000,
      },
    );

    // STEP 2: Scan a book
    await page.goto("/");

    const isbnInput = page
      .locator('input[name="isbn"], input[placeholder*="ISBN"]')
      .first();
    await isbnInput.fill("9780132350884");

    const searchButton = page
      .locator('button:has-text("Harvest"), button:has-text("Search")')
      .first();
    await searchButton.click();

    // Wait for search results
    await expect(page.locator("text=/Clean Code|result/i")).toBeVisible({
      timeout: 10000,
    });

    // STEP 3: AI Clean
    // Click on the book to open details
    await page
      .locator('h2:has-text("Clean Code"), h3:has-text("Clean Code")')
      .first()
      .click();

    // Click AI Clean button
    const aiCleanButton = page
      .locator("button")
      .filter({ hasText: /AI Clean|Enhance/i });
    await expect(aiCleanButton).toBeVisible({ timeout: 5000 });
    await aiCleanButton.click();

    // Wait for AI processing to complete
    await expect(
      page.locator('button:has-text("Saved"), text=/saved|success/i'),
    ).toBeVisible({
      timeout: 15000, // AI processing may take time
    });

    // Verify cleaned metadata is visible (DDC/LCC should appear)
    await expect(page.locator("text=/005\\.133|QA76/i")).toBeVisible({
      timeout: 5000,
    });

    // STEP 4: Verify history shows the scanned book
    await page.goto("/history");

    // History should NOT be blank - should show scanned book immediately
    await expect(
      page.locator('h1:has-text("History"), h1:has-text("Scans")'),
    ).toBeVisible();
    await expect(page.locator('text="Clean Code"')).toBeVisible({
      timeout: 5000,
    });

    // Verify NO data duplication - should appear exactly once
    const historyRows = page.locator("tr").filter({ hasText: "Clean Code" });
    const rowCount = await historyRows.count();
    expect(rowCount).toBe(1);

    // Verify cleaned data appears in history (DDC/LCC from AI clean)
    await expect(page.locator("text=/005\\.133/").first()).toBeVisible();
    await expect(page.locator("text=/QA76/").first()).toBeVisible();

    // Click on history item to view details
    await historyRows.first().click();

    // Verify data is NOT blank in detail view
    await expect(page.locator('text="Clean Code"')).toBeVisible();
    await expect(
      page.locator("text=/Robert.*Martin|Martin.*Robert/i"),
    ).toBeVisible();
    await expect(page.locator('text="005.133"')).toBeVisible();
    await expect(page.locator('text="QA76.73.J38"')).toBeVisible();
  });

  test("should not require refresh after login", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Navigate to another page WITHOUT refreshing
    await page.goto("/");

    // User status should be visible immediately
    await expect(page.locator("text=/logged in|profile|account/i")).toBeVisible(
      { timeout: 5000 },
    );
  });

  test("should show history immediately after scan without refresh", async ({
    page,
  }) => {
    // Assume already logged in (via beforeEach or test setup)
    await page.goto("/");

    // Scan a book
    await page.locator('input[name="isbn"]').fill("9780132350884");
    await page
      .locator('button:has-text("Search"), button:has-text("Harvest")')
      .first()
      .click();
    await page.waitForTimeout(2000); // Wait for scan to process

    // Navigate to history WITHOUT refresh
    await page.goto("/history");

    // History should NOT be blank
    await expect(page.locator('text="Clean Code"')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=/no (scans|results)/i")).not.toBeVisible();
  });

  test("should not duplicate or blank data after AI clean", async ({
    page,
  }) => {
    await page.goto("/");

    // Scan a book
    await page.locator('input[name="isbn"]').fill("9780132350884");
    await page.locator('button:has-text("Search")').click();
    await page.locator('h2:has-text("Clean Code")').click();

    // Take snapshot of data before AI clean
    const titleBefore = await page.locator('text="Clean Code"').textContent();
    expect(titleBefore).toBeTruthy();

    // Click AI Clean
    await page.locator('button:has-text("AI Clean")').click();
    await page.waitForTimeout(3000);

    // Verify data is NOT blank after AI clean
    await expect(page.locator('text="Clean Code"')).toBeVisible();

    // Verify data is NOT duplicated
    const titleElements = page.locator(
      'h2:has-text("Clean Code"), h3:has-text("Clean Code")',
    );
    const count = await titleElements.count();
    expect(count).toBeLessThanOrEqual(2); // At most one in modal, one in background

    // Check history for duplication
    await page.goto("/history");
    const historyRows = page.locator('tr:has-text("Clean Code")');
    const historyCount = await historyRows.count();
    expect(historyCount).toBe(1); // Should appear exactly once
  });
});

/**
 * Lightweight smoke test that can run without database
 * Uses network mocking to validate UI behavior
 */
test.describe("UI Smoke Tests (No DB Required)", () => {
  test("search form is accessible and submittable", async ({ page }) => {
    await page.goto("/");

    // Verify search form exists
    const input = page
      .locator('input[type="text"], input[name="isbn"]')
      .first();
    await expect(input).toBeVisible();

    // Verify can type ISBN
    await input.fill("9780132350884");
    expect(await input.inputValue()).toBe("9780132350884");

    // Verify search button exists and is clickable
    const button = page
      .locator("button")
      .filter({ hasText: /search|harvest|scan/i })
      .first();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test("history page is accessible", async ({ page }) => {
    // Set test session to bypass auth
    await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });

    await page.goto("/history");

    // Should show history page (even if empty)
    await expect(
      page
        .locator("h1, h2")
        .filter({ hasText: /history|scans/i })
        .first(),
    ).toBeVisible();
  });
});
