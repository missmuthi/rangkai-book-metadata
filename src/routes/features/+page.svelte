<script lang="ts">
	// Features page - focused on librarian workflow
</script>

<svelte:head>
	<title>Features - Rangkai Book Metadata Harvester</title>
	<meta name="description" content="Professional metadata harvesting tool for library cataloging workflows." />
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<!-- Hero Section -->
	<section class="max-w-5xl mx-auto px-4 py-12">
		<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12">
			<h1 class="text-4xl font-bold text-gray-900 mb-4">Rangkai Book Metadata Harvester</h1>
			<p class="text-xl text-gray-600 mb-6">
				A focused tool for librarians to scan ISBNs, fetch authoritative metadata from multiple sources, 
				and prepare catalog-ready records for SLiMS and other library systems.
			</p>
			<div class="flex items-center gap-4 text-sm text-gray-500">
				<span class="flex items-center gap-2">
					<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					App-only, no marketing fluff
				</span>
				<span class="flex items-center gap-2">
					<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Fast Cloudflare-native deployment
				</span>
			</div>
		</div>
	</section>

	<!-- Core Capabilities -->
	<section class="max-w-5xl mx-auto px-4 py-8">
		<h2 class="text-2xl font-bold text-gray-900 mb-6">Core Capabilities</h2>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			
			<!-- ISBN Scan & Fetch -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">ISBN Scan & Fetch</h3>
						<p class="text-gray-600 text-sm mb-3">
							Scan or input ISBN-10/13. Automatically fetches from Google Books, OpenLibrary, and Library of Congress.
						</p>
						<div class="flex flex-wrap gap-2">
							<span class="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">Multi-source</span>
							<span class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">Barcode scanner ready</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Merged Metadata -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Normalized & Merged Metadata</h3>
						<p class="text-gray-600 text-sm mb-3">
							Combines data from all sources into a clean, SLiMS-compatible record with DDC/LCC classification.
						</p>
						<div class="flex flex-wrap gap-2">
							<span class="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded">Auto call numbers</span>
							<span class="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded">Cataloger-first fields</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Scan History -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Personal Scan History</h3>
						<p class="text-gray-600 text-sm mb-3">
							Track all scanned books per user. Review, edit, or export batches as CSV or MARCXML for catalog import.
						</p>
						<div class="flex flex-wrap gap-2">
							<span class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">User-specific</span>
							<span class="text-xs px-2 py-1 bg-teal-50 text-teal-700 rounded">Batch export</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Dashboard Analytics -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
				<div class="flex items-start gap-4">
					<div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
						<svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Dashboard & Analytics</h3>
						<p class="text-gray-600 text-sm mb-3">
							Basic stats on scans per user, most-scanned books, and workflow metrics for librarian teams.
						</p>
						<div class="flex flex-wrap gap-2">
							<span class="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded">Usage insights</span>
							<span class="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded">Team metrics</span>
						</div>
					</div>
				</div>
			</div>

		</div>
	</section>

	<!-- Librarian Workflow -->
	<section class="max-w-5xl mx-auto px-4 py-8">
		<div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 text-white">
			<h2 class="text-2xl font-bold mb-6">Built for Librarian Workflows</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div>
					<h3 class="font-semibold mb-2 flex items-center gap-2">
						<span>1.</span> Scan or Type ISBN
					</h3>
					<p class="text-blue-100 text-sm">Use a USB barcode scanner or manually enter ISBN-10/13.</p>
				</div>
				<div>
					<h3 class="font-semibold mb-2 flex items-center gap-2">
						<span>2.</span> Review Merged Data
					</h3>
					<p class="text-blue-100 text-sm">See title, author, DDC/LCC, publisher, and catalog-ready fields instantly.</p>
				</div>
				<div>
					<h3 class="font-semibold mb-2 flex items-center gap-2">
						<span>3.</span> Export to SLiMS
					</h3>
					<p class="text-blue-100 text-sm">Download CSV or MARCXML for direct import into your library system.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Technical Highlights -->
	<section class="max-w-5xl mx-auto px-4 py-8">
		<h2 class="text-2xl font-bold text-gray-900 mb-6">Technical Highlights</h2>
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<div>
						<p class="font-medium text-gray-900">Cloudflare-native Architecture</p>
						<p class="text-gray-600">Deployed on Cloudflare Pages with D1 (SQLite) and KV cache for fast global access.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<div>
						<p class="font-medium text-gray-900">Multi-source Metadata Aggregation</p>
						<p class="text-gray-600">Fetches from Google Books, OpenLibrary, and Library of Congress for authoritative LCC.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<div>
						<p class="font-medium text-gray-900">Google OAuth Authentication</p>
						<p class="text-gray-600">Secure user sessions with Google login. Personal history and dashboard per user.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<div>
						<p class="font-medium text-gray-900">SvelteKit 2 + Svelte 5</p>
						<p class="text-gray-600">Modern reactive UI with excellent performance and developer experience.</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="max-w-5xl mx-auto px-4 py-12 text-center">
		<div class="bg-gray-100 rounded-xl p-8">
			<h2 class="text-3xl font-bold text-gray-900 mb-4">Ready to streamline your cataloging workflow?</h2>
			<p class="text-gray-600 mb-6 max-w-2xl mx-auto">
				Sign in with your Google account and start scanning ISBNs. No complex setup required.
			</p>
			<a 
				href="/login" 
				class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
				</svg>
				Sign In and Start
			</a>
		</div>
	</section>
</div>
