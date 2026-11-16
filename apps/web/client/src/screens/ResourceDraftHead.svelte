<script lang="ts">
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import KindIcon from '@datahub/ui/marks/KindIcon.svelte';
  import MaturityIcon from '@datahub/ui/marks/MaturityIcon.svelte';
  import type { Draft } from '../lib/grain.js';

  /** The Resource a step of adding it is about: its name and Level, the model it is built on, and how many fields are mapped. */
  let { draft }: { draft: Draft } = $props();

  const mapped = $derived(draft.fields.filter((field) => field.kind !== 'none').length);
</script>

<div class="head">
  <span class="kind"><KindIcon kind="resource" /></span>
  <span class="item-title name">{draft.displayName}</span>
  <span class="level"><MaturityIcon level={draft.level} tooltip={false} />{levelName(draft.level)}</span>
</div>
<p class="meta built">
  {#if draft.builtOn?.colleciones && draft.builtOn.action}
    <Sentence key="grain.built.event" names={{ event: `${draft.builtOn.entity}.${draft.builtOn.action}` }} /> ·
  {:else if draft.builtOn?.colleciones}
    <Sentence key="grain.built.colleciones" names={{ model: draft.builtOn.name }} /> ·
  {:else if draft.builtOn}
    <Sentence key="grain.built.model" names={{ model: draft.builtOn.name }} /> ·
  {/if}
  {t('grain.counts', { fields: draft.fields.length, mapped })}
</p>

<style>
  .head { display: flex; align-items: center; gap: 8px; }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .name { flex: 1; min-width: 0; }
  .level { display: inline-flex; align-items: center; gap: 7px; color: var(--text-secondary); white-space: nowrap; font-size: var(--text-small); }
  .built { display: block; margin: 4px 0 6px 23px; }
</style>
