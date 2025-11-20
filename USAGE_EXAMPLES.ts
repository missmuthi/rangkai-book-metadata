/**
 * Usage Examples: Rangkai Book Metadata Harvester (3-Source API)
 *
 * This file contains comprehensive examples for using the 3-source book metadata system:
 * - Google Books API (primary source for publishers, dates, descriptions)
 * - OpenLibrary API (primary source for DDC classifications, subjects)
 * - Library of Congress API (primary source for authoritative LCC classifications)
 *
 * IMPORTANT: This is a documentation file with example code.
 * It is not meant to be compiled or executed directly.
 * Copy the relevant examples into your actual components.
 */

import { BookApiService, locCache } from './src/lib/api';
import { processAndRenderMergedData } from './src/lib/merge';
import type { LoCBookData, MergedBookData, OpenLibraryBookData, OpenLibrarySearchResponse } from './src/lib/types';

/**
 * Example 1: Fetch book data from all 3 sources (ISBN search)
 */
async function fetchBookByISBN(isbn: string): Promise<MergedBookData | null> {
  try {
    // Call all 3 APIs in parallel (Google Books, OpenLibrary, Library of Congress)
    const { google, openlibrary, loc, errors } = await BookApiService.fetchAll(isbn, true, 1, 1);

    // Log any API errors (non-blocking)
    if (errors.google) {
      console.warn('⚠️ Google Books failed:', errors.google.message);
    }
    if (errors.openlibrary) {
      console.warn('⚠️ OpenLibrary failed:', errors.openlibrary.message);
    }
    if (errors.loc) {
      console.warn('⚠️ Library of Congress failed:', errors.loc.message);
    }

    // Extract Google Books volumeInfo
    const googleData = google?.items?.[0]?.volumeInfo || null;

    // Extract OpenLibrary data (for ISBN search, this is OpenLibraryBookData)
    const openLibraryData = openlibrary as OpenLibraryBookData | null;

    // Merge data using "Waterfall of Data" strategy
    const mergedData = processAndRenderMergedData(googleData, openLibraryData, loc);

    // Check data quality
    console.log(`📚 Data Source: ${mergedData.dataSource}`);
    console.log(`📊 Is Partial: ${mergedData.isPartialData}`);
    console.log(`📖 LCC from LoC: ${mergedData.lcc}`);

    return mergedData;
  } catch (error) {
    console.error('❌ Failed to fetch book data:', error);
    return null;
  }
}

/**
 * Example 1b: Fetch book data from all sources (Title search)
 */
async function fetchBooksByTitle(title: string): Promise<MergedBookData[]> {
  try {
    // Title search returns multiple results (LoC doesn't support title search)
    const { google, openlibrary, errors } = await BookApiService.fetchAll(title, false, 10, 10);

    const results: MergedBookData[] = [];

    // Process Google Books results
    if (google?.items) {
      for (const item of google.items) {
        const mergedData = processAndRenderMergedData(item.volumeInfo, null, null);
        results.push(mergedData);
      }
    }

    // Process OpenLibrary results (returns OpenLibrarySearchResponse for title search)
    const olResponse = openlibrary as OpenLibrarySearchResponse | null;
    if (olResponse?.docs) {
      for (const doc of olResponse.docs.slice(0, 10)) { // Limit to 10 results
        // For title search results, we need to fetch individual book data
        const isbn = doc.isbn?.[0];
        if (isbn) {
          const bookData = await fetchBookByISBN(isbn);
          if (bookData) results.push(bookData);
        }
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Failed to fetch books by title:', error);
    return [];
  }
}/**
 * Example 2: Legacy backward-compatible method (2-source only)
 */
async function fetchBookLegacy(isbn: string): Promise<MergedBookData | null> {
  try {
    // Use old fetchBoth() method - still works, but won't include LoC data
    const { google, openlibrary, errors } = await BookApiService.fetchBoth(isbn, true, 1, 1);

    const googleData = google?.items?.[0]?.volumeInfo || null;
    const openLibraryData = openlibrary as OpenLibraryBookData | null;
    
    // Note: processAndRenderMergedData accepts null for LoC parameter
    const mergedData = processAndRenderMergedData(googleData, openLibraryData, null);

    return mergedData;
  } catch (error) {
    console.error('❌ Failed to fetch book data:', error);
    return null;
  }
}

/**
 * Example 3: Handle data source status in UI
 */
function renderDataSourceBadge(mergedData: MergedBookData): string {
  switch (mergedData.dataSource) {
    case 'all-three':
      return '✅ Complete data from all 3 sources (Google + OpenLibrary + LoC)';
    case 'google-loc':
      return '⚠️ Google Books + Library of Congress only (OpenLibrary unavailable)';
    case 'google-openlibrary':
      return '⚠️ Google Books + OpenLibrary only (LoC unavailable - LCC may be less authoritative)';
    case 'loc-openlibrary':
      return '⚠️ Library of Congress + OpenLibrary only (Google Books unavailable)';
    case 'google-only':
      return '🔴 Google Books only (Classification data unavailable)';
    case 'loc-only':
      return '🔴 Library of Congress only (Limited metadata)';
    case 'openlibrary-only':
      return '🔴 OpenLibrary only (Limited metadata)';
    default:
      return '❓ Unknown data source';
  }
}

/**
 * Example 4: Display classification quality indicator
 */
function getClassificationQuality(mergedData: MergedBookData): {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  message: string;
} {
  const hasLCC = mergedData.lcc !== '-';
  const hasDDC = mergedData.ddc !== '-';
  const dataSource = mergedData.dataSource;

  if (hasLCC && hasDDC && dataSource === 'all-three') {
    return {
      quality: 'excellent',
      message: '✅ Authoritative LCC from Library of Congress + DDC from OpenLibrary'
    };
  }

  if (hasLCC && dataSource?.includes('loc')) {
    return {
      quality: 'good',
      message: '👍 Authoritative LCC from Library of Congress'
    };
  }

  if (hasLCC || hasDDC) {
    return {
      quality: 'fair',
      message: '⚠️ Classification available but not from authoritative LoC'
    };
  }

  return {
    quality: 'poor',
    message: '🔴 No classification data available - using subject mapping fallback'
  };
}

/**
 * Example 5: Svelte component usage
 */
/*
<script lang="ts">
  import { BookApiService } from '$lib/api';
  import { processAndRenderMergedData } from '$lib/merge';
  import type { MergedBookData } from '$lib/types';

  let isbn = $state('');
  let mergedData = $state<MergedBookData | null>(null);
  let loading = $state(false);
  let error = $state('');

  async function handleSearch() {
    loading = true;
    error = '';
    
    try {
      const { google, openlibrary, loc, errors } = await BookApiService.fetchAll(isbn, true, 1, 1);

      // Handle all sources failing
      if (!google && !openlibrary && !loc) {
        error = 'No data found from any source. Please check the ISBN.';
        mergedData = null;
        return;
      }

      const googleData = google?.items?.[0]?.volumeInfo || null;
      mergedData = processAndRenderMergedData(googleData, openlibrary as OpenLibraryBookData | null, loc);

      // Show warnings for partial data
      if (mergedData.isPartialData) {
        console.warn('⚠️ Partial data retrieved:', mergedData.dataSource);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      mergedData = null;
    } finally {
      loading = false;
    }
  }
</script>

<div>
  <input type="text" bind:value={isbn} placeholder="Enter ISBN" />
  <button onclick={handleSearch} disabled={loading}>
    {loading ? 'Searching...' : 'Search'}
  </button>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if mergedData}
    <div class="result">
      <h2>{mergedData.title}</h2>
      <p>Author: {mergedData.author}</p>
      <p>LCC: {mergedData.lcc}</p>
      <p>DDC: {mergedData.ddc}</p>
      
      <!-- Data source indicator -->
      {#if mergedData.dataSource === 'all-three'}
        <span class="badge badge-success">✅ All sources available</span>
      {:else if mergedData.isPartialData}
        <span class="badge badge-warning">
          ⚠️ Partial data: {mergedData.dataSource}
        </span>
      {/if}

      <!-- Classification quality indicator -->
      {#if mergedData.lcc !== '-' && mergedData.dataSource?.includes('loc')}
        <span class="badge badge-info">
          🏛️ Authoritative LCC from Library of Congress
        </span>
      {/if}
    </div>
  {/if}
</div>
*/

/**
 * Example 6: Cache management
 */
import { googleCache, openLibraryCache } from './src/lib/api';

function clearAllCaches() {
  googleCache.clear();
  openLibraryCache.clear();
  locCache.clear();
  console.log('✅ All API caches cleared');
}

function getCacheStats() {
  return {
    google: googleCache.getStats(),
    openLibrary: openLibraryCache.getStats(),
    loc: locCache.getStats()
  };
}

/**
 * Example 8: Advanced error handling and retry logic
 */
async function fetchBookWithRetry(isbn: string, maxRetries = 3): Promise<MergedBookData | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for ISBN: ${isbn}`);

      const result = await BookApiService.fetchAll(isbn, true, 1, 1);

      // If we got some data from at least one source, proceed
      if (result.google || result.openlibrary || result.loc) {
        const googleData = result.google?.items?.[0]?.volumeInfo || null;
        const openLibraryData = result.openlibrary as OpenLibraryBookData | null;

        const mergedData = processAndRenderMergedData(googleData, openLibraryData, result.loc);

        // Log partial data warnings
        if (mergedData.isPartialData) {
          console.warn(`⚠️ Partial data on attempt ${attempt}:`, mergedData.dataSource);
        }

        return mergedData;
      }

      // If no data from any source, wait before retry
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`⏳ No data found, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (error) {
      console.error(`❌ Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('❌ All retry attempts failed');
  return null;
}

/**
 * Example 9: Data quality assessment
 */
function assessDataQuality(mergedData: MergedBookData): {
  score: number; // 0-100
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  // Check data source completeness
  if (mergedData.dataSource !== 'all-three') {
    score -= 20;
    issues.push('Missing data from one or more sources');
  }

  // Check critical fields
  if (mergedData.title === '-' || mergedData.title.length < 3) {
    score -= 15;
    issues.push('Title missing or too short');
  }

  if (mergedData.author === '-') {
    score -= 15;
    issues.push('Author information missing');
  }

  if (mergedData.lcc === '-' && mergedData.ddc === '-') {
    score -= 20;
    issues.push('No classification data available');
  } else if (mergedData.lcc === '-' && !mergedData.dataSource?.includes('loc')) {
    score -= 10;
    issues.push('LCC classification missing (not from authoritative LoC source)');
  }

  if (mergedData.isbn13 === '-') {
    score -= 10;
    issues.push('ISBN-13 missing');
  }

  // Determine quality level
  let level: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 90) level = 'excellent';
  else if (score >= 75) level = 'good';
  else if (score >= 50) level = 'fair';
  else level = 'poor';

  return { score: Math.max(0, score), level, issues };
}

/**
 * Example 10: Testing LoC API directly
 */
async function testLoCAPI(isbn: string): Promise<LoCBookData | null> {
  try {
    const loc = await BookApiService.fetchLibraryOfCongress(isbn);

    if (!loc) {
      console.log('❌ LoC returned no data');
      return null;
    }

    console.log('✅ LoC API Response:');
    console.log('  Title:', loc.results?.[0]?.title);
    console.log('  Author:', loc.results?.[0]?.contributor?.[0]);
    console.log('  LCC:', loc.results?.[0]?.item?.call_number?.[0]);
    console.log('  Subjects:', loc.results?.[0]?.subject?.slice(0, 3));

    return loc;
  } catch (error) {
    console.error('❌ LoC API test failed:', error);
    return null;
  }
}

// Example usage
export {
  fetchBookByISBN,
  fetchBooksByTitle,
  fetchBookLegacy,
  renderDataSourceBadge,
  getClassificationQuality,
  clearAllCaches,
  getCacheStats,
  fetchBookWithRetry,
  assessDataQuality,
  testLoCAPI
};
