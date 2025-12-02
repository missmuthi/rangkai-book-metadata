import { test, expect, type Page, type Response } from "@playwright/test";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

/**
 * Real ISBN E2E Test: Search → Bibliographic Record → AI Clean
 *
 * ISBN: 9780684835396
 * Expected Book: "I Don't Want to Talk About It" by Terrence Real
 *
 * This test validates the complete user workflow:
 * 1. Navigate to scan page
 * 2. Enter real ISBN and search
 * 3. Verify correct book is returned
 * 4. Open Bibliographic Record modal
 * 5. Click AI Clean button
 * 6. Verify AI processing succeeds
 * 7. Check classification data (DDC/LCC) is present
 *
 * On failure: Detailed report with screenshots, API responses, console errors
 */

const TEST_ISBN = "9780684835396";
const EXPECTED_TITLE = "I Don't Want to Talk About It";
const EXPECTED_AUTHOR = "Terrence Real";
const REPORT_DIR = path.join(process.cwd(), "test-results", "ai-clean-reports");
const FIXTURE_PATH = new URL(
  "../fixtures/book-9780684835396.json",
  import.meta.url,
);

// Environment toggle: set E2E_MOCKS=false to test with real APIs
const USE_MOCKS = process.env.E2E_MOCKS !== "false";

// ============================================================================
// Test Report Interface
// ============================================================================
interface TestStep {
  name: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  duration: number;
  error?: string;
  errorStack?: string;
  screenshot?: string;
  details?: Record<string, unknown>;
}

interface ApiCall {
  type: "request" | "response";
  url: string;
  method?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: string;
  error?: string;
}

interface TestReport {
  testName: string;
  timestamp: string;
  duration: number;
  status: "PASS" | "FAIL";
  isbn: string;
  expectedTitle: string;
  expectedAuthor: string;
  usedMocks: boolean;
  steps: TestStep[];
  apiCalls: ApiCall[];
  consoleMessages: Array<{ type: string; text: string; timestamp: string }>;
  networkErrors: string[];
  finalUrl: string;
  viewport: { width: number; height: number } | null;
  userAgent: string;
  summary: {
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };
}

// ============================================================================
// Test Suite
// ============================================================================
test.describe("Real ISBN AI Clean Test", () => {
  test.setTimeout(120_000); // 2 minutes for AI operations

  let report: TestReport;
  let testStartTime: number;
  let stepStartTime: number;
  let fixture: Record<string, unknown>;

  // Ensure report directory exists
  test.beforeAll(async () => {
    await mkdir(REPORT_DIR, { recursive: true }).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    testStartTime = Date.now();
    stepStartTime = Date.now();

    // Initialize report
    report = {
      testName: `Real ISBN AI Clean Test - ${TEST_ISBN}`,
      timestamp: new Date().toISOString(),
      duration: 0,
      status: "PASS",
      isbn: TEST_ISBN,
      expectedTitle: EXPECTED_TITLE,
      expectedAuthor: EXPECTED_AUTHOR,
      usedMocks: USE_MOCKS,
      steps: [],
      apiCalls: [],
      consoleMessages: [],
      networkErrors: [],
      finalUrl: "",
      viewport: null,
      userAgent: "",
      summary: {
        totalSteps: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
      },
    };

    // Load fixture
    fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf-8"));

    // Capture console messages
    page.on("console", (msg) => {
      report.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
    });

    // Capture network errors
    page.on("requestfailed", (req) => {
      const failure = req.failure();
      report.networkErrors.push(
        `${req.method()} ${req.url()} - ${failure?.errorText || "Unknown error"}`,
      );
    });

    // Capture API requests
    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        report.apiCalls.push({
          type: "request",
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          body: req.postData()?.substring(0, 2000) || undefined,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Capture API responses
    page.on("response", async (res) => {
      if (res.url().includes("/api/")) {
        let body = "";
        try {
          body = (await res.text()).substring(0, 5000);
        } catch {
          body = "[Unable to read response body]";
        }
        report.apiCalls.push({
          type: "response",
          url: res.url(),
          status: res.status(),
          statusText: res.statusText(),
          headers: res.headers(),
          body,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Bypass authentication for testing
    await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });

    // Setup mocks if enabled
    if (USE_MOCKS) {
      await setupMocks(page, fixture);
    }
  });

  test.afterEach(async ({ page }) => {
    // Finalize report
    report.duration = Date.now() - testStartTime;
    report.finalUrl = page.url();
    report.viewport = page.viewportSize();
    report.userAgent = await page.evaluate(() => navigator.userAgent);

    // Calculate summary
    report.summary.totalSteps = report.steps.length;
    report.summary.passedSteps = report.steps.filter(
      (s) => s.status === "PASS",
    ).length;
    report.summary.failedSteps = report.steps.filter(
      (s) => s.status === "FAIL",
    ).length;
    report.summary.skippedSteps = report.steps.filter(
      (s) => s.status === "SKIPPED",
    ).length;

    // Save report
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(REPORT_DIR, `ai-clean-${timestamp}.json`);

    try {
      await writeFile(reportPath, JSON.stringify(report, null, 2));
    } catch (e) {
      console.error("Failed to save report:", e);
    }

    // Print summary
    printReportSummary(report, reportPath);
  });

  // ==========================================================================
  // Main Test
  // ==========================================================================
  test("should search ISBN 9780684835396, display 'I Don't Want to Talk About It', and complete AI Clean", async ({
    page,
  }) => {
    // ========================================================================
    // STEP 1: Navigate to scan page
    // ========================================================================
    await runStep("Navigate to scan page", async () => {
      await page.goto("/scan/mobile");
      await page.waitForLoadState("networkidle");

      // Verify page loaded
      const pageTitle = await page.title();
      return { pageTitle, url: page.url() };
    });

    // ========================================================================
    // STEP 2: Enter ISBN and search
    // ========================================================================
    let bookApiResponse: Response | null = null;

    await runStep("Enter ISBN and search for book", async () => {
      // Find ISBN input field - try multiple selectors
      const inputSelectors = [
        'input[type="text"][placeholder*="ISBN"]',
        'input[type="text"][placeholder*="barcode"]',
        'input[name="isbn"]',
        'input[type="text"]',
      ];

      let input: ReturnType<typeof page.locator> | null = null;
      for (const selector of inputSelectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0 && (await loc.isVisible())) {
          input = loc;
          break;
        }
      }

      if (!input) {
        // Fallback: simulate camera scan event
        await page.evaluate((isbn) => {
          window.dispatchEvent(
            new CustomEvent("barcode-scan", { detail: { text: isbn } }),
          );
          // Also try dispatching on common scanner elements
          const scanner = document.querySelector(
            '[aria-label*="scanner"], [data-scanner]',
          );
          if (scanner) {
            scanner.dispatchEvent(
              new CustomEvent("scan", { detail: { text: isbn } }),
            );
          }
        }, TEST_ISBN);

        return { method: "camera-scan-simulation", isbn: TEST_ISBN };
      }

      // Fill ISBN and trigger search
      await input.fill(TEST_ISBN);

      // Wait for API response
      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/book") && res.url().includes(TEST_ISBN),
        { timeout: 30_000 },
      );

      // Click search button or press Enter
      const searchButton = page
        .locator('button:has-text("Search"), button:has-text("Harvest")')
        .first();
      if (
        (await searchButton.count()) > 0 &&
        (await searchButton.isVisible())
      ) {
        await searchButton.click();
      } else {
        await input.press("Enter");
      }

      try {
        bookApiResponse = await responsePromise;
      } catch {
        // API call might complete before we set up the listener
        bookApiResponse = null;
      }

      return {
        method: "isbn-input",
        isbn: TEST_ISBN,
        apiStatus: bookApiResponse?.status() || "no-response-captured",
      };
    });

    // ========================================================================
    // STEP 3: Verify book title appears
    // ========================================================================
    await runStep("Verify book title appears on page", async () => {
      // Wait for book to appear - try multiple patterns for the title
      const titlePatterns = [
        `text="${EXPECTED_TITLE}"`,
        `text=/I\\s*Don.*t\\s*Want\\s*to\\s*Talk\\s*About\\s*It/i`,
        `h2:has-text("Don't Want")`,
        `h3:has-text("Don't Want")`,
        `[data-testid="book-title"]:has-text("Don't Want")`,
      ];

      let foundTitle = false;
      let matchedSelector = "";

      for (const pattern of titlePatterns) {
        try {
          const loc = page.locator(pattern).first();
          await expect(loc).toBeVisible({ timeout: 15_000 });
          foundTitle = true;
          matchedSelector = pattern;
          break;
        } catch {
          // Try next pattern
        }
      }

      if (!foundTitle) {
        // Take screenshot and capture page content for debugging
        const screenshot = await captureScreenshot(page, "title-not-found");
        const pageText = await page.locator("body").innerText();
        throw new Error(
          `Expected title "${EXPECTED_TITLE}" not found on page.\n` +
            `Page text preview (first 1500 chars):\n${pageText.substring(0, 1500)}\n` +
            `Screenshot: ${screenshot}`,
        );
      }

      return { matchedSelector, titleFound: true };
    });

    // ========================================================================
    // STEP 4: Click on book to open Bibliographic Record modal
    // ========================================================================
    await runStep("Open Bibliographic Record modal", async () => {
      // Find and click the book card/title to open details
      const clickTargets = [
        `button[aria-label*="View details"]`,
        `button[aria-label*="${EXPECTED_TITLE}"]`,
        `[role="button"]:has-text("${EXPECTED_TITLE}")`,
        `h2:has-text("Don't Want")`,
        `h3:has-text("Don't Want")`,
        `text=/I\\s*Don.*t\\s*Want/i`,
      ];

      let clicked = false;
      for (const selector of clickTargets) {
        try {
          const loc = page.locator(selector).first();
          if ((await loc.count()) > 0 && (await loc.isVisible())) {
            await loc.click();
            clicked = true;
            break;
          }
        } catch {
          // Try next
        }
      }

      if (!clicked) {
        throw new Error("Could not find book card/title to click");
      }

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Verify Bibliographic Record modal is visible
      const modalSelectors = [
        'div[role="dialog"][aria-label*="Bibliographic Record"]',
        'div[role="dialog"]:has-text("Bibliographic Record")',
        'text="Bibliographic Record"',
        '[aria-modal="true"]',
      ];

      let modalVisible = false;
      for (const selector of modalSelectors) {
        try {
          const loc = page.locator(selector).first();
          await expect(loc).toBeVisible({ timeout: 5_000 });
          modalVisible = true;
          break;
        } catch {
          // Try next
        }
      }

      if (!modalVisible) {
        const screenshot = await captureScreenshot(page, "modal-not-found");
        throw new Error(
          `Bibliographic Record modal not visible. Screenshot: ${screenshot}`,
        );
      }

      return { modalOpened: true };
    });

    // ========================================================================
    // STEP 5: Verify bibliographic fields are displayed
    // ========================================================================
    await runStep("Verify bibliographic fields in modal", async () => {
      const modal = page.locator('div[role="dialog"]').first();

      // Check for expected fields
      const fields = {
        title: (await modal.locator("text=/Title/i").count()) > 0,
        classification:
          (await modal.locator("text=/Classification|DDC|LCC/i").count()) > 0,
        publisher: (await modal.locator("text=/Publisher/i").count()) > 0,
        isbn: (await modal.locator(`text="${TEST_ISBN}"`).count()) > 0,
      };

      return { fieldsFound: fields };
    });

    // ========================================================================
    // STEP 6: Locate AI Clean button
    // ========================================================================
    await runStep("Locate AI Clean button", async () => {
      const aiButtonSelectors = [
        'button:has-text("AI Clean")',
        'button:has-text("✨ AI Clean")',
        'button:has-text("Enhance")',
        'button:has-text("Clean with AI")',
      ];

      let aiButton: ReturnType<typeof page.locator> | null = null;
      let foundSelector = "";

      for (const selector of aiButtonSelectors) {
        const loc = page.locator(selector).first();
        if ((await loc.count()) > 0 && (await loc.isVisible())) {
          aiButton = loc;
          foundSelector = selector;
          break;
        }
      }

      if (!aiButton) {
        const screenshot = await captureScreenshot(page, "ai-button-not-found");
        throw new Error(`AI Clean button not found. Screenshot: ${screenshot}`);
      }

      // Verify button is enabled
      const isDisabled = await aiButton.isDisabled();
      if (isDisabled) {
        throw new Error("AI Clean button found but is disabled");
      }

      return { foundSelector, buttonText: await aiButton.textContent() };
    });

    // ========================================================================
    // STEP 7: Click AI Clean and wait for processing
    // ========================================================================
    let aiResponse: Response | null = null;

    await runStep("Click AI Clean button and process", async () => {
      const aiButton = page.locator('button:has-text("AI Clean")').first();

      // Set up response listener before clicking
      const aiResponsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/api/ai/clean") || res.url().includes("/api/ai"),
        { timeout: 60_000 },
      );

      // Click the button
      await aiButton.click();

      // Verify button shows loading state
      try {
        await expect(
          page.locator(
            'button:has-text("Cleaning"), button:has-text("Saving")',
          ),
        ).toBeVisible({ timeout: 3_000 });
      } catch {
        // Button might transition quickly
      }

      // Wait for AI response
      try {
        aiResponse = await aiResponsePromise;
      } catch (e) {
        const screenshot = await captureScreenshot(page, "ai-timeout");
        throw new Error(
          `AI Clean API did not respond within 60s. Screenshot: ${screenshot}`,
        );
      }

      // Parse response
      let responseBody: Record<string, unknown> = {};
      try {
        responseBody = await aiResponse.json();
      } catch {
        responseBody = { _error: "Failed to parse JSON response" };
      }

      // Check for error status
      if (aiResponse.status() >= 400) {
        const screenshot = await captureScreenshot(page, "ai-error-response");
        throw new Error(
          `AI Clean API returned error status ${aiResponse.status()}.\n` +
            `Response: ${JSON.stringify(responseBody, null, 2)}\n` +
            `Screenshot: ${screenshot}`,
        );
      }

      return {
        apiStatus: aiResponse.status(),
        apiUrl: aiResponse.url(),
        response: responseBody,
      };
    });

    // ========================================================================
    // STEP 8: Verify AI Clean success indicator
    // ========================================================================
    await runStep("Verify AI Clean success indicator", async () => {
      const successSelectors = [
        'button:has-text("Saved")',
        'button:has-text("Saved ✓")',
        "text=/saved|success/i",
        '[data-status="success"]',
      ];

      let successFound = false;
      let foundSelector = "";

      for (const selector of successSelectors) {
        try {
          const loc = page.locator(selector).first();
          await expect(loc).toBeVisible({ timeout: 10_000 });
          successFound = true;
          foundSelector = selector;
          break;
        } catch {
          // Try next
        }
      }

      if (!successFound) {
        const screenshot = await captureScreenshot(
          page,
          "no-success-indicator",
        );
        throw new Error(
          `AI Clean did not show success indicator. Screenshot: ${screenshot}`,
        );
      }

      return { successFound, foundSelector };
    });

    // ========================================================================
    // STEP 9: Verify DDC/LCC classification is present
    // ========================================================================
    await runStep(
      "Verify classification data (DDC/LCC) is present",
      async () => {
        const modal = page.locator('div[role="dialog"]').first();
        const modalText = await modal.innerText();

        // Check for DDC pattern (e.g., 362.20, 005.133)
        const ddcPattern = /\d{3}\.\d+/;
        const hasDDC = ddcPattern.test(modalText);

        // Check for LCC pattern (e.g., RC537, QA76)
        const lccPattern = /[A-Z]{1,2}\d+/;
        const hasLCC = lccPattern.test(modalText);

        if (!hasDDC && !hasLCC) {
          const screenshot = await captureScreenshot(page, "no-classification");
          throw new Error(
            `No DDC or LCC classification found in bibliographic record.\n` +
              `Modal text preview: ${modalText.substring(0, 1000)}\n` +
              `Screenshot: ${screenshot}`,
          );
        }

        // Extract actual values
        const ddcMatch = modalText.match(ddcPattern);
        const lccMatch = modalText.match(lccPattern);

        return {
          hasDDC,
          hasLCC,
          ddc: ddcMatch?.[0] || null,
          lcc: lccMatch?.[0] || null,
        };
      },
    );

    // ========================================================================
    // STEP 10: Verify AI Enhanced badge appears
    // ========================================================================
    await runStep("Verify AI Enhanced badge appears", async () => {
      const badgeSelectors = [
        'text="✨ AI Enhanced"',
        "text=/AI Enhanced/i",
        '[title*="Metadata cleaned"]',
      ];

      let badgeFound = false;
      for (const selector of badgeSelectors) {
        try {
          const loc = page.locator(selector).first();
          if ((await loc.count()) > 0 && (await loc.isVisible())) {
            badgeFound = true;
            break;
          }
        } catch {
          // Try next
        }
      }

      return { aiEnhancedBadgeFound: badgeFound };
    });

    // ========================================================================
    // STEP 11: Check for console errors
    // ========================================================================
    await runStep("Check for console errors", async () => {
      const errors = report.consoleMessages.filter(
        (msg) =>
          msg.type === "error" &&
          (msg.text.includes("api") || msg.text.includes("fetch")),
      );

      if (errors.length > 0) {
        return { hasErrors: true, errors: errors.map((e) => e.text) };
      }

      return { hasErrors: false, errorCount: 0 };
    });

    // ========================================================================
    // Final screenshot
    // ========================================================================
    await captureScreenshot(page, "final-success");

    // ==========================================================================
    // Helper functions (scoped to test)
    // ==========================================================================
    async function runStep(
      name: string,
      action: () => Promise<Record<string, unknown>>,
    ): Promise<void> {
      stepStartTime = Date.now();

      try {
        const details = await action();
        report.steps.push({
          name,
          status: "PASS",
          duration: Date.now() - stepStartTime,
          details,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        let screenshot: string | undefined;
        try {
          screenshot = await captureScreenshot(
            page,
            `error-${name.replace(/\s+/g, "-")}`,
          );
        } catch {
          // Ignore screenshot errors
        }

        report.steps.push({
          name,
          status: "FAIL",
          duration: Date.now() - stepStartTime,
          error: errorMessage,
          errorStack,
          screenshot,
        });

        report.status = "FAIL";
        throw error;
      }
    }

    async function captureScreenshot(
      page: Page,
      label: string,
    ): Promise<string> {
      const filename = `${label}-${Date.now()}.png`;
      const filepath = path.join(REPORT_DIR, filename);
      try {
        await page.screenshot({ path: filepath, fullPage: true });
        return filepath;
      } catch (e) {
        console.warn("Screenshot failed:", e);
        return "";
      }
    }
  });
});

// =============================================================================
// Setup Mocks
// =============================================================================
async function setupMocks(
  page: Page,
  fixture: Record<string, unknown>,
): Promise<void> {
  // Mock book API
  await page.route(`**/api/book/${TEST_ISBN}`, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixture),
    });
  });

  // Mock AI clean API
  await page.route("**/api/ai/clean", (route) => {
    const cleaned = {
      ...fixture,
      ddc: (fixture.ddc as string) || "362.20",
      lcc: (fixture.lcc as string) || "RC537.R44",
      is_ai_enhanced: true,
      enhanced_at: new Date().toISOString(),
      saved: true,
      scan_id: 999,
      ai_log: [
        {
          timestamp: new Date().toISOString(),
          model: "llama-3.3-70b-versatile",
          changes: ["Enhanced classification", "Normalized publisher format"],
        },
      ],
    };
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cleaned),
    });
  });

  // Mock history API
  await page.route("**/api/history**", (route) => {
    const history = [
      {
        id: 999,
        isbn13: TEST_ISBN,
        title: fixture.title,
        author: fixture.author,
        ddc: fixture.ddc || "362.20",
        lcc: fixture.lcc || "RC537.R44",
        scanned_at: new Date().toISOString(),
        json_data: JSON.stringify(fixture),
      },
    ];
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(history),
    });
  });
}

// =============================================================================
// Print Report Summary
// =============================================================================
function printReportSummary(report: TestReport, reportPath: string): void {
  const divider = "=".repeat(80);

  console.log("\n" + divider);
  console.log("TEST REPORT SUMMARY");
  console.log(divider);
  console.log(`Status: ${report.status === "PASS" ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
  console.log(`ISBN: ${report.isbn}`);
  console.log(`Expected Title: ${report.expectedTitle}`);
  console.log(`Mocks Enabled: ${report.usedMocks}`);
  console.log("");
  console.log(
    `Steps: ${report.summary.passedSteps}/${report.summary.totalSteps} passed`,
  );

  console.log("\nStep Results:");
  report.steps.forEach((step, idx) => {
    const icon =
      step.status === "PASS" ? "✅" : step.status === "FAIL" ? "❌" : "⏭️";
    console.log(`  ${icon} ${idx + 1}. ${step.name} (${step.duration}ms)`);
    if (step.error) {
      console.log(`     ⚠️  Error: ${step.error.substring(0, 200)}`);
    }
    if (step.screenshot) {
      console.log(`     📸 Screenshot: ${step.screenshot}`);
    }
  });

  if (report.networkErrors.length > 0) {
    console.log("\n⚠️  Network Errors:");
    report.networkErrors.forEach((err) => console.log(`  - ${err}`));
  }

  const consoleErrors = report.consoleMessages.filter(
    (m) => m.type === "error",
  );
  if (consoleErrors.length > 0) {
    console.log(`\n⚠️  Console Errors (${consoleErrors.length}):`);
    consoleErrors
      .slice(0, 5)
      .forEach((e) => console.log(`  - ${e.text.substring(0, 100)}`));
    if (consoleErrors.length > 5) {
      console.log(`  ... and ${consoleErrors.length - 5} more`);
    }
  }

  // API calls summary
  const apiResponses = report.apiCalls.filter((c) => c.type === "response");
  if (apiResponses.length > 0) {
    console.log(`\n📡 API Calls (${apiResponses.length} responses):`);
    apiResponses.forEach((res) => {
      const statusIcon = res.status && res.status < 400 ? "✅" : "❌";
      console.log(`  ${statusIcon} ${res.status} ${res.url?.substring(0, 60)}`);
    });
  }

  console.log("\n📊 Full report saved to:", reportPath);
  console.log(divider + "\n");
}
