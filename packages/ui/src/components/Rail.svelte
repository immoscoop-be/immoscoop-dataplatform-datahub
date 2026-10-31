<script lang="ts" module>
  import type { IconName } from '../foundations/icons.js';

  export interface RailItem {
    readonly id: string;
    /** The name of the section, next to its icon after a short delay. */
    readonly label: string;
    readonly icon: IconName;
    readonly href: string;
    /** For Messages: how many are unread (DEC-UX-29). */
    readonly unread?: number;
    /** Set a little apart from the items above it, as Admin is (DEC-UX-130). */
    readonly apart?: boolean;
  }
</script>

<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';
  import Avatar from '../primitives/Avatar.svelte';

  /**
   * The rail: floating icons of the main sections, without a bar of their own, and at the foot the
   * theme and the initials that open My page (DEC-UX-89, DEC-UX-84). The active icon flows into the
   * open panel as one shape (Navigation). What a click does is the app's to decide (the navigation
   * rules): the rail only says which item was chosen.
   */
  let {
    items,
    active,
    panelOpen,
    blur = false,
    initials,
    myPageHref,
    myPageActive = false,
    onselect,
    ontheme,
    onmypage,
  }: {
    items: readonly RailItem[];
    /** The section the page is in, if any. */
    active: string | undefined;
    panelOpen: boolean;
    /** Over a picture, the active tab blurs it as the frames do (DEC-UX-34). */
    blur?: boolean;
    initials: string;
    myPageHref: string;
    myPageActive?: boolean;
    onselect: (id: string) => void;
    ontheme: () => void;
    onmypage?: () => void;
  } = $props();

  /** A plain click is the app's; a click with a modifier opens the link as the browser does. */
  const plain = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
</script>

<nav class="rail" class:panel-open={panelOpen} class:blur aria-label={t('rail.label')}>
  <svg class="logo" width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
    <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" />
    <circle cx="20" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
  {#each items as item (item.id)}
    <a
      class="nav-btn"
      class:apart={item.apart}
      class:active={item.id === active}
      href={item.href}
      data-label={item.label}
      aria-label={item.unread ? t('rail.unread', { label: item.label, count: item.unread }) : item.label}
      aria-current={item.id === active ? 'page' : undefined}
      onclick={(event) => {
        if (plain(event)) {
          event.preventDefault();
          onselect(item.id);
        }
      }}
    >
      <Icon name={item.icon} />
      {#if item.id === active}<span class="flare top"></span><span class="flare bottom"></span>{/if}
      {#if item.unread}<span class="badge">{item.unread}</span>{/if}
    </a>
  {/each}
  <div class="spacer"></div>
  <button type="button" class="nav-btn" data-label={t('rail.theme')} aria-label={t('rail.themeSwitch')} onclick={ontheme}><Icon name="moon-fill" /></button>
  <Avatar
    {initials}
    href={myPageHref}
    active={myPageActive}
    label={t('rail.myPage')}
    onclick={(event) => {
      if (onmypage && plain(event)) {
        event.preventDefault();
        onmypage();
      }
    }}
  />
</nav>

<style>
  .rail { width: var(--nav-rail-width); margin-right: calc(var(--nav-to-panel-gap) - var(--space-gap)); flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 0; position: relative; z-index: 3; }
  .logo { margin-bottom: 28px; color: var(--text-primary); }
  .spacer { flex: 1; }
  .apart { margin-top: 14px; }
  .nav-btn { width: var(--nav-icon-size); height: var(--nav-icon-size); border-radius: var(--radius-nav-icon); border: 0; background: none;
    display: flex; align-items: center; justify-content: center; color: var(--text-secondary); cursor: pointer; font-size: 22px; position: relative; text-decoration: none; }
  .nav-btn:hover { background: var(--surface-float-hover); }
  .nav-btn.active, .nav-btn.active:hover { background: var(--surface-glass); color: var(--text-primary); }
  /* The name of a rail icon, shown after a short delay */
  .nav-btn[data-label]::before { content: attr(data-label); position: absolute; left: 54px; top: 50%; transform: translate(-4px, -50%);
    background: var(--surface-solid); color: var(--text-primary); font: var(--weight-medium) var(--text-small) var(--font-family);
    padding: 6px 11px; border-radius: var(--radius-sm); white-space: nowrap; opacity: 0; pointer-events: none; z-index: 5;
    transition: opacity var(--motion-tooltip) var(--delay-tooltip), transform var(--motion-tooltip) var(--delay-tooltip); }
  .nav-btn[data-label]:hover::before { opacity: 1; transform: translate(0, -50%); }
  /* The active icon flows into the open panel as one tab, with concave corners */
  .panel-open .nav-btn.active::before { display: none; }
  .panel-open .nav-btn.active { border-radius: var(--radius-nav-icon) 0 0 var(--radius-nav-icon); }
  .panel-open .nav-btn.active::after { content: ''; position: absolute; left: 100%; top: 0; height: 100%;
    width: calc(var(--nav-rail-width) - (var(--nav-rail-width) + var(--nav-icon-size)) / 2 + var(--nav-to-panel-gap)); background: var(--surface-glass); }
  .flare { display: none; position: absolute; width: var(--flare-nav); height: var(--flare-nav);
    left: calc(var(--nav-icon-size) + (var(--nav-rail-width) - var(--nav-icon-size)) / 2 + var(--nav-to-panel-gap) - var(--flare-nav)); }
  .panel-open .flare { display: block; }
  .flare.top { top: calc(-1 * var(--flare-nav)); background: radial-gradient(circle at 0 0, transparent var(--flare-nav), var(--surface-glass) calc(var(--flare-nav) + .5px)); }
  .flare.bottom { top: var(--nav-icon-size); background: radial-gradient(circle at 0 100%, transparent var(--flare-nav), var(--surface-glass) calc(var(--flare-nav) + .5px)); }
  .blur .nav-btn.active { -webkit-backdrop-filter: var(--blur-frame); backdrop-filter: var(--blur-frame); }
  .badge { position: absolute; top: 5px; right: 5px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: var(--radius-pill); background: var(--text-primary); color: var(--surface-solid);
    font-size: 10px; font-weight: var(--weight-medium); line-height: 16px; text-align: center; }
</style>
