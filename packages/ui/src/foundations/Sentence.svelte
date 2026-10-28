<script lang="ts">
  import { tParts } from './texts.svelte.js';

  /**
   * A sentence of the interface, by its key, with the names in it shown as names, in a monospace
   * font (NFR-LOC-03). `values` go in as words, `names` as names; neither is translated.
   */
  let {
    key,
    values = {},
    names = {},
  }: { key: string; values?: Readonly<Record<string, string | number>>; names?: Readonly<Record<string, string>> } = $props();

  const parts = $derived(tParts(key, values, names));
</script>

{#each parts as part, index (index)}{#if 'name' in part}<span class="mono">{part.name}</span>{:else}{part.text}{/if}{/each}
