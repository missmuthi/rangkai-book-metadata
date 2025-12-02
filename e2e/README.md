# End-to-End Tests (Playwright)

This directory contains Playwright E2E tests for the Rangkai Book Metadata UI.

## Test Scenarios

### Complete Workflow Test (`complete-workflow.spec.ts`)

Tests the full user journey: **Login → Scan → AI Clean → Confirm History**

This test validates critical issues:

- ✓ No refresh needed after login to see user status
- ✓ AI cleaned data appears in history
- ✓ No data duplication after AI clean
- ✓ No blank data states after AI clean
- ✓ History displays immediately after scan (no refresh required)

**Note:** Requires test database. Currently skipped in preview mode.

### Login-Scan-AI-History Test (`login-scan-ai-history.spec.ts`)

Integration test using network mocking to validate the UI flow without database dependency.

### Search Test (`search.spec.ts`)

Tests book search functionality with ISBN input.

### AI Clean Test (`ai-clean.spec.ts`)

Tests AI metadata enhancement feature.

## Running Tests

### Locally (Full Suite)

```bash
npm run test:e2e
```

### With Test Database

Set `TEST_DATABASE_URL` to enable full workflow tests:

```bash
TEST_DATABASE_URL=sqlite://./test.db npm run test:e2e
```

### Preview Mode (No DB)

Tests run with mocked network requests:

```bash
PLAYWRIGHT_PREVIEW=1 npm run test:e2e
```

### CI Mode

```bash
npm run test:e2e:ci
```

## Test Session Authentication

For preview server tests without a database, use the test session header:

```typescript
await page.setExtraHTTPHeaders({ "x-playwright-test-session": "1" });
```

This bypasses authentication when `PLAYWRIGHT_PREVIEW=1` is set.

## Test Fixtures

Located in `e2e/fixtures/`:

- `book-9780132350884.json` - Clean Code book metadata

## Configuration

See `playwright.config.ts` in project root:

- Base URL: `http://127.0.0.1:5173`
- Test directory: `./e2e/tests`
- Timeout: 60 seconds per test
- Screenshots: On failure only

## Debugging Tests

### Run in headed mode

```bash
npm run test:e2e -- --headed
```

### Run specific test file

```bash
npm run test:e2e -- complete-workflow.spec.ts
```

### Debug mode (interactive)

```bash
npm run test:e2e -- --debug
```

### View test report

```bash
npx playwright show-report
```

## Known Limitations

- Full workflow tests require a test database (currently skipped)
- Network mocking used for preview mode tests
- Some tests may timeout if external APIs are slow

## Contributing

When adding new E2E tests:

1. Use network mocking for tests that can run without DB
2. Mark DB-dependent tests with `.skip()` condition
3. Add descriptive test names and comments
4. Use fixtures for deterministic test data
5. Keep tests isolated and independent
