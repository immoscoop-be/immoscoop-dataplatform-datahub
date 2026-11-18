<script lang="ts">
  import type { Snippet } from 'svelte';
  import Explained from '@datahub/ui/containers/Explained.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Marker from '@datahub/ui/marks/Marker.svelte';
  import { cardsOf, type MarkerPlace, termOf } from '../lib/learning.js';
  import { useLearning } from '../lib/learning-context.js';
  import LearningPop from './LearningPop.svelte';

  /**
   * System text that the Learning Centre explains (FR-LR-35): it carries the marker and its pop-out once one of
   * the cards of its place is written (DEC-LR-28), and stays tinted while a card it opened is open. A term of the
   * dictionary carries it always, its definition first (DEC-UX-279, FR-LR-44). What it explains places the marker
   * right after its text.
   */
  let {
    place,
    shape = 'text',
    focusable = true,
    children,
  }: {
    place: MarkerPlace;
    shape?: 'text' | 'chip' | 'pill';
    /** Not when it holds a button, which takes the focus itself. */
    focusable?: boolean;
    /** What it explains, given the marker to place after its text; none when nothing explains it yet. */
    children: Snippet<[Snippet | undefined]>;
  } = $props();

  const learning = useLearning();
  const count = $derived(learning ? cardsOf(place, learning.shown).length : 0);
  const term = $derived(termOf(place));
  const label = $derived(term ? t('learning.pop.term', { term: term.text[currentLanguage()].name }) : t('learning.pop.head', { count }));
</script>

{#snippet mark()}<Marker />{/snippet}
{#snippet pop(close: () => void)}<LearningPop {place} {close} />{/snippet}

{#if learning && (count > 0 || term)}
  <Explained {label} {shape} {focusable} active={learning.window?.from === place} {pop}>{@render children(mark)}</Explained>
{:else}
  {@render children(undefined)}
{/if}
