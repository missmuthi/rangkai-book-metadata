<script lang="ts">
        import type { PageData } from './$types';
        import { Card, Button, EmptyState, Alert, Input } from '$lib/components/ui';
        import BookDetailModal from '$lib/components/BookDetailModal.svelte';
        import type { MergedBookData } from '$lib/types';

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

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 py-12">
		<!-- Header -->
		<div class="flex items-center justify-between mb-8">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 mb-2">Scan History</h1>
				<p class="text-gray-600">
					{data.totalScans} total scan{data.totalScans !== 1 ? 's' : ''}
				</p>
			</div>

			{#if data.scans.length > 0}
				<Button
					variant="primary"
					onclick={exportToCSV}
				>
					<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					Export All to CSV ({filteredScans.length})
				</Button>
			{/if}
		</div>

		<!-- Search Bar -->
		{#if data.scans.length > 0}
			<div class="mb-6">
				<Input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by title or ISBN..."
					class="w-full"
				/>
			</div>
		{/if}

		<!-- Error State -->
		{#if data.error}
			<Alert variant="error" title="Error loading scan history">
				{data.error}
			</Alert>
		
		<!-- Empty State -->
		{:else if data.scans.length === 0}
			<Card padding="lg">
				<EmptyState
					icon="book"
					title="No scan history yet"
					description="Start scanning books to build your library catalog"
					actionLabel="Start Scanning"
					onAction={() => window.location.href = '/'}
				/>
			</Card>
		
		<!-- No Search Results -->
		{:else if filteredScans.length === 0}
			<Card padding="lg">
				<EmptyState
					icon="search"
					title={`No scans match "${searchQuery}"`}
					description="Try a different search term"
				/>
			</Card>
		
		<!-- Scans List -->
		{:else}
			<Card padding="sm">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Title
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									ISBN
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Status
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
									Date
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
                                                        {#each filteredScans as scan}
                                                                <tr
                                                                        class="hover:bg-gray-50 transition-colors cursor-pointer"
                                                                        role="button"
                                                                        tabindex="0"
                                                                        on:click={() => openScanDetails(scan)}
                                                                        on:keydown={(event) => handleRowKeydown(event, scan)}
                                                                >
                                                                        <td class="px-6 py-4">
                                                                                <div class="text-sm font-medium text-gray-900">
                                                                                        {scan.title || 'Untitled'}
										</div>
									</td>
									<td class="px-6 py-4">
										<div class="text-sm font-mono text-gray-600">
											{scan.isbn || 'No ISBN'}
										</div>
									</td>
									<td class="px-6 py-4">
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
											{scan.status || 'completed'}
										</span>
									</td>
									<td class="px-6 py-4 text-sm text-gray-600">
										{new Date(scan.created_at).toLocaleDateString('en-US', { 
											year: 'numeric', 
											month: 'short', 
											day: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</td>
								</tr>
							{/each}
						</tbody>
                                        </table>
                                </div>
                        </Card>
                {/if}
        </div>

        {#if selectedBook}
                <BookDetailModal book={selectedBook} onClose={() => (selectedBook = null)} />
        {/if}
</div>
