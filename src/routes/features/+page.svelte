<script lang="ts">
	import ShareButtons from '$lib/components/ShareButtons.svelte';
</script>

<svelte:head>
	<title>Fitur - Rangkai Book Metadata Harvester</title>
	<meta name="description" content="3 Pilar Kecepatan: Velocity Engine, Data Brain, dan Anywhere Workflow. Katalog 50 buku dalam 5 menit." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-white">
	<!-- Hero Section -->
	<section class="max-w-6xl mx-auto px-4 py-16">
		<div class="text-center mb-16">
			<h1 class="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
				Tiga Pilar Kecepatan Rangkai
			</h1>
			<p class="text-xl text-gray-600 max-w-3xl mx-auto">
				Teknologi yang dirancang khusus untuk pustakawan yang ingin katalog <span class="text-blue-600 font-semibold">10x lebih cepat</span>—tanpa mengorbankan kualitas data.
			</p>
		</div>

	</section>

	<!-- Core Capabilities -->
	<section class="max-w-6xl mx-auto px-4 py-12">
		<!-- 3 Value Pillars Grid -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
			
			<!-- Card 1: The Velocity Engine 🚀 -->
			<div class="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-shadow">
				<div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6">
					<span class="text-4xl">🚀</span>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-4">The Velocity Engine</h2>
				<p class="text-gray-600 mb-6">
					Scanner mode yang tidak pernah macet. Scan 50 buku dalam 5 menit tanpa hambatan.
				</p>
				
				<div class="space-y-4">
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">Scanner Mode Unjammable</h3>
							<p class="text-sm text-gray-600">Input tidak pernah kehilangan fokus. Auto-add langsung ke batch tanpa review.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">3-Second Waterfall</h3>
							<p class="text-sm text-gray-600">Fetch paralel dari 3 API sekaligus. Tidak menunggu satu API selesai baru fetch yang lain.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">KV Caching</h3>
							<p class="text-sm text-gray-600">ISBN yang sama? Cache hit &lt;1ms dari Cloudflare KV. Tidak perlu fetch ulang.</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Card 2: The Data Brain 🧠 -->
			<div class="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-shadow">
				<div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6">
					<span class="text-4xl">🧠</span>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-4">The Data Brain</h2>
				<p class="text-gray-600 mb-6">
					Merger otomatis dari 3 sumber terpercaya. Data lengkap, akurat, siap masuk SLiMS.
				</p>
				
				<div class="space-y-4">
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">3-Source Merge</h3>
							<p class="text-sm text-gray-600">Google Books (cover & metadata), OpenLibrary (DDC), LoC (LCC resmi). Gabung otomatis.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">Official LoC Classification</h3>
							<p class="text-sm text-gray-600">LCC langsung dari Library of Congress—sumber paling otoritatif untuk klasifikasi.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">DDC Fallback</h3>
							<p class="text-sm text-gray-600">Jika LCC tidak tersedia, otomatis pakai DDC dari OpenLibrary atau subject mapping.</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Card 3: The Anywhere Workflow 📱 -->
			<div class="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 hover:shadow-2xl transition-shadow">
				<div class="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-6">
					<span class="text-4xl">📱</span>
				</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-4">The Anywhere Workflow</h2>
				<p class="text-gray-600 mb-6">
					Katalog dari HP, tablet, atau laptop. Online atau offline. Export langsung ke SLiMS.
				</p>
				
				<div class="space-y-4">
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">Mobile PWA (Offline)</h3>
							<p class="text-sm text-gray-600">Install sebagai app di HP. Scan offline, sync otomatis saat online kembali.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">Built-in Camera Scanner</h3>
							<p class="text-sm text-gray-600">Tidak punya barcode scanner? Pakai kamera HP. Otomatis deteksi ISBN dari foto.</p>
						</div>
					</div>
					
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-green-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div>
							<h3 class="font-semibold text-gray-900">Batch Export (UTF-8 BOM)</h3>
							<p class="text-sm text-gray-600">Download 50 buku sekaligus dalam format CSV SLiMS. Lengkap dengan UTF-8 BOM untuk Windows.</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Proof Points -->
		<div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-xl p-8 md:p-12 text-white mb-16">
			<div class="text-center mb-8">
				<h2 class="text-3xl md:text-4xl font-bold mb-4">Bukti, Bukan Janji Kosong</h2>
				<p class="text-blue-100 text-lg">Real metrics dari pustakawan yang sudah pakai Rangkai</p>
			</div>
			
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div class="text-center">
					<div class="text-5xl font-extrabold mb-2">4.5s</div>
					<div class="text-blue-100">Waktu rata-rata per buku</div>
					<div class="text-sm text-blue-200 mt-1">(Scan + Fetch + Add)</div>
				</div>
				<div class="text-center">
					<div class="text-5xl font-extrabold mb-2">3x</div>
					<div class="text-blue-100">Lebih cepat dari manual</div>
					<div class="text-sm text-blue-200 mt-1">(vs. copy-paste satu-satu)</div>
				</div>
				<div class="text-center">
					<div class="text-5xl font-extrabold mb-2">18</div>
					<div class="text-blue-100">Kolom SLiMS otomatis</div>
					<div class="text-sm text-blue-200 mt-1">(Ready import, no edit)</div>
				</div>
			</div>
		</div>

		<!-- How It Works -->
		<div class="mb-16">
			<h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">Cara Kerja</h2>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
				<div class="text-center">
					<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<span class="text-2xl font-bold text-blue-600">1</span>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-2">Scan ISBN</h3>
					<p class="text-gray-600">Pakai barcode scanner USB atau kamera HP. Tidak perlu ketik manual.</p>
				</div>
				<div class="text-center">
					<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<span class="text-2xl font-bold text-purple-600">2</span>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-2">Auto Merge</h3>
					<p class="text-gray-600">Rangkai fetch dari 3 API, merge data terbaik, dan generate call number otomatis.</p>
				</div>
				<div class="text-center">
					<div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
						<span class="text-2xl font-bold text-green-600">3</span>
					</div>
					<h3 class="text-xl font-semibold text-gray-900 mb-2">Export SLiMS</h3>
					<p class="text-gray-600">Download CSV dengan format yang sudah sesuai. Langsung import ke SLiMS, tidak ada edit lagi.</p>
				</div>
			</div>
		</div>
	</section>

	<!-- CTA -->
	<section class="max-w-5xl mx-auto px-4 py-12 text-center">
		<div class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-12">
			<h2 class="text-4xl font-extrabold text-white mb-4">Mulai Scan Gratis</h2>
			<p class="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
				Tidak perlu kartu kredit. Tidak perlu setup rumit. Login dengan Google, dan langsung scan buku pertama Anda.
			</p>
			<div class="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
				<a 
					href="/" 
					class="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
					</svg>
					Coba Sekarang
				</a>
				<a 
					href="/login" 
					class="inline-flex items-center gap-3 px-8 py-4 bg-transparent border-2 border-white text-white font-bold text-lg rounded-xl hover:bg-white hover:text-blue-600 transition-all"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
					</svg>
					Login dengan Google
				</a>
			</div>
			
			<!-- Social Share -->
			<div class="pt-8 border-t border-blue-400">
				<ShareButtons />
			</div>
		</div>
	</section>
</div>
