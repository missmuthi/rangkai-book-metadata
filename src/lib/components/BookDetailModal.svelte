<script lang="ts">
        import type { MergedBookData } from '$lib/types';

        let { book, onClose }: { book: MergedBookData; onClose: () => void } = $props();
        let copyStatus = $state<'idle' | 'copied' | 'error'>('idle');

        let coverUrl = $derived(getSecureProxyUrl(book.cover));

        const FALLBACK_COVER =
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjN2M3YzdjIj5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4=';

        function getSecureProxyUrl(url: string | null | undefined): string {
                if (!url || url === '' || url === '-') {
                        return FALLBACK_COVER;
                }

                if (url.startsWith('data:')) {
                        return url;
                }

                const ALLOWED_DOMAINS = [
                        'books.google.com',
                        'books.googleusercontent.com',
                        'covers.openlibrary.org'
                ];

                try {
                        const urlObj = new URL(url);
                        const isAllowed = ALLOWED_DOMAINS.some(
                                (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
                        );

                        if (!isAllowed) {
                                console.warn(`[SSRF Protection] Blocked untrusted domain: ${urlObj.hostname}`);
                                return FALLBACK_COVER;
                        }

                        const encodedUrl = encodeURIComponent(url);
                        return `https://wsrv.nl/?url=${encodedUrl}&w=450&q=80&output=webp`;
                } catch (error) {
                        console.warn('[Secure Proxy] Invalid URL format:', url);
                        return FALLBACK_COVER;
                }
        }

        async function copyAll() {
                const lines = [
                        `Title: ${book.title}`,
                        `Author: ${book.author}`,
                        `ISBN-13: ${book.isbn13 || '-'}`,
                        `ISBN-10: ${book.isbn10 || '-'}`,
                        `Publisher: ${book.publisherString || book.publisher}`,
                        `Year: ${book.date}`,
                        `DDC: ${book.ddc}`,
                        `LCC: ${book.lcc}`,
                        `Call Number: ${book.callNumber}`,
                        `Language: ${book.language}`,
                        `Subjects: ${book.subjects}`,
                        `Description: ${book.description}`
                ];

                try {
                        await navigator.clipboard.writeText(lines.join('\n'));
                        copyStatus = 'copied';
                        setTimeout(() => (copyStatus = 'idle'), 2000);
                } catch (error) {
                        console.error('Failed to copy book details', error);
                        copyStatus = 'error';
                        setTimeout(() => (copyStatus = 'idle'), 2000);
                }
        }

        function onBackdropClick(event: MouseEvent) {
                if ((event.target as HTMLElement).id === 'book-detail-backdrop') {
                        onClose();
                }
        }
</script>

<div
	id="book-detail-backdrop"
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
	role="dialog"
	aria-modal="true"
	aria-label="Book details for {book.title}"
	onclick={onBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	tabindex="-1"
>
	<div
		class="relative flex h-full max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
		role="document"
	>
		<header class="absolute top-0 z-10 flex w-full items-center justify-between p-4 bg-white/80 backdrop-blur-sm">
			<h2 class="text-lg font-bold text-gray-900 sr-only" id="book-modal-title">{book.title}</h2>
			<div class="w-10"></div>
			<button
				class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:scale-105 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
				type="button"
				onclick={onClose}
				aria-label="Close book details"
			>
				✕
			</button>
		</header>

		<div class="flex-1 overflow-y-auto p-6 pt-20">
			<div class="grid gap-x-8 gap-y-6 md:grid-cols-[minmax(0,_1fr)_1.2fr]">
				<div class="space-y-4">
					<div class="overflow-hidden rounded-xl bg-gray-50 shadow-inner">
						{#if coverUrl === FALLBACK_COVER}
							<div class="flex aspect-[2/3] items-center justify-center text-sm text-gray-500">
                                                        No Cover Available
                                                </div>
                                        {:else}
                                                <img
                                                        src={coverUrl}
                                                        alt={`Cover art for ${book.title}`}
                                                        class="aspect-[2/3] w-full object-cover"
                                                />
                                        {/if}
                                </div>

                                <div class="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                        <p class="font-semibold uppercase tracking-wide text-xs text-blue-700">Classification</p>
                                        <div class="mt-2 flex flex-wrap gap-2">
                                                <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-900 shadow-sm ring-1 ring-blue-100">
                                                        <span class="text-xs font-bold text-blue-500">DDC</span> {book.ddc || '-'}
                                                </span>
                                                <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-900 shadow-sm ring-1 ring-blue-100">
                                                        <span class="text-xs font-bold text-blue-500">LCC</span> {book.lcc || '-'}
                                                </span>
                                                {#if book.dataSource?.includes('loc') && book.lcc !== '-'}
                                                        <span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-900 ring-1 ring-green-200">
                                                                🏛️ Official LoC
                                                        </span>
                                                {:else if book.isPartialData && (book.ddc === '-' || book.lcc === '-')}
                                                        <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                                                                ⚠️ Classification Incomplete
                                                        </span>
                                                {/if}
                                        </div>
                                </div>
                        </div>

				<div class="flex flex-col gap-y-4">
					<header class="space-y-1">
						<p class="text-base font-medium text-blue-600">{book.author}</p>
						<h1 class="text-3xl font-bold text-gray-900 break-words">{book.title}</h1>
						<p class="text-sm text-gray-600">{book.publisherString || book.publisher} • {book.date}</p>
					</header>

					<div class="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">ISBN-13</p>
							<p class="font-mono text-sm text-gray-900 break-all">{book.isbn13 || '-'}</p>
						</div>
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">ISBN-10</p>
							<p class="font-mono text-sm text-gray-900 break-all">{book.isbn10 || '-'}</p>
						</div>
						<div class="sm:col-span-2">
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Publisher</p>
							<p class="text-sm text-gray-900">{book.publisherString || book.publisher}</p>
						</div>
					</div>

					<div class="space-y-4 rounded-xl border border-gray-200 p-4">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
							<p class="text-sm leading-relaxed text-gray-800 break-words">{book.description || 'No description available.'}</p>
						</div>
						<div class="grid gap-x-4 gap-y-2 sm:grid-cols-2">
							<div>
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Subjects</p>
								<p class="text-sm text-gray-800 break-words">{book.subjects || '-'}</p>
							</div>
							<div>
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Language</p>
								<p class="text-sm text-gray-800">{book.language || '-'}</p>
							</div>
							<div>
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Call Number</p>
								<p class="text-sm font-semibold text-gray-900">{book.callNumber || '-'}</p>
							</div>
							<div>
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Series</p>
								<p class="text-sm text-gray-800">{book.series || '-'}</p>
							</div>
						</div>
					</div>

					<div class="flex flex-wrap items-center justify-between gap-4">
						<div class="flex flex-wrap items-center gap-2">
							{#if book.dataSource?.includes('loc')}
								<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-900 ring-1 ring-green-200">
									🏛️ Verified by Library of Congress
								</span>
                                                {/if}
                                                {#if book.isPartialData}
                                                        <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                                                                ⚠️ Partial data (one or more sources unavailable)
                                                        </span>
                                                {/if}
                                        </div>

                                        <div class="flex items-center gap-2">
                                                <button
                                                        class="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        type="button"
                                                        onclick={onClose}
                                                >
                                                        Close
                                                </button>
                                                <button
                                                        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        type="button"
                                                        onclick={copyAll}
                                                >
                                                        {#if copyStatus === 'copied'}
                                                                Copied!
                                                        {:else if copyStatus === 'error'}
                                                                Copy failed
                                                        {:else}
                                                                Copy All
                                                        {/if}
                                                </button>
                                        </div>
                                </div>
                        </div>
			</div>
		</div>
	</div>
</div>
