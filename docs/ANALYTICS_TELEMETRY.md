# Analytics & Telemetry System

## Overview

Rangkai now includes a comprehensive analytics and telemetry system that tracks key lifecycle events, performance metrics, and user interactions. This system provides visibility into how the application is being used, cache effectiveness, and API source performance.

## 🎯 Tracked Events

### 1. **Search Performance** (`search_performed`)

Tracks every search operation with timing and result metrics.

**Properties:**

- `type`: 'isbn' | 'title'
- `query_length`: number (characters in search query)
- `duration_ms`: number (total search time in milliseconds)
- `result_count`: number (how many results returned)
- `timestamp`: ISO 8601 string

**When Triggered:**

- ISBN search completes (successful or failed)
- Title search completes (successful or failed)

**Example Dev Console Output:**

```
🔍 [Analytics] search_performed {
  type: 'isbn',
  query_length: 13,
  duration_ms: 1234,
  result_count: 1,
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

---

### 2. **Cache Performance** (`cache_hit`)

Tracks cache hits and misses for all three API sources.

**Properties:**

- `cache_type`: 'google' | 'openlibrary' | 'loc'
- `key`: string (truncated cache key)
- `is_isbn`: boolean (whether the query was an ISBN)
- `timestamp`: ISO 8601 string

**When Triggered:**

- Every time `ApiCache.get()` is called
- Both cache hits and cache misses are tracked

**Example Dev Console Output:**

```
⚡ [Analytics] cache_hit {
  cache_type: 'google',
  key: '9780134092669',
  is_isbn: true,
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- High cache hit rate = efficient API quota usage
- Track which source has better cache performance
- Identify ISBN patterns that benefit from smart prefetching

---

### 2a. **Cache Set** (`cache_set`)

Tracks when we write to KV cache (success or failure).

Properties:

- `cache_type`: 'google' | 'openlibrary' | 'loc' | 'kv'
- `key`: string (full cache key or truncated)
- `key_type`: 'book' | 'metadata' | 'userSession' | 'apiRateLimit' (optional)
- `is_isbn`: boolean (true if book cache)
- `ttl`: number (seconds) optional
- `success`: boolean
- `message`: string (error message on failure, optional)
- `timestamp`: ISO 8601 string

When Triggered:

- After a KV:// set operation (cache write). Both successful and failed sets are tracked.

Example Dev Console Output:

```
⚡ [Analytics] cache_set { cache_type: 'kv', key: 'book:9780134092669', key_type: 'book', is_isbn: true, ttl: 86400, success: true, timestamp: '2025-11-20T10:30:45.123Z' }
```

Analytics Insights:

- Track cache write failures to detect KV quota or permission issues
- Monitor how often cache writes succeed for book metadata
- Measure cache TTL distribution across keys

---

### 3. **Data Source Attribution** (`data_source_used`)

Tracks which combination of API sources provided the final merged data.

**Properties:**

- `source`: 'all-three' | 'google-loc' | 'google-openlibrary' | 'loc-openlibrary' | 'google-only' | 'loc-only' | 'openlibrary-only'
- `has_google`: boolean
- `has_openlibrary`: boolean
- `has_loc`: boolean
- `is_partial`: boolean (true if any source failed)
- `timestamp`: ISO 8601 string

**When Triggered:**

- After successful ISBN search with merged data

**Example Dev Console Output:**

```
📊 [Analytics] data_source_used {
  source: 'all-three',
  has_google: true,
  has_openlibrary: true,
  has_loc: true,
  is_partial: false,
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- Which API sources are most reliable?
- How often do we get complete data vs partial data?
- Is Library of Congress consistently slow/unavailable?

---

### 4. **API Timing** (`api_timing`)

Tracks individual API request performance and success rates.

**Properties:**

- `source`: 'google' | 'openlibrary' | 'loc'
- `endpoint`: 'isbn_search' | 'title_search'
- `duration_ms`: number (request time in milliseconds)
- `success`: boolean (whether the request succeeded)
- `timestamp`: ISO 8601 string

**When Triggered:**

- Every API request to Google Books, OpenLibrary, or Library of Congress

**Example Dev Console Output:**

```
⏱️ [Analytics] api_timing {
  source: 'loc',
  endpoint: 'isbn_search',
  duration_ms: 4567,
  success: true,
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- Which API is fastest/slowest?
- Success rate per source (reliability)
- Identify timeout patterns

---

### 5. **Error Tracking** (`error_occurred`)

Tracks all API errors, network failures, and parsing issues.

**Properties:**

- `error_type`: 'api_503' | 'api_timeout' | 'parse_error' | 'network_error' | 'rate_limit' | 'unknown'
- `source`: 'google' | 'openlibrary' | 'loc' | 'general'
- `message`: string (optional error details)
- `timestamp`: ISO 8601 string

**When Triggered:**

- API returns 503 (Service Unavailable)
- API returns 429 (Rate Limited)
- Network timeout occurs
- Parsing JSON fails

**Example Dev Console Output:**

```
❌ [Analytics] error_occurred {
  error_type: 'api_503',
  source: 'openlibrary',
  message: '503 Service Temporarily Unavailable',
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- Which API is most error-prone?
- Are we hitting rate limits?
- Network stability patterns

---

### 5a. **Metadata Source Degraded** (`metadata_source_degraded`)

Tracks when a metadata source (LoC, OpenLibrary, Google) returns degraded status (503/429/404) or is otherwise unreliable.

Properties:

- `provider`: 'google' | 'openlibrary' | 'loc' | 'other'
- `status`: number | string (HTTP status code or short message)
- `reason`: string (optional)
- `fallback`: string (suggested fallback source, optional)
- `isbn`: string (optional, when applicable)
- `query`: string (optional, when applicable)
- `timestamp`: ISO 8601 string

When Triggered:

- Any time we detect a degraded response from a provider (503/429/404) or returned errors indicating unavailability.

Example Dev Console Output:

```
⚠️ [Analytics] metadata_source_degraded {
  provider: 'openlibrary',
  status: 503,
  reason: '503 Service Temporarily Unavailable',
  fallback: 'google_books',
  query: '9780134092669'
}
```

Analytics Insights:

- Which providers degrade frequently?
- How often do we need to fallback from LoC/OpenLibrary to Google?
- Use this to alert on provider outages or rate-limiting events

---

### 6. **Scanner Mode** (`scanner_mode_toggled`)

Tracks when users enable/disable barcode scanner mode.

**Properties:**

- `enabled`: boolean
- `timestamp`: ISO 8601 string

**When Triggered:**

- User clicks "Enable Scanner Mode" button

**Example Dev Console Output:**

```
📱 [Analytics] scanner_mode_toggled {
  enabled: true,
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- What % of users use scanner mode?
- Session duration in scanner mode

---

### 7. **Export Operations** (`batch_export`, `single_export`)

Tracks CSV and MARCXML exports (both single and batch).

**Batch Export Properties:**

- `count`: number (how many books exported)
- `format`: 'csv' | 'marcxml'
- `timestamp`: ISO 8601 string

**Single Export Properties:**

- `format`: 'csv' | 'marcxml'
- `isbn`: string (optional book identifier)
- `timestamp`: ISO 8601 string

**When Triggered:**

- User exports batch of scanned books
- User exports single book metadata

**Example Dev Console Output:**

```
📦 [Analytics] batch_export {
  count: 47,
  format: 'csv',
  timestamp: '2025-11-20T10:30:45.123Z'
}

💾 [Analytics] single_export {
  format: 'marcxml',
  isbn: '9780134092669',
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

**Analytics Insights:**

- Which export format is more popular?
- Average batch size
- Export frequency

---

### 8. **User Interactions** (`user_interaction`)

Tracks navigation and UI actions.

**Properties:**

- `action`: 'book_selected' | 'back_to_search' | 'home_navigation' | 'view_raw_data'
- `source`: 'google' | 'openlibrary' (optional, for book selection)
- `timestamp`: ISO 8601 string

**When Triggered:**

- User selects a book from search results
- User clicks "Back to Search"
- User clicks home/logo to reset
- User views raw API data

**Example Dev Console Output:**

```
🖱️ [Analytics] user_interaction {
  action: 'book_selected',
  source: 'google',
  timestamp: '2025-11-20T10:30:45.123Z'
}
```

---

## 🎨 Dev Mode vs Production Mode

### Development Mode (`import.meta.env.DEV === true`)

- Events logged to **browser console** with colors and emojis
- Distinct colors per event type for easy debugging
- Full property details visible

**Console Output Example:**

```
⚡ [Analytics] cache_hit  { cache_type: 'google', key: '978...', ... }
🔍 [Analytics] search_performed  { type: 'isbn', duration_ms: 1234, ... }
❌ [Analytics] error_occurred  { error_type: 'api_503', source: 'loc', ... }
```

### Production Mode (`import.meta.env.DEV === false`)

- Events logged to `console.info` with `[Analytics]` prefix
- Prepared for integration with external analytics services
- Easy to filter in production logs

**Console Output Example:**

```
[Analytics] search_performed { type: 'isbn', duration_ms: 1234, ... }
[Analytics] cache_hit { cache_type: 'google', key: '978...', ... }
```

---

## 📊 Future Analytics Integration

The system is designed to easily integrate with third-party analytics platforms:

### Plausible Analytics (Recommended for Privacy)

```typescript
// In analytics.ts → logProdMode()
if (window.plausible) {
  window.plausible(event.name, { props: event.properties });
}
```

### Google Analytics 4

```typescript
// In analytics.ts → logProdMode()
if (window.gtag) {
  window.gtag("event", event.name, event.properties);
}
```

### PostHog

```typescript
// In analytics.ts → logProdMode()
if (window.posthog) {
  window.posthog.capture(event.name, event.properties);
}
```

---

## 🔍 Key Performance Metrics

### Cache Effectiveness

```
Cache Hit Rate = (cache_hit events) / (total search_performed events)
Target: >50% for production usage
```

### API Reliability

```
API Success Rate = (api_timing.success = true) / (total api_timing events)
Target: >95% for Google Books, >85% for OpenLibrary, >70% for LoC
```

### Search Performance

```
Average Search Duration = average(search_performed.duration_ms)
Target: <2.5s for ISBN, <3.5s for title
```

### Data Completeness

```
Complete Data Rate = (data_source_used.source = 'all-three') / (total data_source_used events)
Target: >80%
```

---

## 🛠️ Implementation Details

### File Structure

```
src/lib/services/analytics.ts    # Analytics service (singleton)
src/lib/api.ts                    # API timing + cache tracking
src/routes/+page.svelte           # UI interaction tracking
```

### Key Design Patterns

#### 1. Singleton Pattern

```typescript
export const Analytics = AnalyticsService.getInstance();
```

Ensures single analytics instance across the app.

#### 2. Type-Safe Events

```typescript
Analytics.track("search_performed", {
  type: "isbn", // ✅ Type-checked
  duration_ms: 1234, // ✅ Type-checked
  invalid_prop: "test", // ❌ TypeScript error
});
```

#### 3. Performance Timing

```typescript
const startTime = performance.now();
// ... do work ...
const duration = Math.round(performance.now() - startTime);
Analytics.track('search_performed', { duration_ms: duration, ... });
```

---

## 📈 Sample Analytics Dashboard Queries

### Most Common Search Type

```sql
SELECT type, COUNT(*)
FROM search_performed
GROUP BY type
```

### API Slowest Sources

```sql
SELECT source, AVG(duration_ms) as avg_ms
FROM api_timing
WHERE success = true
GROUP BY source
ORDER BY avg_ms DESC
```

### Error Frequency by Source

```sql
SELECT source, error_type, COUNT(*) as count
FROM error_occurred
GROUP BY source, error_type
ORDER BY count DESC
```

### Cache Hit Rate

```sql
SELECT
  cache_type,
  COUNT(*) FILTER (WHERE key IS NOT NULL) as hits,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE key IS NOT NULL) / COUNT(*), 2) as hit_rate_pct
FROM cache_hit
GROUP BY cache_type
```

---

## 🔐 Privacy Considerations

- **No PII (Personally Identifiable Information)** is tracked
- Cache keys are **truncated** to 50 characters
- ISBN numbers are stored (public data)
- Search queries are **not** stored (only query length)
- No user IP addresses or session IDs tracked

---

## 🚀 Next Steps

1. **Enable External Analytics**
   - Add Plausible Analytics script to `app.html`
   - Update `logProdMode()` in `analytics.ts`

2. **Create Monitoring Dashboards**
   - Set up Grafana/Kibana for real-time monitoring
   - Create alerts for high error rates

3. **A/B Testing**
   - Track feature usage to inform UX decisions
   - Measure impact of optimizations

4. **User Preferences**
   - Add opt-out toggle for analytics
   - Store preference in localStorage

---

## 📝 Usage Examples

### Track Custom Event

```typescript
import { Analytics } from "$lib/services/analytics";

// In any component or service
Analytics.track("search_performed", {
  type: "isbn",
  query_length: 13,
  duration_ms: 1234,
  result_count: 1,
});
```

### Disable Analytics

```typescript
import { Analytics } from "$lib/services/analytics";

Analytics.setEnabled(false); // Stop tracking
Analytics.setEnabled(true); // Resume tracking
```

### Check Status

```typescript
if (Analytics.isEnabled()) {
  console.log("Analytics is active");
}
```

---

## 📖 Event Reference Summary

| Event Name             | Category    | Key Metrics               | Frequency         |
| ---------------------- | ----------- | ------------------------- | ----------------- |
| `search_performed`     | Performance | duration_ms, result_count | Per search        |
| `cache_hit`            | Performance | cache_type, is_isbn       | Per cache access  |
| `data_source_used`     | Reliability | source, is_partial        | Per ISBN result   |
| `api_timing`           | Performance | duration_ms, success      | Per API call      |
| `error_occurred`       | Reliability | error_type, source        | Per error         |
| `scanner_mode_toggled` | Usage       | enabled                   | Per toggle        |
| `batch_export`         | Usage       | count, format             | Per batch export  |
| `single_export`        | Usage       | format, isbn              | Per single export |
| `user_interaction`     | Usage       | action, source            | Per click         |

---

## 🎯 Success Criteria

The analytics system is working correctly when:

✅ Dev console shows colored, emoji-prefixed events
✅ All event properties are type-safe (TypeScript enforced)
✅ No performance impact (<5ms overhead per event)
✅ Production logs include `[Analytics]` prefix
✅ Zero PII tracked
✅ Easy to integrate with external services

---

**Last Updated:** November 20, 2025  
**Status:** ✅ Production Ready  
**Version:** 1.0.0
