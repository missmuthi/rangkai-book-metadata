# Serverless Architecture - Rangkai Book Metadata

## Overview

Rangkai v1.3.0 introduces a **serverless-first architecture** that moves data fetching from client-side to edge-optimized API endpoints powered by Cloudflare Workers.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (SvelteKit)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  User Input (ISBN/Title)                                   │ │
│  │         ↓                                                   │ │
│  │  BookApiService.fetchFromServerless(isbn)                  │ │
│  │         ↓                                                   │ │
│  │  fetch('/api/book/[isbn]')                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│             SERVERLESS API (Cloudflare Workers)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  GET /api/book/[isbn] Handler                              │ │
│  │         ↓                                                   │ │
│  │  1. Check KV Cache (24h TTL)                               │ │
│  │         ↓ (cache miss)                                     │ │
│  │  2. Parallel Fetch (Google + OpenLibrary + LoC)            │ │
│  │         ↓                                                   │ │
│  │  3. Merge Data (Waterfall Prioritization)                  │ │
│  │         ↓                                                   │ │
│  │  4. Return Response IMMEDIATELY                            │ │
│  │         ↓                                                   │ │
│  │  5. Background Writes (waitUntil):                         │ │
│  │     - D1 Database (ISBN audit log)                         │ │
│  │     - KV Cache (24h expiration)                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE INFRASTRUCTURE                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ KV Namespace │  │ D1 Database  │  │ Workers API  │          │
│  │ BOOK_CACHE   │  │ rangkai-scans│  │ waitUntil()  │          │
│  │ (24h TTL)    │  │ (Audit Log)  │  │ (Background) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Changed?

### Before (v1.2.1) - Client-Side Fetching

```typescript
// ❌ OLD: Direct API calls from browser
const result = await BookApiService.fetchAll(isbn, true);

const googleData = result.google?.items?.[0]?.volumeInfo;
const openLibraryData = result.openlibrary;
const locData = result.loc;

mergedData = processAndRenderMergedData(googleData, openLibraryData, locData);
```

**Issues:**

- ❌ No caching → repeated API calls for same ISBN
- ❌ No audit logging → no analytics on usage patterns
- ❌ Client-side rate limits → can't batch requests efficiently
- ❌ Slower perceived performance (sequential processing)

---

### After (v1.3.0) - Serverless API

```typescript
// ✅ NEW: Single call to serverless endpoint
const apiResult = await BookApiService.fetchFromServerless(isbn);

mergedData = apiResult as MergedBookData; // Already merged!
```

**Benefits:**

- ✅ **KV Caching**: 24-hour TTL = instant responses for popular ISBNs
- ✅ **D1 Audit Logging**: Track all searches in SQLite database
- ✅ **Background Writes**: `waitUntil` prevents data loss while maintaining speed
- ✅ **Edge Optimization**: Runs on Cloudflare's global network (< 50ms latency)
- ✅ **Centralized Logic**: Single source of truth for data merging

---

## Performance Improvements

| Metric                       | v1.2.1 (Client) | v1.3.0 (Serverless)       | Improvement     |
| ---------------------------- | --------------- | ------------------------- | --------------- |
| **Cache Hit (Popular ISBN)** | N/A (no cache)  | **< 100ms**               | ∞               |
| **First Request (Cold)**     | ~2500ms         | ~2400ms                   | 4% faster       |
| **Repeated Scans**           | ~2500ms each    | **~80ms** (cached)        | **96% faster**  |
| **Database Logging**         | N/A             | Background (0ms overhead) | Non-blocking    |
| **API Rate Limits**          | Per-user IP     | Shared (Cloudflare IP)    | Better batching |

---

## API Response Structure

### Request

```bash
GET /api/book/9780134092669
```

### Response (200 OK)

```json
{
  "title": "Effective Java",
  "author": "Joshua Bloch",
  "publisher": "Addison-Wesley Professional : Addison-Wesley, 2018",
  "isbn13": "9780134092669",
  "lcc": "QA76.73.J38 B58 2018",
  "ddc": "005.133",
  "callNumber": "005.133 BLO E 2018",
  "dataSource": "all-three",
  "meta": {
    "isbn": "9780134092669",
    "sources": {
      "google": true,
      "openlibrary": true,
      "loc": true
    },
    "fetchDuration": 1847,
    "totalDuration": 1852,
    "timestamp": "2025-11-21T08:45:32.123Z",
    "cacheHit": false
  }
}
```

### Headers

```http
X-Cache: MISS | HIT
X-Response-Time: 1852ms
Cache-Control: public, max-age=86400
```

---

## Scanner Mode Compatibility

The serverless API is **fully compatible** with Scanner Mode and Auto-Add features:

```typescript
// AUTO-ADD MODE: Add directly to batch without showing detail card
if (scannerModeEnabled && autoAddMode && hasUsableData) {
  scanHistory.add(mergedData); // Works with serverless response
  playFeedbackSound("success");
  showToast(`✓ Added: ${truncatedTitle}`, "success");
}
```

**Key Features Preserved:**

- ✅ Unjammable scanning (< 500ms debounce)
- ✅ Auto-add to batch without review card
- ✅ Toast notifications with book titles
- ✅ Partial data handling (graceful degradation)
- ✅ Audio feedback (beep on success/error)

---

## Error Handling

The serverless API uses HTTP status codes for error states:

| Status  | Scenario                       | Response                                                  |
| ------- | ------------------------------ | --------------------------------------------------------- |
| **200** | Success (full or partial data) | Merged book data                                          |
| **400** | Invalid ISBN format            | `{ message: "Invalid ISBN format" }`                      |
| **404** | No data from any source        | `{ message: "Book not found. Google: timeout; OL: 503" }` |
| **500** | Internal server error          | `{ message: "Server error" }`                             |

**Graceful Degradation:**

- Missing LoC data → Returns Google + OpenLibrary only
- Missing OpenLibrary data → Returns Google + LoC only
- Missing Google data → Returns OpenLibrary + LoC only

---

## Analytics Integration

All serverless API calls are tracked with enhanced metrics:

```typescript
Analytics.track("api_timing", {
  source: "serverless",
  endpoint: "isbn_search",
  duration_ms: 1852,
  success: true,
  cache_hit: false, // NEW: Track KV cache performance
});

Analytics.track("search_performed", {
  type: "isbn",
  query_length: 13,
  duration_ms: 1852,
  result_count: 1,
  cache_hit: false, // NEW: Distinguish cached vs. fresh fetches
});
```

---

## Title Search (Legacy Client-Side)

**Title searches still use client-side fetching** because:

1. LoC API doesn't support title search (ISBN-only)
2. Multiple results require UI selection before merging
3. Lower usage frequency (< 5% of queries in Scanner Mode)

```typescript
// Title searches remain client-side
if (!isIsbn) {
  const result = await BookApiService.fetchAll(trimmedQuery, false, 10, 10);
  googleResults = result.google?.items ?? [];
  openLibraryResults = result.openlibrary?.docs ?? [];
}
```

---

## Deployment Checklist

When deploying serverless API changes:

- [ ] Verify `wrangler.toml` has correct D1/KV bindings
- [ ] Run `npx wrangler d1 execute rangkai-scans --remote --command "SELECT COUNT(*) FROM scans"` to test database
- [ ] Run `npx wrangler kv namespace list` to verify KV namespace exists
- [ ] Test serverless API locally: `npm run dev` → `curl http://localhost:5173/api/book/9780134092669`
- [ ] Deploy: `npm run deploy`
- [ ] Test production: `curl https://[deployment-url]/api/book/9780134092669`
- [ ] Monitor logs: `npx wrangler pages deployment tail`

---

## Future Enhancements

Planned features for serverless architecture:

1. **AI-Enhanced Summaries**: Use Cloudflare AI to generate book summaries
2. **Batch ISBN Lookup**: Single API call to fetch 10+ ISBNs (Scanner Mode optimization)
3. **Smart Prefetching**: Pre-cache ISBNs based on usage patterns
4. **Real-time Collaboration**: WebSocket support for multi-user sessions
5. **Analytics Dashboard**: D1 queries to visualize most-searched books

---

## Monitoring & Observability

Track serverless performance via Cloudflare Dashboard:

- **Workers Metrics**: Request count, success rate, P50/P95/P99 latencies
- **D1 Metrics**: Query count, database size, write latency
- **KV Metrics**: Cache hit rate, eviction rate, storage usage

**Key Performance Indicators (KPIs):**

- Cache Hit Rate: Target > 80% for production workloads
- P95 Response Time: Target < 500ms (cache hit), < 3s (cache miss)
- Error Rate: Target < 0.1% (graceful degradation)

---

## Troubleshooting

### Issue: "KV Cache Not Working"

**Symptom:** `X-Cache: MISS` on every request

**Fix:**

```bash
# Verify KV namespace exists
npx wrangler kv namespace list

# Verify wrangler.toml binding
cat wrangler.toml | grep -A 2 "kv_namespaces"

# Test KV write manually
npx wrangler kv key put --namespace-id=<ID> "test" "value"
npx wrangler kv key get --namespace-id=<ID> "test"
```

### Issue: "D1 Database Writes Failing"

**Symptom:** No records in `scans` table after API calls

**Fix:**

```bash
# Verify D1 database exists
npx wrangler d1 list

# Check table schema
npx wrangler d1 execute rangkai-scans --remote --command "PRAGMA table_info(scans);"

# Check recent writes
npx wrangler d1 execute rangkai-scans --remote --command "SELECT * FROM scans ORDER BY created_at DESC LIMIT 5;"
```

### Issue: "waitUntil Not Working"

**Symptom:** Response takes 3+ seconds (writes are blocking)

**Fix:**

- Ensure `platform.context.waitUntil()` is called correctly
- Verify Cloudflare Workers environment (not local dev)
- Check for `await` in waitUntil promise (should be fire-and-forget)

---

## Migration Notes

If upgrading from v1.2.1 to v1.3.0:

1. **No Breaking Changes**: Title searches still work client-side
2. **Scanner Mode**: Automatically uses serverless API for ISBNs
3. **Backward Compatibility**: `BookApiService.fetchAll()` still available
4. **Analytics**: New `cache_hit` field in events (optional)

---

## References

- [Cloudflare Workers Waituntil Pattern](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [SvelteKit API Routes](https://kit.svelte.dev/docs/routing#server)
