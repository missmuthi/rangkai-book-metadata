<script lang="ts">
        import CameraScanner from '$lib/components/CameraScanner.svelte';
        import BookDetailModal from '$lib/components/BookDetailModal.svelte';
        import { BookApiService } from '$lib/api';
        import { normalizeISBN } from '$lib/isbn-helpers';
        import type { MergedBookData } from '$lib/types';

        let cameraActive = true;
        let lastScanned: string | null = null;
        let lastResult: MergedBookData | null = null;
        let isLoading = false;
        let error: string | null = null;
        let selectedBook = $state<MergedBookData | null>(null);

        async function handleScan(event: CustomEvent<{ text: string }>) {
                const text = event.detail.text;

                lastScanned = text;
                error = null;
                await lookupIsbn(text);
        }

        async function lookupIsbn(rawIsbn: string) {
                isLoading = true;

                try {
                        const cleaned = normalizeISBN(rawIsbn);
                        const data = await BookApiService.fetchFromServerless(cleaned);
                        lastResult = data as MergedBookData;
                } catch (err) {
                        error = err instanceof Error ? err.message : 'Unable to fetch book data.';
                        lastResult = null;
                } finally {
                        isLoading = false;
                }
        }

        function toggleCamera() {
                cameraActive = !cameraActive;
        }
</script>

<svelte:head>
        <title>Mobile Scanner | Rangkai</title>
        <meta
                name="description"
                content="Scan ISBN barcodes with your phone camera and fetch book metadata in one tap."
        />
</svelte:head>

<div class="min-h-screen bg-slate-50">
        <div class="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-10">
                <header class="space-y-2">
                        <p class="text-sm font-semibold uppercase tracking-wide text-blue-600">Scanner</p>
                        <h1 class="text-3xl font-bold text-slate-900">Mobile ISBN Capture</h1>
                        <p class="text-sm text-slate-600">
                                Use your device camera to scan barcodes. The last scanned result stays pinned below so you can
                                review details quickly.
                        </p>
                </header>

                <section class="space-y-4">
                        <CameraScanner bind:active={cameraActive} on:scan={handleScan} />

                        <div class="flex gap-3">
                                <button
                                        type="button"
                                        class="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                        on:click={toggleCamera}
                                >
                                        {cameraActive ? 'Stop Camera' : 'Resume Camera'}
                                </button>
                                <button
                                        type="button"
                                        class="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                        on:click={() => lookupIsbn(lastScanned ?? '')}
                                        disabled={!lastScanned || isLoading}
                                >
                                        Refresh Lookup
                                </button>
                        </div>
                </section>

                <section class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div class="flex items-center justify-between">
                                <h2 class="text-lg font-semibold text-slate-900">Last scanned</h2>
                                <p class="text-xs text-slate-500" aria-live="polite">
                                        {lastScanned ? `ISBN: ${lastScanned}` : 'Waiting for first scan'}
                                </p>
                        </div>

                        {#if isLoading}
                                <p class="text-sm text-slate-600">Looking up book details...</p>
                        {:else if error}
                                <p class="text-sm font-semibold text-red-600" role="alert">{error}</p>
                        {:else if lastResult}
                                        <div
                                                class="flex gap-4 cursor-pointer rounded-lg transition hover:bg-slate-50"
                                                role="button"
                                                tabindex="0"
                                                on:click={() => (selectedBook = lastResult)}
                                                on:keydown={(event) =>
                                                        (event.key === 'Enter' || event.key === ' ')
                                                                ? ((event.preventDefault(), (selectedBook = lastResult)))
                                                                : null
                                                }
                                        >
                                                {#if lastResult.cover && lastResult.cover !== '-'}
                                                        <img
                                                                src={lastResult.cover}
                                                        alt={`Cover art for ${lastResult.title}`}
                                                        class="h-32 w-24 rounded-md object-cover shadow"
                                                />
                                        {/if}
                                        <div class="space-y-1">
                                                <p class="text-sm font-semibold text-blue-600">{lastResult.isbn13 || lastResult.isbn10}</p>
                                                <h3 class="text-xl font-bold text-slate-900">{lastResult.title}</h3>
                                                <p class="text-sm text-slate-600">{lastResult.author}</p>
                                                <p class="text-xs text-slate-500">
                                                        {lastResult.publisherString || lastResult.publisher} • {lastResult.date}
                                                </p>
                                                <p class="text-xs text-slate-500">LCC: {lastResult.lcc || '-'}</p>
                                        </div>
                                </div>
                        {:else}
                                <p class="text-sm text-slate-600">Scan a barcode to see details here.</p>
                        {/if}
                </section>
        </div>

        {#if selectedBook}
                <BookDetailModal book={selectedBook} onClose={() => (selectedBook = null)} />
        {/if}
</div>
