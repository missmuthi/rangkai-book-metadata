# History Modal AI Clean E2E Test Documentation

## Overview

The `history-modal-ai-clean.spec.ts` test validates the complete AI Clean workflow through the History Modal, which is the authoritative interface for testing AI-on-system behavior.

## Why History Modal?

The History Modal (`BookDetailModal.svelte`) is the correct target for AI Clean E2E testing because:

1. **Complete Bibliographic Record**: Displays all 15 bibliographic fields (Title, Series Title, Call Number, Publisher, Collation, Language, ISBN/ISSN, Classification, Content Type, Media Type, Carrier Type, Edition, Subjects, Specific Detail Info, Statement of Responsibility)

2. **Full AI Clean UI**: Contains the dedicated AI Clean button in the right sidebar with all status indicators (Cleaning, Saving, Saved ✓, AI Enhanced badge)

3. **Comprehensive Validation**: Shows classification data (DDC/LCC), cover image, AI History section, and all enhanced metadata

4. **Consistent Structure**: Unlike the homepage preview card (which only shows 4 fields: title, ISBN, publisher, date), the modal provides the complete interface for verification

## Test Architecture

### Test Structure

The test follows the E2E Testing Guide pattern with 13 comprehensive steps:

```
STEP 0: Setup - Populate history with a scanned book
STEP 1: Navigate to history page
STEP 2: Verify scan history list is displayed
STEP 3: Click on scan entry to open Bibliographic Record modal
STEP 4: Verify all 15 bibliographic fields in modal
STEP 5: Verify cover image and classification quick view
STEP 6: Locate and verify AI Clean button
STEP 7: Click AI Clean button and verify processing state
STEP 8: Verify AI Clean success indicator
STEP 9: Verify classification data (DDC/LCC) is present
STEP 10: Verify AI Enhanced badge appears
STEP 11: Verify AI History section (if present)
STEP 12: Check for console errors
STEP 13: Close modal and verify state persists
```

### Key Features

**Comprehensive Reporting**: Each test generates a detailed JSON report including:

- Step-by-step execution results with timing
- API call capture (requests and responses)
- Console messages and network errors
- Screenshots on failure
- Summary statistics

**Flexible Execution**: Supports both mocked and real API testing:

- Default: Real database/API testing (E2E_MOCKS=false)
- Optional: Mocked testing (E2E_MOCKS=true) - limited functionality

**Failure Analysis**: Automatic screenshots, error context, and detailed logging for debugging

## Current Limitations

### Database Access Requirement

The history page (`/history`) loads data server-side via `+page.server.ts`, which calls `getScanHistory()` that directly accesses the database. This means:

**Cannot be fully mocked**: Network route mocking (`page.route()`) doesn't intercept server-side database calls

**Requires actual data**: The test must populate the database with at least one scan before verifying the history modal

**Environment dependency**: Works best with Cloudflare D1 in production/preview environments, or with a local SQLite database in development

### Recommended Execution

For reliable testing, run this test:

1. **In Cloudflare Pages Preview**: Deploy to preview environment where D1 is available
2. **With Local D1**: Use `wrangler dev --local` with local D1 database
3. **Integration Test**: As part of full workflow tests that create scans first

## Running the Test

### Basic Execution

```bash
# Run with real APIs/database (recommended)
npx playwright test e2e/tests/history-modal-ai-clean.spec.ts

# Run with headed browser for debugging
npx playwright test e2e/tests/history-modal-ai-clean.spec.ts --headed

# Run with debug mode
npx playwright test e2e/tests/history-modal-ai-clean.spec.ts --debug
```

### With Setup

The test includes an automatic setup step (STEP 0) that:

1. Fetches book metadata via `/api/book/{isbn}`
2. Attempts to save it to the database
3. Falls back gracefully if database is unavailable

### Report Location

Test reports are saved to:

```
test-results/history-modal-reports/history-modal-{timestamp}.json
```

## Test Assertions

### Modal Structure

The test verifies the complete Bibliographic Record modal includes:

- **Header**: "Bibliographic Record" title with optional "✨ AI Enhanced" badge
- **Left Column**: All 15 bibliographic fields in definition list format
- **Right Column**: Cover image, Classification Quick View (DDC/LCC), AI History section, Action buttons

### AI Clean Workflow

1. **Button State**: Verify "✨ AI Clean" button is visible and enabled
2. **Processing**: Verify "Cleaning..." or "Saving..." state appears
3. **API Call**: Wait for `/api/ai/clean` response (60s timeout)
4. **Success State**: Verify "Saved ✓" button text appears
5. **Data Update**: Verify DDC/LCC classification values are populated
6. **Badge**: Verify "✨ AI Enhanced" badge appears in header
7. **History**: Verify AI History section shows changes (optional)

### Error Handling

The test checks for:

- Console errors (filtered for relevant errors only)
- Network failures
- API error responses
- Rate limiting (AI_QUOTA_EXCEEDED)

## Comparison with Homepage Preview

### Homepage (`/scan/mobile`)

**Preview Card** shows only:

- Title (h2)
- ISBN (badge)
- Publisher + Date (footer)
- Cover thumbnail

**Purpose**: Quick scan result preview

**AI Clean**: Separate button below card (not in modal context)

### History Modal (`/history` → modal)

**Bibliographic Record** shows all:

- 15 complete bibliographic fields
- Full cover image
- Classification Quick View (DDC/LCC boxes)
- AI History section
- AI Enhanced badge in header
- Integrated AI Clean button in modal

**Purpose**: Complete metadata management and AI enhancement

## Future Improvements

1. **Mock Database Access**: Implement database mocking at the platform/D1 level for pure unit testing
2. **Seed Script**: Create a database seed script for consistent test data
3. **Multi-Book Testing**: Test with multiple books in history
4. **Error Scenarios**: Add tests for AI Clean failures, rate limiting, and error recovery
5. **Visual Regression**: Add screenshot comparison for modal layout consistency

## Related Files

- **Test**: `e2e/tests/history-modal-ai-clean.spec.ts`
- **Modal Component**: `src/lib/components/BookDetailModal.svelte`
- **History Page**: `src/routes/history/+page.svelte`
- **Server Load**: `src/routes/history/+page.server.ts`
- **Scan Service**: `src/modules/scan/service.ts`
- **Guide**: `docs/E2E_TESTING_GUIDE.md`

## Summary

The History Modal E2E test provides comprehensive validation of the AI Clean feature in its complete, production-ready context. While it requires database access and cannot be fully mocked, it offers the most accurate representation of real-world usage and ensures all UI elements, API interactions, and data transformations work correctly together.
