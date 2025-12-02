# E2E Testing Guide

## Real ISBN AI Clean Test

This document describes the comprehensive E2E test that validates the complete user workflow for scanning ISBNs and using the AI Clean feature.

### Overview

The `real-isbn-ai-clean.spec.ts` test validates the end-to-end functionality of the book metadata scanning and AI enhancement workflow using a real ISBN (`9780684835396` - "I Don't Want to Talk About It" by Terrence Real).

### Test Workflow

The test executes 11 sequential steps that mirror the complete user journey:

1. **Navigate to scan page** - Loads `/scan/mobile`
2. **Enter ISBN and search** - Inputs ISBN and triggers book lookup
3. **Verify book title appears** - Confirms "I Don't Want to Talk About It" is displayed
4. **Open Bibliographic Record modal** - Clicks book to open detailed view
5. **Verify bibliographic fields** - Checks Title, Classification, Publisher, ISBN fields
6. **Locate AI Clean button** - Finds and validates the AI Clean button is enabled
7. **Click AI Clean and process** - Triggers AI enhancement with 60s timeout
8. **Verify success indicator** - Confirms "Saved ✓" state
9. **Verify classification data** - Checks DDC/LCC codes are present
10. **Verify AI Enhanced badge** - Confirms enhancement indicator appears
11. **Check for console errors** - Validates no API/fetch errors occurred

### Running the Test

#### With Mocks (Recommended for CI/CD)

```bash
# Run with mocked APIs (fast, reliable)
npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts
```

#### With Real APIs (Integration Testing)

```bash
# Run against real APIs (slower, comprehensive)
E2E_MOCKS=false npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts
```

#### Additional Options

```bash
# Run with debug mode
npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts --debug

# Run with headed browser
npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts --headed

# Generate HTML report
npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts --reporter=html
```

### Configuration

#### Environment Variables

| Variable             | Default | Description                               |
| -------------------- | ------- | ----------------------------------------- |
| `E2E_MOCKS`          | `true`  | Use mocked APIs instead of real services  |
| `PLAYWRIGHT_PREVIEW` | -       | Enable preview mode for local development |

#### Test Constants

```typescript
const TEST_ISBN = "9780684835396";
const EXPECTED_TITLE = "I Don't Want to Talk About It";
const EXPECTED_AUTHOR = "Terrence Real";
const REPORT_DIR = "test-results/ai-clean-reports";
```

### Test Report Structure

Each test run generates a comprehensive JSON report saved to `test-results/ai-clean-reports/`. The report includes:

#### Report Metadata

- `testName`: Test identifier
- `timestamp`: ISO timestamp of test start
- `duration`: Total test duration in milliseconds
- `status`: "PASS" or "FAIL"
- `isbn`: ISBN being tested
- `expectedTitle`: Expected book title
- `expectedAuthor`: Expected author
- `usedMocks`: Whether mocks were enabled
- `finalUrl`: Final page URL
- `viewport`: Browser viewport dimensions
- `userAgent`: Browser user agent string

#### Step Results

Each step includes:

- `name`: Step description
- `status`: "PASS", "FAIL", or "SKIPPED"
- `duration`: Step execution time in milliseconds
- `error`: Error message (if failed)
- `errorStack`: Full error stack trace
- `screenshot`: Path to failure screenshot
- `details`: Step-specific data

#### API Call Capture

All API interactions are logged:

- **Requests**: URL, method, headers, body (truncated to 2KB)
- **Responses**: URL, status, statusText, headers, body (truncated to 5KB)

#### Console & Network Monitoring

- `consoleMessages`: All browser console messages with timestamps
- `networkErrors`: Failed network requests

#### Summary Statistics

- `totalSteps`: Total number of test steps
- `passedSteps`: Number of successful steps
- `failedSteps`: Number of failed steps
- `skippedSteps`: Number of skipped steps

### Sample Report Output

```
================================================================================
TEST REPORT SUMMARY
================================================================================
Status: ✅ PASS
Duration: 45.23s
ISBN: 9780684835396
Expected Title: I Don't Want to Talk About It
Mocks Enabled: true

Steps: 11/11 passed

Step Results:
  ✅ 1. Navigate to scan page (234ms)
  ✅ 2. Enter ISBN and search for book (1250ms)
  ✅ 3. Verify book title appears on page (3200ms)
  ✅ 4. Open Bibliographic Record modal (450ms)
  ✅ 5. Verify bibliographic fields in modal (120ms)
  ✅ 6. Locate AI Clean button (180ms)
  ✅ 7. Click AI Clean button and process (15200ms)
  ✅ 8. Verify AI Clean success indicator (2300ms)
  ✅ 9. Verify classification data (DDC/LCC) is present (150ms)
  ✅ 10. Verify AI Enhanced badge appears (90ms)
  ✅ 11. Check for console errors (45ms)

📡 API Calls (6 responses):
  ✅ 200 /api/book/9780684835396
  ✅ 200 /api/ai/clean
  ✅ 200 /api/history

📊 Full report saved to: test-results/ai-clean-reports/ai-clean-2025-12-01T12-34-56-789Z.json
================================================================================
```

### Failure Analysis

When tests fail, the report provides comprehensive debugging information:

#### Automatic Screenshots

- Captured on every step failure
- Saved to `test-results/ai-clean-reports/` with descriptive names
- Full page screenshots for context

#### Error Details

- Step-specific error messages
- Full stack traces
- Page content snapshots
- API response dumps

#### Common Failure Scenarios

##### Book Not Found

```
Error: Expected title "I Don't Want to Talk About It" not found on page.
Page text preview (first 1500 chars): [page content]
Screenshot: test-results/ai-clean-reports/error-verify-book-title-1733059200000.png
```

##### AI Clean Timeout

```
Error: AI Clean API did not respond within 60s.
Screenshot: test-results/ai-clean-reports/error-ai-timeout-1733059200000.png
```

##### API Error Response

```
Error: AI Clean API returned error status 429.
Response: {"code": "AI_QUOTA_EXCEEDED", "message": "Rate limit exceeded"}
Screenshot: test-results/ai-clean-reports/error-ai-error-response-1733059200000.png
```

##### Missing Classification

```
Error: No DDC or LCC classification found in bibliographic record.
Modal text preview: [modal content]
Screenshot: test-results/ai-clean-reports/error-no-classification-1733059200000.png
```

### Mock Implementation

When `E2E_MOCKS=true` (default), the test uses realistic mocks:

#### Book API Mock

- Returns fixture data for ISBN `9780684835396`
- Simulates real API response structure

#### AI Clean Mock

- Returns enhanced metadata with DDC/LCC classifications
- Includes `is_ai_enhanced: true` and `ai_log` entries
- Simulates database save with `scan_id`

#### History API Mock

- Returns mock scan history
- Includes cleaned metadata

### Integration Testing

Set `E2E_MOCKS=false` to test against real services:

```bash
E2E_MOCKS=false npx playwright test e2e/tests/real-isbn-ai-clean.spec.ts
```

This validates:

- Real Google Books API integration
- Actual AI service (Groq/Llama model)
- Database operations
- Network reliability

**Note**: Integration tests are slower and may fail due to:

- API rate limits
- Network issues
- AI service availability
- Database connectivity

### Troubleshooting

#### Test Times Out

- Increase timeout in `playwright.config.ts`
- Check network connectivity
- Verify AI service is responding

#### Element Not Found

- UI changes may require selector updates
- Check browser console for JavaScript errors
- Verify page loaded completely

#### API Failures

- Check Cloudflare environment variables
- Verify API keys are configured
- Check service status

#### Screenshot Failures

- Ensure write permissions to `test-results/` directory
- Check available disk space

### File Structure

```
e2e/
├── tests/
│   └── real-isbn-ai-clean.spec.ts    # Main test file
└── fixtures/
    └── book-9780684835396.json       # Test data fixture

test-results/
└── ai-clean-reports/                 # Generated reports
    ├── ai-clean-[timestamp].json
    ├── error-*.png
    └── final-success.png
```

### Dependencies

The test requires:

- Playwright test runner
- Node.js file system APIs
- Test fixtures in `e2e/fixtures/`
- Write access to `test-results/` directory

### Best Practices

1. **Run with mocks in CI/CD** for reliable, fast feedback
2. **Run integration tests periodically** to catch real API issues
3. **Review failure reports** immediately when tests fail
4. **Update selectors** when UI changes affect element detection
5. **Monitor AI service quotas** when running integration tests

### Related Documentation

- [API Documentation](API_DOCUMENTATION.md) - API endpoints tested
- [AI Clean Implementation](ai/AI_CLEAN_IMPLEMENTATION.md) - AI feature details
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Environment setup
- [Quick Commands](QUICK_COMMANDS.md) - Development shortcuts
