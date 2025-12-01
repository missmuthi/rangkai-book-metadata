# End-to-End Tests (Playwright)

This directory contains Playwright E2E tests for the Rangkai Book Metadata UI.

How to run locally:

1. Install dependencies (once):

```bash
npm install
```

2. Run E2E tests:

```bash
npm run test:e2e
```

Notes:

- Playwright builds the app using `npm run build` and serves it via `npm run preview` before running tests.
- Tests intercept network requests to `/api/book/:isbn` to return deterministic fixtures. This prevents flakiness and external API dependencies.
 
 - For the preview server to allow a test-only session (so `/api` requests aren't rejected due to missing authentication), run Playwright with the `PLAYWRIGHT_PREVIEW=1` env var. This enables a dev-mode session bypass so tests can run without D1/DB setup:

 ```bash
 PLAYWRIGHT_PREVIEW=1 npm run test:e2e
 ```
- For CI, use `npm run test:e2e:ci`.
