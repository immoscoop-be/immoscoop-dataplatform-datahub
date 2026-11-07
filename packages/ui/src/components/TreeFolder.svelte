<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * A folder in the panel (Tree, DEC-UX-156): an arrow that unfolds it, its icon and name, which open its page,
   * and how many it holds; unfolded, what it holds stands indented under it, with a thin line. The folder
   * whose page is open is in medium weight. `drop` marks it while what is dragged would go into it, and what is
   * left of the props goes on its row, for the drag and the drop (DEC-UX-157).
   */
  let {
    href,
    name,
    count,
    open = $bindable(false),
    current = false,
    drop = false,
    children,
    ...rest
  }: {
    href: string;
    name: string;
    count: number;
    open?: boolean;
    current?: boolean;
    drop?: boolean;
    children: Snippet;
  } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<div {...rest} class="folder" class:open class:current class:drop>
  <button type="button" class="fold" aria-expanded={open} aria-label={t('tree.toggle', { name })} onclick={() => (open = !open)}><Icon name="caret-down" /></button>
  <a {href} aria-current={current ? 'page' : undefined}
    ><span class="icon"><Icon name={open ? 'folder-open-fill' : 'folder-fill'} /></span><span class="name" title={name}>{name}</span></a
  >
  <span class="count">{count}</span>
</div>
{#if open}<div class="sub">{@render children()}</div>{/if}

<style>
  .folder { display: flex; align-items: center; gap: 2px; padding: 3px 8px 3px 2px; border-radius: var(--radius-sm); font-size: var(--text-small); color: var(--text-secondary); }
  .folder:hover { color: var(--text-primary); }
  .fold { all: unset; cursor: pointer; flex: none; width: 18px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: var(--text-muted); }
  .fold:focus-visible { outline: 2px solid var(--text-secondary); }
  .fold :global(svg) { transition: transform var(--motion-fold) ease; }
  .folder:not(.open) .fold :global(svg) { transform: rotate(-90deg); }
  a { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; color: inherit; text-decoration: none; }
  a:focus-visible { outline: 2px solid var(--text-secondary); }
  .icon { display: inline-flex; flex: none; font-size: 15px; color: var(--text-muted); }
  .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count { flex: none; color: var(--text-muted); font-size: var(--text-meta); }
  .current a { color: var(--text-primary); font-weight: var(--weight-medium); }
  .current .icon { color: var(--text-primary); }
  .drop { background: var(--tint-hover); outline: 1.5px dashed var(--text-muted); }
  .sub { display: grid; grid-template-columns: minmax(0, 1fr); margin-left: 11px; padding-left: 4px; border-left: 1px solid var(--tint-active); }
  .sub :global(.item) { padding-left: 10px; }
</style>
