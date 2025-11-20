/**
 * Example: Using Library of Congress Integration in Rangkai
 * 
 * This file demonstrates how to use the new 3-source API system
 * in your SvelteKit components.
 */

import { BookApiService, locCache } from '$lib/api';
import { processAndRenderMergedData } from '$lib/merge';
import type { LoCBookData, MergedBookData } from '$lib/types';

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
    
    // Extract OpenLibrary data
    const openLibraryData = openlibrary as any; // Type depends on search type
    
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
 * Example 2: Legacy backward-compatible method (2-source only)
 */
async function fetchBookLegacy(isbn: string): Promise<MergedBookData | null> {
  try {
    // Use old fetchBoth() method - still works, but won't include LoC data
    const { google, openlibrary, errors } = await BookApiService.fetchBoth(isbn, true, 1, 1);

    const googleData = google?.items?.[0]?.volumeInfo || null;
    const openLibraryData = openlibrary as any;
    
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
      mergedData = processAndRenderMergedData(googleData, openlibrary as any, loc);

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
import { googleCache, openLibraryCache, locCache } from '$lib/api';

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
 * Example 7: Testing LoC API directly
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
  fetchBookLegacy,
  renderDataSourceBadge,
  getClassificationQuality,
  clearAllCaches,
  getCacheStats,
  testLoCAPI
};
