<script lang="ts">
  import type { Snippet } from 'svelte';
  import Panel from '@datahub/ui/components/Panel.svelte';
  import Rail, { type RailItem } from '@datahub/ui/components/Rail.svelte';
  import BackgroundLayer from '@datahub/ui/foundations/Background.svelte';
  import type { Background, Theme } from '@datahub/ui/foundations/backgrounds.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import { tokenPixels } from '@datahub/ui/foundations/tokens.js';
  import GlassCard from '@datahub/ui/containers/GlassCard.svelte';
  import Mark from './Mark.svelte';

  /**
   * The frame of every page (App shell): the rail, the panel of the active section and the main area,
   * over the background. The frames are glass; the reading surfaces in the window that has the focus
   * are opaque, the others softer (Layers and focus). Below the narrowest window it shows one message
   * instead (DEC-UX-91).
   */
  let {
    background,
    theme,
    items,
    section,
    panelTitle,
    panelOpen,
    initials,
    myPageActive,
    onselect,
    ontheme,
    oncollapse,
    panel,
    children,
  }: {
    background: Background;
    theme: Theme;
    items: readonly RailItem[];
    /** The section the page is in; My page and the page for what does not exist are in none, and have no panel. */
    section: string | undefined;
    panelTitle: string;
    panelOpen: boolean;
    initials: string;
    myPageActive: boolean;
    onselect: (id: string) => void;
    ontheme: () => void;
    oncollapse: () => void;
    panel?: Snippet;
    children: Snippet;
  } = $props();

  let narrow = $state(false);
  $effect(() => {
    const query = matchMedia(`(max-width: ${tokenPixels('--app-min-width') - 0.02}px)`);
    narrow = query.matches;
    const change = (event: MediaQueryListEvent) => {
      narrow = event.matches;
    };
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  });

  /** On touch, hover does not exist: the window tapped last has the focus (Layers and focus). */
  let tapped: 'panel' | 'main' | undefined = $state();
  function tap(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      return;
    }
    const target = event.target as Element;
    tapped = target.closest('.panel') ? 'panel' : target.closest('main') ? 'main' : tapped;
  }

  /** Over a picture or a flowing background, the frames blur it lightly (DEC-UX-34). */
  const blur = $derived(background.kind !== 'gradient');
</script>

<svelte:document onpointerdown={tap} />

<BackgroundLayer {background} {theme} />
{#if narrow}
  <div class="narrow">
    <GlassCard as="main">
      <Mark />
      <p>{t('narrow.text')}</p>
    </GlassCard>
  </div>
{:else}
  <div class="app" data-focus={tapped}>
    <Rail {items} active={section} panelOpen={Boolean(section && panel && panelOpen)} {blur} {initials} myPageHref="/me" {myPageActive} {onselect} {ontheme} />
    {#if section && panel}
      <Panel open={panelOpen} title={panelTitle} focused={tapped === 'panel'} {blur} {oncollapse}>{@render panel()}</Panel>
    {/if}
    <main class="main" class:blur>
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .app { height: 100vh; display: flex; gap: var(--space-gap); padding: var(--space-frame); }
  .main { --card: var(--surface-solid); flex: 1; min-width: 0; background: var(--surface-glass); border-radius: var(--radius-xl); padding: 26px 30px; overflow: auto; }
  @media (hover: hover) { .app:has(:global(.panel:hover)) .main { --card: var(--surface-soft); } }
  .app[data-focus='panel'] .main { --card: var(--surface-soft); }
  .main.blur { -webkit-backdrop-filter: var(--blur-frame); backdrop-filter: var(--blur-frame); }
  .narrow { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
  .narrow p { margin: 18px 0 0; max-width: 360px; font-size: var(--text-body); line-height: 1.6; color: var(--text-secondary); }
</style>
