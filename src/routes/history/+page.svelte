<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
			console.error('Export failed:', err);
			alert('Failed to export CSV. Please try again.');
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
				<button
					onclick={exportToCSV}
					class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					Export All to CSV ({filteredScans.length})
				</button>
			{/if}
		</div>

		<!-- Search Bar -->
		{#if data.scans.length > 0}
			<div class="mb-6">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by title or ISBN..."
					class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm"
				/>
			</div>
		{/if}

		<!-- Error State -->
		{#if data.error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
				<svg class="w-12 h-12 mx-auto text-red-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p class="text-red-700 font-medium">{data.error}</p>
			</div>
		
		<!-- Empty State -->
		{:else if data.scans.length === 0}
			<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
				<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
				<p class="text-gray-600 mb-4">No scan history yet</p>
				<p class="text-sm text-gray-500 mb-6">Start scanning books to build your library catalog</p>
				<a
					href="/"
					class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					Start Scanning
				</a>
			</div>
		
		<!-- Scans List -->
		{:else if filteredScans.length === 0}
			<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
				<p class="text-gray-600">No scans match "{searchQuery}"</p>
			</div>
		{:else}
			<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
								<tr class="hover:bg-gray-50 transition-colors">
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
			</div>
		{/if}
	</div>
</div>
