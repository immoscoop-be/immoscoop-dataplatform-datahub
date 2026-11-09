<script lang="ts">
  import { getContext } from 'svelte';
  import { EXPLAINED, type ExplainedHost } from '../containers/explained.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The marker ⓘ (U+24D8) right after a system text that the Learning Centre explains (Marker ⓘ, DEC-UX-54,
   * OP-UX-22): the sign only, in the colour of its text, smaller and raised, from a symbol font, as Poppins has
   * none. A tap on it opens the pop-out of what holds it, and keeps a button from doing its own action.
   */
  const host = getContext<ExplainedHost | undefined>(EXPLAINED);
  let touched = false;

  function tap(event: MouseEvent): void {
    if (!touched || !host) return;
    event.preventDefault();
    event.stopPropagation();
    host.tap();
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<span class="mark" aria-hidden="true" onpointerdown={(event) => (touched = event.pointerType !== 'mouse')} onclick={tap}>ⓘ</span><span class="sr-only">{t('marker.explained')}</span>

<style>
  .mark { font-family: var(--font-symbol); font-size: 0.78em; font-weight: var(--weight-regular); font-style: normal;
    margin-left: 2px; vertical-align: 0.2em; line-height: 0; color: currentColor; cursor: help; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
