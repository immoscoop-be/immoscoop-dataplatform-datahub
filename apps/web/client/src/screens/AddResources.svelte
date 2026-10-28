<script lang="ts">
  import Search from '@datahub/ui/components/Search.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Steps from '@datahub/ui/containers/Steps.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Catalogue, Resource } from '../lib/catalogue.js';
  import { type Draft, draftOf, requestOf, strangers, unfinished } from '../lib/grain.js';
  import type { DomainModelView, Registry } from '../lib/registry.js';
  import ResourceGrain from './ResourceGrain.svelte';

  /** What adding came to: done, a Resource meanwhile in another Collection, refused, or a failure. */
  type Added = 'added' | 'elsewhere' | 'refused' | 'failed';

  /**
   * Adding Resources to a Collection, in a sheet over its page, in two steps named on top (FR-CO-31,
   * DEC-UX-58). First the Resources without a Collection, searchable, each with its description from
   * dbt, how it came in and its Level, to tick one or more. Then, in a wider sheet, per Resource how it
   * is stored, its grain and model type, and the mapping of every field, from what dbt and the Domain
   * Model propose (FR-CO-33, FR-CO-34). They are added, with all of it, in one go.
   */
  let {
    collection,
    waiting,
    catalogue,
    registry,
    onadd,
    onclose,
  }: {
    collection: string;
    waiting: readonly Resource[];
    catalogue: Catalogue;
    registry: Registry;
    onadd: (resources: ReturnType<typeof requestOf>[]) => Promise<{ outcome: Added; message?: string }>;
    onclose: () => void;
  } = $props();

  let step = $state(0);
  let query = $state('');
  let chosen: string[] = $state([]);
  let adding = $state(false);
  let problem: { outcome: Added; message?: string } | undefined = $state();

  /** The Domain Model: undefined while it comes, null when the collector did not answer (EC-AR-05). */
  let model: DomainModelView | null | undefined = $state();
  /** The draft of each Resource chosen, by its ID; null when it could not be read. */
  let drafts: Record<string, Draft | null> = $state({});
  let show: 'all' | 'mapped' = $state('all');

  const words = $derived(query.trim().toLowerCase());
  const shown = $derived(
    waiting.filter((resource) => !words || [resource.displayName, resource.description, resource.name].some((text) => text.toLowerCase().includes(words))),
  );

  function toggle(id: string) {
    chosen = chosen.includes(id) ? chosen.filter((other) => other !== id) : [...chosen, id];
  }

  function readModel() {
    model = undefined;
    registry.domainModel().then(
      (found) => (model = found),
      () => (model = null),
    );
  }

  /** The draft of a Resource: its fields from catalogue, what registry proposes, or its fields alone. */
  async function draft(resource: Resource) {
    try {
      const [detail, proposal] = await Promise.all([catalogue.resource(resource.id), registry.proposal(resource.nodeId).catch(() => null)]);
      drafts[resource.id] = draftOf(detail, proposal);
    } catch (error) {
      console.error(`${resource.displayName} could not be read`, error);
      drafts[resource.id] = null;
    }
  }

  function next() {
    step = 1;
    problem = undefined;
    if (model === undefined || model === null) {
      readModel();
    }
    for (const resource of waiting.filter((one) => chosen.includes(one.id))) {
      if (!(resource.id in drafts)) {
        draft(resource);
      }
    }
  }

  function retry() {
    readModel();
    for (const id of chosen) {
      const resource = waiting.find((one) => one.id === id);
      if (resource) {
        draft(resource);
      }
    }
  }

  const picked = $derived(chosen.flatMap((id) => (drafts[id] ? [drafts[id]] : [])));
  const loading = $derived(model === undefined || chosen.some((id) => !(id in drafts)));
  const unreadable = $derived(waiting.filter((resource) => chosen.includes(resource.id) && drafts[resource.id] === null));
  const identities = $derived(new Set(model?.identities ?? []));
  const open = $derived(picked.flatMap((one) => unfinished(one)));
  const counts = $derived({
    resources: picked.length,
    is: picked.flatMap((one) => one.fields).filter((field) => field.kind === 'is').length,
    relations: picked.flatMap((one) => one.fields).filter((field) => field.kind === 'relation' || field.kind === 'performedBy').length,
    strangers: model ? new Set(picked.flatMap((one) => strangers(one, identities))).size : 0,
  });
  const fieldCount = $derived(picked.reduce((sum, one) => sum + one.fields.length, 0));
  const mappedCount = $derived(picked.reduce((sum, one) => sum + one.fields.filter((field) => field.kind !== 'none').length, 0));

  async function add() {
    adding = true;
    problem = undefined;
    const outcome = await onadd(picked.map((one) => requestOf(one, identities)));
    adding = false;
    if (outcome.outcome !== 'added') {
      problem = outcome;
    }
  }
</script>

<Sheet title={step === 0 ? t('add.title', { name: collection }) : t('grain.title', { count: chosen.length })} wide={step === 1} {onclose}>
  {#snippet top()}
    <Steps label={t('add.steps')} steps={[t('add.step.choose'), t('add.step.grain')]} current={step} onstep={(index) => (step = index)} />
  {/snippet}
  {#snippet head()}<p class="meta text">{step === 0 ? t('add.text') : t('grain.text')}</p>{/snippet}
  {#if step === 0}
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
  {:else}
    {#if model}
      <p class="model">
        <Icon name="graph" />
        <span>{t('grain.model', { release: model.release })} <a class="text-link" href="https://colleciones-eventos.immoscoop.be/domain-model" target="_blank" rel="noopener">{t('grain.model.open')}</a></span>
      </p>
    {:else if model === null}
      <p class="model warn" role="alert">
        <Icon name="warning" />
        <span>{t('grain.model.missing')} <button type="button" class="text-link" onclick={retry}>{t('grain.model.retry')}</button></span>
      </p>
    {/if}
    <div class="filter">
      <span class="meta">{t('grain.show')}</span>
      <Segmented
        options={[
          { value: 'all', label: t('grain.show.all', { count: fieldCount }) },
          { value: 'mapped', label: t('grain.show.mapped', { count: mappedCount }) },
        ]}
        bind:value={show}
        label={t('grain.show')}
        surface="sub"
      />
    </div>
    <div class="list">
      {#if loading}
        <p class="meta empty">{t('grain.loading')}</p>
      {:else}
        {#each unreadable as resource (resource.id)}
          <p class="meta empty warn">{t('grain.failed', { name: resource.displayName })} <button type="button" class="text-link" onclick={retry}>{t('grain.model.retry')}</button></p>
        {/each}
        {#each chosen as id (id)}
          {#if drafts[id]}
            <ResourceGrain bind:draft={drafts[id]} model={model ?? null} {show} />
          {/if}
        {/each}
      {/if}
    </div>
  {/if}
  {#snippet foot()}
    {#if step === 0}
      <p class="meta chosen">{t('add.selected', { count: chosen.length })}</p>
      <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
      <Button disabled={chosen.length === 0} onclick={next}>{t('add.next')}<Icon name="arrow-right" /></Button>
    {:else}
      <Button variant="quiet" onclick={() => (step = 0)}><Icon name="arrow-left" />{t('grain.back')}</Button>
      <p class="meta chosen" role={problem ? 'alert' : undefined}>
        {#if problem?.outcome === 'elsewhere'}{t('add.elsewhere')}
        {:else if problem?.outcome === 'refused'}{problem.message ?? t('add.failed')}
        {:else if problem?.outcome === 'failed'}{t('add.failed')}
        {:else if open.length > 0}{t('grain.unfinished', { fields: open.join(', ') })}
        {:else}{t('grain.summary', counts)}{/if}
      </p>
      <Button disabled={adding || loading || unreadable.length > 0 || open.length > 0} onclick={add}><Icon name="plus-circle-fill" />{t('add.button', { count: chosen.length })}</Button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .text { display: block; margin-top: 6px; line-height: 1.5; }
  .search { margin-top: 14px; }
  .list { flex: 1; overflow: auto; margin: 12px -6px 0; padding: 0 6px; }
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
  .warn { color: var(--signal-warn); }
  .chosen { flex: 1; margin: 0; }
  .model { display: flex; gap: 10px; align-items: flex-start; margin: 8px 0 0; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .model :global(.icon) { font-size: 17px; margin-top: 1px; }
  .text-link { all: unset; margin-left: 4px; cursor: pointer; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .filter { display: inline-flex; align-self: flex-start; align-items: center; gap: 2px; margin-top: 12px; }
  .filter .meta { padding: 0 6px 0 2px; }
</style>
