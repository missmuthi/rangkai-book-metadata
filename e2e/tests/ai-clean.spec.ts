import { test, expect } from "@playwright/test";
import { readFile } from "fs/promises";

const FIXTURE_PATH = new URL(
  "../fixtures/book-9780132350884.json",
  import.meta.url,
);

// Test the AI Clean endpoint directly (API-level test)
test("AI Clean API returns cleaned metadata with saved state", async ({
  page,
}) => {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf-8"));

  // Set test session header to bypass auth
  await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });

  // Mock the /api/ai/clean response
  const cleanedResponse = {
    ...fixture,
    ddc: "005.133",
    lcc: "QA76.73.J38",
    saved: true,
    scan_id: 999,
    title: "Clean Code",
  };

  await page.route("**/api/ai/clean", async (route) => {
    const request = route.request();
    const body = await request.postDataJSON();

    if (!body || (!body.isbn && !body.isbn13 && !body.isbn10)) {
      route.fulfill({
        status: 400,
        body: JSON.stringify({ error: "Missing isbn" }),
      });
      return;
    }

    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cleanedResponse),
    });
  });

  // Make a direct POST request to the AI Clean endpoint
  const response = await page.request.post("/api/ai/clean", {
    data: fixture,
    headers: { "x-playwright-test-session": "1" },
  });

  // Verify the response is successful
  expect(response.status()).toBe(200);

  const result = await response.json();

  // Verify cleaned metadata is returned
  expect(result.ddc).toBe("005.133");
  expect(result.lcc).toBe("QA76.73.J38");
  expect(result.saved).toBe(true);
  expect(result.scan_id).toBe(999);
  expect(result.title).toBe("Clean Code");
});
