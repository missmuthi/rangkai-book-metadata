<script lang="ts">
	import CameraScanner from '$lib/components/CameraScanner.svelte';
	import { Card } from '$lib/components/ui';
	import type { MergedBookData } from '$lib/types';
	import { normalizeISBN, isValidISBN, extractISBN } from '$lib/isbn-helpers';

	type LastBook = {
		isbn: string;
		title: string;
		subtitle?: string;
		authors?: string[];
		coverUrl?: string;
		source?: string;
	};

	let lastBook = $state<LastBook | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let pendingIsbn = $state<string | null>(null);
	let scanCount = $state(0);
	let showSuccessFlash = $state(false);
	let scannerRef = $state<any>(null);

	/**
	 * Map API response to UI-friendly LastBook model
	 */
	function mapToLastBook(data: MergedBookData, isbn: string): LastBook {
		const authors = data.author
			? data.author.split(/[;,]/).map((a) => a.trim()).filter(Boolean)
			: [];
		
		return {
			isbn,
			title: data.title || 'Unknown Title',
			subtitle: data.specificDetail || undefined,
			authors: authors.length > 0 ? authors : undefined,
			coverUrl: data.cover || undefined,
			source: data.dataSource || undefined
		};
	}

	/**
	 * Fetch book metadata from API
	 */
	async function fetchBook(isbn: string): Promise<MergedBookData> {
		const response = await fetch(`/api/book/${encodeURIComponent(isbn)}`);
		
		if (!response.ok) {
			const errorText = await response.text();
			
			// Provide user-friendly error messages
			if (response.status === 404) {
				throw new Error('Book not found. Please try another ISBN.');
			} else if (response.status === 400) {
				throw new Error('Invalid ISBN format. Please scan again.');
			} else if (response.status >= 500) {
				throw new Error('Server error. Please try again later.');
			}
			
			throw new Error(errorText || `HTTP ${response.status}`);
		}

		return await response.json() as MergedBookData;
	}

	/**
	 * Trigger success flash animation
	 */
	function triggerSuccessFlash() {
		showSuccessFlash = true;
		setTimeout(() => {
			showSuccessFlash = false;
		}, 400);
	}

	/**
	 * Handle successful barcode scan
	 */
	async function handleScan(detail: { text: string }) {
		const scannedText = detail.text;
		
		// Extract and validate ISBN
		const extractedISBN = extractISBN(scannedText);
		if (!extractedISBN) {
			error = 'Invalid barcode. Please scan a book ISBN.';
			return;
		}

		const isbn = normalizeISBN(extractedISBN);
		
		// Optional: Validate ISBN format before API call
		if (!isValidISBN(isbn)) {
			error = `Invalid ISBN: ${isbn}. Please scan again.`;
			return;
		}

		// If already loading, queue this ISBN for next fetch
		if (loading) {
			pendingIsbn = isbn;
			return;
		}

		loading = true;
		error = null;
		pendingIsbn = null;

		try {
			const data = await fetchBook(isbn);
			lastBook = mapToLastBook(data, isbn);
			scanCount++;
			triggerSuccessFlash();

			// If a new scan came in while we were fetching, process it
			if (pendingIsbn && pendingIsbn !== isbn) {
				const nextIsbn = pendingIsbn;
				pendingIsbn = null;
				
				try {
					const nextData = await fetchBook(nextIsbn);
					lastBook = mapToLastBook(nextData, nextIsbn);
					scanCount++;
					triggerSuccessFlash();
				} catch (err) {
					error = err instanceof Error ? err.message : 'Failed to fetch book data';
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to fetch book data';
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle camera scanner errors
	 */
	function handleScanError(detail: { message: string }) {
		error = detail.message;
	}

	/**
	 * Handle image loading errors
	 */
	function handleCoverError(e: Event) {
		const target = e.currentTarget as HTMLImageElement;
		if (target) {
			target.style.display = 'none';
		}
	}
</script>

<svelte:head>
	<title>Mobile Scan Mode - Rangkai</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<!-- Success Flash Overlay -->
{#if showSuccessFlash}
	<div 
		class="fixed inset-0 bg-green-400 opacity-20 z-50 pointer-events-none animate-flash"
		aria-hidden="true"
	></div>
{/if}

<div class="min-h-screen bg-gray-50 pb-24">
	<div class="max-w-7xl mx-auto px-4 py-6">
		<!-- Header -->
		<header class="mb-6">
			<h1 class="text-2xl md:text-3xl font-bold text-gray-900 mb-1">Mobile Scan Mode</h1>
			<p class="text-sm text-gray-600">Scan ISBN/EAN barcodes to fetch book metadata</p>
			{#if scanCount > 0}
				<p class="text-xs text-gray-500 mt-1" role="status" aria-live="polite">
					Books scanned: {scanCount}
				</p>
			{/if}
		</header>

		<!-- Camera Scanner with Glow Animation -->
		<section 
			class="mb-8"
			aria-labelledby="scanner-heading"
		>
			<h2 id="scanner-heading" class="sr-only">Barcode Scanner</h2>
			<div class="relative">
				<div class={`scanning-glow ${!error && !loading ? 'active' : ''}`}>
					<CameraScanner bind:this={scannerRef} onscan={handleScan} onerror={handleScanError} />
				</div>
			</div>
		</section>

		<!-- Last Scanned Book Section -->
		<section 
			class="max-w-lg mx-auto"
			aria-labelledby="results-heading"
		>
			<h2 id="results-heading" class="text-lg font-semibold text-gray-900 mb-4">
				Last Scanned Book
			</h2>

			{#if loading}
				<Card>
					<div class="flex items-center justify-center py-8" role="status" aria-live="polite">
						<div class="flex flex-col items-center gap-3">
							<div 
								class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
								aria-hidden="true"
							></div>
							<p class="text-sm text-gray-600">Fetching book data...</p>
						</div>
					</div>
				</Card>
			{:else if error}
				<Card>
					<div 
						class="bg-red-50 border border-red-200 rounded-lg p-4"
						role="alert"
						aria-live="assertive"
					>
						<div class="flex items-start gap-3">
							<svg 
								class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" 
								fill="none" 
								stroke="currentColor" 
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="font-medium text-red-900">Error</p>
								<p class="text-sm text-red-700 mt-1">{error}</p>
							</div>
						</div>
					</div>
				</Card>
			{:else if lastBook}
				<div class="book-result-card bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
					<article 
						class="flex gap-4 p-4"
						aria-labelledby="book-title"
					>
						{#if lastBook.coverUrl}
							<div class="flex-shrink-0">
								<img 
									src={lastBook.coverUrl} 
									alt={`Cover of ${lastBook.title}`}
									class="w-20 h-28 sm:w-24 sm:h-32 object-cover rounded shadow-sm"
									onerror={handleCoverError}
									loading="lazy"
								/>
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<h3 id="book-title" class="font-bold text-gray-900 text-base sm:text-lg mb-1 line-clamp-2">
								{lastBook.title}
							</h3>
							{#if lastBook.subtitle}
								<p class="text-sm text-gray-600 mb-2 line-clamp-1">{lastBook.subtitle}</p>
							{/if}
							{#if lastBook.authors && lastBook.authors.length > 0}
								<p class="text-sm text-gray-700 mb-2">
									<span class="font-medium">By:</span> {lastBook.authors.join(', ')}
								</p>
							{/if}
							<p class="text-xs text-gray-500 mb-1">
								<span class="font-medium">ISBN:</span> 
								<span class="font-mono">{lastBook.isbn}</span>
							</p>
							{#if lastBook.source}
								<p class="text-xs text-gray-500">
									<span class="font-medium">Source:</span> {lastBook.source}
								</p>
							{/if}
						</div>
					</article>
				</div>
			{:else}
				<Card>
					<div 
						class="text-center py-8 text-gray-500"
						role="status"
					>
						<svg 
							class="w-12 h-12 mx-auto mb-3 text-gray-400" 
							fill="none" 
							stroke="currentColor" 
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
						</svg>
						<p class="text-sm">No book scanned yet</p>
						<p class="text-xs text-gray-400 mt-1">Point your camera at a barcode to begin</p>
					</div>
				</Card>
			{/if}
		</section>
	</div>
</div>

<!-- Fixed Bottom Control Bar -->
<div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-area-bottom">
	<div class="max-w-7xl mx-auto px-4 py-3">
		<div class="flex items-center justify-around gap-2">
			<button
				onclick={() => scannerRef?.resumeScanning?.()}
				class="flex flex-col items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 active:scale-95 transition-transform"
				aria-label="Resume scanning"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-xs">Resume</span>
			</button>
			
			<button
				onclick={() => scannerRef?.pauseScanning?.()}
				class="flex flex-col items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 active:scale-95 transition-transform"
				aria-label="Pause scanning"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-xs">Stop</span>
			</button>
			
			<button
				onclick={() => scannerRef?.switchCamera?.()}
				class="flex flex-col items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 active:scale-95 transition-transform"
				aria-label="Switch camera"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
				</svg>
				<span class="text-xs">Switch</span>
			</button>
		</div>
	</div>
</div>

<!-- Screen reader only styles and animations -->
<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Scan glow animation */
	.scanning-glow {
		position: relative;
	}

	.scanning-glow.active::before {
		content: '';
		position: absolute;
		inset: -4px;
		border-radius: 0.75rem;
		padding: 4px;
		background: linear-gradient(45deg, #3b82f6, #8b5cf6, #3b82f6);
		background-size: 200% 200%;
		-webkit-mask: 
			linear-gradient(#fff 0 0) content-box, 
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		animation: scan-glow 2s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes scan-glow {
		0%, 100% {
			opacity: 0.5;
			background-position: 0% 50%;
		}
		50% {
			opacity: 1;
			background-position: 100% 50%;
		}
	}

	/* Success flash animation */
	@keyframes flash {
		0%, 100% {
			opacity: 0;
		}
		50% {
			opacity: 0.3;
		}
	}

	.animate-flash {
		animation: flash 0.4s ease-in-out;
	}

	/* Book result card styling */
	.book-result-card {
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.book-result-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
	}

	/* Safe area for devices with notches */
	.safe-area-bottom {
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* Text clamping */
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
