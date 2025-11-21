<script lang="ts">
import "../app.css";
import favicon from '$lib/assets/favicon.svg';
import ErrorBoundary from '$lib/ErrorBoundary.svelte';

let { children, data } = $props();

// User menu state
let showUserMenu = $state(false);

function toggleUserMenu() {
	showUserMenu = !showUserMenu;
}

function closeUserMenu() {
	showUserMenu = false;
}

async function onSignOut() {
	closeUserMenu();
	
	try {
		console.log('[Logout] Initiating sign out...');
		
		// Call server-side sign-out endpoint
		const response = await fetch('/api/auth/sign-out', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			cache: 'no-store' // Prevent caching
		});
		
		console.log('[Logout] Sign out response status:', response.status);
		
		if (!response.ok) {
			console.error('[Logout] Sign out failed:', response.status);
		}
		
		console.log('[Logout] ✅ Redirecting to /login');
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
	<link rel="icon" href="{favicon}" />
</svelte:head>

<!-- Close menu when clicking outside -->
{#if showUserMenu}
	<button
		class="fixed inset-0 z-40"
		onclick={closeUserMenu}
		aria-label="Close menu"
	></button>
{/if}

<div class="flex flex-col min-h-screen">
	<!-- Header with Authentication -->
	<header class="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
		<div class="max-w-7xl mx-auto px-4 py-3">
			<div class="flex items-center justify-between">
				<!-- Logo/Brand -->
				<a href="/" class="flex items-center gap-2 text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors">
					<img src={favicon} alt="Rangkai Logo" class="size-8" />
					<span>Rangkai</span>
				</a>

				<!-- Auth Section -->
				<div class="flex items-center gap-4">
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
								<div class="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
									<!-- User Info -->
									<div class="px-4 py-3 border-b border-gray-100">
										<p class="text-sm font-semibold text-gray-900">{data.user?.name || 'User'}</p>
										<p class="text-xs text-gray-500 truncate">{data.user?.email || ''}</p>
									</div>

									<!-- Menu Items -->
									<a
										href="/dashboard"
										class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
										onclick={closeUserMenu}
									>
										<svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
										</svg>
										Dashboard
									</a>

									<a
										href="/history"
										class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
										onclick={closeUserMenu}
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
										onclick={onSignOut}
										class="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
		<div class="max-w-7xl mx-auto px-4 py-6">
			<div class="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
				<!-- Left: Version -->
				<div class="font-medium text-gray-700">
					Rangkai v1.1.0
				</div>

				<!-- Center: Navigation -->
				<nav class="flex items-center gap-6">
					<a href="/" class="hover:text-blue-600 transition-colors">Home</a>
					<a href="/features" class="hover:text-blue-600 transition-colors">Features</a>
					<a href="https://github.com/missmuthi/rangkai-book-metadata" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors">GitHub</a>
				</nav>

				<!-- Right: Creator -->
				<div>
					Created by <a href="https://www.linkedin.com/in/mikhail-adi-negoro-pasaribu/" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 font-medium transition-colors">MikhailRyu</a>
				</div>
			</div>
		</div>
	</footer>
</div>
