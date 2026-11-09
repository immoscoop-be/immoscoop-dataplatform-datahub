<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The explanation on top of a start screen (Intro): a graphic, a title, a short explanation and its
   * actions. The User dismisses it; the start screen remembers that per User and version (Start screen
   * per section, Remember for the User).
   */
  let {
    title,
    graphic,
    ondismiss,
    children,
    actions,
  }: { title: string; graphic: Snippet; ondismiss: () => void; children: Snippet; actions: Snippet } = $props();
</script>

<section class="intro card" aria-label={title}>
  <button type="button" class="dismiss" aria-label={t('intro.hide')} onclick={ondismiss}><Icon name="x-circle-fill" /></button>
  {@render graphic()}
  <h2>{title}</h2>
  <p>{@render children()}</p>
  <div class="actions">{@render actions()}</div>
</section>

<style>
  .intro { position: relative; border-radius: var(--radius-surface); padding: 26px 28px 24px; text-align: center; }
  .dismiss { position: absolute; right: 12px; top: 12px; width: 32px; height: 32px; border-radius: var(--radius-sm); border: 0; background: none;
    display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; font-size: 16px; }
  .dismiss:hover { background: var(--tint-hover); }
  h2 { font-size: 21px; font-weight: var(--weight-medium); margin: 10px 0 0; }
  p { font-size: var(--text-body); color: var(--text-secondary); line-height: 1.6; max-width: 470px; margin: 6px auto 0; }
  .actions { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 18px; }
</style>
