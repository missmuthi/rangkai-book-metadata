<script lang="ts">
import "../app.css";
import favicon from '$lib/assets/favicon.svg';
import ErrorBoundary from '$lib/ErrorBoundary.svelte';
import Toast from '$lib/components/Toast.svelte';
import ShareButtons from '$lib/components/ShareButtons.svelte';
import { onMount } from 'svelte';

let { children, data } = $props();

// User menu state
let showUserMenu = $state(false);

// PWA Install prompt state
let deferredPrompt: any = null;
let showInstallButton = $state(false);

function toggleUserMenu() {
	showUserMenu = !showUserMenu;
}

function closeUserMenu() {
        showUserMenu = false;
}

onMount(() => {
        if ('serviceWorker' in navigator) {
                navigator.serviceWorker
                        .register('/service-worker.js')
                        .catch((err) => console.error('Service worker registration failed', err));
        }
	
	// PWA Install Prompt Logic (Hero Feature)
	window.addEventListener('beforeinstallprompt', (e) => {
		// Prevent the default prompt
		e.preventDefault();
		// Store the event for later use
		deferredPrompt = e;
		// Show the custom install button
		showInstallButton = true;
		// console.log('[PWA] Install prompt available');
	});
	
	// Track PWA installation
	window.addEventListener('appinstalled', () => {
		// console.log('[PWA] App installed successfully');
		showInstallButton = false;
		deferredPrompt = null;
	});
});

async function handleInstallApp() {
	if (!deferredPrompt) {
		console.warn('[PWA] No install prompt available');
		return;
	}
	
	// Show the install prompt
	deferredPrompt.prompt();
	
	// Wait for the user's response
	const { outcome } = await deferredPrompt.userChoice;
	// console.log(`[PWA] User response: ${outcome}`);
	
	// Clear the deferred prompt
	deferredPrompt = null;
	showInstallButton = false;
}

async function onSignOut() {
	closeUserMenu();
	
	try {
		// console.log('[Logout] Initiating sign out...');
		
		// Call server-side sign-out endpoint
		const response = await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			cache: 'no-store' // Prevent caching
		});
		
		// console.log('[Logout] Sign out response status:', response.status);
		
		if (!response.ok) {
			console.error('[Logout] Sign out failed:', response.status);
		}
		
		// console.log('[Logout] ✅ Redirecting to /login');
		// Force hard reload to clear all client-side state
		window.location.href = '/login';
	} catch (error) {
		console.error('[Logout] ❌ Sign out error:', error);
		// Still redirect even if API call fails
		window.location.href = '/login';
	}
}
</script>

<svelte:head>
	<title>Rangkai - Katalog Buku Otomatis untuk SLiMS | Gratis & Cepat</title>
	<meta name="description" content="Scan ISBN, ambil metadata dari 3 sumber global, export ke SLiMS. 100% gratis. Katalog 50 buku dalam 5 menit." />
	<link rel="canonical" href="https://rangkai-book-metadata.pages.dev" />
	<meta property="og:title" content="Rangkai - Katalog Buku Otomatis untuk SLiMS | Gratis & Cepat" />
	<meta property="og:description" content="Scan ISBN, ambil metadata dari 3 sumber global, export ke SLiMS. 100% gratis. Katalog 50 buku dalam 5 menit." />
	<meta property="og:image" content="https://rangkai.app/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="icon" href="{favicon}" />
</svelte:head>

<Toast />

<!-- Close menu when clicking outside - positioned BEHIND dropdown -->
{#if showUserMenu}
        <div
                class="fixed inset-0 z-20"
                onclick={closeUserMenu}
                onkeydown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                closeUserMenu();
                        }
                }}
                role="button"
                tabindex="0"
                aria-label="Close menu"
        ></div>
{/if}

<div class="flex flex-col min-h-screen">
	<!-- Header with Authentication -->
	<header class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
		<div class="max-w-7xl mx-auto px-4 py-3">
			<div class="flex items-center justify-between">
				<!-- Logo/Brand + Mobile Nav -->
				<div class="flex items-center gap-3">
					<a href="/" class="flex items-center gap-2 text-lg font-bold text-gray-900 transition-colors hover:text-blue-600">
						<img src={favicon} alt="Rangkai Logo" class="size-8" />
						<span>Rangkai</span>
					</a>

					<a
						href="/scan/mobile"
						class="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
					>
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M7 5H5a2 2 0 00-2 2v2m14-4h2a2 2 0 012 2v2m0 6v2a2 2 0 01-2 2h-2m-8 0H5a2 2 0 01-2-2v-2"></path>
							<rect x="8" y="8" width="8" height="8" rx="2" ry="2"></rect>
						</svg>
						<span>Scan</span>
					</a>
				</div>

				<!-- Auth Section -->
				<div class="flex items-center gap-4">
					<!-- PWA Install Button (Hero Feature) -->
					{#if showInstallButton}
						<button
							onclick={handleInstallApp}
							class="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-300 rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors shadow-sm"
							title="Install Rangkai as an app for offline access"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
							</svg>
							<span class="hidden md:inline">Install App</span>
							<span class="md:hidden">Install</span>
						</button>
					{/if}
					
					{#if data?.session}
						<!-- User Menu (Authenticated) -->
						<div class="relative">
							<button
								onclick={toggleUserMenu}
								class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
								aria-label="User menu"
								aria-expanded={showUserMenu}
							>
								<!-- User Avatar -->
								{#if data.user?.image}
									<img
										src={data.user.image}
										alt={data.user.name || 'User'}
										class="size-8 rounded-full border-2 border-gray-200"
									/>
								{:else}
									<div class="flex items-center justify-center size-8 rounded-full bg-blue-600 text-white font-semibold text-sm">
										{data.user?.name?.[0]?.toUpperCase() || 'U'}
									</div>
								{/if}

								<!-- User Name (Desktop only) -->
								<span class="hidden md:block text-sm font-medium text-gray-700">
									{data.user?.name || 'User'}
								</span>

								<!-- Dropdown Icon -->
								<svg class="size-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
								</svg>
							</button>

							<!-- Dropdown Menu -->
							{#if showUserMenu}
								<div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[100]">
									<!-- User Info -->
									<div class="px-4 py-3 border-b border-gray-100">
										<p class="text-sm font-semibold text-gray-900">{data.user?.name || 'User'}</p>
										<p class="text-xs text-gray-500 truncate">{data.user?.email || ''}</p>
									</div>

									<!-- Menu Items -->
									<a
										href="/dashboard"
										class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
									>
										<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
										</svg>
										Dashboard
									</a>

									<a
										href="/history"
										class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
									>
										<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
										</svg>
										History
									</a>

									<!-- Divider -->
									<div class="border-t border-gray-100 my-1"></div>

									<!-- Sign Out -->
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											onSignOut();
										}}
										class="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
									>
										<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
										</svg>
										Sign Out
									</button>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Login Button (Not Authenticated) -->
						<a
							href="/login"
							class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors shadow-sm"
						>
							<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
							</svg>
							Login
						</a>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<ErrorBoundary>
		<main class="flex-1">
			{@render children()}
		</main>
	</ErrorBoundary>

	<footer class="bg-white border-t border-gray-200 mt-auto">
		<div class="max-w-7xl mx-auto px-4 py-8">
			<!-- Social Share Section -->
			<div class="mb-6 pb-6 border-b border-gray-200">
				<ShareButtons />
			</div>
			
			<div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
				<!-- Left: Branding -->
				<div class="text-center md:text-left">
					<p class="font-semibold text-gray-900">Rangkai Book Metadata Harvester</p>
					<p class="text-xs text-gray-500 mt-1">v2.0.2 • Built for SLiMS workflows</p>
				</div>

				<!-- Center: Navigation -->
				<nav class="flex items-center gap-6">
					<a href="/" class="hover:text-blue-600 transition-colors">Home</a>
					<a href="/features" class="hover:text-blue-600 transition-colors">Features</a>
					<a href="https://github.com/missmuthi/rangkai-book-metadata" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">GitHub</a>
				</nav>

				<!-- Right: Creator -->
				<div class="text-center md:text-right">
					<p class="text-xs">Created by <a href="https://www.linkedin.com/in/mikhail-adi-negoro-pasaribu/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 font-medium transition-colors">MikhailRyu</a></p>
				</div>
			</div>
		</div>
	</footer>
</div>
