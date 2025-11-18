<script lang="ts">
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
	}

	import { checkGoogleBooksLimit, checkOpenLibraryLimit, getRateLimitStatus } from '$lib/rateLimiter';
	let searchQuery = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// 'search' = show search results | 'result' = show merged data card
	let currentView = $state<'search' | 'result'>('search');
	
	let googleResults = $state<GoogleBookItem[]>([]);
	let openLibraryResults = $state<OpenLibrarySearchResponse['docs'] | undefined>(undefined);
	let mergedData = $state<MergedBookData | null>(null);

	// Raw data for debugging
	let googleRaw = $state('');
	let openLibraryRaw = $state('');

	// Rate limit status
	let rateLimitStatus = $state(getRateLimitStatus());

	const placeholderImg = "https://placehold.co/300x450/e0e0e0/7c7c7c?text=No+Cover";

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

	// --- Main Search Function ---
	async function handleSearch() {
		if (!searchQuery) {
			error = "Please enter an ISBN or Title.";
			return;
		}

		// 1. Reset UI
		isLoading = true;
		error = null;
		mergedData = null;
		googleResults = [];
		openLibraryResults = [];
		googleRaw = 'Fetching...';
		openLibraryRaw = 'Fetching...';
		currentView = 'search'; // Stay on search view to show lists

		// 2. Determine query type (ISBN or Title)
		const isIsbn = /^\d{10}(\d{3})?$/.test(searchQuery.replace(/-/g, ''));
		
		if (isIsbn) {
			// --- ISBN Search ---
			try {
				const [googleResult, openLibraryResult] = await Promise.allSettled([
					fetchGoogle(searchQuery, true, 1),
					fetchOpenLibrary(searchQuery, true)
				]);

				const googleData = (googleResult.status === 'fulfilled' && googleResult.value && googleResult.value.totalItems > 0 && googleResult.value.items) 
					? googleResult.value.items[0].volumeInfo 
					: null;
				const openLibraryData = openLibraryResult.status === 'fulfilled' ? openLibraryResult.value as OpenLibraryBookData | null : null;

				googleRaw = JSON.stringify(googleData, null, 2) || 'Failed to fetch or no data found.';
				openLibraryRaw = JSON.stringify(openLibraryData, null, 2) || 'Failed to fetch or no data found.';

				if (!googleData && !openLibraryData) {
					error = "No data found from any source for this ISBN.";
				} else {
					mergedData = processAndRenderMergedData(googleData, openLibraryData);
					currentView = 'result'; // Show the result card
				}
			} catch (err: any) {
				error = err.message || 'An error occurred during search.';
			}
			
		} else {
			// --- Title Search ---
			try {
				const [googleResponse, openLibraryResponse] = await Promise.allSettled([
					fetchGoogle(searchQuery, false, 10),
					fetchOpenLibrary(searchQuery, false, 10)
				]);

				const googleItems = googleResponse.status === 'fulfilled' ? googleResponse.value?.items : null;
				const openLibraryItems = openLibraryResponse.status === 'fulfilled' ? (openLibraryResponse.value as OpenLibrarySearchResponse | null)?.docs : null;

				if (!googleItems && !openLibraryItems) {
					error = "No books found for that title from any source.";
				}

				if (googleItems && googleItems.length > 0) {
					googleResults = googleItems;
				}

				if (openLibraryItems && openLibraryItems.length > 0) {
					openLibraryResults = openLibraryItems;
				} else {
					openLibraryResults = undefined;
				}
			} catch (err: any) {
				error = err.message || 'An error occurred during search.';
			}
		}
		
		isLoading = false;
		rateLimitStatus = getRateLimitStatus();
	}

	// --- Book Selection Handlers ---

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
			openLibraryData = await fetchOpenLibrary(isbn, true) as OpenLibraryBookData | null;
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
		
		let openLibraryData: OpenLibraryBookData | null = null;
		if (selectedDoc.key) {
			const detailsUrl = `https://openlibrary.org${selectedDoc.key}.json`;
			try {
				const detailsResponse = await fetch(detailsUrl);
				if (!detailsResponse.ok) throw new Error("OpenLibrary details fetch error");
				const detailsData = await detailsResponse.json();
				
				openLibraryData = {
					title: detailsData.title,
					authors: selectedDoc.author_name ? selectedDoc.author_name.map((name: string) => ({ name })) : [],
					publish_date: selectedDoc.first_publish_year?.toString() || detailsData.publish_date,
					number_of_pages: selectedDoc.number_of_pages_median || detailsData.number_of_pages,
					description: detailsData.description?.value || detailsData.description,
					languages: detailsData.languages,
					subjects: detailsData.subjects,
					publish_places: detailsData.publish_places,
					edition_name: detailsData.edition_name,
					series: detailsData.series,
					identifiers: {
						isbn_13: selectedDoc.isbn ? selectedDoc.isbn.filter((isbn: string) => isbn.length === 13) : [],
						isbn_10: selectedDoc.isbn ? selectedDoc.isbn.filter((isbn: string) => isbn.length === 10) : []
					},
					classifications: { 
						dewey_decimal_class: detailsData.dewey_decimal_class,
						lc_classifications: detailsData.lc_classifications
					},
					cover: detailsData.covers ? { large: `https://covers.openlibrary.org/b/id/${detailsData.covers[0]}-L.jpg` } : undefined
				};
				openLibraryRaw = JSON.stringify(openLibraryData, null, 2);
			} catch (err: any) {
					openLibraryRaw = `Error fetching OL details: ${err.message}`;
			}
		} else {
				openLibraryRaw = 'No key found to fetch OpenLibrary details.';
		}

		const isbn = openLibraryData?.identifiers?.isbn_13?.[0];
		let googleData: GoogleBookItem['volumeInfo'] | null = null;
		if (isbn) {
			const googleResponse = await fetchGoogle(isbn, true, 1);
			googleData = (googleResponse && googleResponse.totalItems > 0 && googleResponse.items) ? googleResponse.items[0].volumeInfo : null;
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

	// --- API Fetch Functions ---

	async function fetchGoogle(query: string, isIsbn: boolean, maxResults = 1): Promise<GoogleBooksResponse | null> {
		// Check rate limit
		if (!checkGoogleBooksLimit()) {
			const status = getRateLimitStatus();
			throw new Error(`Google Books API rate limit exceeded. Try again in ${status.google.resetInSeconds} seconds.`);
		}

		const q = isIsbn ? `isbn:${query}` : `intitle:${query}`;
		const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;
		
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`Google API error: ${response.statusText}`);
			const data: GoogleBooksResponse = await response.json();
			return data;
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			console.error("Google Fetch Error:", err);
			googleRaw = `Error: ${errorMessage}`;
			return null;
		}
	}

	async function fetchOpenLibrary(query: string, isIsbn: boolean, limit = 1): Promise<OpenLibraryBookData | OpenLibrarySearchResponse | null> {
		// Check rate limit
		if (!checkOpenLibraryLimit()) {
			const status = getRateLimitStatus();
			throw new Error(`OpenLibrary API rate limit exceeded. Try again in ${status.openlibrary.resetInSeconds} seconds.`);
		}

		let url: string;
		if (isIsbn) {
			url = `https://openlibrary.org/api/books?bibkeys=ISBN:${query}&format=json&jscmd=data`;
		} else {
			url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
		}

		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`OpenLibrary API error: ${response.statusText}`);
			const data = await response.json();
			
			if (isIsbn) {
				const key = `ISBN:${query}`;
				if (!data[key]) return null;
				return data[key] as OpenLibraryBookData;
			} else {
				return data as OpenLibrarySearchResponse;
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			console.error("OpenLibrary Fetch Error:", err);
			openLibraryRaw = `Error: ${errorMessage}`;
			return null;
		}
	}

	// --- Data Processing: use shared module ---
	import { processAndRenderMergedData, placeholderImg } from '$lib/merge';

	// Helper for cover image error
	function handleCoverError(event: any) {
		event.target.src = placeholderImg;
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
	<main class="max-w-5xl mx-auto px-4 py-12">
		
		<!-- Search Bar (from your design) -->
		<div class="text-center mb-12 space-y-4 max-w-3xl mx-auto">
			<h2 class="text-3xl font-bold text-gray-900">Harvest Book Data</h2>
			<p class="text-gray-500">Enter an ISBN or Title to gather metadata from Google Books & OpenLibrary.</p>
			
			<div class="flex gap-2 max-w-lg mx-auto mt-6 relative">
				<input 
					type="text" 
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Enter' && handleSearch()}
					placeholder="e.g. 9780134092669 or Akulah Angin Bambang" 
					class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition-all"
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
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="max-w-3xl mx-auto p-4 bg-red-100 text-red-700 rounded-lg mb-6">
				{error}
			</div>
		{/if}

		<!-- === Main UI State Swap === -->

		{#if isLoading && !mergedData && googleResults.length === 0}
			<!-- Main Loading Spinner (only on initial search) -->
			<div class="flex flex-col items-center justify-center p-12 text-gray-500">
				<svg class="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-lg">Harvesting data...</p>
			</div>
		
		{:else if currentView === 'result' && mergedData}
			<!-- === SLiMS Result Card === -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="md:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-lg">
					<button onclick={handleBackToSearch} class="mb-4 text-sm text-blue-600 hover:text-blue-800 font-medium">
						&larr; Back to Search Results
					</button>
					<h2 class="text-xl font-bold mb-4 border-b pb-2">SLiMS-Ready Data (Merged)</h2>
					
					<div class="space-y-4">
						<div class="w-1/3 float-right ml-4 mb-4">
							<div class="aspect-[2/3] w-full bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 shadow-md overflow-hidden bg-cover bg-center" style="background-image: url({mergedData.cover !== placeholderImg ? mergedData.cover : 'none'});">
    {#if mergedData.cover === placeholderImg}
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
						<p class="font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded-md inline-block col-span-2">{mergedData.callNumber}</p>
						
						<span class="text-sm font-medium text-gray-500 col-span-1">Publisher</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.publisherString}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Collation</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.collation}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Language</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.language}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">ISBN/ISSN</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.isbn13}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Classification</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.classification}</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Content Type</span>
						<p class="text-base text-gray-700 col-span-2">text</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Media Type</span>
						<p class="text-base text-gray-700 col-span-2">unmediated</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Carrier Type</span>
						<p class="text-base text-gray-700 col-span-2">volume</p>

						<span class="text-sm font-medium text-gray-500 col-span-1">Edition</span>
						<p class="text-base text-gray-700 col-span-2">{mergedData.edition}</p>

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
								{@const cover = info.imageLinks?.smallThumbnail || placeholderImg}
								
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
								{@const cover = coverID ? `https://covers.openlibrary.org/b/id/${coverID}-S.jpg` : placeholderImg}

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

	</main>
</div>