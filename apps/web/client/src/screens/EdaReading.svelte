<script lang="ts">
  import type { OwnerReading, ResultView } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import { OWNER_READINGS } from '../lib/eda.js';

  /**
   * The reading of who works on the EDA, of one result (FR-ED-11): Expected, Known or A problem, kept with who gave it
   * and when, and changed with another click. Large with what each means under a result of its own, small on a row or
   * block of a result on several fields (DEC-UX-326).
   */
  let {
    yours,
    large = false,
    label,
    onread,
  }: {
    yours: ResultView['yours'];
    large?: boolean;
    /** What is read, for a screen reader, such as the field. */
    label: string;
    /** Keeps the reading; answers whether it was kept. */
    onread: (reading: OwnerReading) => Promise<boolean>;
  } = $props();

  let saving = $state(false);
  let failed = $state(false);

  async function read(reading: OwnerReading): Promise<void> {
    if (saving || yours?.reading === reading) return;
    saving = true;
    failed = false;
    failed = !(await onread(reading));
    saving = false;
  }
</script>

<div class="reading" class:large role="group" aria-label={label}>
  <span class="meta">{t('eda.yours')}</span>
  <div class="options">
    {#each OWNER_READINGS as option (option.reading)}
      <button type="button" class="option" class:on={yours?.reading === option.reading} aria-pressed={yours?.reading === option.reading} disabled={saving} onclick={() => read(option.reading)}>
        <Icon name={option.icon} /><b>{t(option.text)}</b>{#if large}<small>{t(option.means)}</small>{/if}
      </button>
    {/each}
  </div>
  {#if failed}
    <span class="meta failed" role="alert">{t('eda.yours.failed')}</span>
  {:else if yours}
    <span class="meta by">{t('eda.yours.by', { name: yours.by.name, date: day(yours.at, currentLanguage()) })}</span>
  {/if}
</div>

<style>
  .reading { display: flex; align-items: center; gap: 4px 6px; flex-wrap: wrap; }
  .large { display: block; }
  .options { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .large .options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
  .option { display: inline-flex; align-items: center; gap: 4px; font: var(--text-small) var(--font-family); color: var(--text-secondary); background: none; cursor: pointer;
    padding: 3px 8px; border-radius: var(--radius-pill); border: 1px solid var(--tint-active); }
  .option b { font-weight: var(--weight-regular); }
  .option:hover { color: var(--text-primary); }
  .option.on { color: var(--text-primary); background: var(--card); border-color: var(--text-secondary); }
  .option.on b { font-weight: var(--weight-medium); }
  .option:disabled { cursor: progress; }
  .large .option { display: grid; grid-template-columns: 20px 1fr; gap: 0 6px; align-items: start; text-align: left; padding: 10px 12px; border-radius: var(--radius-md);
    border: 0; background: var(--surface-solid); }
  .large .option :global(.icon) { grid-row: span 2; font-size: 16px; margin-top: 1px; }
  .large .option b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .large .option small { color: var(--text-muted); font-size: var(--text-meta); line-height: 1.4; }
  .large .option:hover { outline: 1.5px solid var(--text-secondary); outline-offset: -1.5px; }
  .large .option.on { outline: 1.5px solid var(--text-primary); outline-offset: -1.5px; }
  .by { margin-left: 4px; }
  .large .by, .large .failed { display: block; margin: 6px 0 0; }
  .failed { color: var(--signal-warn); }
</style>
