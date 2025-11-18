<script>import "../app.css";
import favicon from '$lib/assets/favicon.svg';
import ErrorBoundary from '$lib/ErrorBoundary.svelte';

let { children } = $props();</script>

<svelte:head>
	<link rel="icon" href="{favicon}" />
</svelte:head>

<ErrorBoundary>
	{@render children()}
</ErrorBoundary>
