<script lang="ts">
  import type { DisguisedLists } from '@datahub/contracts/eda';
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { type DisguisedKind, withoutValue, withValue } from '../lib/eda.js';

  /**
   * What Disguised nulls looks for, per kind of field (DEC-ED-35): Data Hub's list, kept per EDA as the parameters of the
   * EDA-Probe. In a text the empty text and only spaces always, then the values of its list; in a date its days; in a
   * number its numbers and nines only. A value of a list is taken out with its cross, and one is added by typing it:
   * Enter adds it, Escape stops. What changes goes with the next run.
   */
  let { lists, onchange }: { lists: DisguisedLists; onchange: (lists: DisguisedLists) => void } = $props();

  /** The kind a value is being typed for, what is typed, and why it was not added. */
  let adding = $state<DisguisedKind | null>(null);
  /** What is typed: a number field binds a number, or nothing while it is empty. */
  let typed = $state<string | number | null | undefined>('');
  let zero = $state(false);

  const KINDS: readonly { kind: DisguisedKind; label: string; add: string; type: 'text' | 'date' | 'number' }[] = [
    { kind: 'text', label: 'eda.params.disguised.text', add: 'eda.params.disguised.addValue', type: 'text' },
    { kind: 'date', label: 'eda.params.disguised.date', add: 'eda.params.addDate', type: 'date' },
    { kind: 'number', label: 'eda.params.disguised.number', add: 'eda.params.disguised.addNumber', type: 'number' },
  ];
  const valuesOf = (kind: DisguisedKind): (string | number)[] => (kind === 'text' ? lists.text : kind === 'date' ? lists.date : lists.number);

  function open(kind: DisguisedKind): void {
    adding = kind;
    typed = '';
    zero = false;
  }

  /** Adds what is typed; answers whether the field may close. */
  function add(): boolean {
    if (!adding) return true;
    const next = withValue(lists, adding, String(typed ?? ''));
    if (next === 'zero') {
      zero = true;
      return false;
    }
    if (next) onchange(next);
    typed = '';
    zero = false;
    return true;
  }

  function key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      adding = null;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      add();
    }
  }

  /** Leaving the field adds what is typed, and closes it. */
  function leave(): void {
    add();
    adding = null;
    zero = false;
  }

  const focus = (input: HTMLInputElement) => input.focus();
</script>

{#each KINDS as one (one.kind)}
  <span class="kind">{t(one.label)}</span>
  <span class="row">
    {#if one.kind === 'text'}
      <span class="lk fixed"><span class="word">{t('eda.disguised.emptyText')}</span></span>
      <span class="lk fixed"><span class="word">{t('eda.disguised.spaces')}</span></span>
    {/if}
    {#each valuesOf(one.kind) as value, index (index)}
      <span class="lk"><span class="mono">{value}</span><button type="button" class="x" aria-label={t('eda.params.disguised.remove', { value: String(value) })} onclick={() => onchange(withoutValue(lists, one.kind, value))}><Icon name="x" /></button></span>
    {/each}
    {#if one.kind === 'number'}
      {#if lists.ninesOnly}
        <span class="lk" title={t('eda.params.disguised.nines')}><span class="mono">999…9</span><button type="button" class="x" aria-label={t('eda.params.disguised.remove', { value: '999…9' })} onclick={() => onchange({ ...lists, ninesOnly: false })}><Icon name="x" /></button></span>
      {:else}
        <button type="button" class="lk off" title={t('eda.params.disguised.nines')} aria-label={t('eda.params.disguised.ninesBack')} onclick={() => onchange({ ...lists, ninesOnly: true })}><Icon name="plus" /><span class="mono">999…9</span></button>
      {/if}
    {/if}
    {#if adding === one.kind}
      <input
        {...NO_PASSWORD_MANAGER}
        class="typed"
        type={one.type}
        step={one.type === 'number' ? 'any' : undefined}
        aria-label={t('eda.params.disguised.typed', { kind: one.kind })}
        bind:value={typed}
        {@attach focus}
        onkeydown={key}
        onblur={leave}
      />
    {:else}
      <button type="button" class="add" onclick={() => open(one.kind)}><Icon name="plus" />{t(one.add)}</button>
    {/if}
  </span>
  {#if adding === one.kind && zero}<span class="zero" role="status">{t('eda.params.disguised.zero')}</span>{/if}
{/each}
<small>{t('eda.params.disguised.about')}</small>

<style>
  .kind { display: block; margin: 8px 0 4px; font-size: var(--text-meta); color: var(--text-muted); }
  .kind:first-child { margin-top: 0; }
  .row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
  .lk { display: inline-flex; gap: 4px; align-items: center; padding: 2px 7px; border-radius: var(--radius-pill); background: var(--surface-solid); font-size: var(--text-meta); color: var(--text-primary); }
  .lk .word { font-style: italic; color: var(--text-secondary); }
  .x { display: inline-grid; place-items: center; border: 0; background: none; cursor: pointer; padding: 0; font-size: 10px; color: var(--text-muted); }
  .x:hover { color: var(--text-primary); }
  .off { border: 1px dashed var(--tint-active); background: none; cursor: pointer; font: var(--text-meta) var(--font-family); color: var(--text-muted); }
  .off :global(.icon) { font-size: 10px; }
  .off:hover { color: var(--text-primary); }
  .add { display: inline-flex; gap: 3px; align-items: center; border: 0; background: none; cursor: pointer; padding: 2px 4px; font: var(--text-meta) var(--font-family); color: var(--text-secondary);
    text-decoration: underline; text-underline-offset: 3px; }
  .add:hover { color: var(--text-primary); }
  .typed { width: 120px; padding: 1px 6px; border-radius: var(--radius-sm); border: 1px solid var(--tint-active); background: var(--surface-solid); font: var(--text-meta) var(--font-family);
    color: var(--text-primary); }
  .zero { display: block; margin-top: 4px; font-size: var(--text-meta); color: var(--signal-warn); }
  small { display: block; color: var(--text-muted); font-size: var(--text-meta); margin-top: 6px; }
</style>
