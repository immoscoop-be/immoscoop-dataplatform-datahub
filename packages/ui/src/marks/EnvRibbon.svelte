<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The ribbon of an environment that is not prod (DEC-UX-203): its name across the upper right corner of the window,
   * over every screen, the sign-in included. Prod wears none. It never takes a click.
   */
  let { environment }: { environment: string } = $props();
</script>

{#if environment !== 'prod'}
  <div class="env-ribbon" role="note" aria-label={t('environment.ribbon', { environment })}><span>{environment}</span></div>
{/if}

<style>
  .env-ribbon { position: fixed; top: 0; right: 0; z-index: 90; width: 124px; height: 124px; overflow: hidden; pointer-events: none; user-select: none; }
  .env-ribbon span {
    position: absolute; top: 28px; right: -44px; width: 180px; padding: 7px 0; text-align: center;
    transform: rotate(45deg); background: var(--env-ribbon); box-shadow: var(--env-ribbon-shadow); color: var(--text-on-env);
    font: var(--weight-semibold) var(--text-small) / 1 var(--font-family); letter-spacing: .16em; text-transform: uppercase;
  }
  @media print { .env-ribbon { display: none; } }
</style>
