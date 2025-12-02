<script lang="ts">
	/**
	 * Reusable Input component with consistent styling and accessibility
	 * Supports text input with proper focus states and error handling
	 */
	
	interface Props {
		type?: 'text' | 'email' | 'password' | 'search' | 'number';
		value?: string;
		placeholder?: string;
		disabled?: boolean;
		error?: boolean;
		id?: string;
		name?: string;
		class?: string;
		'aria-label'?: string;
	}
	
	let {
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		error = false,
		id,
		name,
		class: className = '',
		'aria-label': ariaLabel
	}: Props = $props();
	
	const baseClasses = 'w-full px-4 py-3 rounded-lg border outline-none transition-colors';
	const normalClasses = 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
	const errorClasses = 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500';
	const disabledClasses = 'disabled:bg-gray-100 disabled:cursor-not-allowed';
	
	let classes = $derived(`${baseClasses} ${error ? errorClasses : normalClasses} ${disabledClasses} ${className}`);
</script>

<input
	{type}
	{id}
	{name}
	{placeholder}
	{disabled}
	bind:value
	class={classes}
	aria-label={ariaLabel}
	aria-invalid={error}
/>
