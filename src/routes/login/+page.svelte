<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	
	let { data } = $props<{ data: PageData }>();
	let isLoading = $state(false);
	
	// Read error from URL query params (set by OAuth callback on failure)
	let error = $derived($page.url.searchParams.get('error'));
	
	// Auto-redirect logged-in users to root
	$effect(() => {
		if (data?.session) {
			// console.log('[Login] User already logged in, redirecting to /');
			goto('/', { replaceState: true });
		}
	});
	
	// Clear error from URL when user interacts (optional UX improvement)
	function clearError() {
		if (error) {
			const url = new URL(window.location.href);
			url.searchParams.delete('error');
			history.replaceState({}, '', url.toString());
		}
	}
	
	function handleGoogleSignIn() {
		clearError();
		isLoading = true;
		
		// Redirect to Google OAuth endpoint
		window.location.href = '/api/auth/google';
	}
</script>

<svelte:head>
	<title>Login - Rangkai Book Metadata</title>
	<meta name="description" content="Sign in to access your book metadata collection" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center px-4">
	<div class="max-w-md w-full">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
				</svg>
			</div>
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Welcome to Rangkai</h1>
			<p class="text-gray-600">Sign in to access your book metadata collection</p>
		</div>
		
		<!-- Login Card -->
		<div class="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
			<!-- Error Message -->
			{#if error}
				<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
					<svg class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<div>
						<p class="text-sm font-medium text-red-900">Authentication Error</p>
						<p class="text-sm text-red-700 mt-1">{error}</p>
					</div>
				</div>
			{/if}
			
			<!-- Google Sign In Button -->
			<button
				type="button"
				onclick={handleGoogleSignIn}
				disabled={isLoading}
				class="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
			>
				{#if isLoading}
					<svg class="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>Signing in...</span>
				{:else}
					<!-- Google Icon -->
					<svg class="w-5 h-5" viewBox="0 0 24 24">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
					</svg>
					<span>Continue with Google</span>
				{/if}
			</button>
			
			<!-- Divider -->
			<div class="relative my-8">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t border-gray-200"></div>
				</div>
				<div class="relative flex justify-center text-sm">
					<span class="px-4 bg-white text-gray-500">Or</span>
				</div>
			</div>
			
			<!-- Back to Home Link -->
			<a
				href="/"
				class="block w-full text-center px-6 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
			>
				Continue without signing in
			</a>
		</div>
		
		<!-- Footer -->
		<p class="text-center text-sm text-gray-600 mt-8">
			By signing in, you agree to our 
			<a href="/terms" class="text-blue-600 hover:underline">Terms of Service</a> and 
			<a href="/privacy" class="text-blue-600 hover:underline">Privacy Policy</a>
		</p>
	</div>
</div>

<style>
	/* Add subtle animations */
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	div {
		animation: fade-in 0.3s ease-out;
	}
</style>
