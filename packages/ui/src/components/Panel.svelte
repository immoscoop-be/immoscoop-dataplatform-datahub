<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The panel: the index of its section, sliding out next to the rail (What is in the panel). It
   * belongs to the section that is active; its own button slides it in. Its reading surfaces are
   * opaque while it has the focus, softer when the main area has it (Layers and focus).
   */
  let {
    open,
    title,
    focused = false,
    blur = false,
    actions,
    oncollapse,
    children,
  }: {
    open: boolean;
    title: string;
    /** On touch, the window tapped last has the focus; with a mouse, the window it is in. */
    focused?: boolean;
    /** Over a picture, the panel blurs it lightly, so that it never competes with the text (DEC-UX-34). */
    blur?: boolean;
    actions?: Snippet;
    oncollapse: () => void;
    children: Snippet;
  } = $props();
</script>

<aside class="panel" class:open class:focused class:blur aria-label={title} aria-hidden={!open} inert={!open}>
  <div class="inner">
    <div class="head">
      <h1>{title}</h1>
      {@render actions?.()}
      <button type="button" class="icon-btn" aria-label={t('panel.collapse')} onclick={oncollapse}><Icon name="caret-double-left-fill" /></button>
    </div>
    {@render children()}
  </div>
</aside>

<style>
  .panel { --card: var(--surface-soft); width: 0; padding: 20px 0; opacity: 0; flex-shrink: 0; background: var(--surface-glass); border-radius: var(--radius-xl);
    overflow: hidden auto; transition: width var(--motion-panel), opacity var(--motion-fade), padding var(--motion-panel); }
  .panel.open { width: var(--panel-width); padding: 20px 16px; opacity: 1; }
  .panel.focused { --card: var(--surface-solid); }
  @media (hover: hover) { .panel:hover { --card: var(--surface-solid); } }
  .panel.blur { -webkit-backdrop-filter: var(--blur-frame); backdrop-filter: var(--blur-frame); }
  .inner { width: calc(var(--panel-width) - 32px); }
  .head { display: flex; align-items: center; gap: 4px; }
  h1 { font-size: 19px; font-weight: var(--weight-medium); flex: 1; margin: 0; }
  .icon-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: 0; background: none; display: flex; align-items: center;
    justify-content: center; color: var(--text-secondary); cursor: pointer; font-size: 16px; }
  .icon-btn:hover { background: var(--surface-float-hover); }
</style>
