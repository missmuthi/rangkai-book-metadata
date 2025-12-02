<script lang="ts">
		import { onMount } from 'svelte';
        import type { MergedBookData } from '$lib/types';
		import { parseJsonSafe } from '$lib/utils/json';
		import { scanHistory } from '$lib/stores/history.svelte';
		import { normalizeISBN } from '$lib/isbn-helpers';

        interface BookWithScanId extends MergedBookData {
                scan_id?: number;
        }

        let { book, onClose }: { book: BookWithScanId; onClose: () => void } = $props();

		// Client-side log helper - no-op in production
		function clientLog(level: 'log' | 'warn' | 'error' | 'info' | 'debug', ...args: unknown[]) {
			if (import.meta.env.DEV) {
				const c = console as unknown as Record<string, (...args: unknown[]) => void>;
				c[level]?.(...args);
			}
		}

        const FALLBACK_COVER =
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJub25lIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTBlMGUwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjN2M3YzdjIj5ObyBDb3ZlcjwvdGV4dD48L3N2Zz4=';

        let isCleaning = $state(false);
        let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
        let toast = $state<string | null>(null);
        let copiedField = $state<string | null>(null);
        let _mounted = $state(false);

        // Rate Limit Handling
        let isRateLimited = $state(false);
        let rateLimitCountdown = $state(0);
        let rateLimitTimer: ReturnType<typeof setInterval> | undefined;

        onMount(() => {
                // Component mounted - client-side rendering confirmed
                _mounted = true;
                return () => {
                        // Component unmounting
                        if (rateLimitTimer) clearInterval(rateLimitTimer);
                };
        });

        let coverUrl = $derived(getSecureProxyUrl(book.cover));

        // ISBD Publisher Format
        let publisherISBD = $derived.by(() => {
                const place = book.publishPlace || 'S.l.';
                const publisher = book.publisher || 's.n.';
                const year = book.publishYear || book.date || '[n.d.]';
                return `${place} : ${publisher}, ${year}`;
        });

        // Format subjects with standard heading separator
        let formattedSubjects = $derived.by(() => {
                if (!book.subjects || book.subjects === '-') return '-';
                return book.subjects.split(',').map(s => s.trim()).join(' -- ');
        });

        // Statement of Responsibility
        let responsibility = $derived.by(() => {
                if (book.authors && book.authors !== '-') {
                        return book.authors.split(',').map(a => a.trim()).join(' ; ');
                }
                if (!book.author || book.author === '-') return '-';
                return book.author.split(',').map(a => a.trim()).join(' ; ');
        });

        // Classification Trust Badge
        function getTrustBadge(trust: string | undefined) {
                if (!trust) return null;

                switch (trust) {
                        case 'high':
                                return {
                                        icon: '🏛️',
                                        label: 'Official LoC',
                                        color: 'bg-blue-100 text-blue-800',
                                        tooltip: 'Data directly from Library of Congress'
                                };
                        case 'medium':
                                return {
                                        icon: '📚',
                                        label: 'Community Data',
                                        color: 'bg-yellow-100 text-yellow-800',
                                        tooltip: 'Data sourced from OpenLibrary contributors'
                                };
                        case 'low':
                                return {
                                        icon: '⚠️',
                                        label: 'Estimated',
                                        color: 'bg-gray-100 text-gray-800',
                                        tooltip: 'Inferred from keywords/subjects'
                                };
                        default:
                                return null;
                }
        }

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
							clientLog('warn', `[SSRF Protection] Blocked untrusted domain: ${urlObj.hostname}`);
                                return FALLBACK_COVER;
                        }

                        const encodedUrl = encodeURIComponent(url);
                        return `https://wsrv.nl/?url=${encodedUrl}&w=450&q=80&output=webp`;
				} catch (_error) {
					clientLog('warn', '[Secure Proxy] Invalid URL format:', url);
                        return FALLBACK_COVER;
                }
        }

        async function copyField(fieldName: string, value: string) {
                if (!value || value === '-') return;
                try {
                        await navigator.clipboard.writeText(value);
                        copiedField = fieldName;
                        setTimeout(() => (copiedField = null), 1500);
                } catch (error) {
					clientLog('error', 'Failed to copy field', error);
                }
        }

	async function aiClean() {
				if (isCleaning || isRateLimited) return;
				
				isCleaning = true;
				saveStatus = 'saving';
				
				// 🔍 DIAGNOSTIC LOGGING - Visible in browser console (F12)
				clientLog('info', '🤖 [AI Clean] Request Started');
				clientLog('info', '📚 Book Title:', book.title);
				clientLog('info', '📖 ISBN:', book.isbn13 || book.isbn10 || book.isbn || 'N/A');
				clientLog('info', '🆔 Scan ID:', book.scan_id || 'New scan');
				clientLog('info', '⏱️ Timestamp:', new Date().toISOString());
				
				try {
						// Pass scan_id if available for database update (prevents duplicates)
						const payload = {
								...book,
								scan_id: book.scan_id || undefined
						};
						
						clientLog('info', '📤 [AI Clean] Sending request to /api/ai/clean...');
						const startTime = performance.now();
						
						const res = await fetch('/api/ai/clean', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(payload)
						});
						
						const duration = Math.round(performance.now() - startTime);
								clientLog('info', `⏱️ [AI Clean] Response received in ${duration}ms, status: ${res.status}`);
						
						if (!res.ok) {
							let errorMessage = 'AI clean failed';
							let errorCode = 'UNKNOWN';
							    try {
								    const errorData = await parseJsonSafe(res) as { code?: string; error?: string; message?: string };
								    errorCode = errorData.code || errorData.error || 'UNKNOWN';
								    errorMessage = errorData.message || errorData.error || errorMessage;
									
									// 🔍 DIAGNOSTIC: Show full error details in console
									clientLog('error', '❌ [AI Clean] Request Failed');
									clientLog('error', 'Status:', res.status);
									clientLog('error', 'Error Code:', errorCode);
									clientLog('error', 'Error Message:', errorMessage);
									clientLog('error', 'Full Response:', errorData);

                                    if (errorCode === 'AI_QUOTA_EXCEEDED') {
                                        isRateLimited = true;
                                        rateLimitCountdown = 30;
                                        rateLimitTimer = setInterval(() => {
                                            rateLimitCountdown--;
                                            if (rateLimitCountdown <= 0) {
                                                if (rateLimitTimer) clearInterval(rateLimitTimer);
                                                isRateLimited = false;
                                            }
                                        }, 1000);
                                        toast = errorMessage;
                                        throw new Error(errorMessage);
                                    }

									clientLog('warn', '💡 TIP: Check Cloudflare Pages → Settings → Environment Variables → GROQ_API_KEY');
							} catch (innerError) {
                                    // If we already identified a rate limit error, rethrow immediately
                                    // to avoid trying to read res.text() (which would fail since body is consumed)
                                    if (errorCode === 'AI_QUOTA_EXCEEDED') throw innerError;

									// If JSON parse fails, try text
                                    try {
									    const errorText = await res.text();
									    clientLog('error', '❌ [AI Clean] Non-JSON error response:', errorText);
									    errorMessage = errorText || errorMessage;
                                    } catch (textError) {
                                        // Ignore text read error if we already have an error message
                                        clientLog('warn', '❌ [AI Clean] Failed to read response text:', textError);
                                    }
							}
							saveStatus = 'error';
							toast = errorMessage;
							throw new Error(errorMessage);
					}
						
						const cleaned = await parseJsonSafe(res) as any;
						
						// 🔍 DIAGNOSTIC: Log successful response
						clientLog('info', '✅ [AI Clean] Success');
						clientLog('info', '📋 Cleaned Title:', cleaned.title);
						clientLog('info', '📊 DDC:', cleaned.ddc);
						clientLog('info', '🏛️ LCC:', cleaned.lcc);
						clientLog('info', '💾 Saved:', cleaned.saved);
						clientLog('info', '🆔 Scan ID:', cleaned.scan_id);
						
						// CRITICAL: Store the returned scan_id so future operations update the same row
						// This prevents duplicate scans when user cleans the same book multiple times
						if (cleaned.scan_id && typeof cleaned.scan_id === 'number') {
							book.scan_id = cleaned.scan_id;
						}

						// Update local state by merging cleaned data onto existing book
						book = { ...book, ...cleaned, scan_id: book.scan_id };
						
						// Check if save was successful
						if (cleaned.saved === true || cleaned.scan_id) {
								saveStatus = 'saved';
								toast = 'Metadata cleaned & saved ✓';

							// Update client-side history store to reflect cleaned metadata
							try {
								const key = normalizeISBN(cleaned.isbn13 || cleaned.isbn10 || cleaned.isbn || book.isbn13 || book.isbn10 || book.isbn || '');
								const all = scanHistory.getAll();
								const existing = all.find((i) => normalizeISBN(i.isbn13 || i.isbn10 || i.isbn || '') === key);
								const updatedEntry = { ...(existing || {}), ...cleaned, scan_id: cleaned.scan_id } as any;
								if (existing) {
									// Remove old and re-add updated (keeps top order)
									scanHistory.remove(existing.isbn13 || existing.isbn10 || existing.isbn || '');
									scanHistory.add(updatedEntry);
								} else {
									scanHistory.add(updatedEntry);
								}
							} catch (e) {
								clientLog('warn', 'Failed to update client history after AI clean', e);
							}
						} else if (cleaned.saveError) {
								saveStatus = 'error';
								toast = `Cleaned but save failed: ${cleaned.saveError}`;
						} else {
								saveStatus = 'saved';
								toast = 'Metadata cleaned & saved ✓';
						}
						
						// Auto-reset status after 3 seconds
						setTimeout(() => {
								saveStatus = 'idle';
								toast = null;
						}, 3000);
				} catch (e) {
						saveStatus = 'error';
						const errorMsg = e instanceof Error ? e.message : 'Cleaning failed. Try again.';
						toast = errorMsg;
						clientLog('error', '❌ [AI Clean] Exception:', e);

                        // Don't clear toast immediately if it's rate limit
                        if (!isRateLimited) {
                            setTimeout(() => {
                                    saveStatus = 'idle';
                                    toast = null;
                            }, 3000);
                        }
				} finally {
						isCleaning = false;
				}
	}        // AI History (Latest Log)
        let latestAiLog = $derived.by(() => {
                if (!book.ai_log || book.ai_log.length === 0) return null;
                return book.ai_log[book.ai_log.length - 1];
        });

        function onBackdropClick(event: MouseEvent) {
                if ((event.target as HTMLElement).id === 'book-detail-backdrop') {
                        onClose();
                }
        }
</script>

{#snippet row(label: string, value: string | undefined, copyable = false, trust?: string)}
        <div class="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-x-4 gap-y-1 px-4 py-2.5 even:bg-gray-50">
                <dt class="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {label}
                </dt>
                <dd class="text-sm text-gray-900 break-words flex items-start justify-between group">
                        <span class={label === 'Title' ? 'font-bold' : ''}>
                                {value || '-'}
                                {#if trust && value && value !== '-'}
                                        {@const badge = getTrustBadge(trust)}
                                        {#if badge}
                                                <span
                                                        class="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 {badge.color}"
                                                        title={badge.tooltip}
                                                >
                                                        {badge.icon} {badge.label}
                                                </span>
                                        {/if}
                                {/if}
                        </span>
                        {#if copyable && value && value !== '-'}
                                <button
                                        type="button"
                                        onclick={() => copyField(label, value)}
                                        class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                                        aria-label={`Copy ${label}`}
                                >
                                        {#if copiedField === label}
                                                <svg class="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                        {:else}
                                                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        {/if}
                                </button>
                        {/if}
                </dd>
        </div>
{/snippet}

<div
	id="book-detail-backdrop"
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
	role="dialog"
	aria-modal="true"
	aria-label="Bibliographic Record for {book.title}"
	onclick={onBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	tabindex="-1"
>
	<div
		class="relative flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
		role="document"
	>
		<!-- Header -->
		<header class="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
			<div class="flex items-center gap-3">
				<h2 class="text-lg font-bold text-white">Bibliographic Record</h2>
				{#if book.is_ai_enhanced}
					<span 
						class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-violet-100 px-3 py-1 text-xs font-semibold text-violet-900 ring-1 ring-violet-300 cursor-help"
						title="Metadata cleaned and translated by AI • Enhanced on {new Date(book.enhanced_at || 0).toLocaleDateString('id-ID')}"
					>
						✨ AI Enhanced
					</span>
				{/if}
			</div>
			<button
				class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
				type="button"
				onclick={onClose}
				aria-label="Close bibliographic record"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
			</button>
		</header>

		<!-- Main Content -->
		<div class="flex-1 overflow-y-auto">
			<div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 p-6">
				<!-- Left: Bibliographic Data -->
				<div>
					<dl class="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
						{@render row('Title', book.title, true)}
						{@render row('Series Title', book.series)}
						{@render row('Call Number', book.callNumber, true)}
						{@render row('Publisher', publisherISBD)}
						{@render row('Collation', book.collation || book.physicalDescription || book.pages ? `${book.pages} p.` : undefined)}
						{@render row('Language', book.language)}
						{@render row('ISBN/ISSN', book.isbn13 || book.isbn10, true)}
						{@render row('Classification', book.ddc || book.lcc, false, book.classificationTrust)}
						{@render row('Content Type', 'text')}
						{@render row('Media Type', 'unmediated')}
						{@render row('Carrier Type', 'volume')}
						{@render row('Edition', book.edition)}
						{@render row('Subject(s)', formattedSubjects)}
						{@render row('Specific Detail Info', book.specificDetail)}
						{@render row('Statement of Responsibility', responsibility)}
					</dl>

					<!-- Description Section -->
					{#if book.description && book.description !== '-'}
						<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
							<h3 class="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Description</h3>
							<p class="text-sm leading-relaxed text-gray-800">{book.description}</p>
						</div>
					{/if}

					<!-- Trust Badges -->
					{#if book.dataSource || book.isPartialData}
						<div class="mt-4 flex flex-wrap items-center gap-2">
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
					{/if}
				</div>

				<!-- Right: Cover & Actions -->
				<div class="space-y-4">
					<!-- Cover Image -->
					<div class="overflow-hidden rounded-lg bg-gray-100 shadow-md">
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

					<!-- Classification Quick View -->
					<div class="rounded-lg bg-blue-50 p-4">
						<p class="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Classification</p>
						<div class="space-y-2">
							<div class="flex items-center justify-between rounded bg-white px-3 py-2 shadow-sm ring-1 ring-blue-100">
								<span class="text-xs font-bold text-blue-500">DDC</span>
								<span class="text-sm font-semibold text-blue-900">{book.ddc || '-'}</span>
							</div>
							<div class="flex items-center justify-between rounded bg-white px-3 py-2 shadow-sm ring-1 ring-blue-100">
								<span class="text-xs font-bold text-blue-500">LCC</span>
								<span class="text-sm font-semibold text-blue-900">{book.lcc || '-'}</span>
							</div>
						</div>
					</div>

					<!-- AI History Section -->
					{#if latestAiLog}
						{@const log = latestAiLog}
						<div class="rounded-lg bg-violet-50 p-4 ring-1 ring-violet-200">
							<div class="flex items-center justify-between mb-2">
								<h3 class="text-xs font-semibold uppercase tracking-wide text-violet-700">🤖 AI History</h3>
								<span class="text-[10px] text-violet-500">
									{new Date(log.timestamp).toLocaleTimeString()}
								</span>
							</div>
							{#if log.changes && log.changes.length > 0}
								<ul class="space-y-1">
									{#each log.changes as change}
										<li class="text-xs text-violet-900 flex items-start gap-1.5">
											<span class="text-violet-400 mt-0.5">•</span>
											{change}
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-xs text-violet-800 flex items-center gap-1.5">
									<svg class="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
									Metadata was already perfect.
								</p>
							{/if}
						</div>
					{/if}

					<!-- Actions -->
					<div class="space-y-2">
						<button
							class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
							type="button"
							onclick={aiClean}
							disabled={isCleaning || saveStatus === 'saving' || isRateLimited}
						>
							{#if isCleaning || saveStatus === 'saving'}
								<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/></svg>
								{#if saveStatus === 'saving'}
									Saving...
								{:else}
									Cleaning...
								{/if}
                            {:else if isRateLimited}
                                Wait {rateLimitCountdown}s...
							{:else if saveStatus === 'saved'}
								<svg class="h-4 w-4 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Saved ✓
							{:else if saveStatus === 'error'}
								<svg class="h-4 w-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
								Save Failed
							{:else}
								✨ AI Clean
							{/if}
						</button>
						<button
							class="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
							type="button"
							onclick={onClose}
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Toast Notification -->
	{#if toast}
		<div class="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
			{toast}
		</div>
	{/if}
</div>
