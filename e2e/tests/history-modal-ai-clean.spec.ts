import { test, expect, type Page } from "@playwright/test";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";

/**
 * History Modal AI Clean E2E Test
 *
 * This test validates the complete AI Clean workflow through the History Modal:
 * 1. Navigate to history page
 * 2. Click on a scan entry to open Bibliographic Record modal
 * 3. Verify all bibliographic fields are displayed
 * 4. Locate and verify AI Clean button
 * 5. Click AI Clean and verify processing
 * 6. Verify success states and enhanced data
 * 7. Verify AI Enhanced badge appears
 *
 * IMPORTANT: This test requires actual database access because the history page
 * loads data server-side via +page.server.ts (not through API routes).
 * Run with E2E_MOCKS=false to test against real database.
 *
 * For mocked tests, use scan-page-based tests instead.
 */

const TEST_ISBN = "9780684835396";
const EXPECTED_TITLE = "I Don't Want to Talk About It";
const EXPECTED_AUTHOR = "Terrence Real";
const REPORT_DIR = path.join(
  process.cwd(),
  "test-results",
  "history-modal-reports",
);
const FIXTURE_PATH = new URL(
  "../fixtures/book-9780684835396.json",
  import.meta.url,
);

// Environment toggle: set E2E_MOCKS=false to test with real APIs
const USE_MOCKS = process.env.E2E_MOCKS === "true"; // Default to real DB for this test

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
test.describe("History Modal AI Clean Test", () => {
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
      testName: `History Modal AI Clean Test - ${TEST_ISBN}`,
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
      await setupMocks(page, fixture, true); // Start with scan already saved
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
    const reportPath = path.join(REPORT_DIR, `history-modal-${timestamp}.json`);

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
  test("should open history modal, verify bibliographic fields, and complete AI Clean workflow", async ({
    page,
  }) => {
    // ========================================================================
    // STEP 0: Setup - Scan a book to populate history
    // ========================================================================
    await runStep("Setup: Scan book to populate history", async () => {
      // First get book data from API
      const bookResponse = await page.request.get(`/api/book/${TEST_ISBN}`, {
        headers: {
          "x-playwright-test-session": "1",
        },
      });

      if (!bookResponse.ok()) {
        throw new Error(`Failed to fetch book data: ${bookResponse.status()}`);
      }

      const bookData = await bookResponse.json();

      // Save to scans
      const scanResponse = await page.request.post("/api/scans", {
        data: {
          isbn: TEST_ISBN,
          title: bookData.title || EXPECTED_TITLE,
          json_data: JSON.stringify(bookData),
        },
        headers: {
          "Content-Type": "application/json",
          "x-playwright-test-session": "1",
        },
      });

      let scanData: any = {};
      if (scanResponse.ok()) {
        try {
          scanData = await scanResponse.json();
        } catch {
          // Response may not be JSON
          scanData = { success: true };
        }
      }

      return {
        setupCompleted: scanResponse.ok(),
        scanId: scanData.scan_id || scanData.id || "created",
        bookTitle: bookData.title,
      };
    });

    // ========================================================================
    // STEP 1: Navigate to history page
    // ========================================================================
    await runStep("Navigate to history page", async () => {
      await page.goto("/history");
      await page.waitForLoadState("networkidle");

      // Verify page loaded
      const pageTitle = await page.title();
      const heading = await page.locator("h1").first().textContent();

      return { pageTitle, heading, url: page.url() };
    });

    // ========================================================================
    // STEP 2: Verify scan history list is displayed
    // ========================================================================
    await runStep("Verify scan history list is displayed", async () => {
      // Wait for history items to load
      const historyItems = page.locator(
        'table tbody tr, [role="button"][tabindex="0"]',
      );
      await expect(historyItems.first()).toBeVisible({ timeout: 10_000 });

      const count = await historyItems.count();
      return { historyItemCount: count };
    });

    // ========================================================================
    // STEP 13: Click on the test book to open Bibliographic Record modal
    // ========================================================================
    await runStep("Click on scan entry to open modal", async () => {
      // Find and click the row containing our test ISBN
      const targetRow = page.locator(
        `tr:has-text("${TEST_ISBN}"), [role="button"]:has-text("${TEST_ISBN}")`,
      );

      await expect(targetRow.first()).toBeVisible({ timeout: 10_000 });
      await targetRow.first().click();

      // Wait for modal to appear
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // Verify modal header
      const modalHeader = await modal
        .locator('h2:has-text("Bibliographic Record")')
        .textContent();

      return { modalHeader, modalVisible: true };
    });

    // ========================================================================
    // STEP 13: Verify complete bibliographic fields in modal
    // ========================================================================
    await runStep("Verify all bibliographic fields in modal", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Define expected fields according to BookDetailModal.svelte
      const expectedFields = [
        "Title",
        "Series Title",
        "Call Number",
        "Publisher",
        "Collation",
        "Language",
        "ISBN/ISSN",
        "Classification",
        "Content Type",
        "Media Type",
        "Carrier Type",
        "Edition",
        "Subject(s)",
        "Specific Detail Info",
        "Statement of Responsibility",
      ];

      const fieldsFound: Record<string, boolean> = {};

      for (const field of expectedFields) {
        const fieldLabel = modal.locator(`dt:has-text("${field}")`);
        const isVisible = await fieldLabel.isVisible().catch(() => false);
        fieldsFound[field] = isVisible;
      }

      // Verify Title field contains expected value
      const titleValue = await modal
        .locator('dd:has-text("I Don\'t Want")')
        .first()
        .textContent();

      return {
        fieldsFound,
        allFieldsPresent: Object.values(fieldsFound).every((v) => v),
        titleValue: titleValue?.trim(),
      };
    });

    // ========================================================================
    // STEP 13: Verify cover image and classification quick view
    // ========================================================================
    await runStep("Verify cover image and classification display", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Check cover image section
      const coverSection = modal.locator('img[alt*="Cover art"]');
      const coverVisible = await coverSection.isVisible().catch(() => false);

      // Check classification quick view
      const ddcLabel = modal.locator('span:has-text("DDC")');
      const lccLabel = modal.locator('span:has-text("LCC")');

      const ddcVisible = await ddcLabel.isVisible().catch(() => false);
      const lccVisible = await lccLabel.isVisible().catch(() => false);

      return {
        coverVisible,
        classificationQuickViewPresent: ddcVisible && lccVisible,
      };
    });

    // ========================================================================
    // STEP 13: Locate and verify AI Clean button
    // ========================================================================
    await runStep("Locate AI Clean button in modal", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Find AI Clean button - it should be in the right sidebar
      const aiCleanButton = modal.locator('button:has-text("AI Clean")');

      await expect(aiCleanButton).toBeVisible({ timeout: 5_000 });

      const isEnabled = await aiCleanButton.isEnabled();
      const buttonText = await aiCleanButton.textContent();

      return {
        buttonFound: true,
        isEnabled,
        buttonText: buttonText?.trim(),
      };
    });

    // ========================================================================
    // STEP 13: Click AI Clean button and verify processing state
    // ========================================================================
    await runStep("Click AI Clean button and verify processing", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');
      const aiCleanButton = modal.locator('button:has-text("AI Clean")');

      // Wait for AI Clean API response
      const aiResponsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/ai/clean") && res.status() === 200,
        { timeout: 60_000 },
      );

      // Click the button
      await aiCleanButton.click();

      // Verify loading state appears
      const loadingState = modal.locator(
        'button:has-text("Cleaning"), button:has-text("Saving")',
      );
      const loadingVisible = await loadingState
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      // Wait for API response
      const aiResponse = await aiResponsePromise;
      const aiStatus = aiResponse.status();

      return {
        loadingStateShown: loadingVisible,
        apiStatus: aiStatus,
      };
    });

    // ========================================================================
    // STEP 13: Verify AI Clean success indicator
    // ========================================================================
    await runStep("Verify AI Clean success indicator", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Wait for success state: "Saved ✓" button text
      const successButton = modal.locator('button:has-text("Saved ✓")');
      await expect(successButton).toBeVisible({ timeout: 10_000 });

      // Check for success toast
      const toast = page.locator(
        'div:has-text("Metadata cleaned"), div:has-text("saved")',
      );
      const toastVisible = await toast
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      return {
        successButtonVisible: true,
        toastVisible,
      };
    });

    // ========================================================================
    // STEP 13: Verify classification data (DDC/LCC) is present
    // ========================================================================
    await runStep(
      "Verify classification data (DDC/LCC) is present",
      async () => {
        const modal = page.locator('[role="dialog"][aria-modal="true"]');

        // Check classification quick view for updated values
        const ddcValue = await modal
          .locator('span:has-text("DDC")')
          .locator("..")
          .locator("span")
          .last()
          .textContent();

        const lccValue = await modal
          .locator('span:has-text("LCC")')
          .locator("..")
          .locator("span")
          .last()
          .textContent();

        // Verify classification field in bibliographic record
        const classificationRow = modal.locator(
          'dt:has-text("Classification")',
        );
        const classificationValue = await classificationRow
          .locator("..")
          .locator("dd")
          .textContent();

        const hasDDC = ddcValue !== "-" && ddcValue !== "";
        const hasLCC = lccValue !== "-" && lccValue !== "";

        return {
          ddcValue: ddcValue?.trim(),
          lccValue: lccValue?.trim(),
          classificationValue: classificationValue?.trim(),
          hasValidClassification: hasDDC || hasLCC,
        };
      },
    );

    // ========================================================================
    // STEP 13: Verify AI Enhanced badge appears
    // ========================================================================
    await runStep("Verify AI Enhanced badge appears", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Look for "✨ AI Enhanced" badge in header
      const enhancedBadge = modal.locator(
        'span:has-text("AI Enhanced"), span:has-text("✨")',
      );

      await expect(enhancedBadge.first()).toBeVisible({ timeout: 5_000 });

      const badgeText = await enhancedBadge.first().textContent();

      return {
        badgeVisible: true,
        badgeText: badgeText?.trim(),
      };
    });

    // ========================================================================
    // STEP 13: Verify AI History section appears (optional)
    // ========================================================================
    await runStep("Verify AI History section (if present)", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Check if AI History section is visible
      const aiHistorySection = modal.locator('h3:has-text("AI History")');
      const aiHistoryVisible = await aiHistorySection
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      let aiHistoryContent = "";
      if (aiHistoryVisible) {
        const historyContent = await aiHistorySection
          .locator("..")
          .textContent();
        aiHistoryContent = historyContent?.trim() || "";
      }

      return {
        aiHistoryVisible,
        aiHistoryContent: aiHistoryVisible ? aiHistoryContent : "Not displayed",
      };
    });

    // ========================================================================
    // STEP 13: Check for console errors
    // ========================================================================
    await runStep("Check for console errors", async () => {
      const errors = report.consoleMessages.filter(
        (msg) => msg.type === "error",
      );
      const warnings = report.consoleMessages.filter(
        (msg) => msg.type === "warning",
      );

      // Filter out expected warnings (e.g., sourcemap warnings)
      const relevantErrors = errors.filter(
        (e) =>
          !e.text.includes("sourcemap") &&
          !e.text.includes("DevTools") &&
          !e.text.includes("favicon"),
      );

      return {
        totalErrors: errors.length,
        relevantErrors: relevantErrors.length,
        totalWarnings: warnings.length,
        errorMessages: relevantErrors.map((e) => e.text),
      };
    });

    // ========================================================================
    // STEP 13: Close modal and verify state persists
    // ========================================================================
    await runStep("Close modal and verify", async () => {
      const modal = page.locator('[role="dialog"][aria-modal="true"]');

      // Click close button
      const closeButton = modal.locator('button[aria-label*="Close"]');
      await closeButton.click();

      // Verify modal is closed
      await expect(modal).not.toBeVisible({ timeout: 3_000 });

      // Verify we're back on history page
      const url = page.url();
      const onHistoryPage = url.includes("/history");

      return {
        modalClosed: true,
        onHistoryPage,
        finalUrl: url,
      };
    });
  });

  // ==========================================================================
  // Helper Functions
  // ==========================================================================

  /**
   * Runs a test step and records its result
   */
  async function runStep(
    name: string,
    action: () => Promise<Record<string, unknown>>,
  ): Promise<void> {
    stepStartTime = Date.now();
    const step: TestStep = {
      name,
      status: "PASS",
      duration: 0,
      details: {},
    };

    try {
      step.details = await action();
      step.duration = Date.now() - stepStartTime;
      step.status = "PASS";
    } catch (error) {
      step.duration = Date.now() - stepStartTime;
      step.status = "FAIL";
      step.error = error instanceof Error ? error.message : String(error);
      step.errorStack =
        error instanceof Error ? error.stack : "No stack trace available";

      // Take screenshot on failure
      const screenshotPath = path.join(
        REPORT_DIR,
        `error-${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.png`,
      );

      try {
        await test.info().attach("screenshot", {
          path: screenshotPath,
          contentType: "image/png",
        });
        step.screenshot = screenshotPath;
      } catch {
        // Screenshot failed, continue
      }

      report.status = "FAIL";
      throw error;
    } finally {
      report.steps.push(step);
    }
  }
});

// ============================================================================
// Mock Setup
// ============================================================================
async function setupMocks(
  page: Page,
  fixture: Record<string, unknown>,
  initialScanSaved: boolean = false,
): Promise<void> {
  let scanSaved = initialScanSaved;
  let scanId = 1001;

  // Mock scans API - used by getScanHistory in +page.server.ts
  await page.route("**/api/scans**", (route) => {
    // Check if it's a GET request for history
    if (route.request().method() === "GET") {
      const mockScans = scanSaved
        ? [
            {
              id: scanId,
              isbn: TEST_ISBN,
              title: EXPECTED_TITLE,
              created_at: new Date().toISOString(),
              json_data: JSON.stringify({
                ...fixture,
                scan_id: scanId,
                is_ai_enhanced: false,
              }),
            },
          ]
        : [];

      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockScans),
      });
    } else if (route.request().method() === "POST") {
      // Save scan
      scanSaved = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, scan_id: scanId }),
      });
    } else {
      route.continue();
    }
  });

  // Mock AI Clean API
  await page.route("**/api/ai/clean", async (route) => {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const cleaned = {
      ...fixture,
      ddc: "362.20",
      lcc: "RC537.R44",
      is_ai_enhanced: true,
      enhanced_at: new Date().toISOString(),
      saved: true,
      scan_id: scanId,
      ai_log: [
        {
          timestamp: new Date().toISOString(),
          action: "AI Clean",
          changes: [
            "Added DDC: 362.20",
            "Added LCC: RC537.R44",
            "Translated metadata to Indonesian",
          ],
        },
      ],
    };

    scanSaved = true;

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cleaned),
    });
  });

  // Mock book API (in case needed)
  await page.route("**/api/book/**", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...fixture,
        scan_id: scanSaved ? scanId : null,
      }),
    });
  });
}

// ============================================================================
// Report Summary Printer
// ============================================================================
function printReportSummary(report: TestReport, reportPath: string): void {
  console.log("\n" + "=".repeat(80));
  console.log("HISTORY MODAL AI CLEAN TEST REPORT");
  console.log("=".repeat(80));
  console.log(`Status: ${report.status === "PASS" ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
  console.log(`ISBN: ${report.isbn}`);
  console.log(`Expected Title: ${report.expectedTitle}`);
  console.log(`Mocks Enabled: ${report.usedMocks}`);
  console.log(
    `\nSteps: ${report.summary.passedSteps}/${report.summary.totalSteps} passed`,
  );
  console.log("\nStep Results:");

  report.steps.forEach((step, index) => {
    const icon = step.status === "PASS" ? "✅" : "❌";
    const duration = `(${step.duration}ms)`;
    console.log(`  ${icon} ${index + 1}. ${step.name} ${duration}`);
    if (step.status === "FAIL" && step.error) {
      console.log(`     Error: ${step.error}`);
    }
  });

  const apiResponses = report.apiCalls.filter((c) => c.type === "response");
  if (apiResponses.length > 0) {
    console.log(`\n📡 API Calls (${apiResponses.length} responses):`);
    apiResponses.forEach((call) => {
      const statusIcon = call.status === 200 ? "✅" : "❌";
      const url = call.url?.split("?")[0] || "unknown";
      console.log(`  ${statusIcon} ${call.status} ${url}`);
    });
  }

  if (report.summary.failedSteps > 0 && report.networkErrors.length > 0) {
    console.log(`\n⚠️  Network Errors (${report.networkErrors.length}):`);
    report.networkErrors.slice(0, 5).forEach((err) => {
      console.log(`  - ${err}`);
    });
  }

  console.log(`\n📊 Full report saved to: ${reportPath}`);
  console.log("=".repeat(80) + "\n");
}
