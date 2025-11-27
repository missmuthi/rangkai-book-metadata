<script lang="ts">
        import type { PageData } from './$types';
        import { Card, Button, EmptyState, Alert, Input } from '$lib/components/ui';
        import BookDetailModal from '$lib/components/BookDetailModal.svelte';
        import type { MergedBookData } from '$lib/types';
        import { fade, slide } from 'svelte/transition';

        let { data }: { data: PageData } = $props();
        let selectedBook = $state<MergedBookData | null>(null);

	// Filter state
	let searchQuery = $state('');
	let filteredScans = $derived(
		data.scans.filter((scan: any) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				scan.title?.toLowerCase().includes(query) ||
				scan.isbn?.toLowerCase().includes(query)
			);
		})
	);

	// Export to CSV
        async function exportToCSV() {
                try {
                        const { exportBatchToSLiMSCSV } = await import('$lib/export');
			
			// Parse json_data for each scan
			const books = filteredScans
				.map((scan: any) => {
					try {
						return JSON.parse(scan.json_data);
					} catch {
						return null;
					}
				})
				.filter((book: any) => book !== null);

			if (books.length === 0) {
				alert('No valid scans to export');
				return;
			}

			exportBatchToSLiMSCSV(books);
		} catch (err) {
			// Log error without exposing to user (they see alert)
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        console.error('[History] Export failed:', errorMessage);
                        alert('Failed to export CSV. Please try again.');
                }
        }

        function openScanDetails(scan: any) {
                try {
                        selectedBook = JSON.parse(scan.json_data) as MergedBookData;
                } catch (err) {
                        console.error('[History] Failed to parse scan json_data', err);
                        selectedBook = null;
                }
        }

        function handleRowKeydown(event: KeyboardEvent, scan: any) {
                if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openScanDetails(scan);
                }
        }
</script>

<svelte:head>
	<title>Scan History | Rangkai</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 pb-20">
	<div class="max-w-7xl mx-auto px-4 py-8 sm:py-12">
		<!-- Header -->
		<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Scan History</h1>
				<p class="text-gray-600 mt-1">
					Manage your collection of {data.totalScans} scanned book{data.totalScans !== 1 ? 's' : ''}
				</p>
			</div>

			{#if data.scans.length > 0}
				<div class="flex gap-2">
					<Button
						variant="primary"
						class="w-full sm:w-auto justify-center"
						onclick={exportToCSV}
					>
						<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Export CSV
					</Button>
				</div>
			{/if}
		</div>

		<!-- Search Bar -->
		{#if data.scans.length > 0}
			<div class="mb-6 sticky top-20 z-20 bg-gray-50 pt-2 pb-2">
				<div class="relative">
					<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
						<svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
					<Input
						type="search"
						bind:value={searchQuery}
						placeholder="Search by title, author, or ISBN..."
						class="w-full pl-10"
					/>
				</div>
			</div>
		{/if}

		<!-- Error State -->
		{#if data.error}
			<Alert variant="error" title="Error loading scan history">
				{data.error}
			</Alert>
		
		<!-- Empty State -->
		{:else if data.scans.length === 0}
			<div transition:fade>
				<Card padding="lg">
					<EmptyState
						icon="book"
						title="No scan history yet"
						description="Start scanning books to build your library catalog"
						actionLabel="Start Scanning"
						onAction={() => window.location.href = '/scan/mobile'}
					/>
				</Card>
			</div>
		
		<!-- No Search Results -->
		{:else if filteredScans.length === 0}
			<div transition:fade>
				<Card padding="lg">
					<EmptyState
						icon="search"
						title={`No scans match "${searchQuery}"`}
						description="Try a different search term"
					/>
				</Card>
			</div>
		
		<!-- Scans List -->
		{:else}
			<!-- Desktop Table View -->
			<div class="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
								<th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ISBN</th>
								<th class="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
								<th class="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each filteredScans as scan (scan.id)}
								<tr
									class="hover:bg-blue-50/50 transition-colors cursor-pointer group"
									onclick={() => openScanDetails(scan)}
								>
									<td class="px-6 py-4">
										<div class="flex items-center">
											<div class="flex-shrink-0 h-10 w-8 bg-gray-100 rounded overflow-hidden">
												{#if JSON.parse(scan.json_data).cover && JSON.parse(scan.json_data).cover !== '-'}
													<img src={JSON.parse(scan.json_data).cover} alt="" class="h-full w-full object-cover" />
												{:else}
													<div class="flex items-center justify-center h-full text-gray-300">
														<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l-5.5 9h11z"/></svg>
													</div>
												{/if}
											</div>
											<div class="ml-4">
												<div class="text-sm font-medium text-gray-900 line-clamp-1">{scan.title || 'Untitled'}</div>
												<div class="text-xs text-gray-500 line-clamp-1">{JSON.parse(scan.json_data).author || 'Unknown Author'}</div>
											</div>
										</div>
									</td>
									<td class="px-6 py-4">
										<span class="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{scan.isbn || 'No ISBN'}</span>
									</td>
									<td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
										{new Date(scan.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
									</td>
									<td class="px-6 py-4 text-right">
										<svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
										</svg>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Mobile Card View -->
			<div class="md:hidden space-y-4">
				{#each filteredScans as scan (scan.id)}
					<div
						class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 active:scale-[0.99] transition-transform"
						role="button"
						tabindex="0"
						onclick={() => openScanDetails(scan)}
						onkeydown={(e) => handleRowKeydown(e, scan)}
					>
						<div class="flex gap-4">
							<!-- Cover Thumbnail -->
							<div class="w-16 h-24 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden shadow-sm">
								{#if JSON.parse(scan.json_data).cover && JSON.parse(scan.json_data).cover !== '-'}
									<img
										src={JSON.parse(scan.json_data).cover}
										alt={scan.title}
										class="w-full h-full object-cover"
										loading="lazy"
									/>
								{:else}
									<div class="flex items-center justify-center h-full text-gray-300">
										<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
										</svg>
									</div>
								{/if}
							</div>

							<!-- Details -->
							<div class="flex-1 min-w-0">
								<div class="flex justify-between items-start mb-1">
									<p class="text-xs font-bold text-blue-600 uppercase tracking-wide">
										{scan.isbn}
									</p>
									<span class="text-xs text-gray-400">
										{new Date(scan.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
									</span>
								</div>

								<h3 class="font-semibold text-gray-900 leading-tight mb-1 line-clamp-2">
									{scan.title}
								</h3>

								<p class="text-sm text-gray-600 line-clamp-1">
									{JSON.parse(scan.json_data).author || 'Unknown Author'}
								</p>

								<div class="mt-2 flex items-center text-xs text-gray-500">
									<span class="truncate max-w-[150px]">{JSON.parse(scan.json_data).publisher || 'Unknown Publisher'}</span>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if selectedBook}
		<BookDetailModal book={selectedBook} onClose={() => (selectedBook = null)} />
	{/if}
</div>
