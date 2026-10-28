<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { type Draft, recordedDraftOf, requestOf, strangers, unfinished } from '../lib/grain.js';
  import type { DomainModelView, Registry } from '../lib/registry.js';
  import ResourceGrain from './ResourceGrain.svelte';

  /**
   * Edit relations (DEC-UX-107): step 2 of adding Resources, for this one Resource, from what was recorded
   * when it was added. A Data Admin changes how it is stored, its grain and model type, and the mapping of
   * its fields, and saves them in one go; the change goes into its Log.
   */
  let {
    resource,
    registry,
    onsave,
    onclose,
  }: {
    resource: ResourceDetail;
    registry: Registry;
    onsave: (details: Record<string, unknown>) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  // The sheet opens afresh each time: it starts from the Resource as it was when it opened.
  let draft: Draft = $state(untrack(() => recordedDraftOf(resource)));
  let show: 'all' | 'mapped' = $state('all');
  let saving = $state(false);
  let failed = $state(false);

  /** The Domain Model: undefined while it comes, null when the collector did not answer (EC-AR-05). */
  let model: DomainModelView | null | undefined = $state();
  function readModel() {
    model = undefined;
    registry.domainModel().then(
      (found) => (model = found),
      () => (model = null),
    );
  }
  readModel();

  const identities = $derived(new Set(model?.identities ?? []));
  const open = $derived(unfinished(draft));
  const mappedCount = $derived(draft.fields.filter((field) => field.kind !== 'none').length);
  const counts = $derived({
    resources: 1,
    is: draft.fields.filter((field) => field.kind === 'is').length,
    relations: draft.fields.filter((field) => field.kind === 'relation' || field.kind === 'performedBy').length,
    strangers: model ? strangers(draft, identities).length : 0,
  });

  async function save() {
    saving = true;
    failed = false;
    const { id: _, ...details } = requestOf(draft, identities);
    failed = !(await onsave(details));
    saving = false;
  }
</script>

<Sheet title={t('relations.title', { name: resource.displayName })} wide {onclose}>
  {#snippet head()}<p class="meta text">{t('grain.text')}</p>{/snippet}
  {#if model}
    <p class="model">
      <Icon name="graph" />
      <span>{t('grain.model', { release: model.release })} <a class="text-link" href="https://colleciones-eventos.immoscoop.be/domain-model" target="_blank" rel="noopener">{t('grain.model.open')}</a></span>
    </p>
  {:else if model === null}
    <p class="model warn" role="alert">
      <Icon name="warning" />
      <span>{t('grain.model.missing')} <button type="button" class="text-link" onclick={readModel}>{t('grain.model.retry')}</button></span>
    </p>
  {/if}
  <div class="filter">
    <span class="meta">{t('grain.show')}</span>
    <Segmented
      options={[
        { value: 'all', label: t('grain.show.all', { count: draft.fields.length }) },
        { value: 'mapped', label: t('grain.show.mapped', { count: mappedCount }) },
      ]}
      bind:value={show}
      label={t('grain.show')}
      surface="sub"
    />
  </div>
  <div class="list">
    {#if model === undefined}
      <p class="meta empty">{t('grain.loading')}</p>
    {:else}
      <ResourceGrain bind:draft model={model ?? null} {show} />
    {/if}
  </div>
  {#snippet foot()}
    <p class="meta chosen" role={failed ? 'alert' : undefined}>
      {#if failed}{t('resource.saveFailed')}
      {:else if open.length > 0}{t('grain.unfinished', { fields: open.join(', ') })}
      {:else}{t('grain.summary', counts)}{/if}
    </p>
    <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
    <Button disabled={saving || model === undefined || open.length > 0} onclick={save}>{t('collection.save')}</Button>
  {/snippet}
</Sheet>

<style>
  .text { display: block; margin-top: 6px; line-height: 1.5; }
  .list { flex: 1; overflow: auto; margin: 12px -6px 0; padding: 0 6px; }
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
