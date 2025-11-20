# Library of Congress API Integration Guide

## Overview
The Rangkai Book Metadata Harvester has been upgraded from a **2-source system** (Google Books + OpenLibrary) to a **3-source system** adding **Library of Congress (LoC)** as a robust, authoritative source for classification data.

## Why Library of Congress?

### Problems with OpenLibrary
- **Rate Limited**: Strict rate limits cause 503 errors
- **Unreliable**: Service frequently unavailable
- **Incomplete**: Missing data for many books

### Benefits of LoC Integration
- ✅ **Authoritative**: Official source for LCC (Library of Congress Classification)
- ✅ **Free**: No API key required
- ✅ **Reliable**: Stable government-maintained service
- ✅ **Comprehensive**: Extensive catalog coverage

## Architecture Changes

### Type System (`src/lib/types.ts`)

#### New Interface: `LoCBookData`
```typescript
export interface LoCBookData {
  results?: Array<{
    title?: string;
    contributor?: string[];      // Authors
    date?: string;               // Publication date
    subject?: string[];          // Subject headings
    description?: string[];
    language?: string[];
    number_lccn?: string;        // LCCN identifier
    item?: {
      call_number?: string[];    // LCC classification (HIGH VALUE)
      control_number?: string[];
    };
    url?: string;
  }>;
}
```

#### Updated `MergedBookData.dataSource`
```typescript
dataSource?: 
  | 'all-three'           // All 3 sources succeeded
  | 'google-loc'          // Google + LoC only
  | 'google-openlibrary'  // Google + OpenLibrary only
  | 'loc-openlibrary'     // LoC + OpenLibrary only
  | 'google-only'         // Only Google Books
  | 'loc-only'            // Only LoC
  | 'openlibrary-only';   // Only OpenLibrary
```

### API Service Layer (`src/lib/api.ts`)

#### New Method: `fetchLibraryOfCongress()`
```typescript
static async fetchLibraryOfCongress(isbn: string): Promise<LoCBookData | null>
```

**Endpoint**: `https://www.loc.gov/books/?q={isbn}&fo=json&at=results`

**Features**:
- 5-second timeout (LoC can be slow - fail fast)
- Graceful degradation on 503/429/404 errors
- Silent failure returns `null` (allows fallback to other sources)
- ISBN-only search (LoC doesn't support title search well)

#### New Method: `fetchAll()`
```typescript
static async fetchAll(
  query: string, 
  isIsbn: boolean, 
  googleLimit = 1, 
  openLibraryLimit = 1
): Promise<{
  google: GoogleBooksResponse | null;
  openlibrary: OpenLibraryBookData | OpenLibrarySearchResponse | null;
  loc: LoCBookData | null;
  errors: { google?: Error; openlibrary?: Error; loc?: Error };
}>
```

**Parallel Execution**:
```typescript
Promise.allSettled([
  fetchGoogleBooks(),    // 10s timeout
  fetchOpenLibrary(),    // 10s timeout
  fetchLibraryOfCongress() // 5s timeout (ISBN only)
])
```

#### Legacy Support: `fetchBoth()`
The old `fetchBoth()` method remains for backward compatibility:
```typescript
static async fetchBoth(...) {
  const result = await this.fetchAll(...);
  return { google: result.google, openlibrary: result.openlibrary, errors: {...} };
}
```

### Data Merging (`src/lib/merge.ts`)

#### Updated Function Signature
```typescript
export function processAndRenderMergedData(
  google: GoogleBookItem['volumeInfo'] | null,
  openlib: OpenLibraryBookData | null,
  loc: LoCBookData | null = null  // NEW: Optional LoC data
): MergedBookData
```

#### "Waterfall of Data" Prioritization Strategy

| Field | Priority Order | Rationale |
|-------|---------------|-----------|
| **Title** | Google → OpenLibrary → LoC | Google has cleanest formatting |
| **Author** | Google → OpenLibrary → LoC | Google most reliable |
| **Publisher** | Google → OpenLibrary | Google preferred |
| **Date** | Google → OpenLibrary → LoC | Google most consistent |
| **Pages** | Google → OpenLibrary | Google more accurate |
| **ISBN** | Google → OpenLibrary | Google standardized |
| **DDC** | OpenLibrary only | Only source with DDC |
| **LCC** | **LoC → OpenLibrary** | **LoC is authoritative source** |
| **Description** | Google → OpenLibrary → LoC | Google best quality |
| **Language** | Google → OpenLibrary → LoC | Google most complete |
| **Subjects** | **Combined & deduplicated** | All 3 sources merged |
| **Cover** | Google → OpenLibrary | LoC doesn't provide covers |
| **Info Link** | Google → LoC | LoC provides authoritative links |

#### Subject Deduplication
```typescript
const googleSubjects = google?.categories || [];
const openlibSubjects = openlib?.subjects?.slice(0, 5) || [];
const locSubjects = locResult?.subject?.slice(0, 5) || [];

const allSubjects = [...googleSubjects, ...openlibSubjects, ...locSubjects];
const uniqueSubjects = Array.from(new Set(allSubjects)).slice(0, 10);
```

## Migration Steps

### Step 1: Update Import Statements
```typescript
// Before
import { BookApiService } from '$lib/api';

// After (same - backward compatible)
import { BookApiService, locCache } from '$lib/api';
```

### Step 2: Update API Calls (for ISBN Search)

#### Option A: Use New `fetchAll()` Method (Recommended)
```typescript
const result = await BookApiService.fetchAll(isbn, true, 1, 1);
const { google, openlibrary, loc, errors } = result;

const googleData = google?.items?.[0]?.volumeInfo || null;
const openLibraryData = openlibrary as OpenLibraryBookData | null;

const mergedData = processAndRenderMergedData(googleData, openLibraryData, loc);
```

#### Option B: Keep Using `fetchBoth()` (Backward Compatible)
```typescript
// No changes needed - works as before
const result = await BookApiService.fetchBoth(isbn, true, 1, 1);
const mergedData = processAndRenderMergedData(googleData, openLibraryData);
// Note: LoC data won't be included, but code still works
```

### Step 3: Update Cache Handling
```typescript
// Add LoC cache to clearing logic
import { googleCache, openLibraryCache, locCache } from '$lib/api';

function clearAllCaches() {
  googleCache.clear();
  openLibraryCache.clear();
  locCache.clear(); // NEW
}
```

### Step 4: Update Error Handling
```typescript
const { google, openlibrary, loc, errors } = await BookApiService.fetchAll(isbn, true);

if (errors.google) {
  console.warn('Google API error:', errors.google.message);
}
if (errors.openlibrary) {
  console.warn('OpenLibrary API error:', errors.openlibrary.message);
}
if (errors.loc) {
  console.warn('LoC API error:', errors.loc.message);
}
```

### Step 5: Update UI for Data Source Tracking
```typescript
{#if mergedData.dataSource === 'all-three'}
  <span class="text-green-600">✓ Complete data from all 3 sources</span>
{:else if mergedData.dataSource === 'google-loc'}
  <span class="text-blue-600">⚠️ Using Google + LoC (OpenLibrary unavailable)</span>
{:else if mergedData.dataSource === 'google-openlibrary'}
  <span class="text-amber-600">⚠️ Using Google + OpenLibrary (LoC unavailable)</span>
{/if}
```

## Testing the Integration

### Manual Test Cases

#### Test 1: ISBN with LoC Data
```
ISBN: 9780143034902
Expected: All 3 sources should return data
Expected LCC: From LoC (authoritative)
```

#### Test 2: ISBN with LoC Timeout
```
Simulate: Slow LoC response (>5s)
Expected: Graceful degradation to Google + OpenLibrary
Expected dataSource: 'google-openlibrary'
```

#### Test 3: ISBN Not in LoC
```
ISBN: Recent publication not yet in LoC
Expected: Google + OpenLibrary only
Expected dataSource: 'google-openlibrary'
```

### Unit Tests
```typescript
// Test LoC integration
it('prioritizes LoC for LCC classification', () => {
  const loc = {
    results: [{
      item: { call_number: ['PS3566.A822 Z46'] }
    }]
  };
  const merged = processAndRenderMergedData(google, openlib, loc);
  expect(merged.lcc).toBe('PS3566.A822 Z46');
});

// Test graceful degradation
it('handles missing LoC data gracefully', () => {
  const merged = processAndRenderMergedData(google, openlib, null);
  expect(merged.dataSource).toBe('google-openlibrary');
});
```

## Performance Considerations

### Timeout Strategy
| Source | Timeout | Rationale |
|--------|---------|-----------|
| Google Books | 10s | Generally fast |
| OpenLibrary | 10s | Can be slow |
| **LoC** | **5s** | **Fail fast to avoid blocking** |

### Caching
All 3 sources use LRU caching:
- **TTL**: 5 minutes
- **Max Size**: 100 items
- **Separate Caches**: Independent eviction policies

### Parallel Execution
All 3 APIs called simultaneously using `Promise.allSettled()` - total time = slowest API (not sum of all).

## Error Handling

### Silent Failures (Return `null`)
- LoC 503 Service Unavailable
- LoC 429 Too Many Requests
- LoC 404 Not Found
- Network timeouts
- Malformed JSON responses

### Hard Failures (Throw Error)
- LoC 500 Server Error
- LoC authentication errors (if API changes)

## Limitations

### LoC API Constraints
1. **ISBN Search Only**: LoC doesn't support reliable title search
2. **No Cover Images**: LoC doesn't provide book cover URLs
3. **Slower Response Times**: Government servers can be slow (hence 5s timeout)
4. **No Rate Limit Info**: LoC doesn't publish official rate limits

### Fallback Strategy
If LoC fails:
1. LCC falls back to OpenLibrary
2. All other fields use Google Books + OpenLibrary
3. User sees warning: "LoC unavailable - using OpenLibrary for classification"

## Future Enhancements

### Potential Improvements
- [ ] Add LoC LCCN search (in addition to ISBN)
- [ ] Implement LoC API health check endpoint
- [ ] Add configurable LoC timeout in UI settings
- [ ] Create LoC-specific error messages
- [ ] Add LoC attribution in export metadata

### Monitoring
- Track LoC success/failure rates
- Monitor LoC response times
- Alert on sustained LoC unavailability

## Troubleshooting

### LoC Always Returns `null`
**Symptoms**: LoC never provides data
**Causes**:
- LoC API endpoint changed
- Network firewall blocking LoC requests
- ISBN format not recognized by LoC

**Solutions**:
1. Check LoC API documentation: https://www.loc.gov/apis/
2. Test endpoint directly: `curl "https://www.loc.gov/books/?q=9780143034902&fo=json&at=results"`
3. Verify network access to `.gov` domains

### LoC Timeout Errors
**Symptoms**: Frequent "Library of Congress API timeout" errors
**Causes**:
- LoC servers slow
- Network latency high

**Solutions**:
1. Increase timeout in `fetchAll()` from 5s to 10s
2. Use caching to reduce LoC API calls
3. Accept graceful degradation to OpenLibrary

### Incorrect LCC Classification
**Symptoms**: Wrong call numbers generated
**Causes**:
- LoC returning multiple call numbers
- Incorrect parsing of LoC response

**Solutions**:
1. Review `locResult?.item?.call_number?.[0]` extraction logic
2. Add validation for LCC format (e.g., regex pattern)
3. Log raw LoC response for debugging

## API Reference

### Library of Congress Books API

**Base URL**: `https://www.loc.gov/books/`

**Query Parameters**:
- `q`: Search query (ISBN recommended)
- `fo=json`: Return JSON format
- `at=results`: Include full results (not just facets)

**Example Request**:
```
https://www.loc.gov/books/?q=9780143034902&fo=json&at=results
```

**Example Response**:
```json
{
  "results": [
    {
      "title": "The Kite Runner",
      "contributor": ["Hosseini, Khaled"],
      "date": "2003",
      "subject": ["Afghanistan -- Fiction", "Male friendship -- Fiction"],
      "item": {
        "call_number": ["PS3566.A822 Z46 2003"]
      },
      "number_lccn": "2003043345"
    }
  ]
}
```

## Conclusion

The Library of Congress integration provides:
- **Improved Classification Accuracy**: Authoritative LCC data
- **Better Reliability**: Reduces dependency on OpenLibrary
- **Enhanced Subjects**: Combined subjects from 3 sources
- **Graceful Degradation**: System works even when LoC fails

The "Waterfall of Data" strategy ensures the best available data from all sources is used intelligently.
