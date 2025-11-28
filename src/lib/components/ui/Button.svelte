<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * Reusable Button component with consistent styling and accessibility
	 * Variants: primary (blue), secondary (gray), danger (red), ghost (transparent)
	 */
	
	interface Props {
		variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: () => void;
		class?: string;
		children?: Snippet;
	}
	
	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		type = 'button',
		onclick,
		class: className = '',
		children
	}: Props = $props();
	
	const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
	
	const variantClasses = {
		primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
		secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-500',
		danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
		ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-500'
	};
	
	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2 text-base',
		lg: 'px-6 py-3 text-lg'
	};
	
	const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
</script>

<button
	{type}
	{disabled}
	{onclick}
	class={classes}
>
	{#if children}{@render children()}{/if}
</button>
