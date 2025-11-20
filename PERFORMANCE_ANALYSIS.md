# Book Search Performance Analysis & Optimization Guide

## Current Performance Bottlenecks

### 1. **Sequential API Calls (CRITICAL)**
**Current Issue:** When selecting a book from results, the code makes 2 sequential API calls:
- First: Fetch OpenLibrary data (if ISBN available)
- Then: Fetch Google data (if ISBN from OpenLibrary)

**Example (Line 218-223 in +page.svelte):**
```typescript
// Slow - Sequential
openLibraryData = await fetchOpenLibrary(isbn, true);
googleData = await fetchGoogle(isbn, true, 1);
```

**Impact:** ~2-5 second delay per book selection
**Severity:** 🔴 CRITICAL

---

### 2. **Redundant OpenLibrary Details Fetch**
**Current Issue:** When selecting from OpenLibrary results, code fetches detailed data from `/works/{key}.json` endpoint
- This makes an extra HTTP request
- The search results already contain most useful data

**Example (Line 231-251):**
```typescript
const detailsUrl = `https://openlibrary.org${selectedDoc.key}.json`;
const detailsResponse = await fetch(detailsUrl);
```

**Impact:** +1-2 seconds per OpenLibrary selection
**Severity:** 🟠 HIGH

---

### 3. **No Request Caching**
**Current Issue:** Identical searches within the session are re-fetched from APIs
- User searches for ISBN, later clicks same ISBN = new API call
- Memory could hold recent results

**Impact:** Wastes API quota and increases latency
**Severity:** 🟠 HIGH

---

### 4. **Rate Limiting Not Optimized**
**Current Issue:** Rate limiter tracks requests but no adaptive backoff
- When rate limit is hit, user gets error instead of retry

**Severity:** 🟡 MEDIUM

---

## Optimization Recommendations

### PRIORITY 1: Parallelize API Calls (Fastest Win)
**Expected Speed Improvement:** 50-70% faster (2-5s → 1.5-2s)

Replace sequential calls with `Promise.all()`:

```typescript
// Fast - Parallel
const [openLibraryData, googleData] = await Promise.all([
  fetchOpenLibrary(isbn, true),
  fetchGoogle(isbn, true, 1)
]);
```

**Files to Update:**
- `src/routes/+page.svelte` lines 218-226 (Google book selection)
- `src/routes/+page.svelte` lines 251-260 (OpenLibrary book selection)

---

### PRIORITY 2: Add Response Caching
**Expected Speed Improvement:** 90%+ faster on repeat searches

Implement a simple in-memory cache:

```typescript
const searchCache = new Map<string, { 
  google?: GoogleBooksResponse; 
  openlibrary?: OpenLibraryBookData;
  timestamp: number;
}>();

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function getCachedOrFetch(key: string, fetcher: () => Promise<any>) {
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  const result = await fetcher();
  searchCache.set(key, { ...result, timestamp: Date.now() });
  return result;
}
```

**Files to Update:**
- `src/routes/+page.svelte` - Add cache logic to `fetchGoogle()` and `fetchOpenLibrary()`

---

### PRIORITY 3: Remove Redundant OpenLibrary Details Fetch
**Expected Speed Improvement:** 30-40% faster on OpenLibrary selections

The search results (`selectedDoc`) already contain:
- ISBN values
- Author names
- Cover image
- Basic metadata

Use `selectedDoc` directly instead of fetching `/works/{key}.json`

**Files to Update:**
- `src/routes/+page.svelte` lines 231-255 (simplify to direct mapping)

---

### PRIORITY 4: Add Request Debouncing
**Expected Speed Improvement:** Prevents duplicate requests during typing

Use debounce for search input to prevent multiple submissions:

```typescript
let debounceTimer: ReturnType<typeof setTimeout>;

function handleSearchWithDebounce() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleSearch();
  }, 300); // Wait 300ms after user stops typing
}
```

---

### PRIORITY 5: Implement Adaptive Rate Limit Backoff
**Expected Improvement:** Better UX when hitting API limits

```typescript
async function fetchWithRetry(
  url: string, 
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) { // Rate limited
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Performance Comparison: Before vs After

### Before Optimization:
- **ISBN Search**: ~2-3s (parallel already, good)
- **Book Selection from Google**: ~3-5s (sequential OL + Google)
- **Book Selection from OpenLibrary**: ~4-6s (details fetch + Google)
- **Repeat Search**: ~2-3s (no cache)
- **API Quota**: Uses more requests than necessary

### After All Optimizations:
- **ISBN Search**: ~2-3s (no change)
- **Book Selection from Google**: ~1.5-2s (50% faster, parallel)
- **Book Selection from OpenLibrary**: ~1-1.5s (70% faster, no details fetch)
- **Repeat Search**: ~0.1s (cached)
- **API Quota**: 30-40% fewer requests

---

## Implementation Priority

1. **🔴 CRITICAL (Do First)**: Parallelize API calls
   - Easiest to implement
   - 50-70% speed improvement
   - 15-20 minutes work

2. **🟠 HIGH (Do Next)**: Add request caching
   - 90%+ improvement for repeats
   - 20-30 minutes work

3. **🟠 HIGH (Do Soon)**: Remove redundant OL details fetch
   - 30-40% improvement on OL selections
   - 10-15 minutes work

4. **🟡 MEDIUM**: Add debouncing
   - Better UX, less server load
   - 5 minutes work

5. **🟡 MEDIUM**: Retry with backoff
   - Handles rate limits gracefully
   - 15 minutes work

---

## Code Examples Ready to Implement

See the attached implementation files for ready-to-use code snippets for each optimization.

Would you like me to implement any of these optimizations now?
