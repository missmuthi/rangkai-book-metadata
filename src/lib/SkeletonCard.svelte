<!-- Loading Skeleton Components -->
<script lang="ts">
	// Skeleton for book cards in search results
	// Note: 'lines' parameter kept for future extensibility
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export let lines = 3;
</script>

<div class="animate-pulse">
	<button type="button" class="w-full p-4 bg-white border border-gray-200 rounded-lg flex gap-4 items-center cursor-pointer hover:bg-gray-50 transition-colors shadow-sm text-left">
		<div class="w-12 h-16 bg-gray-200 rounded shadow-sm flex-shrink-0"></div>
		<div class="flex-1">
			<div class="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
			<div class="h-3 bg-gray-200 rounded w-1/2"></div>
		</div>
	</button>
</div>