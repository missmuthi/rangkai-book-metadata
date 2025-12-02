<script lang="ts">
		import { browser } from '$app/environment';
		import { onMount, tick } from 'svelte';
		import { checkGoogleBooksLimit as _checkGoogleBooksLimit, checkOpenLibraryLimit as _checkOpenLibraryLimit } from '$lib/rateLimiter';
        import { scanHistory } from '$lib/stores/history.svelte';
        import { processAndRenderMergedData } from '$lib/merge';
        import { BookApiService, googleCache, openLibraryCache, locCache } from '$lib/api';
        import { retry, isOnline } from '$lib/utils';
        import { cleanISBN } from '$lib/isbn-helpers';
	
	import { Analytics } from '$lib/services/analytics';

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
			[key: string]: unknown;
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



	// --- Secure Image Proxy Utility (SSRF Protection) ---
	/**
	 * Proxy book cover images via wsrv.nl for privacy and HTTPS
	 * CRITICAL: Only allows whitelisted domains to prevent SSRF attacks
	 * 
	 * Security Audit Fix: Hardened against Server-Side Request Forgery (SSRF)
	 * - Whitelist validation prevents requests to internal/untrusted hosts
	 * - Blocks localhost, private IPs, and non-whitelisted domains
	 * - Returns safe placeholder on validation failure
	 * 
	 * @param url - Original image URL from book API
	 * @returns Proxied URL via wsrv.nl or fallback placeholder
	 */
	function getSecureProxyUrl(url: string | null | undefined): string {
		if (!url || url === '' || url === '-') {
			return FALLBACK_COVER;
		}
		
		// Allow data URIs (SVG fallback covers)
		if (url.startsWith('data:')) {
			return url;
		}
		
		// SSRF Protection: Whitelist only trusted book cover domains
		// Audit Requirement: Prevent requests to arbitrary URLs
		const ALLOWED_DOMAINS = [
			'books.google.com',
			'books.googleusercontent.com',
			'covers.openlibrary.org'
		];
		
		try {
			const urlObj = new URL(url);
			
			// Check if domain is whitelisted
			const isAllowed = ALLOWED_DOMAINS.some(domain => 
				urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
			);
			
			if (!isAllowed) {
				clientLog('warn', `[SSRF Protection] Blocked untrusted domain: ${urlObj.hostname}`);
				return FALLBACK_COVER;
			}
			
			// Proxy via wsrv.nl with optimization parameters
			// w=300: max width 300px (responsive)
			// q=80: quality 80% (balance between size and quality)
			// output=webp: modern format for better compression
			const encodedUrl = encodeURIComponent(url);
			return `https://wsrv.nl/?url=${encodedUrl}&w=300&q=80&output=webp`;
			
		} catch (_error) {
			clientLog('warn', '[Secure Proxy] Invalid URL format:', url);
			return FALLBACK_COVER;
		}
	}

	// Client-side debug log helper (no-op in production)
	function clientLog(level: 'log' | 'warn' | 'error' | 'info' | 'debug', ...args: unknown[]) {
		if (import.meta.env.DEV) {
			const c = console as unknown as Record<string, (...a: unknown[]) => void>;
			c[level]?.(...args);
		}
	}

	// --- Enhanced Cache System ---
	function getCacheKey(query: string, source: 'google' | 'openlibrary' | 'loc', isIsbn: boolean): string {
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



	// Scanner Mode: Input reference for auto-focus
        let searchInputRef: HTMLInputElement | null = null;
        let scannerModeEnabled = $state(false);
        let autoAddEnabled = $state(false); // Auto-add to batch without showing detail card
        let isNetworkOnline = $state(isOnline());

        // Toast Notification System (single toast at a time)
        let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
        let toastTimeout: ReturnType<typeof setTimeout> | null = null;

        /**
         * Show a toast notification
         * Automatically dismisses after 2 seconds
         */
        function showToast(message: string, type: 'success' | 'error') {
                toast = { message, type };

                if (toastTimeout) {
                        clearTimeout(toastTimeout);
                }

                toastTimeout = setTimeout(() => {
                        toast = null;
                        toastTimeout = null;
                }, 2000);
        }

	/**
	 * Play audio feedback for scan success/error
	 * Uses Web Audio API for non-intrusive beep sounds
	 */
        function playFeedbackSound(type: 'success' | 'error') {
                if (typeof window === 'undefined' || (!window.AudioContext && !(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) return;
		
                try {
                        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                        const audioContext = new AudioContextClass();
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
			
			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			
			// Success: Higher pitch (800Hz), Error: Lower pitch (400Hz)
			oscillator.frequency.value = type === 'success' ? 800 : 400;
			oscillator.type = 'sine';
			
			// Quick beep (100ms)
			gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.1);
                } catch (err) {
							clientLog('warn', '[Audio] Feedback sound failed:', err);
                }
        }

        onMount(() => {
                if (!browser) return;

                const updateNetworkState = () => {
                        isNetworkOnline = navigator.onLine;
                        if (!isNetworkOnline) {
                                autoAddEnabled = false;
                        }
                };

                window.addEventListener('online', updateNetworkState);
                window.addEventListener('offline', updateNetworkState);
                updateNetworkState();

                return () => {
                        window.removeEventListener('online', updateNetworkState);
                        window.removeEventListener('offline', updateNetworkState);
                };
        });

	// Auto-focus input on mount (Scanner Mode)
	$effect(() => {
		if (searchInputRef && scannerModeEnabled) {
			searchInputRef.focus();
		}
	});



	// --- Home Navigation Function ---
	function _goHome() {
		Analytics.track('user_interaction', {
			action: 'home_navigation'
		});

		// Reset all state to initial view
		searchQuery = '';
		isLoading = false;
		error = null;
		currentView = 'search';
		mergedData = null;
		googleResults = [];
		openLibraryResults = [];
	}

	// --- Input Debouncing (Manual Typing Only) ---
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleInputChange() {
		const trimmedQuery = searchQuery.trim();
		if (!trimmedQuery) return;

		const cleanedQuery = cleanISBN(trimmedQuery);
		const isCompleteIsbn = /^\d{10}(\d{3})?$/.test(cleanedQuery);

		// Clear any existing debounce timer before scheduling a new one
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		if (scannerModeEnabled) {
			// Scanner Mode Auto-Submit Logic
			if (isCompleteIsbn) {
				// Barcode scanners should submit instantly when a full ISBN is present
				handleSearch();
				return;
			}

		if (cleanedQuery.length >= 3) {
			// Partial scanner input: debounce briefly to avoid ghost scans
			// Capture current query length for the timeout check
			const capturedLength = cleanedQuery.length;
			debounceTimer = setTimeout(() => {
				if (capturedLength >= 9) {
					handleSearch();
				}
			}, 500);
		}

		return;
		}

		// Manual typing: debounce partial input, but allow instant search for full ISBNs
		if (isCompleteIsbn) {
			handleSearch();
			return;
		}

		if (cleanedQuery.length >= 3) {
			debounceTimer = setTimeout(() => {
				handleSearch();
			}, 400);
		}
	}

        // --- Enhanced Main Search Function ---
        async function handleSearch() {
                // Latency Tracking: Start timer for "Time to Toast" metric
                const scanLatencyStart = performance.now();
                const searchStartTime = scanLatencyStart;
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
		currentView = 'search';

		try {
			const isIsbn = /^\d{10}(\d{3})?$/.test(cleanedQuery);

		if (isIsbn) {
			// ISBN Search - Use serverless API endpoint (Cloudflare Workers + D1 + KV)
			const apiResult = await retry(() => BookApiService.fetchFromServerless(cleanedQuery));

			// The serverless API returns already-merged data
			mergedData = apiResult as MergedBookData;
			
			// Extract metadata for analytics and debugging
			const meta = apiResult.meta || {};
			const hasGoogle = meta.sources?.google || false;
			const hasOpenLib = meta.sources?.openlibrary || false;
			const hasLoC = meta.sources?.loc || false;

			if (!mergedData || mergedData.title === '-') {
				error = 'No data found from any source for this ISBN.';
				
				// Track failed search
                                const searchDuration = Math.round(performance.now() - searchStartTime);
                                Analytics.track('search_performed', {
                                        type: 'isbn',
                                        query_length: cleanedQuery.length,
                                        duration_ms: searchDuration,
                                        latency_ms: searchDuration,
                                        result_count: 0
                                });
                        } else {
				// Track partial data state based on which sources succeeded
				isPartialData = !(hasGoogle && hasOpenLib && hasLoC);
				
				// Track successful search and data source
                                const searchDuration = Math.round(performance.now() - searchStartTime);
                                Analytics.track('search_performed', {
                                        type: 'isbn',
                                        query_length: cleanedQuery.length,
                                        duration_ms: searchDuration,
                                        latency_ms: searchDuration,
                                        result_count: 1,
                                        cache_hit: meta.cacheHit || false
                                });

				Analytics.track('data_source_used', {
					source: mergedData.dataSource || 'unknown',
					has_google: hasGoogle,
					has_openlibrary: hasOpenLib,
					has_loc: hasLoC,
					is_partial: isPartialData
				});
				
				// Validate we have USABLE data (not just placeholder "-")
				const hasUsableData = mergedData && mergedData.title !== '-' && mergedData.title.length > 0;
				
				// AUTO-ADD MODE: Add directly to batch without showing detail card
				// Works even with partial data (e.g., Google-only when OpenLibrary fails)
                                if (scannerModeEnabled && autoAddEnabled && hasUsableData) {
                                        scanHistory.add(mergedData);
                                        playFeedbackSound('success');

                                        // Show toast notification with book title
                                        const truncatedTitle = mergedData.title.length > 40
                                                ? mergedData.title.substring(0, 40) + '...'
                                                : mergedData.title;

                                        showToast(`Added: ${truncatedTitle}`, 'success');

                                        const scanLatencyEnd = performance.now();
                                        Analytics.track('scan_latency', { duration: Math.round(scanLatencyEnd - scanLatencyStart) });

                                        // Track auto-add with partial data context
                                        Analytics.track('auto_add_triggered', {
                                                isbn: cleanedQuery,
                                                is_partial_data: isPartialData,
						data_source: mergedData.dataSource || 'unknown',
						has_google: hasGoogle,
						has_openlibrary: hasOpenLib,
						has_loc: hasLoC
					});
					
					Analytics.track('user_interaction', {
						action: 'auto_add_to_batch',
						source: 'scanner_mode',
						is_partial: isPartialData
					});

                                        // Skip showing result card - stay in search view for continuous scanning
                                        currentView = 'search';
                                        mergedData = null;
                                } else if (!hasUsableData) {
                                        // CRITICAL FAILURE: No usable data even after merge
                                        error = 'Data fetched but no usable title found. Cannot add to batch.';
                                        playFeedbackSound('error');
                                        showToast('✗ No usable data found', 'error');
				} else {
					// MANUAL MODE: Show result card for review
					currentView = 'result';
					
					if (scannerModeEnabled && mergedData) {
						scanHistory.add(mergedData);
					}
				}
				}
			} else {
				// Title Search - Get multiple results from all 3 APIs (LoC skipped for title search)
				const result = await retry(() => BookApiService.fetchAll(trimmedQuery, false, 10, 10));

				const googleItems = result.google?.items ?? null;
				const openLibraryItems = (result.openlibrary as OpenLibrarySearchResponse | null)?.docs ?? null;

				// Show API errors as warnings but continue with available data
				if (result.errors.google) {
					clientLog('warn', '[Title Search] Google API error:', result.errors.google.message);
				}
				if (result.errors.openlibrary) {
					clientLog('warn', '[Title Search] OpenLibrary API error:', result.errors.openlibrary.message);
				}

				const totalResults = (googleItems?.length || 0) + (openLibraryItems?.length || 0);

				if (!googleItems && !openLibraryItems) {
					error = 'No books found for that title from any source.';
				}

				if (googleItems && googleItems.length > 0) {
					googleResults = googleItems;
				}

				if (openLibraryItems && openLibraryItems.length > 0) {
					openLibraryResults = openLibraryItems;
				}

				// Track title search
                                const searchDuration = Math.round(performance.now() - searchStartTime);
                                Analytics.track('search_performed', {
                                        type: 'title',
                                        query_length: trimmedQuery.length,
                                        duration_ms: searchDuration,
                                        latency_ms: searchDuration,
                                        result_count: totalResults
                                });
                        }
		} catch (err) {
			clientLog('error', '[Scanner Mode] Search failed:', err);
			const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during search.';
			error = errorMessage;
			
			// AUTO-ADD MODE: Show error toast and play error sound
                        if (scannerModeEnabled && autoAddEnabled) {
                                playFeedbackSound('error');
                                showToast(`✗ Error: ${errorMessage}`, 'error');
                        }
		} finally {
			isLoading = false;
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
		Analytics.track('user_interaction', {
			action: 'book_selected',
			source: 'google'
		});

		isLoading = true;
		error = null;
		currentView = 'search'; // Hide lists

		const selectedItem = googleResults[index];
		const googleData = selectedItem.volumeInfo;

		const isbn = googleData.industryIdentifiers?.find((id) => id.type === 'ISBN_13')?.identifier;

		let openLibraryData: OpenLibraryBookData | null = null;
		if (isbn) {
			try {
				const cacheKey = getCacheKey(isbn, 'openlibrary', true);
				openLibraryData = openLibraryCache.get(cacheKey) as OpenLibraryBookData | null;

				if (!openLibraryData) {
					openLibraryData = await retry(() => BookApiService.fetchOpenLibrary(isbn, true)) as OpenLibraryBookData | null;
					if (openLibraryData) {
						openLibraryCache.set(cacheKey, openLibraryData);
					}
				}
				} catch (err) {
				clientLog('warn', '[Book Selection] OpenLibrary fetch failed:', err);
			}
		}
		mergedData = processAndRenderMergedData(googleData, openLibraryData);
		currentView = 'result'; // Show the card
		isLoading = false;
	}

	async function handleOpenLibraryBookSelection(index: number) {
		Analytics.track('user_interaction', {
			action: 'book_selected',
			source: 'openlibrary'
		});

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

		const isbn = openLibraryData?.identifiers?.isbn_13?.[0];
		let googleData: GoogleBookItem['volumeInfo'] | null = null;
		let locData = null;
		if (isbn) {
			try {
				// Fetch from all 3 sources
				const result = await retry(() => BookApiService.fetchAll(isbn, true, 1, 1));
				googleData = (result.google && result.google.totalItems > 0 && result.google.items) ? result.google.items[0].volumeInfo : null;
				locData = result.loc || null;
				
				if (googleData) {
					const cacheKey = getCacheKey(isbn, 'google', true);
					googleCache.set(cacheKey, googleData);
				}
				if (locData) {
					const cacheKey = getCacheKey(isbn, 'loc', true);
					locCache.set(cacheKey, locData);
				}
			} catch (err) {
				clientLog('warn', '[OpenLibrary Selection] API fetch failed:', err);
			}
		}
		mergedData = processAndRenderMergedData(googleData, openLibraryData, locData);
		currentView = 'result'; // Show the card
		isLoading = false;
	}
	
	function handleBackToSearch() {
		Analytics.track('user_interaction', {
			action: 'back_to_search'
		});

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

		Analytics.track('scanner_mode_toggled', {
			enabled: scannerModeEnabled
		});

		if (scannerModeEnabled && searchInputRef) {
			searchInputRef.focus();
			searchInputRef.select();
		}
	}

	// --- Lazy-Loaded Export Functions (Code Splitting) ---
	
	/**
	 * Export single merged book to SLiMS CSV format
	 * Uses dynamic import to reduce main bundle size
	 */
	async function handleExportSLiMSCSV(book: MergedBookData) {
		try {
			const { exportToSLiMSCSV } = await import('$lib/export');
			exportToSLiMSCSV(book);

			Analytics.track('single_export', {
				format: 'csv',
				isbn: book.isbn13 || book.isbn10
			});
		} catch (err) {
			clientLog('error', 'Failed to load export module:', err);
			alert('Failed to export CSV. Please try again.');
		}
	}

	/**
	 * Export single merged book to MARCXML format
	 * Uses dynamic import to reduce main bundle size
	 */
	async function handleExportMARCXML(book: MergedBookData) {
		try {
			const { exportToMARCXML } = await import('$lib/export');
			exportToMARCXML(book);

			Analytics.track('single_export', {
				format: 'marcxml',
				isbn: book.isbn13 || book.isbn10
			});
		} catch (err) {
			clientLog('error', 'Failed to load export module:', err);
			alert('Failed to export MARCXML. Please try again.');
		}
	}
	
	/**
	 * Batch export all scanned books to SLiMS CSV
	 * Uses dynamic import to reduce main bundle size
	 */
	async function exportBatchToCSV() {
		const allBooks = scanHistory.getAll();
		if (allBooks.length === 0) {
			alert('No scanned books to export.');
			return;
		}

		try {
			const { exportBatchToSLiMSCSV } = await import('$lib/export');
			exportBatchToSLiMSCSV(allBooks);

			Analytics.track('batch_export', {
				count: allBooks.length,
				format: 'csv'
			});

			clientLog('info', `[Batch Export] Exported ${allBooks.length} books`);
		} catch (err) {
			clientLog('error', 'Failed to load export module:', err);
			alert('Failed to export batch CSV. Please try again.');
		}
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

<div class="min-h-screen bg-[#fafafa] text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
	<!-- Gradient Background Spotlights -->
	<div class="fixed inset-0 pointer-events-none z-0">
		<div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-blue-100/40 to-transparent rounded-full blur-3xl opacity-60"></div>
		<div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-indigo-100/40 to-transparent rounded-full blur-3xl opacity-60"></div>
	</div>

	<main class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 flex flex-col items-center">
		
		<!-- Hero Typography -->
		<div class="text-center max-w-5xl mx-auto mb-16 animate-fade-in-up">
			<h1 class="text-6xl md:text-8xl font-bold tracking-tight text-gray-900 mb-8 text-balance leading-[0.9]">
				Katalogisasi Buku.<br class="hidden md:block"/>
				<span class="text-gray-400">Selesai dalam Detik.</span>
			</h1>
			<p class="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed text-balance">
				Otomatisasi metadata SLiMS dengan kecepatan cahaya.
				<span class="text-gray-900">100% Gratis.</span>
			</p>
		</div>

		<!-- Main Interaction Area (Search) -->
		<div class="w-full max-w-3xl mx-auto mb-8 relative z-20">
			<div class="relative group">
				<!-- Blur Glow -->
				<div class="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
				
				<!-- Input Container -->
				<div class="relative flex items-center bg-white/80 backdrop-blur-2xl rounded-full p-2 ring-1 ring-black/5 shadow-2xl transition-all">
					<div class="pl-6 text-gray-400">
						{#if isLoading}
							<svg class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						{:else}
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
						{/if}
					</div>

					<input
						type="text"
						bind:this={searchInputRef}
						bind:value={searchQuery}
						oninput={handleInputChange}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								if (debounceTimer) {
									clearTimeout(debounceTimer);
									debounceTimer = null;
								}
								handleSearch();
							}
						}}
						placeholder={scannerModeEnabled ? "Ready to Scan..." : "Scan ISBN (e.g. 9780134092669) or type title"}
						class="flex-1 bg-transparent border-0 focus:ring-0 text-lg md:text-xl px-4 py-4 text-gray-900 placeholder-gray-400 w-full"
					/>

					<button
						onclick={handleSearch}
						disabled={isLoading}
						class="bg-gray-900 hover:bg-black text-white rounded-full px-8 py-3 md:py-4 font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Harvest
					</button>
				</div>
			</div>

			<!-- Scanner Mode Toggle & Stats -->
			<div class="mt-6 flex flex-wrap items-center justify-center gap-4 animate-fade-in text-sm text-gray-500">
				<button
					onclick={toggleScannerMode}
					class="flex items-center gap-2 px-4 py-2 rounded-full transition-all border {scannerModeEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white/50 text-gray-600 border-gray-200 hover:bg-white'}"
				>
					<div class="w-2 h-2 rounded-full {scannerModeEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}"></div>
					{scannerModeEnabled ? 'Scanner Mode Active' : 'Enable Scanner Mode'}
				</button>
				
				{#if scannerModeEnabled}
					<label class="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all border {autoAddEnabled ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white/50 text-gray-600 border-gray-200'}">
						<input type="checkbox" bind:checked={autoAddEnabled} disabled={!isNetworkOnline} class="rounded text-blue-600 focus:ring-offset-0 focus:ring-0 w-4 h-4" />
						<span>Auto-Add {autoAddEnabled ? 'On' : 'Off'}</span>
					</label>

					<div class="px-4 py-2 bg-white/50 backdrop-blur border border-gray-200 rounded-full font-mono">
						Scanned: <span class="font-bold text-gray-900">{scanHistory.count}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="w-full max-w-2xl mx-auto p-4 bg-red-50/80 backdrop-blur border border-red-200 text-red-600 rounded-2xl mb-8 text-center animate-shake">
				{error}
			</div>
		{/if}


		<!-- Dynamic Content Area -->
		<div class="w-full max-w-7xl mx-auto transition-all duration-500">

			<!-- State: Loading Skeletons -->
			{#if isLoading && !mergedData && googleResults.length === 0}
				<div class="max-w-3xl mx-auto mt-12 space-y-6 animate-pulse">
					<div class="h-64 bg-white/60 rounded-3xl w-full"></div>
					<div class="grid grid-cols-2 gap-4">
						<div class="h-40 bg-white/60 rounded-3xl w-full"></div>
						<div class="h-40 bg-white/60 rounded-3xl w-full"></div>
					</div>
				</div>

			<!-- State: Result Card -->
			{:else if currentView === 'result' && mergedData}
				<div class="mt-12 animate-fade-in-up">
					<!-- Keep existing mergedData logic but wrap in cleaner container -->
					<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
						<div class="md:col-span-2 bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/40 shadow-xl ring-1 ring-black/5">
							
							<!-- Action Bar -->
							<div class="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
								<button onclick={handleBackToSearch} class="text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-2 font-medium">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
									Back
								</button>

								<div class="flex gap-2">
									<button onclick={() => handleExportSLiMSCSV(mergedData!)} class="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-all">
										CSV
									</button>
									<button onclick={() => handleExportMARCXML(mergedData!)} class="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all">
										MARCXML
									</button>
								</div>
							</div>

							<!-- Book Content -->
							<div class="flex flex-col md:flex-row gap-8">
								<!-- Cover -->
								<div class="w-full md:w-1/3">
									<div class="aspect-[2/3] rounded-xl overflow-hidden shadow-lg bg-gray-100 relative group">
										<img
											src={getSecureProxyUrl(mergedData.cover)}
											alt={mergedData.title}
											class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
											onerror={handleCoverError}
										/>
									</div>
								</div>

								<!-- Details -->
								<div class="flex-1 space-y-6">
									<div>
										<h2 class="text-3xl font-bold text-gray-900 leading-tight mb-2">{mergedData.title}</h2>
										<p class="text-xl text-gray-500">{mergedData.author}</p>
									</div>

									<div class="grid grid-cols-2 gap-4 text-sm">
										<div class="p-4 bg-gray-50/50 rounded-2xl">
											<span class="block text-gray-400 mb-1">ISBN</span>
											<span class="font-mono font-medium text-gray-900">{mergedData.isbn13}</span>
										</div>
										<div class="p-4 bg-gray-50/50 rounded-2xl">
											<span class="block text-gray-400 mb-1">Publisher</span>
											<span class="font-medium text-gray-900">{mergedData.publisherString}</span>
										</div>
										<div class="p-4 bg-gray-50/50 rounded-2xl">
											<span class="block text-gray-400 mb-1">DDC/Call Number</span>
											<span class="font-mono font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">{mergedData.callNumber}</span>
										</div>
										<div class="p-4 bg-gray-50/50 rounded-2xl">
											<span class="block text-gray-400 mb-1">Pages</span>
											<span class="font-medium text-gray-900">{mergedData.pages}</span>
										</div>
									</div>

									<div class="prose prose-sm text-gray-600 max-w-none">
										{mergedData.description || 'No description available.'}
									</div>
								</div>
							</div>
						</div>

						<!-- Source & Debug Sidebar -->
						<div class="space-y-6">
							<div class="bg-white/60 backdrop-blur p-6 rounded-[2rem] border border-gray-100 shadow-sm">
								<h3 class="font-semibold text-gray-900 mb-4">Data Composition</h3>
								<div class="space-y-3 text-sm">
									<div class="flex justify-between items-center">
										<span class="text-gray-500">Google Books</span>
										<div class="w-2 h-2 rounded-full {mergedData.dataSource?.includes('google') ? 'bg-green-500' : 'bg-gray-300'}"></div>
									</div>
									<div class="flex justify-between items-center">
										<span class="text-gray-500">OpenLibrary</span>
										<div class="w-2 h-2 rounded-full {mergedData.dataSource?.includes('openlibrary') ? 'bg-green-500' : 'bg-gray-300'}"></div>
									</div>
									<div class="flex justify-between items-center">
										<span class="text-gray-500">LoC (LCC)</span>
										<div class="w-2 h-2 rounded-full {mergedData.dataSource?.includes('loc') ? 'bg-green-500' : 'bg-gray-300'}"></div>
									</div>
								</div>
							</div>
							
							<!-- JSON Debug (Collapsed by default or small) -->
							<div class="bg-gray-900 p-6 rounded-[2rem] shadow-inner overflow-hidden">
								<h3 class="text-gray-400 text-xs font-mono mb-2 uppercase tracking-wider">Raw Output</h3>
								<div class="text-xs font-mono text-green-400 overflow-x-auto whitespace-pre">{JSON.stringify({title: mergedData.title, isbn: mergedData.isbn13}, null, 2)}</div>
							</div>
						</div>
					</div>
				</div>

			<!-- State: Search Results List -->
			{:else if currentView === 'search' && (googleResults.length > 0 || (openLibraryResults && openLibraryResults.length > 0))}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 animate-fade-in-up">
					<!-- Google Results -->
					{#if googleResults.length > 0}
						<div class="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-white/50">
							<h3 class="text-xl font-bold text-gray-900 mb-6 px-2">Google Books</h3>
							<div class="space-y-2">
								{#each googleResults as item, index}
									<button onclick={() => handleBookSelection(index)} class="w-full text-left p-4 hover:bg-white rounded-2xl transition-all hover:shadow-md flex items-center gap-4 group">
										<img src={getSecureProxyUrl(item.volumeInfo.imageLinks?.smallThumbnail)} class="w-12 h-16 object-cover rounded shadow-sm group-hover:scale-110 transition-transform" alt="" />
										<div>
											<div class="font-semibold text-gray-900">{item.volumeInfo.title}</div>
											<div class="text-sm text-gray-500">{item.volumeInfo.authors?.[0] || 'Unknown'}</div>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<!-- OpenLibrary Results -->
					{#if openLibraryResults && openLibraryResults.length > 0}
						<div class="bg-white/60 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-white/50">
							<h3 class="text-xl font-bold text-gray-900 mb-6 px-2">OpenLibrary</h3>
							<div class="space-y-2">
								{#each openLibraryResults as doc, index}
									<button onclick={() => handleOpenLibraryBookSelection(index)} class="w-full text-left p-4 hover:bg-white rounded-2xl transition-all hover:shadow-md flex items-center gap-4">
										<div class="w-12 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400">OL</div>
										<div>
											<div class="font-semibold text-gray-900">{doc.title}</div>
											<div class="text-sm text-gray-500">{doc.author_name?.[0] || 'Unknown'}</div>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

			<!-- State: Landing Bento Grid (Initial View) -->
			{:else if !isLoading}
				<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 animate-fade-in-up">
					
					<!-- Card 1: Velocity Engine -->
					<div class="md:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-[0_2px_20px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-500 border border-gray-100 flex flex-col justify-between overflow-hidden relative group">
						<div class="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-100/80"></div>
						<div class="relative z-10">
							<div class="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-blue-600/20">🚀</div>
							<h3 class="text-3xl font-bold text-gray-900 mb-3 tracking-tight">The Velocity Engine.</h3>
							<p class="text-lg text-gray-500 max-w-md leading-relaxed">
								Scanner mode unjammable. Waterfall fetching paralel.
								<span class="text-gray-900 font-medium">Scan 50 buku dalam 5 menit.</span>
							</p>
						</div>
					</div>

					<!-- Card 2: Data Brain -->
					<div class="bg-gray-50 rounded-[2.5rem] p-10 border border-gray-100 hover:bg-white hover:shadow-xl transition-all duration-500 relative overflow-hidden group">
						<div class="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-purple-600/20">🧠</div>
						<h3 class="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Data Brain.</h3>
						<p class="text-gray-500 leading-relaxed">
							Merger otomatis 3 sumber (Google, OpenLibrary, LoC). Klasifikasi DDC & LCC akurat.
						</p>
					</div>

					<!-- Card 3: Anywhere Workflow -->
					<div class="bg-gray-50 rounded-[2.5rem] p-10 border border-gray-100 hover:bg-white hover:shadow-xl transition-all duration-500 group">
						<div class="w-14 h-14 bg-green-600 text-white rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-green-600/20">📱</div>
						<h3 class="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Anywhere.</h3>
						<p class="text-gray-500 leading-relaxed">
							Mobile PWA offline-ready. Gunakan kamera HP sebagai barcode scanner.
						</p>
					</div>

					<!-- Card 4: SLiMS Export -->
					<div class="md:col-span-2 bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
						<div class="absolute inset-0 bg-gradient-to-r from-gray-800 to-gray-900"></div>
						<div class="relative z-10">
							<h3 class="text-2xl font-bold mb-2 tracking-tight">Siap untuk SLiMS.</h3>
							<p class="text-gray-400 max-w-sm">
								Export CSV dengan encoding UTF-8 BOM yang sempurna. Import langsung tanpa edit.
							</p>
						</div>
						<div class="relative z-10 flex gap-4">
							<div class="px-6 py-3 bg-white/10 backdrop-blur rounded-xl border border-white/10 text-sm font-medium">CSV</div>
							<div class="px-6 py-3 bg-white/10 backdrop-blur rounded-xl border border-white/10 text-sm font-medium">MARCXML</div>
						</div>
					</div>

				</div>
			{/if}
		</div>
		
		<!-- History Sidebar (Only in Scanner Mode) -->
		{#if scannerModeEnabled}
			<div class="fixed right-6 bottom-6 z-50">
				<div class="bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl p-4 w-80 max-h-[50vh] overflow-hidden flex flex-col animate-fade-in-up">
					<div class="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
						<h3 class="font-bold text-gray-900">Session History</h3>
						<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{scanHistory.count}</span>
					</div>
					
					<div class="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
						{#each scanHistory.items as book}
							<div class="text-sm p-3 bg-gray-50 rounded-xl">
								<div class="font-medium text-gray-900 truncate">{book.title}</div>
								<div class="text-xs text-gray-500">{book.isbn13}</div>
							</div>
						{/each}
						{#if scanHistory.isEmpty}
							<div class="text-center py-8 text-gray-400 text-xs">No books scanned yet</div>
						{/if}
					</div>

					{#if !scanHistory.isEmpty}
						<div class="mt-4 pt-3 border-t border-gray-100">
							<button onclick={exportBatchToCSV} class="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors">
								Download Batch CSV
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

	</main>
	
	<!-- Toast -->
	{#if toast}
		<div class="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
			<div class="flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-xl {toast.type === 'success' ? 'bg-white/90 text-green-700 border-green-100' : 'bg-red-50/90 text-red-700 border-red-100'}">
				{#if toast.type === 'success'}
					<span class="text-xl">✅</span>
				{:else}
					<span class="text-xl">❌</span>
				{/if}
				<p class="text-sm font-semibold">{toast.message}</p>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Custom Utilities */
	.text-balance {
		text-wrap: balance;
	}

	/* Animations */
	@keyframes fade-in-up {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.animate-fade-in-up {
		animation: fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes fade-in-down {
		from { opacity: 0; transform: translateY(-20px) translateX(-50%); }
		to { opacity: 1; transform: translateY(0) translateX(-50%); }
	}
	.animate-fade-in-down {
		animation: fade-in-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-5px); }
		75% { transform: translateX(5px); }
	}
	.animate-shake {
		animation: shake 0.4s ease-in-out;
	}
</style>
