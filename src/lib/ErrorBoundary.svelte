<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { children } = $props();

	let error = $state<Error | null>(null);
	let errorId = $state<string | null>(null);

	// Listen for unhandled errors
	onMount(() => {
		const handleError = (event: ErrorEvent) => {
			error = event.error;
			errorId = `error_${Date.now()}`;
			console.error('Global error caught:', event.error);
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
			errorId = `rejection_${Date.now()}`;
			console.error('Unhandled promise rejection:', event.reason);
		};

		window.addEventListener('error', handleError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});

	// Handle SvelteKit page errors
	$effect(() => {
		if ($page.status >= 400) {
			error = new Error(`HTTP ${$page.status}: ${$page.error?.message || 'Page error'}`);
			errorId = `page_error_${Date.now()}`;
		}
	});
</script>

{#if error}
	<!-- Error Overlay -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<div class="flex items-center mb-4">
				<div class="flex-shrink-0">
					<svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
					</svg>
				</div>
				<div class="ml-3">
					<h3 class="text-lg font-medium text-gray-900">Something went wrong</h3>
					{#if errorId}
						<p class="text-sm text-gray-500">Error ID: {errorId}</p>
					{/if}
				</div>
			</div>

			<div class="mb-4">
				<p class="text-sm text-gray-700">{error.message}</p>
			</div>

			<div class="flex space-x-3">
				<button
					onclick={() => { error = null; errorId = null; }}
					class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors"
				>
					Dismiss
				</button>
				<button
					onclick={() => window.location.reload()}
					class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
				>
					Reload Page
				</button>
			</div>

			{#if import.meta.env.DEV}
				<details class="mt-4">
					<summary class="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
						Technical Details (Development)
					</summary>
					<pre class="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">{error.stack}</pre>
				</details>
			{/if}
		</div>
	</div>
{/if}

<!-- Main content -->
{@render children()}