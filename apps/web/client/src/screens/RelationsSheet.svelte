<script lang="ts" module>
  /**
   * Where the steps open: at the model type, by "Edit relations" and "Complete it", or to change it, by "Change model
   * type", which waits for another one; or at the fields, by "Choose another field" (DEC-CO-27, DEC-UX-263, DEC-UX-264).
   */
  export type RelationsStart = 'type' | 'change' | 'fields';
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Steps from '@datahub/ui/containers/Steps.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { ModelType } from '@datahub/contracts/model-types';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { type Draft, missingOf, recordedDraftOf, requestOf, strangers, suggestTypeFields, unfinished } from '../lib/grain.js';
  import type { DomainModelView, Registry } from '../lib/registry.js';
  import { TYPE_KEYS, waitingFor } from '../lib/typeFields.js';
  import ResourceFields from './ResourceFields.svelte';
  import ResourceGrain from './ResourceGrain.svelte';
  import ResourceType from './ResourceType.svelte';

  /**
   * Edit relations (DEC-UX-107, DEC-CO-27): the steps of adding a Resource from its model type on, for this one
   * Resource, from what was recorded: its model type, its grain and storage, then the fields its model type asks for and
   * the mapping of every field. A Data Admin changes them and saves them in one go; the change goes into its Log.
   * Changing the model type drops the fields of the old one, and its EDA is revalidated (DEC-RC-22). "Save" waits
   * until the model type has every field it asks for, as adding does (FR-CO-44).
   */
  let {
    resource,
    registry,
    start = 'type',
    assigns = true,
    onsave,
    onclose,
  }: {
    resource: ResourceDetail;
    registry: Registry;
    start?: RelationsStart;
    /**
     * Whether the viewer may assign (resources.assign). Who may only map fields (entityMapping) starts at the fields,
     * keeps the model type and its fields as they are, and saves mappings even while the model type is incomplete, as
     * the catalogue allows (TR-CO-09).
     */
    assigns?: boolean;
    onsave: (details: Record<string, unknown>) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  const TYPE = 0;
  const GRAIN = 1;
  const FIELDS = 2;

  // The sheet opens afresh each time: it starts from the Resource as it was when it opened.
  let draft: Draft = $state(untrack(() => recordedDraftOf(resource)));
  /** The model type it has now, when the sheet opened to change it: "Next" waits for another one. */
  const now: ModelType | null = untrack(() => (start === 'change' ? resource.details.modelType : null));
  let step = $state(untrack(() => (start === 'fields' || !assigns ? FIELDS : TYPE)));
  let show: 'all' | 'mapped' = $state('all');
  let saving = $state(false);
  let failed = $state(false);
  /** The model type the fields were last suggested for: suggested once per model type. */
  let suggested: ModelType | null | undefined;

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

  /** To a step; on the step of the fields, what its model type asks for is suggested where it is cheap. */
  function go(to: number) {
    step = to;
    failed = false;
    if (assigns && to === FIELDS && suggested !== draft.modelType) {
      suggestTypeFields(draft);
      suggested = draft.modelType;
    }
  }
  if (untrack(() => step) === FIELDS) go(FIELDS);

  const identities = $derived(new Set(model?.identities ?? []));
  const open = $derived(unfinished(draft));
  const missing = $derived(assigns ? missingOf(draft) : []);
  const list = (items: string[]) => new Intl.ListFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB').format(items);
  const waits = $derived(waitingFor(missing, draft.modelType, list));
  const mappedCount = $derived(draft.fields.filter((field) => field.kind !== 'none').length);
  const counts = $derived({
    resources: 1,
    is: draft.fields.filter((field) => field.kind === 'is').length,
    relations: draft.fields.filter((field) => field.kind === 'relation' || field.kind === 'performedBy').length,
    strangers: model ? strangers(draft, identities).length : 0,
  });
  const sentenceMissing = $derived(draft.modelType === 'other' && draft.grainSentence.trim() === '');
  /** Changing the model type, another one is chosen before going on. */
  const same = $derived(now !== null && draft.modelType === now);

  const TITLES = ['type.title', 'grain.title', 'fields.title'] as const;
  const TEXTS = ['type.text', 'grain.text', 'fields.text'] as const;
  const title = $derived(step === TYPE && now ? t('type.change.title', { name: resource.displayName }) : t(TITLES[step] ?? 'type.title', { name: resource.displayName }));

  async function save() {
    saving = true;
    failed = false;
    const { id: _, ...details } = requestOf(draft, identities);
    failed = !(await onsave(details));
    saving = false;
  }
</script>

<Sheet {title} wide={step === FIELDS} {onclose}>
  {#snippet top()}
    {#if assigns}<Steps label={t('add.steps')} steps={[t('add.step.type'), t('add.step.grain'), t('add.step.fields')]} current={step} onstep={go} />{/if}
  {/snippet}
  {#snippet head()}<p class="meta text">{t(TEXTS[step] ?? 'type.text')}</p>{/snippet}
  {#if step === TYPE}
    <ResourceType bind:draft {now} />
  {:else if step === GRAIN}
    <div class="list"><ResourceGrain bind:draft onchangetype={() => go(TYPE)} /></div>
  {:else}
    {#if model}
      <p class="model">
        <Icon name="graph" />
        <span>{model.release ? t('grain.model', { release: model.release }) : t('grain.model.unversioned')} <a class="text-link" href="https://colleciones-eventos.immoscoop.be/domain-model" target="_blank" rel="noopener">{t('grain.model.open')}</a></span>
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
        <p class="meta empty">{t('grain.loading')} <Loading inline /></p>
      {:else}
        <ResourceFields bind:draft model={model ?? null} {show} fixed={!assigns} onchangetype={() => go(TYPE)} />
      {/if}
    </div>
  {/if}
  {#snippet foot()}
    {#if step === TYPE}
      <p class="meta chosen">
        {#if same}{t('type.foot.change')}
        {:else if draft.modelType}<Sentence key="type.foot" values={{ asks: t(TYPE_KEYS[draft.modelType].wants) }} names={{ type: draft.modelType }} />
        {:else}{t('type.foot.none')}{/if}
      </p>
      <Button disabled={!draft.modelType || same} onclick={() => go(GRAIN)}>{t('type.next')}<Icon name="arrow-right" /></Button>
    {:else if step === GRAIN}
      <Button variant="quiet" onclick={() => go(TYPE)}><Icon name="arrow-left" />{t('grain.back')}</Button>
      <p class="meta chosen">
        {#if sentenceMissing}<Sentence key="grain.foot.sentence" names={{ type: 'other' }} />
        {:else if draft.grainSentence.trim()}{t('grain.foot', { sentence: draft.grainSentence.trim() })}
        {:else}{t('grain.foot.none')}{/if}
      </p>
      <Button disabled={sentenceMissing} onclick={() => go(FIELDS)}>{t('grain.next')}<Icon name="arrow-right" /></Button>
    {:else}
      {#if assigns}<Button variant="quiet" onclick={() => go(GRAIN)}><Icon name="arrow-left" />{t('grain.back')}</Button>{/if}
      <p class="meta chosen" role={failed ? 'alert' : undefined}>
        {#if failed}{t('resource.saveFailed')}
        {:else if waits}<Sentence key={waits.key} values={waits.values} names={waits.names} />
        {:else if open.length > 0}{t('grain.unfinished', { fields: open.join(', ') })}
        {:else}{t('grain.summary', counts)}{/if}
      </p>
      <Button disabled={saving || model === undefined || open.length > 0 || missing.length > 0} onclick={save}>{t('collection.save')}</Button>
    {/if}
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
