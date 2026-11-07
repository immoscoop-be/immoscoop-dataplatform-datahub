<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import type { IconName } from '../foundations/icons.js';
  import { currentLanguage, t } from '../foundations/texts.svelte.js';

  /**
   * The pages of a result (Pager, FR-SR-51): which rows of how many, and the first, previous, next and
   * last page. A page is read from the same run, never a new query (DEC-SR-30).
   */
  let {
    page,
    size,
    total,
    busy = false,
    onpage,
  }: {
    /** From 1. */
    page: number;
    size: number;
    total: number;
    busy?: boolean;
    onpage: (page: number) => void;
  } = $props();

  const pages = $derived(Math.max(1, Math.ceil(total / size)));
  const number = (value: number) => new Intl.NumberFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(value);
  const from = $derived(total === 0 ? 0 : (page - 1) * size + 1);
  const to = $derived(Math.min(page * size, total));
  const steps: { icon: IconName; label: string; to: () => number; off: () => boolean }[] = [
    { icon: 'caret-double-left', label: 'pager.first', to: () => 1, off: () => page <= 1 },
    { icon: 'caret-left', label: 'pager.previous', to: () => page - 1, off: () => page <= 1 },
    { icon: 'caret-right', label: 'pager.next', to: () => page + 1, off: () => page >= pages },
    { icon: 'caret-double-right', label: 'pager.last', to: () => pages, off: () => page >= pages },
  ];
</script>

<span class="pager">
  <span class="meta">{t('pager.size', { size: number(size) })}</span>
  <span>{t('pager.rows', { from: number(from), to: number(to), total: number(total) })}</span>
  {#each steps as step (step.icon)}
    <button type="button" class="step" aria-label={t(step.label)} title={t(step.label)} disabled={busy || step.off()} onclick={() => onpage(step.to())}><Icon name={step.icon} /></button>
  {/each}
</span>

<style>
  .pager { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-meta); color: var(--text-secondary); }
  .meta { color: var(--text-muted); margin-right: 4px; }
  .step { width: 24px; height: 24px; border: 0; border-radius: var(--radius-sm); background: none; display: inline-flex; align-items: center; justify-content: center;
    color: var(--text-secondary); cursor: pointer; font-size: 13px; }
  .step:hover:not(:disabled) { background: var(--tint-hover); color: var(--text-primary); }
  .step:disabled { opacity: .35; cursor: default; }
  .step:focus-visible { outline: 2px solid var(--text-secondary); }
</style>
