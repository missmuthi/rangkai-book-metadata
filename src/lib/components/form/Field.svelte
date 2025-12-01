<script lang="ts">
  export let form: any = null;
  export let name: string;
  export let label: string | undefined;
  export let required: boolean = false;
</script>

<div class="form-field">
  {#if label}
    <label for={name} class="block text-sm font-medium text-gray-700">{label}{#if required} *{/if}</label>
  {/if}
  <slot />
</div>

<style>
  .form-field {
    margin-bottom: 1rem;
  }
</style>
