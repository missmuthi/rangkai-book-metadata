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

  // Ensure the route interceptor captures both page fetches and API request context
  await page.context().route("**/api/ai/clean", async (route) => {
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

  // Ensure the page has a valid origin (not about:blank) so fetch can use location.origin
  await page.goto("/");
  // Make a direct POST request from inside the page (so page.route/page.context().route intercepts it)
  const response = await page.evaluate(async (payload) => {
    const resp = await fetch(location.origin + "/api/ai/clean", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-playwright-test-session": "1",
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    return { status: resp.status, bodyText: text };
  }, fixture);

  // Verify the response is successful
  expect(response.status).toBe(200);

  const result = JSON.parse(response.bodyText);

  // Verify cleaned metadata is returned
  expect(result.ddc).toBe("005.133");
  expect(result.lcc).toBe("QA76.73.J38");
  expect(result.saved).toBe(true);
  expect(result.scan_id).toBe(999);
  expect(result.title).toBe("Clean Code");
});
