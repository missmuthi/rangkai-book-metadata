<!-- Loading Skeleton Components -->
<script lang="ts">
	// Skeleton for book cards in search results
	export let lines = 3;
</script>

<div class="animate-pulse">
	<button type="button" class="w-full p-4 bg-white border border-gray-200 rounded-lg flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-left" aria-label="Loading book information">
		<div class="w-12 h-16 bg-gray-200 rounded shadow-sm flex-shrink-0"></div>
		<div class="flex-1">
			{#each Array(lines) as _, i}
				<div class="h-4 bg-gray-200 rounded {i === 0 ? 'w-3/4 mb-1' : 'w-1/2'}" class:mb-1={i < lines - 1}></div>
			{/each}
		</div>
	</button>
</div>