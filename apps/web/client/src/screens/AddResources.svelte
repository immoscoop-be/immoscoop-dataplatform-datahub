<script lang="ts">
  import Search from '@datahub/ui/components/Search.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Resource } from '../lib/catalogue.js';

  /** What adding came to: done, a Resource meanwhile in another Collection, or a failure. */
  type Added = 'added' | 'elsewhere' | 'failed';

  /**
   * Adding Resources to a Collection, in a sheet over its page (FR-CO-31, DEC-UX-58): the Resources
   * without a Collection, searchable, each with its description from dbt, how it came in and its
   * Level, to tick one or more. A Resource is in one Collection at most, so only those without one
   * appear. The second step, their grain and relations (FR-CO-33, FR-CO-34), comes next; until then
   * the ones ticked are added from here.
   */
  let {
    collection,
    waiting,
    onadd,
    onclose,
  }: { collection: string; waiting: readonly Resource[]; onadd: (ids: string[]) => Promise<Added>; onclose: () => void } = $props();

  let query = $state('');
  let chosen: string[] = $state([]);
  let adding = $state(false);
  let problem: Added | undefined = $state();

  const words = $derived(query.trim().toLowerCase());
  const shown = $derived(
    waiting.filter((resource) => !words || [resource.displayName, resource.description, resource.name].some((text) => text.toLowerCase().includes(words))),
  );

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id];
  }

  async function add() {
    adding = true;
    problem = undefined;
    const outcome = await onadd(chosen);
    adding = false;
    if (outcome !== 'added') {
      problem = outcome;
    }
  }
</script>

<Sheet title={t('add.title', { name: collection })} {onclose}>
  {#snippet head()}<p class="meta text">{t('add.text')}</p>{/snippet}
  <div class="search"><Search bind:value={query} placeholder={t('add.search')} surface="sub" /></div>
  <div class="list">
    {#each shown as resource (resource.id)}
      {@const on = chosen.includes(resource.id)}
      <label class="pick" class:on>
        <input type="checkbox" checked={on} onchange={() => toggle(resource.id)} />
        <span class="what">
          <span class="line">
            <span class="kind"><KindIcon kind="resource" /></span>
            <span class="item-title name">{resource.displayName}</span>
            <span class="level"><MaturityIcon level={resource.level} tooltip={false} />{levelName(resource.level)}</span>
          </span>
          {#if resource.description.trim()}<span class="description">{resource.description}</span>{/if}
          <span class="meta came">{t('add.came', { date: day(resource.registeredAt, currentLanguage()), exposure: resource.exposures[0] ?? '' })}</span>
        </span>
      </label>
    {:else}
      <p class="meta empty">{t(words ? 'add.noMatch' : 'add.none')}</p>
    {/each}
  </div>
  {#snippet foot()}
    <p class="meta chosen" role={problem ? 'alert' : undefined}>
      {problem === 'elsewhere' ? t('add.elsewhere') : problem === 'failed' ? t('add.failed') : t('add.selected', { count: chosen.length })}
    </p>
    <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
    <Button disabled={chosen.length === 0 || adding} onclick={add}>{t('add.button', { count: chosen.length })}</Button>
  {/snippet}
</Sheet>

<style>
  .text { display: block; margin-top: 6px; line-height: 1.5; }
  .search { margin-top: 14px; }
  .list { flex: 1; overflow: auto; margin: 12px -6px 0; }
  .pick { display: flex; gap: 12px; padding: 12px 10px; border-radius: var(--radius-md); cursor: pointer; }
  .pick:hover { background: var(--tint-hover); }
  .pick.on { background: var(--surface-sub); }
  input { margin-top: 3px; accent-color: var(--text-primary); }
  .what { flex: 1; min-width: 0; }
  .line { display: flex; align-items: center; gap: 8px; }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; font-size: var(--text-small); }
  .description { display: block; margin-top: 4px; font-size: var(--text-small); color: var(--text-secondary); line-height: 1.5; }
  .came { margin-top: 4px; }
  .empty { padding: 12px 10px; }
  .chosen { flex: 1; margin: 0; }
</style>
