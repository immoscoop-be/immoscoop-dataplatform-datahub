<script lang="ts">
  import type { Snippet } from 'svelte';
  import CopyButton from '../primitives/CopyButton.svelte';

  /**
   * The head of an object page (Object header): its name, its Key in a monospace font with a button
   * that copies it, and under it what the page puts there, such as its status row.
   */
  let { name, key, copyLabel, children }: { name: string; key: string; copyLabel: string; children?: Snippet } = $props();
</script>

<header class="head">
  <h1 class="page-title">{name}</h1>
  <div class="meta mono key">{key} <CopyButton text={key} label={copyLabel} /></div>
</header>
{@render children?.()}

<style>
  .head { margin-top: 8px; min-width: 0; }
  .key { display: block; margin-top: 4px; overflow-wrap: anywhere; }
</style>
