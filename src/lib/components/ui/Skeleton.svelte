<script lang="ts">
	/**
	 * Skeleton loading placeholder component
	 * Shows an animated placeholder while content is loading
	 */
	
	interface Props {
		variant?: 'text' | 'circle' | 'rectangular';
		width?: string;
		height?: string;
		class?: string;
	}
	
	let {
		variant = 'rectangular',
		width = '100%',
		height = variant === 'text' ? '1rem' : '100%',
		class: className = ''
	}: Props = $props();
	
	const variantClasses = {
		text: 'h-4 rounded',
		circle: 'rounded-full',
		rectangular: 'rounded-lg'
	};
</script>

<div
	class="animate-pulse bg-gray-200 {variantClasses[variant]} {className}"
	style:width
	style:height
	role="status"
	aria-label="Loading..."
>
	<span class="sr-only">Loading...</span>
</div>
