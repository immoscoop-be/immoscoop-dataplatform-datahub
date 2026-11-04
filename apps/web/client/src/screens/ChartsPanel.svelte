<script lang="ts">
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { type ChartsOverview, grouped } from '../lib/charts.js';
  import { chartPath } from '../lib/routes.js';
  import ChartIcon from './ChartIcon.svelte';

  /**
   * The panel of Charts, the gallery of semgraph (FR-CH-06, DEC-UX-182): one line on what the charts are, then the
   * charts semgraph draws by the question they answer, each with its icon and name; the one opened is marked.
   */
  let {
    overview,
    current,
    iconUrl,
  }: {
    /** What semgraph offers: undefined while it comes, null when it did not answer. */
    overview: ChartsOverview | null | undefined;
    /** The chart opened. */
    current: string | undefined;
    iconUrl: (id: string) => string;
  } = $props();
</script>

<p class="about">{t('charts.about')}</p>
{#if overview}
  <nav class="chart-list" aria-label={t('section.charts')}>
    {#each grouped(overview.charts) as { group, charts } (group.id)}
      <div class="panel-label">{t(group.label)}</div>
      {#each charts as chart (chart.id)}
        <a class="chart-item" class:on={chart.id === current} href={chartPath(chart.id)} aria-current={chart.id === current ? 'page' : undefined}>
          <ChartIcon src={iconUrl(chart.id)} /><span>{chart.title}</span>
        </a>
      {/each}
    {/each}
  </nav>
{:else if overview === null}
  <p class="meta failed">{t('charts.failed')}</p>
{:else}
  <Loading />
{/if}

<style>
  .about { margin: 10px 4px 0; font-size: var(--text-meta); line-height: 1.5; color: var(--text-muted); }
  .chart-list { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; }
  .panel-label { font-size: var(--text-meta); color: var(--text-muted); margin: 18px 4px 8px; }
  .chart-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: var(--radius-md); font-size: var(--text-small); color: var(--text-secondary); text-decoration: none; }
  .chart-item:hover { background: var(--tint-hover); color: var(--text-primary); }
  .chart-item:focus-visible { outline: 2px solid var(--text-secondary); }
  .chart-item.on { background: var(--card); color: var(--text-primary); font-weight: var(--weight-medium); }
  .chart-item.on :global(.chart-icon) { color: var(--text-primary); }
  .failed { margin: 18px 4px 0; line-height: 1.5; }
</style>
