<script lang="ts">
  import type { GapScope } from '@datahub/contracts/gaps';
  import { hasScope } from '@datahub/contracts/gaps';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import type { Field, KnownGap } from '../lib/catalogue.js';
  import GapForm from './GapForm.svelte';
  import GapScopeView from './GapScope.svelte';

  /**
   * The Known Gaps of a Resource, a part of its Overview (FR-RC-21, DEC-UX-170): a list, one gap per line, each with
   * who added it and when, and where it holds as chips: a period, fields and rows (FR-RC-24, DEC-UX-177). Its Owner
   * Unit and the Data Team add a gap from the line at the bottom, which opens a form, and change or remove one on its
   * own line, without editing the others; every change goes into its Log. The why is plain text.
   */
  let {
    gaps,
    fields,
    canEdit,
    onadd,
    onchange,
    onremove,
  }: {
    gaps: readonly KnownGap[];
    /** The fields of the Resource, to narrow a gap down by. */
    fields: readonly Field[];
    canEdit: boolean;
    /** Each answers whether it worked. */
    onadd: (text: string, scope: GapScope | null) => Promise<boolean>;
    onchange: (gap: KnownGap, text: string, scope: GapScope | null) => Promise<boolean>;
    onremove: (gap: KnownGap) => Promise<boolean>;
  } = $props();

  let adding = $state(false);
  let changing: string | undefined = $state();
  let busy = $state(false);
  let failed = $state(false);

  const known = $derived(new Set(fields.map((field) => field.name)));
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

  async function add(text: string, scope: GapScope | null) {
    if (await attempt(() => onadd(text, scope))) adding = false;
  }

  async function save(gap: KnownGap, text: string, scope: GapScope | null) {
    const same = text === gap.text && JSON.stringify(scope) === JSON.stringify(hasScope(gap.scope) ? gap.scope : null);
    if (same || (await attempt(() => onchange(gap, text, scope)))) changing = undefined;
  }
</script>

{#if gaps.length > 0}
  <ul class="gaps">
    {#each gaps as gap (gap.id)}
      <li class="gap" class:open={changing === gap.id}>
        {#if changing === gap.id}
          <div class="body">
            <GapForm
              text={gap.text}
              scope={gap.scope}
              {fields}
              {busy}
              label={t('gaps.change')}
              saveLabel={t('collection.save')}
              onsave={(text, scope) => save(gap, text, scope)}
              oncancel={() => (changing = undefined)}
            />
          </div>
        {:else}
          <Icon name="circle-dashed-fill" />
          <div class="body">
            <p>{gap.text}</p>
            {#if hasScope(gap.scope)}<GapScopeView scope={gap.scope} {known} />{/if}
            {#if gap.addedBy && gap.addedAt}<span class="meta">{t('gaps.addedBy', { name: gap.addedBy, date: day(gap.addedAt) })}</span>{/if}
          </div>
          {#if canEdit}
            <span class="tools">
              <IconButton
                icon="pencil-simple-line"
                label={t('gaps.change')}
                onclick={() => {
                  adding = false;
                  changing = gap.id;
                }}
              />
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
  {#if adding}
    <div class="adding">
      <GapForm {fields} {busy} label={t('gaps.new')} saveLabel={t('gaps.add')} onsave={add} oncancel={() => (adding = false)} />
    </div>
  {:else}
    <button
      type="button"
      class="add"
      onclick={() => {
        changing = undefined;
        adding = true;
      }}><Icon name="plus" /><span>{t('gaps.placeholder')}</span><span class="add-word">{t('gaps.add')}</span></button
    >
  {/if}
  {#if failed}<p class="failed" role="alert">{t('gaps.failed')}</p>{/if}
  <p class="help">{t('gaps.help')}</p>
{/if}

<style>
  .gaps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .gap { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .gap.open { padding: 0; background: none; }
  .gap > :global(.icon) { color: var(--text-muted); margin-top: 3px; flex: none; }
  .body { flex: 1; min-width: 0; }
  .body p { margin: 0 0 4px; font-size: var(--text-small); line-height: 1.55; color: var(--text-primary); white-space: pre-line; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .tools { display: flex; gap: 2px; flex: none; opacity: 0; }
  .gap:hover .tools, .gap:focus-within .tools { opacity: 1; }
  .adding { margin-top: 6px; }
  .add { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 10px; margin-top: 6px; padding: 10px 14px; border-radius: var(--radius-md); outline: 1px dashed var(--tint-active); font-size: var(--text-small); color: var(--text-muted); cursor: text; }
  .add > :global(.icon) { flex: none; }
  .add > span:first-of-type { flex: 1; min-width: 0; }
  .add-word { color: var(--text-secondary); font-weight: var(--weight-medium); }
  .add:hover { outline-color: var(--text-muted); }
  .add:focus-visible { outline: 2px solid var(--text-secondary); }
  .empty { margin: 0; font-size: var(--text-small); color: var(--text-muted); line-height: 1.5; }
  .help { margin: 8px 0 0; font-size: var(--text-meta); color: var(--text-muted); line-height: 1.5; }
  .failed { margin: 8px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>
