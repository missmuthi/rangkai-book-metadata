<script lang="ts">
	import { tick } from 'svelte';
	import { checkGoogleBooksLimit, checkOpenLibraryLimit, getRateLimitStatus } from '$lib/rateLimiter';
	import { exportToSLiMSCSV, exportToMARCXML } from '$lib/export';
	import { scanHistory } from '$lib/stores/history.svelte';
	import { processAndRenderMergedData } from '$lib/merge';
	import { BookApiService, googleCache, openLibraryCache } from '$lib/api';
	import { debounce, retry, isOnline } from '$lib/utils';
	import SkeletonCard from '$lib/SkeletonCard.svelte';

	// --- TypeScript Interfaces ---
	interface GoogleBookItem {
		volumeInfo: {
			title?: string;
			authors?: string[];
			publisher?: string;
			publishedDate?: string;
			pageCount?: number;
			description?: string;
			language?: string;
			categories?: string[];
			printType?: string;
			industryIdentifiers?: Array<{
				type: 'ISBN_10' | 'ISBN_13';
				identifier: string;
			}>;
			imageLinks?: {
				smallThumbnail?: string;
				thumbnail?: string;
			};
			infoLink?: string;
		};
	}

	interface GoogleBooksResponse {
		totalItems: number;
		items?: GoogleBookItem[];
	}

	interface OpenLibraryBookData {
		title?: string;
		authors?: Array<{ name: string }>;
		publishers?: Array<{ name: string }>;
		publish_date?: string;
		number_of_pages?: number;
		description?: string | { value: string };
		identifiers?: {
			isbn_10?: string[];
			isbn_13?: string[];
		};
		classifications?: {
			dewey_decimal_class?: string[];
			lc_classifications?: string[];
		};
		languages?: Array<{ key: string }>;
		subjects?: string[];
		series?: string[];
		publish_places?: string[];
		edition_name?: string;
		cover?: {
			large?: string;
		};
	}

	interface OpenLibrarySearchResponse {
		docs?: Array<{
			title?: string;
			author_name?: string[];
			cover_i?: number;
			isbn?: string[];
			first_publish_year?: number;
			number_of_pages_median?: number;
			[key: string]: any;
		}>;
	}

	interface MergedBookData {
		title: string;
		author: string;
		publisher: string;
		date: string;
		pages: string;
		isbn13: string;
		isbn10: string;
		ddc: string;
		lcc: string;
		callNumber: string;
		description: string;
		language: string;
		subjects: string;
		series: string;
		publisherString: string;
		collation: string;
		classification: string;
		edition: string;
		specificDetail: string;
		gmd: string;
		infoLink: string;
		cover: string;
		isPartialData?: boolean; // True when one or more sources failed
		dataSource?: 'all-three' | 'google-loc' | 'google-openlibrary' | 'loc-openlibrary' | 'google-only' | 'loc-only' | 'openlibrary-only';
	}

	// --- Constants ---
	const FALLBACK_COVER =
		'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjN2M3YzdjIj5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4=';


	// --- ISBN Sanitization Utility ---
	/**
	 * Clean ISBN input from barcode scanners
	 * Strips all non-alphanumeric characters (dashes, spaces)
	 */
	function cleanISBN(input: string): string {
		return input.replace(/[^a-zA-Z0-9]/g, '');
	}

	// --- Enhanced Cache System ---
	function getCacheKey(query: string, source: 'google' | 'openlibrary', isIsbn: boolean): string {
		return `${source}:${query}:${isIsbn}`;
	}

	let searchQuery = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// 'search' = show search results | 'result' = show merged data card
	let currentView = $state<'search' | 'result'>('search');
	
	let googleResults = $state<GoogleBookItem[]>([]);
	let openLibraryResults = $state<OpenLibrarySearchResponse['docs'] | undefined>(undefined);
	let mergedData = $state<MergedBookData | null>(null);
	let isPartialData = $state(false); // Track when OpenLibrary failed

	// Raw data for debugging
	let googleRaw = $state('');
	let openLibraryRaw = $state('');

	// Rate limit status
	let rateLimitStatus = $state(getRateLimitStatus());

	// Scanner Mode: Input reference for auto-focus
	let searchInputRef: HTMLInputElement | null = null;
	let scannerModeEnabled = $state(false);

	// Auto-focus input on mount (Scanner Mode)
	$effect(() => {
		if (searchInputRef && scannerModeEnabled) {
			searchInputRef.focus();
		}
	});



	// --- Home Navigation Function ---
	function goHome() {
		// Reset all state to initial view
		searchQuery = '';
		isLoading = false;
		error = null;
		currentView = 'search';
		mergedData = null;
		googleResults = [];
		openLibraryResults = [];
		googleRaw = '';
		openLibraryRaw = '';
	}

	// --- Debounced Search ---
	let debouncedSearch: (() => void) | null = null;

	// Initialize debounced search on mount
	$effect(() => {
		debouncedSearch = debounce(async () => {
			await handleSearch();
		}, 500); // 500ms delay
	});

	// --- Enhanced Main Search Function ---
	async function handleSearch() {
		const trimmedQuery = searchQuery.trim();
		if (!trimmedQuery) {
			error = 'Please enter an ISBN or Title.';
			return;
		}

		// Check online status
		if (!isOnline()) {
			error = 'No internet connection. Please check your network and try again.';
			return;
		}

		const cleanedQuery = cleanISBN(trimmedQuery);
		// Ignore ghost scans (e.g., partial barcode reads) when scanner mode is active
		if (scannerModeEnabled && cleanedQuery.length < 9) {
			searchQuery = '';
			await tick();
			if (searchInputRef) {
				searchInputRef.focus();
				searchInputRef.select();
			}
			return;
		}

		// Prepare UI state
		isLoading = true;
		error = null;
		mergedData = null;
		googleResults = [];
		openLibraryResults = [];
		googleRaw = 'Fetching...';
		openLibraryRaw = 'Fetching...';
		currentView = 'search';

		try {
			const isIsbn = /^\d{10}(\d{3})?$/.test(cleanedQuery);

			if (isIsbn) {
				// ISBN Search - Get single result from both APIs
				const cacheKey = getCacheKey(cleanedQuery, 'google', true);
				let cachedResult = googleCache.get(cacheKey);

				if (!cachedResult) {
					const result = await retry(() => BookApiService.fetchBoth(cleanedQuery, true, 1, 1));

					cachedResult = {
						googleData: (result.google && result.google.totalItems > 0 && result.google.items) ? result.google.items[0].volumeInfo : null,
						openLibraryData: result.openlibrary as OpenLibraryBookData | null,
						errors: result.errors
					};
					googleCache.set(cacheKey, cachedResult);
				}

				const { googleData, openLibraryData, errors } = cachedResult;

				googleRaw = JSON.stringify(googleData, null, 2) || 'Failed to fetch or no data found.';
				openLibraryRaw = JSON.stringify(openLibraryData, null, 2) || 'Failed to fetch or no data found.';

				// Show API errors as warnings but continue processing
				if (errors.google) {
					console.warn('[ISBN Search] Google API error:', errors.google.message);
				}
				if (errors.openlibrary) {
					console.warn('[ISBN Search] OpenLibrary API error:', errors.openlibrary.message);
				}

				if (!googleData && !openLibraryData) {
					error = 'No data found from any source for this ISBN.';
				} else {
					// Track partial data state (Google only, no OpenLibrary)
					isPartialData = googleData && !openLibraryData;
					
					mergedData = processAndRenderMergedData(googleData, openLibraryData);
					
					// Mark merged data with partial data flag (legacy 2-source logic)
					if (mergedData && isPartialData) {
						mergedData.isPartialData = true;
						mergedData.dataSource = 'google-only';
					} else if (mergedData) {
						mergedData.dataSource = 'google-openlibrary';
					}
					
					currentView = 'result';

					if (scannerModeEnabled && mergedData) {
						scanHistory.add(mergedData);
					}
				}
			} else {
				// Title Search - Get multiple results from both APIs
				const result = await retry(() => BookApiService.fetchBoth(trimmedQuery, false, 10, 10));

				const googleItems = result.google?.items ?? null;
				const openLibraryItems = (result.openlibrary as OpenLibrarySearchResponse | null)?.docs ?? null;

				// Show API errors as warnings but continue with available data
				if (result.errors.google) {
					console.warn('[Title Search] Google API error:', result.errors.google.message);
				}
				if (result.errors.openlibrary) {
					console.warn('[Title Search] OpenLibrary API error:', result.errors.openlibrary.message);
				}

				if (!googleItems && !openLibraryItems) {
					error = 'No books found for that title from any source.';
				}

				if (googleItems && googleItems.length > 0) {
					googleResults = googleItems;
				}

				if (openLibraryItems && openLibraryItems.length > 0) {
					openLibraryResults = openLibraryItems;
				}
			}
		} catch (err) {
			console.error('[Scanner Mode] Search failed:', err);
			error = err instanceof Error ? err.message : 'An unexpected error occurred during search.';
		} finally {
			isLoading = false;
			rateLimitStatus = getRateLimitStatus();
			searchQuery = '';
			await tick();
			if (searchInputRef) {
				searchInputRef.focus();
				searchInputRef.select();
			}
		}
	}

	// --- Enhanced Book Selection Handlers ---

	async function handleBookSelection(index: number) {
		isLoading = true;
		error = null;
		currentView = 'search'; // Hide lists

		const selectedItem = googleResults[index];
		const googleData = selectedItem.volumeInfo;
		googleRaw = JSON.stringify(googleData, null, 2);

		const isbn = googleData.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier;

		let openLibraryData: OpenLibraryBookData | null = null;
		if (isbn) {
			try {
				const cacheKey = getCacheKey(isbn, 'openlibrary', true);
				openLibraryData = openLibraryCache.get(cacheKey);

				if (!openLibraryData) {
					openLibraryData = await retry(() => BookApiService.fetchOpenLibrary(isbn, true)) as OpenLibraryBookData | null;
					if (openLibraryData) {
						openLibraryCache.set(cacheKey, openLibraryData);
					}
				}
			} catch (err) {
				console.warn('[Book Selection] OpenLibrary fetch failed:', err);
			}
			openLibraryRaw = JSON.stringify(openLibraryData, null, 2) || 'No data found from OpenLibrary for this ISBN.';
		} else {
			openLibraryRaw = 'No ISBN found in Google data to search OpenLibrary for DDC/LCC.';
		}

		mergedData = processAndRenderMergedData(googleData, openLibraryData);
		currentView = 'result'; // Show the card
		isLoading = false;
	}

	async function handleOpenLibraryBookSelection(index: number) {
		isLoading = true;
		error = null;
		currentView = 'search'; // Hide lists

		if (!openLibraryResults) {
			error = "No OpenLibrary results available.";
			isLoading = false;
			return;
		}

		const selectedDoc = openLibraryResults[index];

		// OPTIMIZATION: Use search result data directly instead of fetching details
		let openLibraryData: OpenLibraryBookData | null = {
			title: selectedDoc.title,
			authors: selectedDoc.author_name ? selectedDoc.author_name.map((name: string) => ({ name })) : [],
			publish_date: selectedDoc.first_publish_year?.toString(),
			number_of_pages: selectedDoc.number_of_pages_median,
			identifiers: {
				isbn_13: selectedDoc.isbn ? selectedDoc.isbn.filter((isbn: string) => isbn.length === 13) : [],
				isbn_10: selectedDoc.isbn ? selectedDoc.isbn.filter((isbn: string) => isbn.length === 10) : []
			},
			cover: selectedDoc.cover_i ? { large: `https://covers.openlibrary.org/b/id/${selectedDoc.cover_i}-L.jpg` } : undefined
		};
		openLibraryRaw = JSON.stringify(openLibraryData, null, 2);

		const isbn = openLibraryData?.identifiers?.isbn_13?.[0];
		let googleData: GoogleBookItem['volumeInfo'] | null = null;
		if (isbn) {
			try {
				const cacheKey = getCacheKey(isbn, 'google', true);
				googleData = googleCache.get(cacheKey);

				if (!googleData) {
					const googleResponse = await retry(() => BookApiService.fetchGoogleBooks(isbn, true, 1));
					googleData = (googleResponse && googleResponse.totalItems > 0 && googleResponse.items) ? googleResponse.items[0].volumeInfo : null;
					if (googleData) {
						googleCache.set(cacheKey, googleData);
					}
				}
			} catch (err) {
				console.warn('[OpenLibrary Selection] Google fetch failed:', err);
			}
			googleRaw = JSON.stringify(googleData, null, 2) || 'No data found from Google for this ISBN.';
		} else {
			googleRaw = 'No ISBN found in OpenLibrary data to search Google.';
		}

		mergedData = processAndRenderMergedData(googleData, openLibraryData);
		currentView = 'result'; // Show the card
		isLoading = false;
	}
	
	function handleBackToSearch() {
		currentView = 'search';
		mergedData = null;
		error = null;
		// We keep the googleResults and openLibraryResults state
		// so the user doesn't have to search again.
	}

	// --- API Fetch Functions (Now handled by BookApiService) ---

	// --- Scanner Mode Functions ---
	
	function toggleScannerMode() {
		scannerModeEnabled = !scannerModeEnabled;
		if (scannerModeEnabled && searchInputRef) {
			searchInputRef.focus();
			searchInputRef.select();
		}
	}
	
	/**
	 * Batch export all scanned books to SLiMS CSV
	 */
	function exportBatchToCSV() {
		const allBooks = scanHistory.getAll();
		if (allBooks.length === 0) {
			alert('No scanned books to export.');
			return;
		}
		
		// Generate CSV header
		const headers = [
			'Title',
			'GMD',
			'Series Title',
			'Call Number',
			'Publisher',
			'Collation',
			'Language',
			'ISBN/ISSN',
			'Classification',
			'Subject(s)',
			'Specific Detail Info',
			'Statement of Responsibility',
			'Edition'
		];
		
		// Escape CSV value
		const escapeCSV = (value: string): string => {
			if (value.includes(',') || value.includes('"') || value.includes('\n')) {
				return `"${value.replace(/"/g, '""')}"`;
			}
			return value;
		};
		
		// Generate rows
		const rows = allBooks.map(book => {
			return [
				escapeCSV(book.title),
				escapeCSV(book.gmd),
				escapeCSV(book.series),
				escapeCSV(book.callNumber),
				escapeCSV(book.publisherString),
				escapeCSV(book.collation),
				escapeCSV(book.language),
				escapeCSV(book.isbn13),
				escapeCSV(book.classification),
				escapeCSV(book.subjects),
				escapeCSV(book.specificDetail),
				escapeCSV(book.author),
				escapeCSV(book.edition)
			].join(',');
		});
		
		// Combine header and rows
		const csvContent = [headers.join(','), ...rows].join('\n');

		// Download (prepend UTF-8 BOM for Excel/SLiMS compatibility)
		const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `rangkai-batch-export-${new Date().toISOString().split('T')[0]}.csv`;
		link.click();
		URL.revokeObjectURL(url);
		
		console.log(`[Batch Export] Exported ${allBooks.length} books`);
	}
	
	// Helper for cover image error
	function handleCoverError(e: Event) {
		const target = e.currentTarget as HTMLImageElement;
		if (target && target.src === FALLBACK_COVER) {
			return; // Prevent infinite loop
		}
		if (target) {
			target.src = FALLBACK_COVER;
		}
	}
</script>

<!-- Header (from your design) -->
<div class="min-h-screen bg-gray-50 text-gray-900 font-sans">
	<header class="bg-white border-b border-gray-200 sticky top-0 z-10">
		<div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
			<button type="button" onclick={goHome} class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-none p-0">
				<div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
					R
				</div>
				<h1 class="text-xl font-bold tracking-tight text-slate-800">Rangkai</h1>
			</button>
			<div class="text-sm text-gray-500 flex items-center gap-4">
				<span>Metadata Harvester</span>
				{#if rateLimitStatus.google.remaining < 10 || rateLimitStatus.openlibrary.remaining < 10}
					<span class="text-orange-600 text-xs">
						⚠️ API Limits: G:{rateLimitStatus.google.remaining} OL:{rateLimitStatus.openlibrary.remaining}
					</span>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Content Area -->
	<main class="max-w-7xl mx-auto px-4 py-12">
		
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
			<!-- Main Content Column -->
			<div class="lg:col-span-3">
		
		<!-- Search Bar (from your design) -->
		<div class="text-center mb-12 space-y-4 max-w-3xl mx-auto">
			<h2 class="text-3xl font-bold text-gray-900">Harvest Book Data</h2>
			<p class="text-gray-500">Enter an ISBN or Title to gather metadata from Google Books & OpenLibrary.</p>
			
			<div class="flex gap-2 max-w-lg mx-auto mt-6 relative">
				<input 
					type="text" 
					bind:this={searchInputRef}
					bind:value={searchQuery}
					oninput={(e) => {
						// For title searches, use debounced search
						const value = (e.target as HTMLInputElement).value;
						const isPotentialIsbn = /^\d{10}(\d{3})?$/.test(value.replace(/[^0-9]/g, ''));
						
						if (!isPotentialIsbn && value.length > 2 && debouncedSearch) {
							debouncedSearch();
						}
					}}
					onfocus={(e) => {
						e.currentTarget.select();
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							handleSearch();
						}
					}}
					placeholder={scannerModeEnabled ? "Scan barcode or enter ISBN..." : "e.g. 9780134092669 or Akulah Angin Bambang"}
					class="w-full px-4 py-3 rounded-lg border {scannerModeEnabled ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition-all"
				/>
				
				<button 
					onclick={handleSearch}
					disabled={isLoading}
					class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
				>
					{#if isLoading}
						<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Processing...
					{:else}
						Harvest
					{/if}
				</button>
			</div>
			
			<!-- Scanner Mode Toggle -->
			<div class="flex items-center justify-center gap-3 mt-4">
				<button
					onclick={toggleScannerMode}
					class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all {scannerModeEnabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
					</svg>
					{scannerModeEnabled ? 'Scanner Mode: ON' : 'Enable Scanner Mode'}
				</button>
				{#if scannerModeEnabled}
					<span class="text-xs text-gray-500">📦 Scanned: {scanHistory.count}</span>
				{/if}
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="max-w-3xl mx-auto p-4 bg-red-100 text-red-700 rounded-lg mb-6">
				{error}
			</div>
		{/if}

		<!-- === Main UI State Swap === -->

		{#if isLoading && !mergedData && googleResults.length === 0}
			<!-- Enhanced Loading State with Skeletons -->
			<div class="max-w-3xl mx-auto">
				<div class="flex flex-col items-center justify-center p-8 text-gray-500 mb-6">
					<svg class="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<p class="mt-4 text-lg">Harvesting data from Google Books & OpenLibrary...</p>
					<p class="text-sm text-gray-400 mt-1">This may take a few seconds</p>
				</div>
				
				<!-- Show skeleton cards for title searches -->
				{#if searchQuery && !/^\d{10}(\d{3})?$/.test(searchQuery.replace(/[^0-9]/g, ''))}
					<div class="space-y-4">
						<h3 class="text-lg font-semibold text-gray-700">Loading results...</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="space-y-3">
								<h4 class="text-sm font-medium text-gray-600">Google Books</h4>
								{#each Array(3) as _}
									<SkeletonCard />
								{/each}
							</div>
							<div class="space-y-3">
								<h4 class="text-sm font-medium text-gray-600">OpenLibrary</h4>
								{#each Array(3) as _}
									<SkeletonCard />
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		
		{:else if currentView === 'result' && mergedData}
			<!-- === SLiMS Result Card === -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-lg">
					{#if mergedData.isPartialData}
						<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
							<svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<div class="flex-1">
								<p class="text-sm font-medium text-amber-900">Partial Data Retrieved</p>
								<p class="text-xs text-amber-700 mt-1">
									OpenLibrary service is temporarily unavailable. Classification data (DDC/LCC) may be incomplete. Displaying Google Books data only.
								</p>
							</div>
						</div>
					{/if}
					<div class="flex items-center justify-between mb-4 flex-wrap gap-3">
						<button onclick={handleBackToSearch} class="text-sm text-blue-600 hover:text-blue-800 font-medium">
							&larr; Back to Search Results
						</button>
						
						<!-- Export Buttons -->
						<div class="flex gap-2">
							<button
								onclick={() => exportToSLiMSCSV(mergedData!)}
								class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition-colors"
								title="Download as SLiMS CSV for direct import"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Download SLiMS CSV
							</button>
							
							<button
								onclick={() => exportToMARCXML(mergedData!)}
								class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
								title="Download as MARCXML for library catalog systems"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
								</svg>
								Download MARCXML
							</button>
						</div>
					</div>
					
					<h2 class="text-xl font-bold mb-4 border-b pb-2">SLiMS-Ready Data (Merged)</h2>
					
					<div class="space-y-4">
						<div class="w-1/3 float-right ml-4 mb-4">
							<div class="aspect-[2/3] w-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 shadow-md overflow-hidden bg-cover bg-center" style="background-image: url({mergedData.cover !== FALLBACK_COVER ? mergedData.cover : 'none'});">
    {#if mergedData.cover === FALLBACK_COVER}
        <span class="text-sm px-4 text-center">No Cover Available</span>
    {/if}
</div>
						</div>
					
					<div>
						<span class="text-sm font-medium text-gray-500">Title</span>
						<p class="text-xl font-semibold text-gray-900">{mergedData.title}</p>
					</div>

					<div class="grid grid-cols-3 gap-x-4 gap-y-3 pt-4 border-t">
						<span class="text-sm font-medium text-gray-500 col-span-1">GMD</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.gmd}</p>
						
						<span class="text-sm font-medium text-gray-500 col-span-1">Series Title</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.series}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Call Number</span>
						<div class="col-span-2 flex items-center gap-2">
							<p class="font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded-md inline-block">{mergedData.callNumber}</p>
							{#if mergedData.isPartialData && (mergedData.callNumber === '-' || mergedData.ddc === '-')}
								<span
									class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-md"
									title="OpenLibrary service is temporarily unavailable. Classification data (DDC/LCC) cannot be retrieved. Using Google Books data only."
								>
									⚠️ Classification Unavailable
								</span>
							{/if}
						</div>
						
						<span class="text-sm font-medium text-gray-500 col-span-1">Publisher</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.publisherString}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Collation</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.collation}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Language</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.language}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">ISBN/ISSN</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.isbn13}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Classification</span>
						<div class="col-span-2 flex items-center gap-2">
							<p class="text-base text-gray-700">{mergedData.classification}</p>
							{#if mergedData.isPartialData && (mergedData.classification === 'NONE' || mergedData.classification === '-')}
								<span
									class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 rounded-md"
									title="OpenLibrary service is temporarily unavailable. Using Google Books data only."
								>
									⚠️ Data Incomplete
								</span>
							{/if}
						</div>

						<span class="text-sm font-medium text-gray-500 col-span-1">Content Type</span>
						<p class="text-base text-gray-700 col-span-2">text</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Media Type</span>
						<p class="text-base text-gray-700 col-span-2">unmediated</p>

					<span class="text-sm font-medium text-gray-500 col-span-1">Carrier Type</span>
					<p class="text-base text-gray-700 col-span-2">volume</p>

					{#if mergedData.edition && mergedData.edition !== '-' && mergedData.edition !== ''}
						<span class="text-sm font-medium text-gray-500 col-span-1">Edition</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.edition}</p>
					{/if}

					<span class="text-sm font-medium text-gray-500 col-span-1">Subject(s)</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.subjects}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Specific Detail Info</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.specificDetail}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Statement of Responsibility</span>
						<p class="text-lg text-gray-700 col-span-2">{mergedData.author}</p>
						
						<span class="text-sm font-medium text-gray-500 col-span-1">Electronic Source</span>
						<p class="text-base text-gray-700 col-span-2">
							{#if mergedData.infoLink !== '-'}
								<a href={mergedData.infoLink} target="_blank" class="text-blue-600 hover:underline break-all">View on Google Books</a>
							{:else}
								-
							{/if}
						</p>
						</div>

						<div>
							<span class="text-sm font-medium text-gray-500">Description / Abstract</span>
							<div class="text-base text-gray-800 max-h-32 overflow-y-auto bg-gray-50 p-3 rounded-md border border-gray-200 mt-1">
								{mergedData.description}
							</div>
						</div>
					</div>
				</div>

				<!-- Raw Data Sources -->
				<div class="md:col-span-1 space-y-4">
					<h3 class="text-lg font-semibold text-gray-800">Data Sources</h3>
					
					<div>
						<h4 class="text-base font-medium text-gray-700">1. Google Books</h4>
						<pre class="w-full h-48 p-3 mt-1 bg-gray-900 text-green-400 text-xs rounded-lg shadow-inner overflow-auto">{googleRaw}</pre>
					</div>
					
					<div>
						<h4 class="text-base font-medium text-gray-700">2. OpenLibrary</h4>
						<pre class="w-full h-48 p-3 mt-1 bg-gray-900 text-green-400 text-xs rounded-lg shadow-inner overflow-auto">{openLibraryRaw}</pre>
					</div>
				</div>
			</div>

		{:else if currentView === 'search' && (googleResults.length > 0 || (openLibraryResults && openLibraryResults.length > 0))}
			<!-- === Search Result Lists === -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Google Results -->
				{#if googleResults.length > 0}
					<div>
						<h2 class="text-xl font-bold mb-4">Results from Google Books</h2>
						<div class="space-y-3 max-h-[60vh] overflow-y-auto">
							{#each googleResults as item, index}
								{@const info = item.volumeInfo}
								{@const title = info.title || 'No Title'}
								{@const author = info.authors ? info.authors[0] : 'Unknown Author'}
								{@const cover = info.imageLinks?.smallThumbnail || FALLBACK_COVER}
								
							<button type="button" onclick={() => handleBookSelection(index)} class="w-full p-4 bg-white border border-gray-200 rounded-lg flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-left">
								<img src={cover} alt="Cover" class="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" onerror={handleCoverError} />
								<div>
									<div class="font-semibold text-base text-blue-700">{title}</div>
									<div class="text-sm text-gray-600">{author}</div>
								</div>
							</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- OpenLibrary Results -->
				{#if openLibraryResults && openLibraryResults.length > 0}
					<div>
						<h2 class="text-xl font-bold mb-4">Results from OpenLibrary</h2>
						<div class="space-y-3 max-h-[60vh] overflow-y-auto">
							{#each openLibraryResults as doc, index}
								{@const title = doc.title || 'No Title'}
								{@const author = doc.author_name ? doc.author_name[0] : 'Unknown Author'}
								{@const coverID = doc.cover_i}
								{@const cover = coverID ? `https://covers.openlibrary.org/b/id/${coverID}-S.jpg` : FALLBACK_COVER}

							<button type="button" onclick={() => handleOpenLibraryBookSelection(index)} class="w-full p-4 bg-white border border-gray-200 rounded-lg flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-left">
								<img src={cover} alt="Cover" class="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0" onerror={handleCoverError} />
								<div>
									<div class="font-semibold text-base text-green-700">{title}</div>
									<div class="text-sm text-gray-600">{author}</div>
								</div>
							</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

		{:else if !isLoading}
			<!-- === Initial Placeholder === -->
			<div class="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center max-w-3xl mx-auto">
				<div class="text-gray-400 mb-2">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mx-auto">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 006 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
					</svg>
				</div>
				<h3 class="text-lg font-medium text-gray-900">No Data Harvested Yet</h3>
				<p class="text-gray-500 mt-1">Search for a book to see the merged metadata here.</p>
			</div>
		{/if}
		
		</div>
		<!-- End Main Content Column -->
		
		<!-- Performance Dashboard (Advanced Users) -->
		{#if scannerModeEnabled}
			<aside class="lg:col-span-1 space-y-4">
				<!-- Recent Scans Sidebar -->
				<div class="sticky top-20 bg-white rounded-xl border-2 border-green-200 shadow-lg p-4">
					<div class="flex items-center justify-between mb-4">
						<h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">
							<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
							</svg>
							Recent Scans
						</h3>
						<span class="text-sm font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
							{scanHistory.count}
						</span>
					</div>
					
					{#if scanHistory.isEmpty}
						<div class="text-center py-8 text-gray-400 text-sm">
							<svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<p>No scans yet</p>
							<p class="text-xs mt-1">Start scanning ISBNs</p>
						</div>
					{:else}
						<!-- Batch Export Button -->
						<div class="mb-3">
							<button
								onclick={exportBatchToCSV}
								class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition-colors"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Download All ({scanHistory.count}) as CSV
							</button>
						</div>
						
						<!-- Clear All Button -->
						<button
							onclick={() => {
								if (confirm(`Clear all ${scanHistory.count} scanned books from history?`)) {
									scanHistory.clear();
								}
							}}
							class="w-full mb-3 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
						>
							Clear All
						</button>
						
						<!-- Scanned Books List -->
						<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
							{#each scanHistory.items as book (book.isbn13)}
								<div class="group relative bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors">
									<div class="pr-8">
										<h4 class="text-sm font-semibold text-gray-900 line-clamp-2 mb-1">
											{book.title}
										</h4>
										<p class="text-xs text-gray-600 font-mono">
											{book.isbn13}
										</p>
										<p class="text-xs text-gray-500 mt-1">
											{book.author}
										</p>
									</div>
									
									<!-- Remove Button -->
									<button
										onclick={() => scanHistory.remove(book.isbn13)}
										class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors opacity-0 group-hover:opacity-100"
										title="Remove from history"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				
				<!-- Performance Stats -->
				<div class="bg-white rounded-xl border border-gray-200 shadow-lg p-4">
					<h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
						<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						Performance
					</h3>
					
					<div class="space-y-3 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-600">Cache Hit Rate</span>
							<span class="font-mono text-green-600">
								{Math.round((googleCache.getStats().totalHits / Math.max(1, googleCache.getStats().size + googleCache.getStats().totalHits)) * 100)}%
							</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Google Cache</span>
							<span class="font-mono text-blue-600">{googleCache.getStats().size} items</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">OL Cache</span>
							<span class="font-mono text-green-600">{openLibraryCache.getStats().size} items</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Avg Response</span>
							<span class="font-mono text-purple-600">
								{Math.round((googleCache.getStats().averageAge + openLibraryCache.getStats().averageAge) / 2 / 1000)}s
							</span>
						</div>
					</div>
				</div>
			</aside>
		{/if}
		<!-- End Recent Scans Sidebar -->
		
		</div>
		<!-- End Grid Layout -->

	</main>
</div>