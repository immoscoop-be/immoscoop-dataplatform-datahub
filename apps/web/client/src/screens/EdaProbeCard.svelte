<script lang="ts">
  import type { EdaView, ProbeView } from '@datahub/contracts/eda';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { day } from '@datahub/ui/foundations/when.js';
  import { overallReading, PROBE_TEXTS } from '../lib/eda.js';
  import { cardSentence } from '../lib/edaWords.js';
  import { probePath } from '../lib/routes.js';
  import EdaDrawing from './EdaDrawing.svelte';
  import EdaSaid from './EdaSaid.svelte';
  import EdaTone from './EdaTone.svelte';

  /**
   * An EDA-Probe added to an EDA, as a card in its EDA-Step (DEC-UX-322): its drawing with the fields of this Resource
   * and its result on it, the result in a sentence, how Data Hub reads it, and the fields it is set on. The whole card
   * opens its detail: its title is the link, stretched over the card.
   */
  let { probe, view }: { probe: ProbeView; view: EdaView } = $props();

  const language = $derived(currentLanguage());
  const name = $derived(t(PROBE_TEXTS[probe.key]));
  const reading = $derived(overallReading(probe.lastRun?.results ?? []));
  const setOn = $derived(probe.fields.length > 0 ? probe.fields : probe.applies.fields);
</script>

<article class="card" aria-label={name}>
  <header>
    <h4><a href={probePath(view.resource.id, probe.key)}>{name}</a></h4>
    {#if reading}<EdaTone {reading} />{/if}
  </header>
  <EdaDrawing probe={probe.key} fields={view.resource.fields} {setOn} results={probe.lastRun?.results ?? []} label={name} />
  <p class="result"><EdaSaid parts={cardSentence(probe, view, language)} /></p>
  <footer>
    <span class="set">
      {#if probe.needed}<span class="need" title={t('eda.card.needed.title')}><Icon name="seal-check-fill" />{t('eda.card.needed')}</span>{/if}
      {#if setOn.length > 0}{t('eda.card.setOn', { fields: setOn.join(', ') })}{:else}{t('eda.card.setOnTable')}{/if}
    </span>
    {#if probe.lastRun}<span>{day(probe.lastRun.ranAt, language)}</span>{/if}
  </footer>
</article>

<style>
  .card { position: relative; display: flex; flex-direction: column; padding: 12px 14px 10px; min-height: 300px; border-radius: var(--radius-md); background: var(--surface-sub); min-width: 0; transition: box-shadow var(--motion-fade); }
  .card:hover { box-shadow: 0 0 0 1px var(--tint-active); }
  .card:focus-within { box-shadow: 0 0 0 2px var(--text-secondary); }
  header { display: flex; gap: 8px; align-items: flex-start; }
  h4 { flex: 1; font-size: 14px; font-weight: var(--weight-medium); margin: 0; line-height: 1.3; }
  h4 a { color: inherit; text-decoration: none; outline: none; }
  /* The link covers the whole card, so that a click anywhere on it opens the detail. */
  h4 a::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
  .card:hover h4 a { text-decoration: underline; text-underline-offset: 3px; }
  .card :global(.drawing) { margin: 4px 0 2px; }
  .result { font-size: var(--text-small); line-height: 1.5; margin: 2px 0 8px; }
  footer { display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--tint-active); font-size: var(--text-meta); color: var(--text-muted); }
  .set { flex: 1; min-width: 0; }
  .need { display: inline-flex; gap: 4px; align-items: center; color: var(--text-secondary); margin-right: 6px; }
</style>
