<script lang="ts">
	/**
	 * Reusable Alert component for displaying messages
	 * Variants: info (blue), success (green), warning (yellow), error (red)
	 */
	
	interface Props {
		variant?: 'info' | 'success' | 'warning' | 'error';
		title?: string;
		dismissible?: boolean;
		onDismiss?: () => void;
		class?: string;
		children: import("svelte").Snippet;
	}
	
	let {
		variant = 'info',
		title,
		dismissible = false,
		onDismiss,
		class: className = '',
		children
	}: Props = $props();
	
	const variantConfig = {
		info: {
			container: 'bg-blue-50 border-blue-200',
			icon: 'text-blue-600',
			title: 'text-blue-900',
			text: 'text-blue-700',
			iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		success: {
			container: 'bg-green-50 border-green-200',
			icon: 'text-green-600',
			title: 'text-green-900',
			text: 'text-green-700',
			iconPath: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		warning: {
			container: 'bg-yellow-50 border-yellow-200',
			icon: 'text-yellow-600',
			title: 'text-yellow-900',
			text: 'text-yellow-700',
			iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z'
		},
		error: {
			container: 'bg-red-50 border-red-200',
			icon: 'text-red-600',
			title: 'text-red-900',
			text: 'text-red-700',
			iconPath: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		}
	};
	
	const config = variantConfig[variant];
</script>

<div class="rounded-lg border {config.container} p-4 {className}" role="alert">
	<div class="flex items-start gap-3">
		<svg class="w-5 h-5 {config.icon} flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={config.iconPath} />
		</svg>
		
		<div class="flex-1">
			{#if title}
				<h3 class="font-medium {config.title} mb-1">{title}</h3>
			{/if}
			<div class="text-sm {config.text}">
				{@render children()}
			</div>
		</div>
		
		{#if dismissible && onDismiss}
			<button
				type="button"
				onclick={onDismiss}
				class="{config.icon} hover:opacity-70 flex-shrink-0"
				aria-label="Dismiss alert"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>
</div>
