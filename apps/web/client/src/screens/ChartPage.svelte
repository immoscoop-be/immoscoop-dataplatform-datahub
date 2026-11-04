<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import type { Theme } from '@datahub/ui/foundations/backgrounds.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { moveFocus } from '@datahub/ui/foundations/roving.js';
  import Sentence from '@datahub/ui/foundations/Sentence.svelte';
  import { t, type Language } from '@datahub/ui/foundations/texts.svelte.js';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { type Chart, ChartMissing, type Charts, type ChartsOverview, type Drawing, exampleLabel, groupOf, INTENTS, shownExamples } from '../lib/charts.js';
  import { chartPath } from '../lib/routes.js';
  import ChartIcon from './ChartIcon.svelte';
  import NotFound from './NotFound.svelte';

  /**
   * A chart of semgraph opened in Charts (FR-CH-06, DEC-UX-182): its name and the question it answers; its examples
   * to switch between, each as semgraph draws it in the theme of the page, with its hover (DEC-UX-184), with its warning or caution, or why it
   * refuses it; and beside it the questions it is for, what to use instead, what it needs and where a User meets it.
   * What an example shows in words waits for semgraph (OP-UX-54).
   */
  let {
    id,
    overview,
    charts,
    language,
    theme,
  }: {
    id: string;
    /** What semgraph offers, for the names of the charts to use instead and those only planned. */
    overview: ChartsOverview | null | undefined;
    charts: Charts;
    language: Language;
    theme: Theme;
  } = $props();

  /** The chart: undefined while it comes, null when semgraph does not offer it, 'failed' when it did not answer. */
  let chart: Chart | null | 'failed' | undefined = $state();
  /** The example chosen; the first until the User chooses another. */
  let chosen: string | undefined = $state();
  $effect(() => {
    const [wanted, words] = [id, language];
    chart = undefined;
    chosen = undefined;
    let current = true;
    charts.chart(wanted, words).then(
      (found) => current && (chart = found),
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ChartMissing) {
          chart = null;
        } else {
          console.error(`semgraph did not describe ${wanted}`, error);
          chart = 'failed';
        }
      },
    );
    return () => {
      current = false;
    };
  });

  const opened = $derived(chart && chart !== 'failed' && chart.id === id ? chart : undefined);
  const examples = $derived(opened ? shownExamples(opened.examples) : []);
  const example = $derived(examples.find((one) => one.name === chosen) ?? examples[0]);
  const group = $derived(groupOf(id));

  /** The example as semgraph drew it: undefined while it is drawn. */
  let drawing: Drawing | undefined = $state();
  $effect(() => {
    if (!opened || !example) return;
    const [chartId, name, drawn] = [opened.id, example.name, theme];
    drawing = undefined;
    let current = true;
    charts.draw(chartId, name, drawn).then((found) => current && (drawing = found));
    return () => {
      current = false;
    };
  });

  /** A chart to use instead: offered, by its name; only planned, by its id. */
  function insteadOf(use: string): { title: string } | { planned: boolean } {
    const listed = overview?.charts.find((one) => one.id === use);
    return listed ? { title: listed.title } : { planned: overview?.planned.includes(use) ?? false };
  }
</script>

{#if chart === null}
  <NotFound />
{:else if chart === 'failed'}
  <Breadcrumb steps={[{ label: t('section.charts') }]} />
  <p class="meta failed">{t('charts.failed')}</p>
{:else if opened}
  <Breadcrumb steps={[{ label: group ? `${t('section.charts')} · ${t(group.label)}` : t('section.charts') }]} />
  <div class="chart-head">
    <ChartIcon src={charts.iconUrl(opened.id)} big />
    <div>
      <h1 class="page-title">{opened.title}</h1>
      <span class="mono meta">{opened.id}</span>
    </div>
  </div>
  <p class="chart-answers">{opened.answers}</p>
  <div class="chart-layout">
    <section class="card chart-stage" aria-label={t('charts.examples')}>
      <div class="chart-examples" role="tablist" aria-label={t('charts.examples')} tabindex="-1" onkeydown={(event) => moveFocus(event, '[role="tab"]')}>
        {#each examples as one (one.name)}
          <button
            type="button"
            class="seg"
            class:on={one.name === example?.name}
            role="tab"
            aria-selected={one.name === example?.name}
            tabindex={one.name === example?.name ? 0 : -1}
            onclick={() => (chosen = one.name)}>{exampleLabel(one.name)}</button
          >
        {/each}
      </div>
      {#if example}
        <div role="tabpanel" aria-label={exampleLabel(example.name)}>
          <figure class="chart-figure">
            {#if drawing?.kind === 'drawn'}
              <!-- The SVG itself, in the page, so that its hover, metadata panels and links work (DEC-UX-184); lib/charts makes it placeable. -->
              <div class="chart-svg" role="group" aria-label={t('charts.example.alt', { chart: opened.title, example: example.title })}>{@html drawing.svg}</div>
              {#if drawing.deviations.length > 0 || drawing.cautions.length > 0}
                <figcaption>
                  {#if drawing.deviations.length > 0}<Chip variant="warn"><Icon name="warning-fill" />{t('charts.example.deviation')}</Chip>{/if}
                  {#if drawing.cautions.length > 0}<Chip variant="warn"><Icon name="warning-circle-fill" />{t('charts.example.caution')}</Chip>{/if}
                </figcaption>
              {/if}
            {:else if drawing?.kind === 'refused'}
              <div class="chart-refused">
                <Icon name="prohibit-fill" />
                <div>
                  <b>{t('charts.refused.title')}</b>
                  <p><Sentence key="charts.refused.text" names={{ code: drawing.code }} /></p>
                </div>
              </div>
              <figcaption><Chip><Icon name="prohibit-fill" />{t('charts.example.refused')}</Chip></figcaption>
            {:else if drawing?.kind === 'failed'}
              <p class="meta failed">{t('charts.example.failed')}</p>
            {:else}
              <div class="drawing"><Loading /></div>
            {/if}
          </figure>
        </div>
      {/if}
    </section>
    <aside class="chart-about">
      {#if opened.exampleQuestions.length > 0}
        <div class="label">{t('charts.forQuestions')}</div>
        <ul>
          {#each opened.exampleQuestions as question, index (index)}<li>{question}</li>{/each}
        </ul>
      {/if}
      {#if opened.doNotUseWhen.length > 0}
        <div class="label">{t('charts.notFor')}</div>
        <ul>
          {#each opened.doNotUseWhen as reason, index (index)}
            {@const instead = insteadOf(reason.use)}
            <li>
              {INTENTS[reason.intent] ? t(INTENTS[reason.intent] ?? '') : reason.intent}:
              {#if 'title' in instead}<a href={chartPath(reason.use)}>{instead.title}</a>{:else}{reason.use}{#if instead.planned}{' '}<span class="meta">{t('charts.planned')}</span>{/if}{/if}
            </li>
          {/each}
        </ul>
      {/if}
      {#if opened.minimumPoints !== null}
        <div class="label">{t('charts.needs')}</div>
        <p>{t('charts.needs.text', { count: opened.minimumPoints })}</p>
      {/if}
      <div class="label">{t('charts.meet')}</div>
      <p><Sentence key="charts.meet.text" names={{ route: 'POST /render', request: `"semgraph": "${opened.id}"` }} /></p>
    </aside>
  </div>
{:else}
  <Loading />
{/if}

<style>
  .chart-head { display: flex; align-items: center; gap: 14px; margin-top: 8px; }
  .chart-head .meta { display: block; }
  .chart-answers { margin: 14px 0 18px; font-size: var(--text-section); line-height: 1.5; color: var(--text-secondary); }
  .chart-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 280px); gap: 16px; align-items: start; }
  .chart-stage { border-radius: var(--radius-lg); padding: 14px 16px 16px; }
  .chart-examples { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
  .seg { font: var(--text-small) var(--font-family); color: var(--text-muted); cursor: pointer; padding: 3px 8px; border-radius: var(--radius-pill); border: 0; background: none; }
  .seg:hover { color: var(--text-primary); }
  .seg.on { color: var(--text-primary); font-weight: var(--weight-medium); background: var(--card); }
  .chart-figure { margin: 0; }
  /* At the size semgraph draws it, centred: never stretched, only smaller on a narrower card (DEC-UX-183). */
  .chart-svg :global(svg) { display: block; max-width: 100%; height: auto; margin: 0 auto; border-radius: var(--radius-sm); }
  .chart-figure figcaption { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; font-size: var(--text-small); line-height: 1.5; color: var(--text-secondary); }
  .chart-figure figcaption :global(.icon) { font-size: 13px; }
  .drawing { aspect-ratio: 16 / 9; border-radius: var(--radius-sm); background: var(--tint-hover); display: flex; align-items: center; justify-content: center; }
  .chart-refused { display: flex; gap: 12px; align-items: flex-start; padding: 18px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); line-height: 1.5; }
  .chart-refused > :global(.icon) { font-size: 20px; color: var(--text-muted); }
  .chart-refused b { font-weight: var(--weight-medium); }
  .chart-refused p { margin: 4px 0 0; color: var(--text-secondary); }
  .chart-about { font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .chart-about .label { margin: 0 0 6px; }
  .chart-about ul { margin: 0 0 16px; padding-left: 18px; }
  .chart-about p { margin: 0 0 16px; }
  .chart-about a { color: var(--text-primary); text-underline-offset: 3px; }
  .failed { margin: 18px 0; line-height: 1.5; }
  @media (max-width: 1100px) {
    .chart-layout { grid-template-columns: minmax(0, 1fr); }
  }
</style>
