<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { dayOf, formatDay, isDay, SUGGESTED, suggestedOf } from '../lib/parameters.js';

  /**
   * The value of one Parameter of a Lens, as its page offers it (FR-LE-13): a date, or a function worked
   * out at every run, in one dropdown, each with the date it gives today; a value of its list for a Choice;
   * yes or no; or a number or text as typed. Only the value changes, never its kind or list (DEC-LE-01).
   */
  let {
    kind,
    value,
    list = [],
    label,
    onchange,
  }: {
    kind: 'date' | 'number' | 'decimal' | 'text' | 'choice' | 'several' | 'yesno';
    value: string | string[] | boolean;
    list?: readonly string[];
    /** The name Users see, for screen readers. */
    label: string;
    onchange: (value: string | string[] | boolean) => void;
  } = $props();

  let open = $state(false);
  let anchor = $state<HTMLElement | undefined>();
  const language = $derived(currentLanguage());

  /** A date or a function as it reads: a suggested function by its name, with the date it gives today. */
  const shown = $derived.by(() => {
    if (typeof value !== 'string') return { text: '', day: null as string | null, fn: false };
    if (isDay(value)) return { text: formatDay(value, language), day: null, fn: false };
    const suggested = suggestedOf(value);
    const day = dayOf(value);
    return { text: suggested ? t(suggested.label) : value, day: day ? formatDay(day, language) : null, fn: true };
  });

  function choose(next: string): void {
    onchange(next);
    open = false;
  }

  function outside(event: MouseEvent): void {
    if (open && anchor && !anchor.contains(event.target as Node)) open = false;
  }
</script>

<svelte:document onclick={outside} />

{#if kind === 'date'}
  <span class="anchor" bind:this={anchor}>
    <button type="button" class="pick" aria-haspopup="listbox" aria-expanded={open} aria-label={t('lens.value', { name: label })} onclick={() => (open = !open)} onkeydown={(event) => event.key === 'Escape' && (open = false)}>
      <span class="what">{#if shown.fn}<Icon name="function" />{/if}{shown.text}</span>{#if shown.day}<span class="day">{shown.day}</span>{/if}<Icon name="caret-down" />
    </button>
    {#if open}
      <div class="list" role="listbox" aria-label={label} tabindex="-1" onkeydown={(event) => event.key === 'Escape' && (open = false)}>
        <div class="group">{t('lens.value.date')}</div>
        <input type="date" aria-label={t('lens.value.date')} value={typeof value === 'string' && isDay(value) ? value : ''} onchange={(event) => event.currentTarget.value && choose(event.currentTarget.value)} />
        <div class="group">{t('lens.value.function')}</div>
        {#each SUGGESTED as suggested (suggested.key)}
          {@const day = dayOf(suggested.sql)}
          <button type="button" role="option" aria-selected={suggestedOf(String(value))?.key === suggested.key} class="option" onclick={() => choose(suggested.sql)}>
            <Icon name="function" /><span class="what">{t(suggested.label)}</span>{#if day}<span class="day">{formatDay(day, language)}</span>{/if}
          </button>
        {/each}
      </div>
    {/if}
  </span>
{:else if kind === 'choice'}
  <select aria-label={t('lens.value', { name: label })} value={String(value)} onchange={(event) => onchange(event.currentTarget.value)}>
    {#each list as item (item)}<option value={item}>{item}</option>{/each}
  </select>
{:else if kind === 'several'}
  <span class="several" role="group" aria-label={t('lens.value', { name: label })}>
    {#each list as item (item)}
      {@const chosen = Array.isArray(value) && value.includes(item)}
      <label class="check"
        ><input
          type="checkbox"
          checked={chosen}
          onchange={() => onchange(Array.isArray(value) ? (chosen ? value.filter((other) => other !== item) : list.filter((other) => other === item || value.includes(other))) : [item])}
        />{item}</label
      >
    {/each}
  </span>
{:else if kind === 'yesno'}
  <select aria-label={t('lens.value', { name: label })} value={value ? 'yes' : 'no'} onchange={(event) => onchange(event.currentTarget.value === 'yes')}>
    <option value="yes">{t('param.yes')}</option>
    <option value="no">{t('param.no')}</option>
  </select>
{:else}
  <input type="text" class="typed" aria-label={t('lens.value', { name: label })} value={String(value)} maxlength="1000" onchange={(event) => onchange(event.currentTarget.value.trim())} />
{/if}

<style>
  .anchor { position: relative; display: inline-block; }
  .pick { display: inline-flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 7px 10px; border-radius: var(--radius-field); background: var(--surface-solid);
    outline: 1px solid var(--tint-active); font: var(--text-small) var(--font-family); color: var(--text-primary); }
  .pick:focus-visible { outline: 2px solid var(--text-secondary); }
  .what { display: inline-flex; align-items: center; gap: 5px; }
  .day { color: var(--text-muted); font-size: var(--text-meta); }
  .list { position: absolute; left: 0; top: calc(100% + 6px); z-index: 6; width: 280px; padding: 8px; border-radius: var(--radius-md); background: var(--surface-solid);
    box-shadow: var(--sheet-shadow); outline: 1px solid var(--tint-active); display: grid; gap: 2px; }
  .group { font-size: var(--text-meta); color: var(--text-muted); padding: 6px 6px 2px; }
  .list input[type='date'] { margin: 0 6px 4px; padding: 5px 8px; border: 1px solid var(--tint-active); border-radius: var(--radius-field); font: var(--text-small) var(--font-family);
    color: var(--text-primary); background: var(--surface-solid); }
  .option { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-small); }
  .option .what { flex: 1; }
  .option:hover, .option:focus-visible, .option[aria-selected='true'] { background: var(--tint-hover); }
  select, .typed { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 7px 9px; }
  .several { display: inline-flex; flex-wrap: wrap; gap: 4px 12px; font-size: var(--text-small); }
  .check { display: inline-flex; align-items: center; gap: 5px; }
</style>
