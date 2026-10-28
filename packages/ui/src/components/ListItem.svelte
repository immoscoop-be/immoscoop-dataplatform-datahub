<script lang="ts">
  import KindIcon from '../marks/KindIcon.svelte';
  import MaturityIcon from '../marks/MaturityIcon.svelte';

  /**
   * An item in a list: the icon of its kind, its name on one line, and its Level, small and grey
   * (DEC-UX-11). A name too long ends in an ellipsis and shows in full on hover.
   */
  let { href, name, level, current = false }: { href: string; name: string; level: number; current?: boolean } = $props();
</script>

<a class="item" class:current {href} aria-current={current ? 'page' : undefined}>
  <span class="kind"><KindIcon kind="resource" /></span>
  <span class="name" title={name}>{name}</span>
  <MaturityIcon {level} small />
</a>

<style>
  .item { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 16px; color: var(--text-secondary); text-decoration: none; font-size: var(--text-small); }
  .item:hover { color: var(--text-primary); }
  .current { color: var(--text-primary); font-weight: var(--weight-medium); }
  .kind { display: inline-flex; font-size: 14px; color: var(--text-muted); }
  .current .kind { color: var(--text-primary); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
