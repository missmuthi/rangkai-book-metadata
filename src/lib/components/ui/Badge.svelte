<script lang="ts">
	/**
	 * Reusable Badge component for status indicators
	 * Variants: default (gray), info (blue), success (green), warning (yellow), error (red)
	 */
	
	interface Props {
		variant?: 'default' | 'info' | 'success' | 'warning' | 'error';
		size?: 'sm' | 'md';
		class?: string;
			   children?: any;
	}
	
	let {
		variant = 'default',
		size = 'md',
		class: className = '',
		children
	}: Props = $props();
	
	const variantClasses = {
		default: 'bg-gray-100 text-gray-800',
		info: 'bg-blue-100 text-blue-800',
		success: 'bg-green-100 text-green-800',
		warning: 'bg-yellow-100 text-yellow-800',
		error: 'bg-red-100 text-red-800'
	};
	
	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm'
	};
	
	const classes = `inline-flex items-center font-medium rounded-full ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
</script>

<span class={classes}>
	{@render children()}
</span>
