<script lang="ts">
  export let id: string;
  export let name: string;
  export let type: string = 'text';
  export let value: any = '';
  export let placeholder: string | undefined;
  export let form: any = null;
</script>

<input id={id} name={name} type={type} bind:value={value} placeholder={placeholder} class="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />

<style>
  input:invalid { border-color: #f43f5e; }
</style>
