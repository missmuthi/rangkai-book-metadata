<script lang="ts">
	import CameraScanner from '$lib/components/CameraScanner.svelte';
	import BookDetailModal from '$lib/components/BookDetailModal.svelte';
	import { BookApiService } from '$lib/api';
	import { normalizeISBN } from '$lib/isbn-helpers';
	import type { MergedBookData } from '$lib/types';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { toasts } from '$lib/stores/toast';
	import { fade, fly } from 'svelte/transition';

	let { data } = $props<{ data: PageData }>();

	let cameraActive = $state(false); // Start inactive so user can trigger it
	let lastScanned = $state<string | null>(null);
	let lastResult = $state<MergedBookData | null>(null);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let selectedBook = $state<MergedBookData | null>(null);

	$effect(() => {
		if (!data.session) {
			goto('/login?redirect=/scan/mobile');
		}
	});

	async function handleScan(event: CustomEvent<{ text: string }>) {
		const text = event.detail.text;

		// Prevent duplicate scans if we are already processing
		if (isLoading) return;

		lastScanned = text;
		error = null;

		// Stop camera temporarily while processing
		cameraActive = false;

		await lookupIsbn(text);
	}

	async function lookupIsbn(rawIsbn: string) {
		isLoading = true;

		try {
			const cleaned = normalizeISBN(rawIsbn);
			// console.log('[Scanner] Looking up ISBN:', cleaned);
			
			const result = await BookApiService.fetchFromServerless(cleaned);
			lastResult = result as MergedBookData;
			
			toasts.add(`Found: ${lastResult.title}`, 'success');
			// console.log('[Scanner] ✅ Book fetched successfully');
		} catch (err: any) {
			console.error('[Scanner] ❌ Error fetching book:', err);
			
			// Handle 401 Unauthorized specifically
			if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized'))) {
				toasts.add('Session expired. Redirecting...', 'warning');
				goto('/login?redirect=/scan/mobile');
				return;
			}
			error = err instanceof Error ? err.message : 'Unable to fetch book data.';
			toasts.add(error || 'Failed to fetch book', 'error');
			lastResult = null;
		} finally {
			isLoading = false;
		}
	}

	function toggleCamera() {
		cameraActive = !cameraActive;
		if (cameraActive) {
			error = null;
		}
	}

	async function cleanData() {
		if (!lastResult) return;

		const original = { ...lastResult };
		isLoading = true;

		try {
			const res = await fetch('/api/ai/clean', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(lastResult)
			});

			if (!res.ok) throw new Error('AI Cleaning failed');

			const cleaned = await res.json();
			lastResult = cleaned;

			// Handle warnings
			if (cleaned.aiWarning) {
				toasts.add(cleaned.aiWarning, 'warning');
			} else {
				toasts.add('Metadata cleaned by AI ✨', 'success');
			}

			// Update selectedBook if it matches
			if (selectedBook && (selectedBook.isbn13 === original.isbn13 || selectedBook.isbn10 === original.isbn10)) {
				selectedBook = cleaned;
			}
		} catch (e) {
			console.error(e);
			toasts.add('Failed to clean metadata', 'error');
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Mobile Scanner | Rangkai</title>
	<meta
		name="description"
		content="Scan ISBN barcodes with your phone camera and fetch book metadata in one tap."
	/>
</svelte:head>

<div class="min-h-screen bg-slate-50 pb-32 relative">
	<!-- Header -->
	<header class="bg-white px-4 py-3 shadow-sm sticky top-0 z-10">
		<div class="mx-auto max-w-3xl flex justify-between items-center">
			<h1 class="text-lg font-bold text-slate-900">Scanner</h1>
			<div class="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
				v2.0
			</div>
		</div>
	</header>

	<div class="mx-auto flex max-w-3xl flex-col gap-6 p-4">

		<!-- Camera Section -->
		<section class="relative rounded-2xl overflow-hidden shadow-lg bg-black aspect-[3/4] sm:aspect-video">
			<CameraScanner bind:active={cameraActive} on:scan={handleScan} />

			<!-- Scan Line Animation -->
			{#if cameraActive}
				<div class="absolute inset-x-0 h-0.5 bg-green-400/80 shadow-[0_0_15px_rgba(74,222,128,0.8)] z-10 animate-scan-vertical pointer-events-none"></div>

				<div class="absolute top-4 left-0 right-0 text-center pointer-events-none z-10">
					<span class="inline-block px-3 py-1 bg-black/60 text-white text-xs rounded-full backdrop-blur-sm">
						Point camera at ISBN barcode
					</span>
				</div>
			{:else}
				<div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-20">
					<div class="p-4 rounded-full bg-white/10 mb-4">
						<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</div>
					<p class="font-medium">Camera is paused</p>
					<p class="text-sm text-slate-400 mt-1">Tap the button below to start</p>
				</div>
			{/if}
		</section>

		<!-- Last Scanned Result (Card Layout) -->
		{#if isLoading}
			<!-- Loading Skeleton -->
			<div class="bg-white rounded-xl shadow-sm p-4 animate-pulse">
				<div class="flex gap-4">
					<div class="w-24 h-36 bg-slate-200 rounded-md"></div>
					<div class="flex-1 space-y-3 py-2">
						<div class="h-5 bg-slate-200 rounded w-3/4"></div>
						<div class="h-4 bg-slate-200 rounded w-1/2"></div>
						<div class="h-3 bg-slate-200 rounded w-full"></div>
						<div class="h-3 bg-slate-200 rounded w-full"></div>
					</div>
				</div>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 rounded-xl p-6 text-center" transition:fade>
				<svg class="mx-auto size-12 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<h3 class="text-lg font-semibold text-gray-900">Couldn't find book</h3>
				<p class="mt-1 text-sm text-gray-600 mb-4">{error}</p>
				<button
					onclick={() => lookupIsbn(lastScanned || '')}
					class="text-blue-600 font-medium hover:underline"
				>
					Try Again
				</button>
			</div>
		{:else if lastResult}
			<button
				class="w-full text-left bg-white rounded-xl shadow-lg overflow-hidden transition-transform active:scale-[0.99]"
				transition:fly={{ y: 20, duration: 400 }}
				onclick={() => (selectedBook = lastResult)}
				aria-label={`View details for ${lastResult.title}`}
			>
				<div class="flex">
					<!-- Cover Image -->
					<div class="w-32 bg-gray-100 relative shrink-0">
						{#if lastResult.cover && lastResult.cover !== '-'}
							<img
								src={lastResult.cover}
								alt={lastResult.title}
								class="object-cover w-full h-full absolute inset-0"
								loading="lazy"
							/>
						{:else}
							<div class="flex items-center justify-center h-full text-gray-400">
								<svg class="size-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
								</svg>
							</div>
						{/if}
					</div>

					<!-- Metadata -->
					<div class="p-4 flex-1 min-w-0">
						<div class="flex justify-between items-start">
							<p class="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">
								{lastResult.isbn13 || lastResult.isbn10}
							</p>
							<span class="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
								Saved
							</span>
						</div>

						<h2 class="text-lg font-bold text-gray-900 leading-tight mb-1 line-clamp-2">
							{lastResult.title}
						</h2>

						<p class="text-sm text-gray-600 mb-3 line-clamp-1">
							{lastResult.author}
						</p>

						<div class="flex items-center gap-3 text-xs text-gray-500 border-t border-gray-100 pt-3">
							<span class="truncate">{lastResult.publisherString || lastResult.publisher}</span>
							<span>•</span>
							<span class="whitespace-nowrap">{lastResult.date}</span>
						</div>
					</div>
				</div>
			</button>

			<div class="mt-2 flex justify-end">
				<button
					onclick={cleanData}
					class="text-sm flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors"
					disabled={isLoading}
				>
					{#if isLoading}
						<svg class="animate-spin size-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Cleaning...
					{:else}
						<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
						</svg>
						AI Clean
					{/if}
				</button>
			</div>
		{:else}
			<!-- Empty State Hint -->
			<div class="text-center py-8 opacity-60">
				<p class="text-sm text-gray-500">Scan results will appear here</p>
			</div>
		{/if}
	</div>

	<!-- Floating Action Button -->
	<button
		class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-semibold rounded-full shadow-2xl active:scale-95 transition-all disabled:opacity-80 disabled:cursor-wait min-w-[220px] justify-center hover:shadow-blue-500/30"
		onclick={toggleCamera}
		disabled={isLoading}
		aria-label={cameraActive ? "Stop scanning" : "Start scanning"}
	>
		{#if isLoading}
			<svg class="animate-spin size-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<span>Processing...</span>
		{:else if cameraActive}
			<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
			</svg>
			<span>Stop Scanning</span>
		{:else}
			<svg class="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			<span>Scan ISBN</span>
		{/if}
	</button>

	{#if selectedBook}
		<BookDetailModal book={selectedBook} onClose={() => (selectedBook = null)} />
	{/if}
</div>

<style>
	@keyframes scan-vertical {
		0% { top: 0; opacity: 0; }
		10% { opacity: 1; }
		90% { opacity: 1; }
		100% { top: 100%; opacity: 0; }
	}
	.animate-scan-vertical {
		animation: scan-vertical 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
	}
</style>
