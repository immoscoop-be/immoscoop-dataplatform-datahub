<script lang="ts">
  import Icon from '../foundations/Icon.svelte';

  /**
   * Named steps in a row, an arrow between each, the current one marked (Steps, DEC-UX-58). A step
   * already done shows a check, and going back to it is a click.
   */
  let {
    label,
    steps,
    current,
    onstep,
  }: { label: string; steps: readonly string[]; current: number; onstep?: (index: number) => void } = $props();
</script>

<nav class="steps" aria-label={label}>
  {#each steps as step, index (index)}
    {#if index > 0}<span class="arrow"><Icon name="arrow-right" /></span>{/if}
    {#if index < current && onstep}
      <button type="button" class="step done" onclick={() => onstep(index)}><b><Icon name="check" /></b>{step}</button>
    {:else}
      <span class="step" class:on={index === current} class:done={index < current} aria-current={index === current ? 'step' : undefined}
        ><b>{#if index < current}<Icon name="check" />{:else}{index + 1}{/if}</b>{step}</span
      >
    {/if}
  {/each}
</nav>

<style>
  .steps { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: var(--text-meta); color: var(--text-muted); }
  .arrow { display: inline-flex; font-size: 12px; }
  .step { display: inline-flex; align-items: center; gap: 6px; color: inherit; }
  button.step { all: unset; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  button.step:hover { color: var(--text-primary); }
  button.step:focus-visible { outline: 2px solid var(--text-secondary); }
  b { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--tint-active); font-weight: var(--weight-medium); font-size: 11px; }
  .on { color: var(--text-primary); font-weight: var(--weight-medium); }
  .on b { background: var(--text-primary); border-color: var(--text-primary); color: var(--surface-solid); }
  .done b { color: var(--text-secondary); }
</style>
