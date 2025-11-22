<script lang="ts">
	/**
	 * Reusable EmptyState component for when there's no data to display
	 * Includes icon, message, optional description, and optional CTA
	 */
	
	interface Props {
		icon?: 'book' | 'search' | 'inbox';
		title: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
		class?: string;
	}
	
	let {
		icon = 'inbox',
		title,
		description,
		actionLabel,
		onAction,
		class: className = ''
	}: Props = $props();
	
	const iconPaths = {
		book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
		search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
		inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
	};
</script>

<div class="text-center py-12 {className}">
	<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPaths[icon]} />
	</svg>
	
	<h3 class="text-lg font-medium text-gray-900 mb-2">{title}</h3>
	
	{#if description}
		<p class="text-sm text-gray-500 mb-6 max-w-sm mx-auto">{description}</p>
	{/if}
	
	{#if actionLabel && onAction}
		<button
			type="button"
			onclick={onAction}
			class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
		>
			{actionLabel}
		</button>
	{/if}
</div>
