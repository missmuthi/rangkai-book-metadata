<script>
import "../app.css";
import favicon from '$lib/assets/favicon.svg';
import ErrorBoundary from '$lib/ErrorBoundary.svelte';

let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href="{favicon}" />
</svelte:head>

<div class="flex flex-col min-h-screen">
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
