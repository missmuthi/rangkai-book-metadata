<script lang="ts">
  import { toasts } from '$lib/stores/toast';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
</script>

<div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none p-4 sm:p-0">
  {#each $toasts as toast (toast.id)}
    <div
      animate:flip
      transition:fly={{ y: -20, duration: 300 }}
      class="pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-lg shadow-2xl border-l-4
        {toast.type === 'success' ? 'bg-white border-green-500 text-gray-800' :
         toast.type === 'error' ? 'bg-white border-red-500 text-gray-800' :
         'bg-white border-blue-500 text-gray-800'}"
      role="alert"
    >
      {#if toast.type === 'success'}
        <svg class="size-6 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      {:else if toast.type === 'error'}
        <svg class="size-6 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      {:else}
        <svg class="size-6 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      {/if}

      <div>
        <p class="font-medium">{toast.message}</p>
      </div>

      <button
        class="ml-auto text-gray-400 hover:text-gray-600"
        onclick={() => toasts.remove(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  {/each}
</div>
