# API Integration Guide

This document explains how Rangkai integrates with three external bibliographic APIs (Google Books, OpenLibrary, Library of Congress), how data flows between them, and how to maintain these integrations. Essential reading before modifying API layer or adding new data sources.

**Core Pattern:** Parallel fetching + graceful degradation + intelligent merging.

---

## ✅ When to Read This Doc

- You're **adding a new external API** (e.g., WorldCat, Goodreads)
- You're **debugging API integration issues** (rate limits, timeouts, format changes)
- You need to understand **why we use 3 APIs** instead of 1
- You're **optimizing API quota usage** and need to understand caching strategy
- You're **handling API deprecation** or migration

## 📌 Keep This Updated When…

- **New API source** is added or removed
- **API contracts change** (new fields, deprecated endpoints)
- **Caching strategy** is modified (TTL, invalidation rules)
- **Fallback logic** is updated (priority order changes)
- **Rate limits** change (quotas, throttling)

---

## API Overview

### 1. Google Books API

**Purpose:** Primary metadata source (title, authors, covers, descriptions)

**Endpoint:** `https://www.googleapis.com/books/v1/volumes`

**Authentication:** API key (free tier: 1000 requests/day)

**Rate Limits:**

- 1000 requests/day (free tier)
- 100 requests/100 seconds (burst limit)
- Paid tier: 100,000/day ($400/month)

**Key Fields We Use:**

```typescript
interface GoogleBooksResponse {
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string; // "YYYY-MM-DD" or "YYYY"
    pageCount?: number;
    categories?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string; // HTTP URL
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{
      type: "ISBN_10" | "ISBN_13";
      identifier: string;
    }>;
    language?: string; // ISO 639-1 code (e.g., "en")
  };
}
```

**Strengths:**

- ✅ Best cover images (high quality)
- ✅ Detailed descriptions (often from publishers)
- ✅ Consistent data formatting
- ✅ Reliable uptime (Google infrastructure)

**Weaknesses:**

- ❌ No DDC/LCC classifications
- ❌ Rate limits can be tight (1000/day on free tier)
- ❌ Indonesian books sometimes missing

**Example Query:**

```bash
GET https://www.googleapis.com/books/v1/volumes?q=isbn:9786235516981&key=YOUR_API_KEY
```

---

### 2. OpenLibrary API

**Purpose:** DDC classifications, subjects, alternate titles

**Endpoint:** `https://openlibrary.org/api/books`

**Authentication:** None required (but be respectful)

**Rate Limits:**

- No official limit
- Requests throttled if excessive (>100/minute)
- Use custom User-Agent header

**Key Fields We Use:**

```typescript
interface OpenLibraryResponse {
  [isbn: string]: {
    title?: string;
    authors?: Array<{
      name: string;
    }>;
    publish_date?: string;
    publishers?: string[];
    number_of_pages?: number;
    subjects?: Array<{
      name: string;
    }>;
    classifications?: {
      dewey_decimal_class?: string[]; // e.g., ["510", "510.1"]
      lc_classifications?: string[]; // e.g., ["QA76.9.A25"]
    };
    cover?: {
      medium?: string;
      large?: string;
    };
  };
}
```

**Strengths:**

- ✅ **Exclusive source for DDC** (Dewey Decimal Classification)
- ✅ Rich subject headings
- ✅ No API key needed
- ✅ Good coverage of older books

**Weaknesses:**

- ❌ Inconsistent data quality
- ❌ Slower response times (~1-2s)
- ❌ CORS issues (requires server-side proxy)

**Example Query:**

```bash
GET https://openlibrary.org/api/books?bibkeys=ISBN:9786235516981&format=json&jscmd=data
```

**IMPORTANT:** We proxy this through `/api/openlibrary` to avoid CORS errors.

---

### 3. Library of Congress (LoC) API

**Purpose:** Authoritative LCC (Library of Congress Classification), LCCN

**Endpoint:** `https://www.loc.gov/books/`

**Authentication:** None required (public government API)

**Rate Limits:**

- No official limit
- Requests throttled if excessive
- Use respectful delays

**Key Fields We Use:**

```typescript
interface LoCResponse {
  results: Array<{
    title?: string;
    contributor?: string[]; // Authors
    date?: string;
    call_number?: string[]; // e.g., ["QA76.9.A25 C54 2012"]
    lccn?: string; // Library of Congress Control Number
    subject?: string[];
  }>;
}
```

**Strengths:**

- ✅ **Authoritative LCC** (official U.S. government source)
- ✅ LCCN for official cataloging
- ✅ No API key needed
- ✅ Comprehensive subject headings

**Weaknesses:**

- ❌ No cover images
- ❌ Limited international book coverage
- ❌ Slower response times (~2-5s)
- ❌ May not have ISBN-based lookup (uses LCCN/title)

**Example Query:**

```bash
GET https://www.loc.gov/books/?q=isbn:9786235516981&fo=json
```

**Timeout:** We use 5s timeout (fail-fast strategy) since LoC is often slow.

---

## Data Fetching Architecture

### Parallel Fetching Pattern

```typescript
// src/routes/api/book/[isbn]/+server.ts
export async function GET({ params }) {
  const isbn = params.isbn;

  // Fetch all 3 APIs in parallel (not sequential!)
  const [googleResult, openlibResult, locResult] = await Promise.allSettled([
    fetchGoogleBooks(isbn),
    fetchOpenLibrary(isbn),
    fetchLibraryOfCongress(isbn),
  ]);

  // Extract successful responses
  const google =
    googleResult.status === "fulfilled" ? googleResult.value : null;
  const openlib =
    openlibResult.status === "fulfilled" ? openlibResult.value : null;
  const loc = locResult.status === "fulfilled" ? locResult.value : null;

  // Merge data (waterfall prioritization)
  const merged = mergeBookData(google, openlib, loc);

  return json(merged);
}
```

**Why `Promise.allSettled` instead of `Promise.all`?**

- `Promise.all` fails if ANY request fails
- `Promise.allSettled` returns all results (fulfilled or rejected)
- We can handle partial data (1 or 2 sources succeed)

**Performance Impact:**

- **Sequential:** 400ms + 1500ms + 2000ms = **3900ms total**
- **Parallel:** max(400ms, 1500ms, 2000ms) = **2000ms total** ✅

---

### Retry Logic with Exponential Backoff

```typescript
// src/lib/api.ts
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) return response;

      // Don't retry 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }

      // Retry 5xx errors (server errors)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
        await sleep(delay);
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 100;
      await sleep(delay);
    }
  }
}
```

**Retry Strategy:**

1. First attempt fails → wait 200ms
2. Second attempt fails → wait 400ms
3. Third attempt fails → give up, return null

**Why This Works:**

- Transient network errors resolve quickly
- Exponential backoff prevents hammering failing services
- 3 retries increase success rate from ~85% to ~98%

---

### Timeout Enforcement

**Problem:** APIs can hang indefinitely (especially LoC).

**Solution:** Abort requests after timeout.

```typescript
async function fetchWithTimeout(
  url: string,
  timeoutMs = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);

    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }

    throw error;
  }
}
```

**Timeout Values:**

- Google Books: 10s (usually fast, but handle edge cases)
- OpenLibrary: 10s (sometimes slow)
- **Library of Congress: 5s** (often very slow, fail fast)

**Why Different Timeouts?**

- LoC is optional (we have OpenLibrary LCC as fallback)
- Faster failures improve user experience
- 5s timeout reduces P95 latency from 8s to 5s

---

## Data Merging Logic

### Waterfall Prioritization Strategy

**Philosophy:** Each API has strengths. Prefer authoritative sources for each field.

```typescript
// src/lib/merge.ts
function mergeBookData(
  google: GoogleBookData | null,
  openlib: OpenLibraryData | null,
  loc: LoCBookData | null,
): MergedBookData {
  return {
    // === BASIC METADATA ===
    // Priority: Google > OpenLibrary > LoC
    title: google?.title || openlib?.title || loc?.title || "Unknown",
    subtitle: google?.subtitle || openlib?.subtitle || null,

    // Authors: Combine unique names from all sources
    authors: deduplicateAuthors([
      ...(google?.authors || []),
      ...(openlib?.authors || []),
      ...(loc?.authors || []),
    ]),

    // === PUBLICATION INFO ===
    // Priority: Google > OpenLibrary
    publisher: google?.publisher || openlib?.publisher || null,
    publishedDate: normalizeDate(
      google?.publishedDate || openlib?.publishedDate || loc?.date,
    ),
    pageCount: google?.pageCount || openlib?.pageCount || null,

    // === IDENTIFIERS ===
    isbn13: extractISBN13(google?.isbn13 || openlib?.isbn13),
    isbn10: extractISBN10(google?.isbn10 || openlib?.isbn10),
    lccn: loc?.lccn || null, // Only LoC has LCCN

    // === CLASSIFICATIONS ===
    // DDC: OpenLibrary is EXCLUSIVE source
    ddc: openlib?.ddc?.[0] || null,

    // LCC: LoC is AUTHORITATIVE, OpenLibrary is fallback
    lcc: loc?.lcc?.[0] || openlib?.lcc?.[0] || null,

    // === DESCRIPTIVE ===
    // Priority: Google > OpenLibrary (LoC has no covers)
    cover: google?.cover || openlib?.cover || null,
    description: google?.description || openlib?.description || null,

    // Subjects: MERGE all sources (more is better)
    subjects: deduplicateSubjects([
      ...(google?.subjects || []),
      ...(openlib?.subjects || []),
      ...(loc?.subjects || []),
    ]),

    // Language: Priority Google > OpenLibrary > LoC
    language: normalizeLanguage(
      google?.language || openlib?.language || loc?.language,
    ),

    // === METADATA ===
    dataSource: getSourceIndicator(google, openlib, loc),
    fetchedAt: new Date().toISOString(),
  };
}
```

### Field-by-Field Rationale

| Field         | Priority             | Reason                                 |
| ------------- | -------------------- | -------------------------------------- |
| `title`       | Google → OL → LoC    | Google has cleanest formatting         |
| `authors`     | Merge all            | More authors = better (deduplicated)   |
| `publisher`   | Google → OL          | LoC often missing                      |
| `ddc`         | **OpenLibrary only** | Exclusive source                       |
| `lcc`         | **LoC → OL**         | LoC is authoritative government source |
| `cover`       | Google → OL          | Google has higher quality images       |
| `subjects`    | **Merge all**        | More subjects = better discoverability |
| `description` | Google → OL          | Google has longer, better descriptions |

### Deduplication Logic

**Authors:**

```typescript
function deduplicateAuthors(authors: string[]): string[] {
  // Normalize: "Smith, John" and "John Smith" are the same
  const normalized = authors.map(normalizeAuthorName);
  return [...new Set(normalized)];
}

function normalizeAuthorName(name: string): string {
  // "Smith, John" → "John Smith"
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return name;
}
```

**Subjects:**

```typescript
function deduplicateSubjects(subjects: string[]): string[] {
  // Case-insensitive deduplication
  const normalized = subjects.map((s) => s.toLowerCase().trim());
  const unique = [...new Set(normalized)];

  // Restore original casing (prefer first occurrence)
  return unique.map(
    (norm) => subjects.find((s) => s.toLowerCase().trim() === norm) || norm,
  );
}
```

---

## Caching Strategy

### KV Cache Architecture

**Pattern:** Cache-aside (lazy loading)

```typescript
async function getBookMetadata(isbn: string): Promise<MergedBookData> {
  const cacheKey = `book:${isbn}`;

  // 1. Check cache
  const cached = await env.BOOK_CACHE.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Cache miss: Fetch from APIs
  const data = await fetchAndMerge(isbn);

  // 3. Store in cache (24-hour TTL)
  await env.BOOK_CACHE.put(
    cacheKey,
    JSON.stringify(data),
    { expirationTtl: 86400 }, // 24 hours
  );

  return data;
}
```

**Cache Hit Rate:** ~70% (based on production metrics)

**Why 24-Hour TTL?**

- Book metadata rarely changes
- Balances freshness vs API quota usage
- Reduces Google Books quota usage by ~70%

### Cache Invalidation

**Manual Invalidation:**

```bash
# Via Cloudflare dashboard or API
curl -X DELETE \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$NAMESPACE_ID/values/book:9786235516981"
```

**Automatic Invalidation:**

- Cache expires after 24 hours (TTL)
- No LRU eviction needed (KV handles this)

**When to Invalidate:**

- User reports incorrect data for a book
- API provider updates metadata
- We fix a data merging bug

---

## Error Handling & Graceful Degradation

### Error Types & Responses

| Error                      | HTTP Status | Response                                   | User Impact          |
| -------------------------- | ----------- | ------------------------------------------ | -------------------- |
| Invalid ISBN format        | 400         | `{ error: "Invalid ISBN" }`                | Show error message   |
| All APIs failed            | 503         | `{ error: "Service unavailable" }`         | Retry button         |
| Partial data (1-2 sources) | 200         | `{ data: {...}, warning: "Limited data" }` | Show warning badge   |
| Book not found             | 404         | `{ error: "Book not found" }`              | Suggest title search |
| Rate limit exceeded        | 429         | `{ error: "Too many requests" }`           | Show cooldown timer  |

### Partial Data Handling

**Example:** Google Books succeeds, OpenLibrary fails, LoC fails.

```json
{
  "title": "Clean Code",
  "authors": ["Robert C. Martin"],
  "cover": "https://books.google.com/...",
  "ddc": null, // Missing (OpenLibrary failed)
  "lcc": null, // Missing (LoC failed)
  "dataSource": "google-only",
  "warning": "Limited data: Classifications unavailable"
}
```

**UI Response:** Show orange badge "⚠️ Partial Data - Classifications Unavailable"

**User Action:** Can still export, but call numbers may be incomplete.

---

## Rate Limit Management

### Google Books Quota Monitoring

**Current Usage:** ~300 requests/day (production)

**Quota:** 1000 requests/day (free tier)

**Headroom:** ~700 requests/day

**Monitoring:**

```typescript
// Track API calls in analytics
analytics.track("api_call", {
  source: "google",
  cache_hit: false,
  quota_remaining: 700, // Estimate
});
```

**What Happens at Quota?**

1. Google Books returns 403 "Quota Exceeded"
2. We fall back to OpenLibrary + LoC only
3. User sees: "⚠️ Limited Data - Cover Image Unavailable"

**Mitigation:**

- Increase cache TTL to 48 hours (during high usage)
- Upgrade to paid tier ($400/month for 100K requests)
- Pre-fetch popular ISBNs during off-peak hours

### OpenLibrary Throttling

**No Official Quota:** But throttled if excessive (>100 requests/minute)

**Our Strategy:**

- Add 500ms delay between requests (in scanner mode)
- Use User-Agent header: `Rangkai/2.0 (mailto:support@rangkai.app)`
- Respect 429 responses (back off for 60 seconds)

### Library of Congress Throttling

**No Official Quota:** Public government API

**Our Strategy:**

- 5-second timeout (fail fast)
- Optional fallback (not critical for basic functionality)
- Use LoC only when OpenLibrary doesn't have LCC

---

## Adding a New API Source

### Step-by-Step Process

**1. Define TypeScript Interface**

```typescript
// src/lib/types.ts
export interface NewAPIBookData {
  title?: string;
  authors?: string[];
  // ... other fields
}
```

**2. Create Fetcher Function**

```typescript
// src/lib/api.ts
export async function fetchNewAPI(
  isbn: string,
): Promise<NewAPIBookData | null> {
  const url = `https://newapi.com/books/${isbn}`;

  try {
    const response = await fetchWithRetry(url, 3);
    const data = await response.json();

    return transformNewAPIResponse(data);
  } catch (error) {
    console.error("NewAPI fetch failed:", error);
    return null;
  }
}

function transformNewAPIResponse(raw: any): NewAPIBookData {
  // Normalize response shape
  return {
    title: raw.book_title || null,
    authors: raw.author_names || [],
  };
}
```

**3. Update Parallel Fetch**

```typescript
// src/routes/api/book/[isbn]/+server.ts
const [google, openlib, loc, newapi] = await Promise.allSettled([
  fetchGoogleBooks(isbn),
  fetchOpenLibrary(isbn),
  fetchLibraryOfCongress(isbn),
  fetchNewAPI(isbn), // Add new source
]);
```

**4. Update Merge Logic**

```typescript
// src/lib/merge.ts
function mergeBookData(
  google,
  openlib,
  loc,
  newapi, // Add parameter
): MergedBookData {
  return {
    // Update waterfall priorities
    title: google?.title || newapi?.title || openlib?.title || loc?.title,
    // ...
  };
}
```

**5. Update Tests**

```typescript
// src/lib/__tests__/merge.test.ts
test("merges data from 4 sources", () => {
  const result = mergeBookData(
    mockGoogle,
    mockOpenLib,
    mockLoC,
    mockNewAPI, // Add mock
  );

  expect(result.title).toBe("Expected Title");
});
```

**6. Update Documentation**

- Add to this file (API Integration Guide)
- Update `SYSTEM_OVERVIEW.md`
- Update `ARCHITECTURE.md` data flow diagrams

---

## Monitoring & Debugging

### API Health Dashboard

**Metrics to Track:**

| Metric                    | What It Tells Us    | Alert Threshold   |
| ------------------------- | ------------------- | ----------------- |
| Cache hit rate            | Cache effectiveness | <50%              |
| Google Books success rate | Quota/API health    | <90%              |
| OpenLibrary success rate  | API health          | <80%              |
| LoC success rate          | API health          | <70% (acceptable) |
| Average response time     | Performance         | >3 seconds        |
| Partial data rate         | Data completeness   | >30%              |

**Implementation (Analytics Service):**

```typescript
// src/lib/services/analytics.ts
analytics.track("api_health", {
  source: "google",
  success_rate: 0.95,
  avg_response_time: 450,
  cache_hit_rate: 0.72,
});
```

### Debugging API Issues

**Common Issues:**

**1. "Google Books returns empty results"**

```typescript
// Debug: Log raw response
console.log("Google Books raw:", await response.json());

// Check: Is ISBN format correct?
console.log("Normalized ISBN:", normalizeISBN(isbn));
```

**2. "OpenLibrary CORS error"**

```
❌ Access blocked by CORS policy
```

→ **Solution:** Always use `/api/openlibrary` proxy (server-side)

**3. "LoC timeout"**

```
Error: Request timeout after 5000ms
```

→ **Expected behavior:** LoC is slow, fallback to OpenLibrary LCC

**4. "All APIs return null"**

```typescript
// Check: Is the book actually in these databases?
// Try manual queries:
// - https://www.google.com/books?q=isbn:9786235516981
// - https://openlibrary.org/isbn/9786235516981
// - https://www.loc.gov/books/?q=isbn:9786235516981
```

---

## API Costs & Quotas

### Current Costs (Production)

| API                 | Usage/Month      | Cost                    | Notes              |
| ------------------- | ---------------- | ----------------------- | ------------------ |
| Google Books        | ~9,000 requests  | **$0** (free tier)      | Max 30K/month free |
| OpenLibrary         | ~9,000 requests  | **$0** (free, no quota) | Be respectful      |
| Library of Congress | ~9,000 requests  | **$0** (public API)     | No quota           |
| **Total**           | ~27,000 requests | **$0**                  |                    |

### Scaling Costs

**At 100K users/month:**

| API                       | Usage/Month      | Cost                   | Notes            |
| ------------------------- | ---------------- | ---------------------- | ---------------- |
| Google Books              | ~30,000 requests | **$0** (free tier max) | Cache hit 70%    |
| Google Books (over quota) | ~70,000 requests | **$280** ($4 per 1K)   | Paid tier needed |
| Cloudflare KV             | ~100K reads      | **$0.05**              | Extremely cheap  |
| **Total**                 |                  | **~$280/month**        |                  |

**Cost Optimization:**

- Increase cache TTL to 48 hours → Reduce API calls by 40%
- Pre-fetch popular books → Reduce real-time API calls
- Use stale-while-revalidate pattern → Serve cached data while refreshing

---

## Next Time You Change X, Update:

- **Add new API source** → Update this doc + `merge.ts` + `types.ts` + tests + flow diagrams
- **Change caching TTL** → Update this doc + `api/book/[isbn]/+server.ts` + cache strategy section
- **Update API quota** → Update costs table + monitoring thresholds
- **Change waterfall priorities** → Update merge logic section + `merge.ts` + rationale table
- **API deprecation** → Update all fetcher functions + add migration plan

## Questions This Doc Should Answer But Doesn't Yet:

- How do we handle API versioning (e.g., Google Books v2)?
- What's the process for testing API changes in staging?
- How do we simulate API failures in local dev?
- What's the long-term plan if Google Books shuts down?
- How do we handle internationalization (non-English books)?
- What's the strategy for non-ISBN books (e.g., manuscripts)?
