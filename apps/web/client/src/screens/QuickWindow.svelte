<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { firstActive, type QuickGroup, type QuickRow, rowsFor, stepFrom } from '../lib/quick.js';

  /**
   * The quick window (DEC-UX-237): Cmd+Shift+P or Cmd+K anywhere in Data Hub. It floats over the upper part of the
   * window, the page lightly dimmed. On top the search, with where it opened on its right. Empty, it lists the commands
   * of the screen, the flagged queries and Go to; typed, it searches those and everything the User may see, grouped by
   * kind, four at most a kind (OP-UX-88). Up and Down move, Enter does the row, Escape or a click beside it closes it.
   * What cannot be done right now is greyed, with why under it, and Enter never does it (DEC-UX-207).
   */
  let {
    where,
    screenGroup,
    rows,
    findQueries,
    onclose,
  }: {
    /** Where it opened, such as "Query · Leads per source name". */
    where: string | null;
    /** The name of the group of the commands of the screen, such as This query. */
    screenGroup: string;
    /** Every row it can show: commands, flagged queries, places and what the User may see. */
    rows: readonly QuickRow[];
    /** The User's own queries matching words, read from query as they type. */
    findQueries?: (words: string) => Promise<QuickRow[]>;
    onclose: () => void;
  } = $props();

  const GROUPS: Record<Exclude<QuickGroup, 'screen'>, string> = {
    commands: 'quick.group.commands',
    flagged: 'quick.group.flagged',
    resources: 'quick.group.resources',
    collections: 'quick.group.collections',
    lenses: 'quick.group.lenses',
    queries: 'quick.group.queries',
    cards: 'quick.group.cards',
    goTo: 'quick.group.goTo',
  };
  const groupName = (group: QuickGroup) => (group === 'screen' ? screenGroup : t(GROUPS[group]));

  let typed = $state('');
  let input = $state<HTMLInputElement | undefined>();
  /** The queries found for the words typed last, once query answered. */
  let queries = $state<{ words: string; rows: QuickRow[] } | null>(null);
  const shown = $derived(rowsFor([...rows, ...(queries && queries.words === typed.trim() ? queries.rows : [])], typed));
  let on = $state(-1);
  $effect(() => {
    on = firstActive(shown);
  });
  const active = $derived(on >= 0 ? shown[on] : undefined);
  const DOES = { do: 'quick.do', open: 'quick.open', go: 'quick.go' } as const;

  $effect(() => {
    input?.focus();
  });
  // Their own queries, once typing pauses.
  $effect(() => {
    const words = typed.trim();
    if (!findQueries || words.length < 2) return;
    const timer = setTimeout(() => {
      findQueries(words).then(
        (found) => typed.trim() === words && (queries = { words, rows: found }),
        (error: unknown) => console.error('The queries could not be searched', error),
      );
    }, 200);
    return () => clearTimeout(timer);
  });

  function run(row: QuickRow | undefined): void {
    if (!row || row.why) return;
    onclose();
    row.run();
  }
  function keydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      on = stepFrom(shown, on, event.key === 'ArrowDown' ? 1 : -1);
      document.getElementById(`quick-row-${on}`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
    }
  }
</script>

<!-- A click beside the window closes it; the keyboard closes it with Escape. -->
<div class="backdrop" role="presentation" onclick={onclose}></div>
<div class="quick" role="dialog" aria-modal="true" aria-label={t('quick.title')}>
  <div class="head">
    <Icon name="magnifying-glass" />
    <input
      {...NO_PASSWORD_MANAGER}
      bind:this={input}
      bind:value={typed}
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-controls="quick-list"
      aria-activedescendant={on >= 0 ? `quick-row-${on}` : undefined}
      aria-label={t('quick.title')}
      placeholder={t('quick.placeholder')}
      onkeydown={keydown}
    />
    {#if where}<span class="where">{where}</span>{/if}
  </div>
  <div class="list" id="quick-list" role="listbox" aria-label={t('quick.list')}>
    {#each shown as row, at (row.key)}
      {#if at === 0 || shown[at - 1]?.group !== row.group}
        <div class="group" role="presentation">{groupName(row.group)}</div>
      {/if}
      <div
        class="row"
        class:on={at === on}
        id={`quick-row-${at}`}
        role="option"
        aria-selected={at === on}
        aria-disabled={row.why ? 'true' : undefined}
        tabindex="-1"
        onmousemove={() => !row.why && on !== at && (on = at)}
        onclick={() => run(row)}
        onkeydown={keydown}
      >
        <span class="icon"><Icon name={row.icon} /></span>
        <span class="title">{row.title}</span>
        <span class="meta">{row.meta ?? ''}</span>
        {#if row.keys}<span class="kbd">{row.keys}</span>{/if}
        <span class="kind">{row.kind}</span>
      </div>
      {#if row.why}<div class="why">{row.why}</div>{/if}
    {:else}
      <p class="none">{t('quick.none', { words: typed.trim() })}</p>
    {/each}
  </div>
  <div class="foot">
    <span class="meta">↑↓ {t('quick.move')}</span>
    {#if active}<span class="act">{t(DOES[active.does])}</span><span class="kbd">↵</span><span class="sep"></span>{/if}
    <span>{t('quick.close')}</span><span class="kbd">esc</span>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 40; background: var(--quick-backdrop); }
  .quick { position: fixed; z-index: 41; top: 12vh; left: 50%; transform: translateX(-50%); width: min(720px, calc(100vw - 48px)); max-height: 70vh; display: flex; flex-direction: column;
    border-radius: var(--radius-xl); background: var(--glass-solid); -webkit-backdrop-filter: var(--blur-glass); backdrop-filter: var(--blur-glass); outline: 1px solid var(--glass-edge); box-shadow: var(--glass-shadow); overflow: hidden; }
  .head { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--tint-active); color: var(--text-muted); font-size: 18px; }
  .head input { all: unset; flex: 1; min-width: 0; font: 17px var(--font-family); color: var(--text-primary); }
  .head input::placeholder { color: var(--text-muted); }
  .where { font-size: var(--text-meta); color: var(--text-secondary); background: var(--tint-hover); border-radius: var(--radius-pill); padding: 3px 10px; white-space: nowrap; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
  .list { flex: 1; overflow: auto; padding: 6px 8px 8px; }
  .group { font-size: var(--text-meta); color: var(--text-muted); padding: 10px 12px 4px; }
  .row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: var(--radius-md); cursor: pointer; color: var(--text-primary); outline: none; }
  .row.on { background: var(--tint-active); }
  .row[aria-disabled='true'] { cursor: default; color: var(--text-muted); }
  .icon { display: inline-flex; width: 20px; justify-content: center; font-size: 17px; color: var(--text-secondary); flex: none; }
  .row[aria-disabled='true'] .icon { color: var(--text-muted); }
  .title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; max-width: 60%; }
  .meta { color: var(--text-muted); font-size: var(--text-small); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  .kind { color: var(--text-muted); font-size: var(--text-small); white-space: nowrap; flex: none; }
  .kbd { font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-muted); background: var(--tint-hover); border-radius: var(--radius-mark); padding: 1px 5px; white-space: nowrap; flex: none; }
  .why { font-size: var(--text-small); color: var(--text-muted); padding: 0 12px 6px 44px; }
  .none { padding: 22px 12px; margin: 0; color: var(--text-muted); text-align: center; }
  .foot { display: flex; align-items: center; gap: 10px; padding: 9px 14px 9px 20px; border-top: 1px solid var(--tint-active); font-size: var(--text-small); color: var(--text-secondary); }
  .foot .meta { flex: 1; }
  .act { font-weight: var(--weight-medium); color: var(--text-primary); }
  .sep { width: 1px; height: 16px; background: var(--tint-active); }
</style>
