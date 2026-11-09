<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /** Where a value comes from: dbt, the Owner or the Data Team (DEC-UX-61). */
  let { origin }: { origin: 'dbt' | 'owner' | 'dataTeam' } = $props();

  const KEYS = { dbt: 'origin.dbt', owner: 'origin.owner', dataTeam: 'origin.dataTeam' } as const;
</script>

<span class="origin">{t(KEYS[origin])}</span>

<style>
  .origin { font-size: 10px; color: var(--text-muted); background: var(--card); padding: 1px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
</style>
