<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import type { KnownGap } from '../lib/catalogue.js';

  /**
   * The Known Gaps of a Resource, a part of its Overview (FR-RC-21, DEC-UX-170): a list, one gap per line, each with
   * who added it and when. Its Owner Unit and the Data Team add a gap in the line at the bottom, and change or remove
   * one on its own line, without editing the others; every change goes into its Log. Plain text.
   */
  let {
    gaps,
    canEdit,
    onadd,
    onchange,
    onremove,
  }: {
    gaps: readonly KnownGap[];
    canEdit: boolean;
    /** Each answers whether it worked. */
    onadd: (text: string) => Promise<boolean>;
    onchange: (gap: KnownGap, text: string) => Promise<boolean>;
    onremove: (gap: KnownGap) => Promise<boolean>;
  } = $props();

  const MAX = 1000;
  let fresh = $state('');
  let changing: { id: string; text: string } | undefined = $state();
  let busy = $state(false);
  let failed = $state(false);

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (at: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(at));

  async function attempt(work: () => Promise<boolean>): Promise<boolean> {
    busy = true;
    failed = false;
    const done = await work();
    busy = false;
    failed = !done;
    return done;
  }

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const text = fresh.trim();
    if (!text) return;
    if (await attempt(() => onadd(text))) fresh = '';
  }

  async function save(event: SubmitEvent, gap: KnownGap) {
    event.preventDefault();
    const text = changing?.text.trim() ?? '';
    if (!text) return;
    if (text === gap.text || (await attempt(() => onchange(gap, text)))) changing = undefined;
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      changing = undefined;
    }
  }
</script>

{#if gaps.length > 0}
  <ul class="gaps">
    {#each gaps as gap (gap.id)}
      <li class="gap">
        <Icon name="circle-dashed-fill" />
        {#if changing?.id === gap.id}
          <form class="change" onsubmit={(event) => save(event, gap)}>
            <textarea bind:value={changing.text} rows="2" maxlength={MAX} aria-label={t('gaps.change')} onkeydown={keydown}></textarea>
            <span class="actions">
              <Button type="submit" disabled={busy || !changing.text.trim()}>{t('collection.save')}</Button>
              <Button variant="quiet" onclick={() => (changing = undefined)}>{t('collection.cancel')}</Button>
            </span>
          </form>
        {:else}
          <div class="body">
            <p>{gap.text}</p>
            {#if gap.addedBy && gap.addedAt}<span class="meta">{t('gaps.addedBy', { name: gap.addedBy, date: day(gap.addedAt) })}</span>{/if}
          </div>
          {#if canEdit}
            <span class="tools">
              <IconButton icon="pencil-simple-line" label={t('gaps.change')} onclick={() => (changing = { id: gap.id, text: gap.text })} />
              <IconButton icon="trash" label={t('gaps.remove')} disabled={busy} onclick={() => attempt(() => onremove(gap))} />
            </span>
          {/if}
        {/if}
      </li>
    {/each}
  </ul>
{:else}
  <p class="empty">{t('gaps.none')}</p>
{/if}

{#if canEdit}
  <form class="add" onsubmit={add}>
    <Icon name="plus" />
    <input type="text" bind:value={fresh} maxlength={MAX} placeholder={t('gaps.placeholder')} aria-label={t('gaps.new')} />
    <Button variant="outline" type="submit" disabled={busy || !fresh.trim()}>{t('gaps.add')}</Button>
  </form>
  {#if failed}<p class="failed" role="alert">{t('gaps.failed')}</p>{/if}
  <p class="help">{t('gaps.help')}</p>
{/if}

<style>
  .gaps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .gap { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .gap > :global(.icon) { color: var(--text-muted); margin-top: 3px; flex: none; }
  .body { flex: 1; min-width: 0; }
  .body p { margin: 0 0 4px; font-size: var(--text-small); line-height: 1.55; color: var(--text-primary); white-space: pre-line; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .tools { display: flex; gap: 2px; flex: none; opacity: 0; }
  .gap:hover .tools, .gap:focus-within .tools { opacity: 1; }
  .change { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .actions { display: flex; gap: 8px; }
  textarea, input { box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); }
  textarea { width: 100%; background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .add { display: flex; align-items: center; gap: 10px; margin-top: 6px; padding: 6px 6px 6px 14px; border-radius: var(--radius-md); outline: 1px dashed var(--tint-active); }
  .add > :global(.icon) { color: var(--text-muted); flex: none; }
  .add:focus-within { outline: 2px solid var(--text-secondary); }
  .add input { flex: 1; min-width: 0; border: 0; background: none; padding: 6px 0; }
  .add input:focus { outline: none; }
  .empty { margin: 0; font-size: var(--text-small); color: var(--text-muted); line-height: 1.5; }
  .help { margin: 8px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .failed { margin: 8px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>
