<script lang="ts" module>
  import type { IconName } from '../foundations/icons.js';

  /** A model in the lineage, as a card shows it. */
  export interface LineageModel {
    id: string;
    name: string;
    /** Such as `staging · dbt-prod`. */
    meta: string;
    icon: IconName;
    /** The Resource it is, when the User sees it. */
    resource?: { name: string; level: number };
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import Icon from '../foundations/Icon.svelte';
  import MaturityIcon from '../marks/MaturityIcon.svelte';

  type Side = 'up' | 'down';

  /**
   * The lineage of a Resource, walked one step at a time and never shown whole (Lineage, DEC-UX-100,
   * FR-SR-54). The Resource stays in the middle; the models it is built on stand in a column on its left,
   * those built on it on its right. A click on a model adds its own next models a column further out and
   * marks it; a click on another model opens that branch and closes the one that was open; a click on an
   * open model closes it. Curves with an arrowhead join the models in the direction the data flows.
   */
  let {
    center,
    models,
    upstream,
    downstream,
    label,
    backLabel,
  }: {
    center: string;
    models: ReadonlyMap<string, LineageModel>;
    /** The models a model is built on, and those built on it. */
    upstream: (id: string) => readonly string[];
    downstream: (id: string) => readonly string[];
    label: string;
    backLabel: string;
  } = $props();

  const uid = $props.id();
  let side: Side | null = $state(null);
  let path: string[] = $state([]);

  const nextOf = (direction: Side, id: string) => (direction === 'up' ? upstream(id) : downstream(id)).filter((next) => models.has(next));

  /** The columns of a side, nearest the middle first: the direct models, then what each open model adds. */
  function columnsOf(direction: Side): string[][] {
    const columns = [nextOf(direction, center)];
    if (side === direction) {
      for (const id of path) {
        columns.push(nextOf(direction, id));
      }
    }
    return columns.filter((column) => column.length > 0);
  }

  const left = $derived(columnsOf('up'));
  const right = $derived(columnsOf('down'));
  const open = (direction: Side, depth: number, id: string) => side === direction && path[depth] === id;

  function choose(direction: Side, depth: number, id: string) {
    if (open(direction, depth, id)) {
      path = path.slice(0, depth);
      side = path.length > 0 ? direction : null;
      return;
    }
    path = [...(side === direction ? path.slice(0, depth) : []), id];
    side = direction;
  }

  function back() {
    side = null;
    path = [];
  }

  // The curves, drawn on a layer over the lineage from where the cards are.
  let box: HTMLElement | undefined = $state();
  let leftWing: HTMLElement | undefined = $state();
  const cards: Record<string, HTMLElement | undefined> = {};
  const keyOf = (direction: Side | 'center', depth: number, id: string) => `${direction}:${depth}:${id}`;
  let curves: { d: string; on: boolean }[] = $state([]);

  function draw() {
    if (!box) {
      return;
    }
    const frame = box.getBoundingClientRect();
    // A card scrolled out of its side draws no line.
    const shown = (card: HTMLElement) => {
      const wing = card.closest('.wing');
      if (!wing) {
        return true;
      }
      const at = card.getBoundingClientRect();
      const view = wing.getBoundingClientRect();
      return at.right > view.left + 4 && at.left < view.right - 4;
    };
    const curve = (from: HTMLElement | undefined, to: HTMLElement | undefined, on: boolean) => {
      if (!from || !to || !shown(from) || !shown(to)) {
        return [];
      }
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      const [x1, y1, x2, y2] = [a.right - frame.left, a.top + a.height / 2 - frame.top, b.left - frame.left, b.top + b.height / 2 - frame.top];
      const dx = Math.max(18, (x2 - x1) / 2);
      return [{ d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2 - 2},${y2}`, on }];
    };
    const middle = cards[keyOf('center', 0, center)];
    const drawn: { d: string; on: boolean }[] = [];
    // Right: the Resource feeds the first column, an open model the column it added.
    right.forEach((column, depth) => {
      const from = depth === 0 ? middle : cards[keyOf('down', depth - 1, path[depth - 1]!)];
      for (const id of column) {
        drawn.push(...curve(from, cards[keyOf('down', depth, id)], open('down', depth, id)));
      }
    });
    // Left: each column feeds the open model of the column nearer the middle, the first the Resource.
    left.forEach((column, depth) => {
      const to = depth === 0 ? middle : cards[keyOf('up', depth - 1, path[depth - 1]!)];
      for (const id of column) {
        drawn.push(...curve(cards[keyOf('up', depth, id)], to, open('up', depth, id)));
      }
    });
    curves = drawn;
  }

  // The left side shows the columns nearest the middle; columns further out scroll away.
  $effect(() => {
    void [left, right, models];
    tick().then(() => {
      if (leftWing) {
        leftWing.scrollLeft = leftWing.scrollWidth;
      }
      draw();
    });
  });
  $effect(() => {
    const redraw = () => requestAnimationFrame(draw);
    addEventListener('resize', redraw);
    return () => removeEventListener('resize', redraw);
  });
</script>

{#snippet card(direction: Side | 'center', depth: number, id: string)}
  {@const model = models.get(id)}
  {#if model}
    {@const clickable = direction !== 'center' && nextOf(direction, id).length > 0}
    <svelte:element
      this={clickable ? 'button' : 'div'}
      bind:this={cards[keyOf(direction, depth, id)]}
      class="node"
      class:center={direction === 'center'}
      class:open={direction !== 'center' && open(direction, depth, id)}
      type={clickable ? 'button' : undefined}
      aria-expanded={clickable ? open(direction, depth, id) : undefined}
      title={model.name}
      onclick={clickable ? () => choose(direction, depth, id) : undefined}
      role={clickable ? undefined : 'listitem'}
    >
      <span class="icon"><Icon name={model.icon} /></span>
      <span class="text">
        <span class="mono name">{model.name}</span>
        <span class="meta">{model.meta}</span>
        {#if model.resource}<span class="resource"><MaturityIcon level={model.resource.level} tooltip={false} />{model.resource.name}</span>{/if}
      </span>
    </svelte:element>
  {/if}
{/snippet}

{#if side !== null}
  <div class="back">
    <button type="button" class="reset" onclick={back}><Icon name="arrow-counter-clockwise" />{backLabel}</button>
  </div>
{/if}
<div class="lineage" bind:this={box} role="group" aria-label={label}>
  <svg class="edges" aria-hidden="true">
    <defs>
      <marker id="{uid}-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" /></marker>
    </defs>
    {#each curves as edge, index (index)}<path class="edge" class:on={edge.on} d={edge.d} marker-end="url(#{uid}-arrow)" />{/each}
  </svg>
  <div class="wing left" bind:this={leftWing} onscroll={() => requestAnimationFrame(draw)}>
    {#each [...left.keys()].reverse() as depth (depth)}
      <div class="column up" role="list">
        {#each left[depth]! as id (id)}{@render card('up', depth, id)}{/each}
      </div>
    {/each}
  </div>
  <div class="middle" role="list">{@render card('center', 0, center)}</div>
  <div class="wing right" onscroll={() => requestAnimationFrame(draw)}>
    {#each right as column, depth (depth)}
      <div class="column down" role="list">
        {#each column as id (id)}{@render card('down', depth, id)}{/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .lineage { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: start; padding: 6px 0 10px; }
  .edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; color: var(--text-muted); }
  .edge { fill: none; stroke: currentColor; stroke-width: 1.25; }
  .edge.on { stroke: var(--text-secondary); stroke-width: 1.5; }
  .wing { display: flex; align-items: flex-start; overflow-x: auto; padding: 4px 2px 8px; }
  .wing.left > :first-child { margin-left: auto; }
  .middle { padding: 4px 6px 0; }
  .column { display: flex; flex-direction: column; gap: 10px; flex: none; }
  .column.down { padding-left: 38px; }
  .column.up { padding-right: 38px; }
  .node { display: flex; gap: 10px; align-items: flex-start; text-align: left; width: 178px; height: 100px; overflow: hidden; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); border: 0; font: inherit; color: inherit; box-sizing: border-box; }
  button.node { cursor: pointer; }
  button.node:hover { box-shadow: 0 0 0 1.5px var(--tint-active); }
  button.node:focus-visible { outline: 2px solid var(--text-secondary); outline-offset: 2px; }
  .node.center { background: var(--surface-solid); box-shadow: 0 0 0 2px var(--text-primary); }
  .node.open { background: var(--surface-solid); box-shadow: 0 0 0 1.5px var(--text-secondary); }
  .icon { display: inline-flex; font-size: 17px; color: var(--text-secondary); margin-top: 2px; }
  .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-size: var(--text-meta); line-height: 15px; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 30px; }
  .text > .meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .resource { display: flex; align-items: center; gap: 6px; font-size: var(--text-meta); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .back { display: flex; justify-content: flex-end; margin: -6px 0 6px; }
  .reset { display: inline-flex; align-items: center; gap: 6px; font: var(--text-small) var(--font-family); color: var(--text-primary); background: transparent; border: 1px solid var(--tint-active); border-radius: var(--radius-pill); padding: 6px 12px; cursor: pointer; }
  .reset:hover { background: var(--tint-hover); }
</style>
