<script lang="ts">
	/**
	 * Reusable Card component with consistent spacing and styling
	 * Supports optional interactive state and custom padding
	 */
	
	interface Props {
		interactive?: boolean;
		padding?: 'sm' | 'md' | 'lg';
		class?: string;
		onclick?: () => void;
				children?: import('svelte').Snippet;
	}
	
	let {
		interactive = false,
		padding = 'md',
		class: className = '',
		onclick,
		children
	}: Props = $props();
	
	const baseClasses = 'bg-white rounded-lg border border-gray-200 shadow-sm';
	
	const paddingClasses = {
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
	
	let classes = $derived(`${baseClasses} ${interactive ? 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all' : ''} ${paddingClasses[padding]} ${className}`);
</script>

{#if onclick}
	<button
		type="button"
		{onclick}
		class="{classes} text-left"
	>
		{#if children}
			{@render children()}
		{/if}
	</button>
{:else}
	<div class={classes}>
		{#if children}
			{@render children()}
		{/if}
	</div>
{/if}
