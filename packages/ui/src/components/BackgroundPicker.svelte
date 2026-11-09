<script lang="ts">
  import { backgroundsOf, RANDOM, type Background, type Theme } from '../foundations/backgrounds.js';
  import Icon from '../foundations/Icon.svelte';
  import { moveFocus } from '../foundations/roving.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The backgrounds of the current theme, Random first, each with a small picture and its name; the
   * chosen one has a ring (DEC-UX-108). Choosing one keeps it for this theme; the other theme has a
   * choice of its own, made while it is on. The arrows choose too.
   */
  let { theme, choice, onchoose }: { theme: Theme; choice: string; onchoose: (id: string) => void } = $props();

  const title = (background: Background) =>
    background.name ?? (background.kind === 'flow' ? t('background.flow') : t('background.gradient'));
  const meta = (background: Background) =>
    background.kind === 'flow' ? t('background.flowMeta') : background.kind === 'lights' ? t('background.lightsMeta') : undefined;
  /** The still picture of a flowing background, as tokens.css draws it. */
  const preview = (background: Background) =>
    background.kind === 'flow' || background.kind === 'lights' ? `var(--bg-prev-${background.id})` : undefined;

  const set = $derived(backgroundsOf(theme));
  /** Random is on when the choice is not one of the set (any more), as the background then is one at random. */
  const chosen = $derived(set.some((background) => background.id === choice) ? choice : RANDOM);

  function key(event: KeyboardEvent) {
    const index = moveFocus(event, '[role="radio"]');
    if (index !== undefined) {
      onchoose(index === 0 ? RANDOM : (set[index - 1]?.id ?? RANDOM));
    }
  }
</script>

<div class="options" role="radiogroup" aria-label={t('background.label')} tabindex="-1" onkeydown={key}>
  <button
    type="button"
    class="option"
    class:on={chosen === RANDOM}
    role="radio"
    aria-checked={chosen === RANDOM}
    tabindex={chosen === RANDOM ? 0 : -1}
    onclick={() => onchoose(RANDOM)}
  >
    <span class="preview random"><Icon name="shuffle" /></span>
    <span class="item-title">{t('background.random')}</span>
    <span class="meta">{t('background.randomMeta')}</span>
  </button>
  {#each set as background (background.id)}
    <button
      type="button"
      class="option"
      class:on={chosen === background.id}
      role="radio"
      aria-checked={chosen === background.id}
      tabindex={chosen === background.id ? 0 : -1}
      onclick={() => onchoose(background.id)}
    >
      <span
        class="preview {background.kind}"
        style:--preview={preview(background)}
        style:--picture={background.picture ? `url("${background.picture}")` : undefined}
        style:--position={background.previewPosition}
      ></span>
      <span class="item-title">{title(background)}</span>
      {#if meta(background)}<span class="meta">{meta(background)}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .options { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-tile-gap); }
  .option { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 8px 12px; border: 0; border-radius: var(--radius-lg);
    background: var(--surface-sub); color: inherit; font: inherit; text-align: left; cursor: pointer; outline-offset: 2px; }
  .option:hover { background: var(--tint-hover); }
  .option.on { outline: 2px solid var(--text-primary); }
  .item-title { margin-top: 8px; padding: 0 4px; }
  .meta { padding: 0 4px; }
  .preview { display: flex; align-items: center; justify-content: center; width: 100%; aspect-ratio: 16 / 10; border-radius: var(--radius-md);
    background: center / cover no-repeat var(--bg-1); color: var(--text-secondary); font-size: 26px; }
  .random { background: var(--surface-solid); }
  .gradient { background: var(--app-bg); background-size: 130% 130%; }
  .flow, .lights { background: var(--preview); }
  .picture { background-image: var(--picture); background-position: var(--position, center); }
</style>
