<script lang="ts">
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { joins, type Said } from '../lib/edaWords.js';

  /** A sentence of a result said in parts: the lead in bold, the names in it as names (NFR-LOC-03). */
  let { parts }: { parts: readonly Said[] } = $props();
</script>

{#each parts as part, index (index)}{#if index > 0 && !joins(t(part.key, { ...part.values, ...part.names }))}{' '}{/if}{#if index === 0}<b><Sentence key={part.key} values={part.values} names={part.names} /></b>{:else if part.warn}<span class="warn"><Sentence key={part.key} values={part.values} names={part.names} /></span>{:else}<Sentence key={part.key} values={part.values} names={part.names} />{/if}{/each}

<style>
  b { font-weight: var(--weight-medium); }
  .warn { color: var(--signal-warn); }
</style>
