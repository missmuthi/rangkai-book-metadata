<script lang="ts">
  export let form: any;
  export let name: string;
</script>
{#if form?.errors && form.errors[name]}
  <p class="text-sm text-red-600 mt-1">{form.errors[name]}</p>
{/if}
{#if form?.serverErrors && form.serverErrors[name]}
  <p class="text-sm text-red-600 mt-1">{form.serverErrors[name]}</p>
{/if}
