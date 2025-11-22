<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { Card, Button, EmptyState, Alert } from '$lib/components/ui';

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
			<Card>
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
			</Card>

			<Card>
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
			</Card>

			<Card>
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
			</Card>
		</div>

		<!-- Quick Actions -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
			<Card interactive onclick={() => goto('/')}>
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">Search Books</h3>
						<p class="text-sm text-gray-600">Find book metadata by ISBN or title</p>
					</div>
				</div>
			</Card>

			<Card interactive onclick={() => goto('/history')}>
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900">View History</h3>
						<p class="text-sm text-gray-600">Browse and export your scanned books</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- Recent Scans Preview -->
		<Card>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-bold text-gray-900">Recent Scans</h2>
				{#if data.scans.length > 0}
					<Button 
						variant="ghost" 
						size="sm"
						onclick={() => goto('/history')}
					>
						View All →
					</Button>
				{/if}
			</div>

			{#if data.error}
				<Alert variant="error">
					{data.error}
				</Alert>
			{:else if data.scans.length === 0}
				<EmptyState
					icon="book"
					title="No scans yet"
					description="Start scanning books to build your library catalog"
					actionLabel="Start Scanning"
					onAction={() => goto('/')}
				/>
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
		</Card>
	</div>
</div>
