<script lang="ts">
	import { page } from '$app/stores';
	
	/**
	 * Global error page for the application
	 * Displays friendly, non-technical error messages for librarians
	 * Includes optional request ID for debugging in production
	 */
	
	// Generate a simple request ID for debugging
	const requestId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	
	// Extract error details (don't leak sensitive info)
	const status = $page.status || 500;
	const message = $page.error?.message || 'Something went wrong';
	
	// Friendly messages for common errors
	const friendlyMessages: Record<number, { title: string; description: string }> = {
		404: {
			title: 'Page Not Found',
			description: 'The page you\'re looking for doesn\'t exist or may have been moved.'
		},
		403: {
			title: 'Access Denied',
			description: 'You don\'t have permission to view this page. Please sign in or contact an administrator.'
		},
		500: {
			title: 'Something Went Wrong',
			description: 'We encountered an unexpected error. Our team has been notified and is working on it.'
		},
		503: {
			title: 'Service Temporarily Unavailable',
			description: 'The service is temporarily down for maintenance. Please try again in a few minutes.'
		}
	};
	
	const friendly = friendlyMessages[status] || {
		title: `Error ${status}`,
		description: 'An unexpected error occurred. Please try again or contact support if the problem persists.'
	};
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
	<div class="max-w-md w-full">
		<!-- Error Icon -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 mb-4">
				<svg class="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path 
						stroke-linecap="round" 
						stroke-linejoin="round" 
						stroke-width="2" 
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
					/>
				</svg>
			</div>
			
			<h1 class="text-3xl font-bold text-gray-900 mb-2">
				{friendly.title}
			</h1>
			
			<p class="text-gray-600 mb-6">
				{friendly.description}
			</p>
			
			<!-- Actions -->
			<div class="flex flex-col sm:flex-row gap-3 justify-center">
				<a
					href="/"
					class="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-md"
				>
					<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
					</svg>
					Go Home
				</a>
				
				<button
					onclick={() => window.history.back()}
					class="inline-flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
				>
					<svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Go Back
				</button>
			</div>
		</div>
		
		<!-- Technical Details (for debugging, collapsed by default) -->
		<details class="bg-white rounded-lg border border-gray-200 p-4">
			<summary class="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
				Technical Details (for debugging)
			</summary>
			<div class="mt-3 space-y-2 text-sm text-gray-600">
				<div>
					<span class="font-medium">Request ID:</span>
					<code class="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-mono">{requestId}</code>
				</div>
				<div>
					<span class="font-medium">Status Code:</span>
					<code class="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-mono">{status}</code>
				</div>
				<div>
					<span class="font-medium">Timestamp:</span>
					<code class="ml-2 px-2 py-1 bg-gray-100 rounded text-xs font-mono">
						{new Date().toISOString()}
					</code>
				</div>
				{#if import.meta.env.DEV}
					<div class="pt-2 border-t border-gray-200">
						<span class="font-medium text-red-600">Dev Mode Error:</span>
						<pre class="mt-2 p-2 bg-red-50 rounded text-xs font-mono overflow-x-auto">{message}</pre>
					</div>
				{/if}
			</div>
		</details>
		
		<!-- Support Note -->
		<p class="text-center text-sm text-gray-500 mt-6">
			If you need help, please contact support and reference the Request ID above.
		</p>
	</div>
</div>
