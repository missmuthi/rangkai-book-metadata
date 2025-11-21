<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 py-12">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
			<p class="text-gray-600">Welcome back, {data.user?.name || 'User'}!</p>
		</div>

		<!-- Quick Stats -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			<div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-gray-600">Total Scans</p>
						<p class="text-2xl font-bold text-gray-900">{data.totalScans}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-gray-600">Recent Activity</p>
						<p class="text-2xl font-bold text-gray-900">{data.scans.length > 0 ? 'Active' : 'None'}</p>
					</div>
				</div>
			</div>

			<div class="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<div>
						<p class="text-sm text-gray-600">Account Status</p>
						<p class="text-lg font-semibold text-green-600">Active</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
			<button
				onclick={() => goto('/')}
				class="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left"
			>
				<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
					<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900">Search Books</h3>
					<p class="text-sm text-gray-600">Find book metadata by ISBN or title</p>
				</div>
			</button>

			<button
				onclick={() => goto('/history')}
				class="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-green-500 hover:shadow-md transition-all text-left"
			>
				<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
					<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-semibold text-gray-900">View History</h3>
					<p class="text-sm text-gray-600">Browse and export your scanned books</p>
				</div>
			</button>
		</div>

		<!-- Recent Scans Preview -->
		<div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold text-gray-900">Recent Scans</h2>
				{#if data.scans.length > 0}
					<button
						onclick={() => goto('/history')}
						class="text-sm text-blue-600 hover:text-blue-700 font-medium"
					>
						View All →
					</button>
				{/if}
			</div>

			{#if data.error}
				<div class="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
					{data.error}
				</div>
			{:else if data.scans.length === 0}
				<div class="text-center py-12">
					<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
					</svg>
					<p class="text-gray-600 mb-4">No scans yet</p>
					<button
						onclick={() => goto('/')}
						class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
						Start Scanning
					</button>
				</div>
			{:else}
				<div class="space-y-3">
					{#each data.scans.slice(0, 5) as scan}
						<div class="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
							<div class="flex-1">
								<h3 class="font-semibold text-gray-900">{scan.title || 'Untitled'}</h3>
								<p class="text-sm text-gray-600 font-mono mt-1">{scan.isbn || 'No ISBN'}</p>
								<p class="text-xs text-gray-500 mt-1">
									{new Date(scan.created_at).toLocaleDateString('en-US', { 
										year: 'numeric', 
										month: 'short', 
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit'
									})}
								</p>
							</div>
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
								{scan.status || 'completed'}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
