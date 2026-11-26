<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * Where a value comes from: dbt, the Owner or the Data Team (DEC-UX-61). dbt is a term of the dictionary: given the
   * marker of its explanation, the tag carries it after its text (DEC-UX-340).
   */
  let { origin, mark }: { origin: 'dbt' | 'owner' | 'dataTeam'; mark?: Snippet | undefined } = $props();

  const KEYS = { dbt: 'origin.dbt', owner: 'origin.owner', dataTeam: 'origin.dataTeam' } as const;
</script>

<span class="origin">{t(KEYS[origin])}{@render mark?.()}</span>

<style>
  .origin { font-size: 10px; color: var(--text-muted); background: var(--card); padding: 1px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
</style>
