<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';
  import KindIcon from '../marks/KindIcon.svelte';
  import MaturityIcon from '../marks/MaturityIcon.svelte';

  /**
   * An item in a list: the icon of its kind, its name on one line, and its Level, small and grey
   * (DEC-UX-11). A name too long ends in an ellipsis and shows in full on hover. A Resource that is
   * not published has its name in a lighter grey; hover and a screen reader say so (DEC-UX-12).
   */
  let {
    href,
    name,
    level,
    current = false,
    published = true,
    deprecated = false,
  }: { href: string; name: string; level: number; current?: boolean; published?: boolean; deprecated?: boolean } = $props();
</script>

<a class="item" class:current class:unpublished={!published} {href} aria-current={current ? 'page' : undefined}>
  <span class="kind"><KindIcon kind="resource" /></span>
  <span class="name" title={published ? name : t('item.notPublished', { name })}
    >{name}{#if !published}<span class="hidden">{t('item.notPublishedLabel')}</span>{/if}</span
  >
  {#if deprecated}<span class="tag">{t('status.deprecated')}</span>{/if}
  <MaturityIcon {level} small />
</a>

<style>
  .item { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 16px; color: var(--text-secondary); text-decoration: none; font-size: var(--text-small); }
  .item:hover { color: var(--text-primary); }
  .current { color: var(--text-primary); font-weight: var(--weight-medium); }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .current .kind { color: var(--text-primary); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .unpublished:not(.current) .name { color: var(--text-muted); opacity: .75; }
  .tag { flex: none; font-size: var(--text-meta); color: var(--signal-warn); }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
