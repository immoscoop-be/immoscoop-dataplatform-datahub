<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';

  /**
   * Where a text about a Resource is written, one quiet line says what it is for (DEC-UX-275): next to the
   * description from dbt, what the Business Description is for (DEC-RC-27); at the pitfalls and the Known Gaps, the
   * test that tells them apart (DEC-RC-26).
   */
  let { kind }: { kind: 'dbt' | 'gap' } = $props();
</script>

<p class="purpose">
  <Icon name="info" />
  <span>
    {#if kind === 'dbt'}
      <b>{t('purpose.dbt')}</b> {t('purpose.dbt.says')} <b>{t('purpose.business')}</b> {t('purpose.business.says')}
    {:else}
      <b>{t('purpose.gap')}</b> {t('purpose.gap.says')} <b>{t('purpose.pitfall')}</b> {t('purpose.pitfall.says')}
    {/if}
  </span>
</p>

<style>
  .purpose { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 14px; padding: 8px 12px; border-radius: var(--radius-md); border: 1px dashed var(--tint-active); font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .purpose :global(svg) { flex: none; margin-top: 3px; color: var(--text-muted); }
  b { font-weight: var(--weight-medium); color: var(--text-primary); }
</style>
