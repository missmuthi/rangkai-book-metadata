import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import path from 'path';

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/book-9780132350884.json');

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
  await input.press('Enter');

  // Wait for the merged data header and verify title and call number
  await expect(page.locator('h2', { hasText: 'SLiMS-Ready Data (Merged)' })).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=Clean Code')).toBeVisible();
  await expect(page.locator('text=005.133 B87')).toBeVisible();
});
