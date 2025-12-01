import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';

// Use ESM compatible URL-based path resolution
const FIXTURE_PATH = new URL('../fixtures/book-9780132350884.json', import.meta.url);

test('Search by ISBN displays merged metadata card', async ({ page }) => {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf-8'));

  // Intercept API calls to return deterministic data
  await page.route('**/api/book/9780132350884', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });

  // Navigate to home and perform a search
  await page.goto('/');

  // locate search input
  const input = page.locator('input[type="text"]').first();
  await expect(input).toBeVisible();

  await input.fill('9780132350884');
  const harvestBtn = page.locator('button:has-text("Harvest")');
  await harvestBtn.click();

  // Wait for the merged data header and verify title and call number
  await expect(page.locator('h2:has-text("SLiMS-Ready Data (Merged)")')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('p.text-xl:has-text("Clean Code")')).toBeVisible();
  await expect(page.locator('p.font-mono:has-text("005.133 B87")')).toBeVisible();
});

test('Cache header toggles between MISS and HIT across sequential requests', async ({ page }) => {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf-8'));
  let callCount = 0;

  await page.route('**/api/book/9780132350884', (route) => {
    callCount += 1;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
      headers: { 'X-Cache': callCount === 1 ? 'MISS' : 'HIT' },
    });
  });

  await page.goto('/');
  const input = page.locator('input[type="text"]').first();
  await input.fill('9780132350884');
  const harvestBtn = page.locator('button:has-text("Harvest")');
  // Trigger first search and capture network response
  const [resp1] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/book/9780132350884')),
    harvestBtn.click(),
  ]);
  expect(resp1.headers()['x-cache']).toBe('MISS');

  // Trigger second search (same ISBN)
  await input.fill('9780132350884');
  // Trigger second search and capture response
  const [resp2] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/book/9780132350884')),
    harvestBtn.click(),
  ]);
  expect(resp2.headers()['x-cache']).toBe('HIT');
});
