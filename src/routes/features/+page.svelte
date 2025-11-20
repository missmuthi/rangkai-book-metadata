<script lang="ts">
	// Features showcase page
</script>

<svelte:head>
	<title>Features - Rangkai Book Metadata Harvester</title>
	<meta name="description" content="Discover the powerful features of Rangkai: Triple-source search, scanner mode, privacy-first design, and more." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white">
	<!-- Hero Section -->
	<section class="max-w-7xl mx-auto px-4 py-16 text-center">
		<h1 class="text-5xl font-bold text-gray-900 mb-4">Why use Rangkai?</h1>
		<p class="text-xl text-gray-600 max-w-2xl mx-auto">
			A modern, intelligent metadata harvesting tool designed for Indonesian libraries and catalogers. 
			Automate the tedious process of metadata entry while maintaining data quality and completeness.
		</p>
	</section>

	<!-- Features Grid -->
	<section class="max-w-7xl mx-auto px-4 pb-16">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
			
			<!-- Feature 1: Triple-Source Search -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">🏛️</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Triple-Source Search</h3>
				<p class="text-gray-600 leading-relaxed">
					Simultaneously fetch metadata from <strong>Google Books</strong>, <strong>OpenLibrary</strong>, and <strong>Library of Congress</strong>. 
					Get the most complete and authoritative data available.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Authoritative LCC</span>
					<span class="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full ml-2">DDC Mapping</span>
				</div>
			</div>

			<!-- Feature 2: Unjammable Scanner Mode -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">⚡</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Unjammable Scanner Mode</h3>
				<p class="text-gray-600 leading-relaxed">
					Optimized for USB barcode scanners. Scan <strong>50+ books in minutes</strong> without touching the mouse. 
					Automatic input clearing and focus management ensure you never jam the workflow.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">Auto-Submit</span>
					<span class="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full ml-2">Batch Processing</span>
				</div>
			</div>

			<!-- Feature 3: Privacy First -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">🛡️</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Privacy First</h3>
				<p class="text-gray-600 leading-relaxed">
					<strong>No tracking. No cookies. HTTPS enforced.</strong> Your searches remain private. 
					Safe for school networks and institutional deployments with strict privacy policies.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">No Referrers</span>
					<span class="inline-block px-3 py-1 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full ml-2">HTTPS Only</span>
				</div>
			</div>

			<!-- Feature 4: Batch Export -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">📦</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Batch Export</h3>
				<p class="text-gray-600 leading-relaxed">
					Download your entire scan history as a <strong>SLiMS-compatible CSV</strong> or <strong>MARCXML</strong>. 
					Import directly into your library management system with zero manual entry.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">SLiMS Ready</span>
					<span class="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full ml-2">MARC21 XML</span>
				</div>
			</div>

			<!-- Feature 5: Smart Caching -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">🧠</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Smart Caching</h3>
				<p class="text-gray-600 leading-relaxed">
					Intelligent pre-fetching of <strong>ISBN-10/13 variants</strong> for instant results. 
					LRU cache with 5-minute TTL ensures you never wait twice for the same book.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-cyan-100 text-cyan-800 text-xs font-semibold rounded-full">60-80% Hit Rate</span>
					<span class="inline-block px-3 py-1 bg-sky-100 text-sky-800 text-xs font-semibold rounded-full ml-2">Instant Replay</span>
				</div>
			</div>

			<!-- Feature 6: Trust Badges -->
			<div class="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow border border-gray-100">
				<div class="text-5xl mb-4">✅</div>
				<h3 class="text-2xl font-bold text-gray-900 mb-3">Trust Badges</h3>
				<p class="text-gray-600 leading-relaxed">
					Know exactly where your data comes from with <strong>authoritative source indicators</strong>. 
					🏛️ Official LoC, ✅ Complete, ⚠️ Partial - transparency at every step.
				</p>
				<div class="mt-4 pt-4 border-t border-gray-100">
					<span class="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">Data Provenance</span>
					<span class="inline-block px-3 py-1 bg-violet-100 text-violet-800 text-xs font-semibold rounded-full ml-2">Quality Assured</span>
				</div>
			</div>

		</div>
	</section>

	<!-- Additional Features Section -->
	<section class="max-w-7xl mx-auto px-4 pb-16">
		<div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-12 text-white">
			<h2 class="text-3xl font-bold mb-6 text-center">More Powerful Features</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
				<div class="flex items-start gap-3">
					<span class="text-2xl">🔄</span>
					<div>
						<h4 class="font-bold text-lg mb-1">Graceful Degradation</h4>
						<p class="text-blue-100">Works with 1, 2, or 3 data sources. System adapts to API availability.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-2xl">🏷️</span>
					<div>
						<h4 class="font-bold text-lg mb-1">Auto Call Numbers</h4>
						<p class="text-blue-100">Generates call numbers using DDC/LCC + Cutter-Sanborn system.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-2xl">📊</span>
					<div>
						<h4 class="font-bold text-lg mb-1">Real-time Analytics</h4>
						<p class="text-blue-100">Track cache hit rates, API performance, and search patterns.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-2xl">⚙️</span>
					<div>
						<h4 class="font-bold text-lg mb-1">CORS-Free Proxy</h4>
						<p class="text-blue-100">Server-side proxy eliminates browser CORS restrictions.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-2xl">🎨</span>
					<div>
						<h4 class="font-bold text-lg mb-1">Modern UI</h4>
						<p class="text-blue-100">Clean, responsive interface built with SvelteKit + Tailwind CSS.</p>
					</div>
				</div>
				<div class="flex items-start gap-3">
					<span class="text-2xl">🚀</span>
					<div>
						<h4 class="font-bold text-lg mb-1">Edge Deployment</h4>
						<p class="text-blue-100">Hosted on Cloudflare Pages for global low-latency access.</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Call to Action -->
	<section class="max-w-7xl mx-auto px-4 pb-20 text-center">
		<h2 class="text-4xl font-bold text-gray-900 mb-6">Ready to streamline your cataloging?</h2>
		<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
			Join librarians and catalogers who are saving hours of manual work every day.
		</p>
		<a 
			href="/" 
			class="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
		>
			<span>Start Cataloging Now</span>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
			</svg>
		</a>
		<p class="mt-6 text-sm text-gray-500">
			Free and open source. No registration required.
		</p>
	</section>
</div>
