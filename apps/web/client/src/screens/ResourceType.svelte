<script lang="ts">
  import { MODEL_TYPES, type ModelType } from '@datahub/contracts/model-types';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { chooseType, type Draft } from '../lib/grain.js';
  import { TYPE_KEYS } from '../lib/typeFields.js';
  import LearningRef from './LearningRef.svelte';

  /**
   * The step of the model type of a Resource (FR-CO-44, DEC-UX-262): what one row of it is, chosen explicitly from a
   * card per model type, two side by side, `other` beside the five (DEC-RC-21). Each card says what one row is, why the
   * model type exists, what may be added up, the fields it asks for and an example at Immoscoop. No card is chosen to
   * start with: Data Hub suggests no model type from the words of a Colleciónes model (DEC-RC-25). Opened by "Change
   * model type", it says the model type it has now and what changing drops (DEC-RC-22, DEC-UX-263).
   */
  let {
    draft = $bindable(),
    now = null,
  }: {
    draft: Draft;
    /** The model type it has now, when the step is opened to change it. */
    now?: ModelType | null;
  } = $props();
</script>

{#if now}
  <Callout icon="warning-circle-fill" tone="warning">
    <b><Sentence key="type.change.now" names={{ type: now }} /></b>
    {t('type.change.text')}
  </Callout>
{/if}
<div class="types" role="radiogroup" aria-label={t('grain.modelType')}>
  {#each MODEL_TYPES as type (type)}
    {@const on = draft.modelType === type}
    {@const keys = TYPE_KEYS[type]}
    <label class="pick" class:on>
      <input type="radio" name="model-type-{draft.id}" value={type} checked={on} onchange={() => chooseType(draft, type)} />
      <span class="what">
        <span class="head">
          <LearningRef place="modelType" shape="chip">
            {#snippet children(mark)}<span class="name">{type}{@render mark?.()}</span>{/snippet}
          </LearningRef>
          {#if type === now}<span class="now"><Icon name="check" />{t('type.now')}</span>{/if}
        </span>
        <span class="def">{t(keys.def)}</span>
        <dl class="facts">
          <dt>{t('type.why')}</dt>
          <dd>{t(keys.why)}</dd>
          <dt>{t('type.counting')}</dt>
          <dd>{t(keys.counting)}</dd>
          <dt>{t('type.asks')}</dt>
          <dd>{t(keys.asks)}</dd>
          <dt>{t('type.example')}</dt>
          <dd>{t(keys.example)}</dd>
        </dl>
      </span>
    </label>
  {/each}
</div>

<style>
  b { font-weight: var(--weight-medium); }
  .types { flex: 1; overflow: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; margin: 12px -6px 0; padding: 2px 6px; }
  .pick { display: flex; align-items: flex-start; gap: 12px; padding: 12px 10px; border-radius: var(--radius-md); border: 1px solid var(--tint-active); cursor: pointer; }
  .pick:hover { background: var(--tint-hover); }
  .pick.on { background: var(--surface-sub); outline: 1.5px solid var(--text-muted); border-color: transparent; }
  input { margin-top: 3px; accent-color: var(--text-primary); }
  .what { flex: 1; min-width: 0; }
  .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .name { font: var(--weight-medium) var(--text-body) var(--font-mono); }
  .now { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-meta); color: var(--text-secondary); }
  .def { display: block; margin-top: 6px; font-size: var(--text-small); line-height: 1.45; }
  .facts { display: grid; grid-template-columns: 72px 1fr; gap: 3px 10px; margin: 8px 0 0; font-size: var(--text-meta); line-height: 1.45; }
  dt { color: var(--text-muted); }
  dd { margin: 0; color: var(--text-secondary); }
  @media (max-width: 900px) { .types { grid-template-columns: 1fr; } }
</style>
