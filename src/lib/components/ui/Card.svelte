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
				children?: any;
	}
	
	let {
		interactive = false,
		padding = 'md',
		class: className = '',
		onclick,
		children
	}: Props = $props();
	
	const baseClasses = 'bg-white rounded-lg border border-gray-200 shadow-sm';
	const interactiveClasses = interactive 
		? 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all'
		: '';
	
	const paddingClasses = {
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8'
	};
	
	const classes = `${baseClasses} ${interactiveClasses} ${paddingClasses[padding]} ${className}`;
</script>

{#if onclick}
	<button
		type="button"
		{onclick}
		class="{classes} text-left"
	>
		{@render children()}
	</button>
{:else}
	<div class={classes}>
		{@render children()}
	</div>
{/if}
