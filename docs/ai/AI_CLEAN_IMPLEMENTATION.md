# AI Clean Feature - Write-Through Caching Implementation

## Overview

The AI Clean feature allows librarians to enhance book metadata using Groq's Llama model (Llama 3.3 70B Versatile). The cleaned metadata is automatically saved to both KV Cache and D1 Database for future users.

## Implementation Summary

### 1. Backend Architecture (`src/routes/api/ai/clean/+server.ts`)

**Flow:**

1. Receive raw book data from client
2. Call Groq Llama 3.3 to clean/enhance metadata (Indonesian librarian standards)
3. Inject `is_ai_enhanced: true` and `enhanced_at: timestamp`
4. Return cleaned data immediately (non-blocking response)
5. **Background writes** (using `platform.context.waitUntil()`):
   - Update KV Cache with 30-day TTL
   - Update D1 `scans` table `json_data` column

**Key Features:**

- ✅ Non-blocking async writes (no response delay)
- ✅ Error handling for cache writes (logged but don't fail request)
- ✅ Proper ISBN key lookup (tries isbn13 → isbn10 → isbn)
- ✅ Comprehensive logging for debugging

### 2. AI Service (`src/lib/server/ai/index.ts`)

**Indonesian Librarian Standards:**

The AI is instructed to:

1. **Title Normalization**
   - Convert ALL CAPS to Title Case
   - Remove trailing punctuation
   - Preserve subtitles

2. **Author Cleaning**
   - Remove role labels: "(Author)", "(Editor)", "By", "Ed.", "Ph.D."
   - Return clean names only
   - Format: "Name1 ; Name2 ; Name3"

3. **Description Translation**
   - **Auto-translate English → Indonesian**
   - If already Indonesian, improve clarity
   - Keep concise (2-3 sentences)
   - Professional library tone

4. **Publisher ISBD Format**
   - Standard: "City : Publisher, Year"
   - Example: "Jakarta : Gramedia, 2020"
   - Fallbacks: "S.l." (sine loco), "s.n." (sine nomine), "[n.d.]" (no date)

5. **Subject Keywords**
   - Add Indonesian subject headings
   - Enhance existing keywords
   - Follow standard cataloging practice

6. **Language Standardization**
   - Full names: "Indonesia", "English", "Arab"
   - No ISO codes in display

### 3. Frontend UI (`src/lib/components/BookDetailModal.svelte`)

**Visual Enhancements:**

1. **AI Enhanced Badge**
   - Gold-to-purple gradient background
   - Positioned in header next to title
   - Shows sparkle emoji ✨

2. **Tooltip Information**
   - Hover to see: "Metadata cleaned and translated by AI"
   - Shows enhancement date in Indonesian format
   - `cursor-help` for UX clarity

3. **AI Clean Button**
   - Located in actions sidebar
   - Shows loading spinner during processing
   - Disabled while cleaning to prevent double-clicks

4. **Toast Notifications**
   - Success: "Metadata cleaned & saved to network."
   - Error: "Cleaning failed. Try again."
   - Auto-dismiss after 3 seconds

### 4. Database Schema

**Required columns in `scans` table:**

```sql
-- Already exists (from previous implementation):
json_data TEXT  -- Stores the full MergedBookData JSON
is_ai_enhanced INTEGER DEFAULT 0  -- Boolean flag
enhanced_at INTEGER  -- Unix timestamp
isbn13 TEXT
isbn10 TEXT
```

### 5. Type Definitions (`src/lib/types.ts`)

**Extended MergedBookData interface:**

```typescript
export interface MergedBookData {
  // ... existing fields ...
  publishPlace?: string; // NEW: For ISBD format
  publishYear?: string; // NEW: For ISBD format
  physicalDescription?: string; // NEW: For collation
  authors?: string; // NEW: Comma-separated authors
  is_ai_enhanced?: boolean; // NEW: AI flag
  enhanced_at?: number; // NEW: Timestamp
}
```

## Usage Flow

### For Librarians:

1. Scan a book ISBN
2. View the fetched metadata in BookDetailModal
3. Click **"✨ AI Clean"** button
4. Wait ~2-3 seconds for AI processing
5. See updated, cleaned metadata instantly
6. Toast confirms: "Metadata cleaned & saved to network."

### For Future Users:

1. Scan the same ISBN
2. **Automatically receive the AI-cleaned version** from KV Cache
3. See "✨ AI Enhanced" badge
4. No AI tokens consumed (served from cache)

## Performance Characteristics

- **AI Processing Time:** ~2-3 seconds (Groq Llama 3.3 70B Versatile - free tier may vary)
- **Response Time:** Same as AI processing (writes are async)
- **KV Cache TTL:** 30 days (auto-refresh on access)
- **Token Savings:** ~95% reduction (one AI call serves all users)

## Error Handling

1. **AI Service Unavailable:**
   - Returns `{ aiWarning: 'AI cleaning service unavailable' }`
   - Original data remains unchanged
   - User sees error toast

2. **KV Write Failure:**
   - Logged to console
   - Does NOT fail the request
   - User still gets cleaned data

3. **D1 Write Failure:**
   - Logged to console
   - Does NOT fail the request
   - Cache still updated (eventual consistency)

## Monitoring & Debugging

**Console Logs:**

```
[AI Clean] KV Cache updated for ISBN: 9781234567890
[AI Clean] D1 Database updated for ISBN: 9781234567890, rows affected: 1
[AI Clean] KV Cache write failed for 9781234567890: [error details]
```

### Observability & Log Events (Server-side)

To make debugging and analysis easier, the backend emits structured logs for the AI Clean pipeline. Each log entry includes a `requestId` for correlation.

- `ai_clean_auth_check_started` — Authentication check started (includes `sessionExists`, `userExists`).
- `ai_clean_request_received` — Request accepted; includes `userId`, `scan_id`, `mode`, `title`, `isbn`, and `requestId`.
- `ai_clean_request_validated` — Returns normalized request metadata (title/isbn).
- `ai_clean_groq_call_started` — A call to Groq API has started.
- `ai_clean_rate_limit_retry` — Backoff retry for rate-limited Groq calls (includes `attempt` and `waitTime`).
- `ai_clean_groq_fallback_to_generateText` / `ai_clean_groq_fallback_to_generateText_loop` — Groq model doesn't support `json_schema`, falling back to `generateText`.
- `ai_fallback_used` — Analytics event (tracks when fallback occurred). Includes `model`, `provider`, `isbn`, and `reason`.
- `ai_clean_groq_success` — Groq responded successfully with structured output (includes `duration` and `requestId`).
- `ai_clean_groq_failed` / `ai_clean_groq_failed_message` — Groq returned an error; includes `errorMessage`.
- `ai_clean_fallback_raw` — Raw fallback text parsed from `generateText` fallback.
- `ai_clean_parsed_ai_result` — Small AI result summary (keys, ddc/lcc/title), not full payload.
- `ai_clean_raw_result` / `ai_clean_normalized` — Raw and normalized AI result payloads.
- `ai_clean_compare_<field>` — Per-field comparison logs indicating old/new values and types; useful for auditing what changed.
- `ai_clean_no_changes` — No changes detected after AI run (useful for debugging `"No changes detected"` cases).
- `ai_clean_changes_detected` — Changes were found (includes `changesCount`).
- `ai_clean_scan_updated` / `ai_clean_existing_scan_updated` / `ai_clean_inserted_new_scan` — D1 upsert operations summarized with scan id and requestId.
- `ai_clean_race_condition_detected` / `ai_clean_race_resolved` — Database unique constraint detected and resolved; includes `isbn` and `id`.
- `ai_clean_db_error` — Generic DB errors including context such as query and `requestId`.
- `ai_clean_complete` — Endpoint finished processing; includes `requestId`, `savedScanId`, `changesCount`, and whether save succeeded.
- `ai_clean_error_response` — When returning a 5xx to user; includes `code` (AI_NOT_CONFIGURED, AI_QUOTA_EXCEEDED, AI_TIMEOUT, AI_SERVICE_UNAVAILABLE) and `requestId`.

These are intentionally implemented as structured logs (JSON) and are safe to ship to log aggregators. Where possible, PII is sanitized.

### Quick Debugging Steps for "No changes detected"

1. Reproduce the request in Playwright or via `curl`, note the `requestId` in the response (we now return that in logs and use it for tracing).
2. Search server logs for `ai_clean_parsed_ai_result` with that `requestId` to check the keys generated by AI.
3. Look for `ai_clean_compare_<field>` logs to see per-field old vs new values.
4. If `ai_clean_no_changes` appears but AI produced useful metadata, check `ai_clean_parsed_ai_result` and `ai_clean_raw_result` to see if AI produced values but your client-side normalization or cleaning suppressed them.
5. If a DB upsert did not occur, verify the sequence of `ai_clean_inserting_new_scan` or `ai_clean_existing_scan_updated` logs.

## Environment Requirements

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here  # Optional: legacy key (kept for backward compatibility)
```

## Testing Checklist

- [ ] Clean a book with ALL CAPS title
- [ ] Clean a book with English description
- [ ] Verify KV cache is updated (check Cloudflare dashboard)
- [ ] Verify D1 database is updated (query `scans` table)
- [ ] Verify toast notifications appear
- [ ] Verify "AI Enhanced" badge shows on re-fetch
- [ ] Test error handling (remove API key temporarily)
- [ ] Verify non-blocking writes (response is immediate)

## Future Enhancements

1. **Bulk AI Cleaning:** Clean multiple books in one request
2. **AI Confidence Score:** Show metadata quality rating
3. **Version History:** Track AI enhancement iterations
4. **Manual Override:** Let librarians edit AI suggestions before saving
5. **Analytics Dashboard:** Track AI enhancement coverage per library

---

**Status:** ✅ Implemented and Type-Checked  
**Last Updated:** 2025-11-27  
**Version:** 2.0.2
