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
  import '@xyflow/svelte/dist/style.css';
  import { Controls, type Edge, MarkerType, type Node, Position, SvelteFlow, type Viewport } from '@xyflow/svelte';
  import Icon from '../foundations/Icon.svelte';
  import { t } from '../foundations/texts.svelte.js';
  import LineageCard, { type LineageCardData } from './LineageCard.svelte';
  import LineageFollow from './LineageFollow.svelte';

  type Side = 'up' | 'down';

  /**
   * The lineage of a Resource, walked one step at a time and never shown whole (Lineage, DEC-UX-100,
   * FR-SR-54), drawn on the canvas of Svelte Flow (DEC-UX-152). The Resource stays in the middle; the
   * models it is built on stand in a column on its left, those built on it on its right. A click on a
   * model adds its own next models a column further out and marks it; a click on another model opens that
   * branch and closes the one that was open; a click on an open model closes it. Curves with an arrowhead
   * join the models in the direction the data flows. The canvas pans when dragged and zooms with its
   * buttons, a pinch, or Cmd or Ctrl and scrolling; each step brings what was walked into view.
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

  /** The size of a card, and the room between the columns and between the cards of one. */
  const WIDTH = 178;
  const HEIGHT = 100;
  const BETWEEN = 76;
  const UNDER = 10;
  /** The room kept around the walked flow, more on the left where the zoom buttons stand, and how far it may shrink to fit. */
  const PAD = 24;
  const BUTTONS = 56;
  const SMALLEST = 0.5;
  const NODE_TYPES = { model: LineageCard };

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

  // The canvas: a card per model where its column puts it, the Resource at the origin, the columns aligned at the top.
  const keyOf = (direction: Side | 'center', depth: number, id: string) => `${direction}:${depth}:${id}`;
  const HANDLES = [
    { type: 'target' as const, position: Position.Left, x: 0, y: HEIGHT / 2 - 0.5 },
    { type: 'source' as const, position: Position.Right, x: WIDTH - 1, y: HEIGHT / 2 - 0.5 },
  ];

  function card(direction: Side | 'center', depth: number, id: string, x: number, y: number): Node<LineageCardData> {
    const clickable = direction !== 'center' && nextOf(direction, id).length > 0;
    return {
      id: keyOf(direction, depth, id),
      type: 'model',
      position: { x, y },
      width: WIDTH,
      height: HEIGHT,
      handles: HANDLES,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      data: {
        model: models.get(id)!,
        center: direction === 'center',
        clickable,
        open: direction !== 'center' && open(direction, depth, id),
        onchoose: () => choose(direction as Side, depth, id),
      },
    };
  }

  function edge(source: string, target: string, on: boolean): Edge {
    return {
      id: `${source}>${target}`,
      source,
      target,
      type: 'default',
      class: on ? 'on' : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      selectable: false,
      focusable: false,
    };
  }

  const graph = $derived.by(() => {
    const step = WIDTH + BETWEEN;
    const middle = keyOf('center', 0, center);
    const nodes: Node[] = [card('center', 0, center, 0, 0)];
    const edges: Edge[] = [];
    // Right: the Resource feeds the first column, an open model the column it added.
    right.forEach((column, depth) => {
      const from = depth === 0 ? middle : keyOf('down', depth - 1, path[depth - 1]!);
      column.forEach((id, row) => {
        nodes.push(card('down', depth, id, (depth + 1) * step, row * (HEIGHT + UNDER)));
        edges.push(edge(from, keyOf('down', depth, id), open('down', depth, id)));
      });
    });
    // Left: each column feeds the open model of the column nearer the middle, the first the Resource.
    left.forEach((column, depth) => {
      const to = depth === 0 ? middle : keyOf('up', depth - 1, path[depth - 1]!);
      column.forEach((id, row) => {
        nodes.push(card('up', depth, id, -(depth + 1) * step, row * (HEIGHT + UNDER)));
        edges.push(edge(keyOf('up', depth, id), to, open('up', depth, id)));
      });
    });
    const rows = Math.max(1, ...left.map((column) => column.length), ...right.map((column) => column.length));
    return { nodes, edges, rows };
  });

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  $effect.pre(() => {
    nodes = graph.nodes;
    edges = graph.edges;
  });

  // What was walked, in view: whole when it fits, shrunk down to half if need be. When even that is too
  // wide, the Resource stays in view with the columns nearest it, on the side that was walked.
  let width = $state(0);
  let height = $state(0);
  const view: Viewport | null = $derived.by(() => {
    if (width === 0 || height === 0) {
      return null;
    }
    const xs = graph.nodes.map((node) => node.position.x);
    const ys = graph.nodes.map((node) => node.position.y);
    const [fromX, fromY] = [Math.min(...xs), Math.min(...ys)];
    const [wide, high] = [Math.max(...xs) + WIDTH - fromX, Math.max(...ys) + HEIGHT - fromY];
    const room = width - BUTTONS - PAD;
    const zoom = Math.min(1, Math.max(SMALLEST, Math.min(room / wide, (height - 2 * PAD) / high)));
    const across = wide * zoom <= room;
    const x = across
      ? BUTTONS + (room - wide * zoom) / 2 - fromX * zoom
      : side === 'up'
        ? width - PAD - WIDTH * zoom
        : side === 'down'
          ? BUTTONS
          : BUTTONS + (room - WIDTH * zoom) / 2;
    const y = high * zoom <= height - 2 * PAD ? (height - high * zoom) / 2 - fromY * zoom : PAD - fromY * zoom;
    return { x, y, zoom };
  });
</script>

{#if side !== null}
  <div class="back">
    <button type="button" class="reset" onclick={back}><Icon name="arrow-counter-clockwise" />{backLabel}</button>
  </div>
{/if}
<div class="lineage" role="group" aria-label={label} style:--rows={graph.rows} bind:clientWidth={width} bind:clientHeight={height}>
  <SvelteFlow
    bind:nodes
    bind:edges
    nodeTypes={NODE_TYPES}
    minZoom={0.3}
    maxZoom={1.5}
    nodesDraggable={false}
    nodesConnectable={false}
    nodesFocusable={false}
    edgesFocusable={false}
    elementsSelectable={false}
    zoomOnScroll={false}
    zoomOnDoubleClick={false}
    zoomActivationKey={['Meta', 'Control']}
    preventScrolling={false}
    defaultMarkerColor={null}
    ariaLabelConfig={{
      'controls.ariaLabel': t('lineage.controls'),
      'controls.zoomIn.ariaLabel': t('lineage.zoomIn'),
      'controls.zoomOut.ariaLabel': t('lineage.zoomOut'),
      'controls.fitView.ariaLabel': t('lineage.fit'),
      'node.a11yDescription.default': '',
      'node.a11yDescription.keyboardDisabled': '',
      'edge.a11yDescription.default': '',
    }}
  >
    <Controls showLock={false} position="bottom-left" fitViewOptions={{ padding: 0.08, maxZoom: 1 }} />
    <LineageFollow {view} />
  </SvelteFlow>
</div>

<style>
  /* As high as its longest column, within reason; the canvas takes the colours of Data Hub (DEC-UX-152). */
  .lineage { height: clamp(260px, calc(var(--rows) * 110px + 60px), 70vh); margin: 0 -6px; }
  .lineage :global(.svelte-flow) {
    --xy-background-color: transparent;
    --xy-edge-stroke: var(--text-muted);
    --xy-edge-stroke-width: 1.25;
    --xy-node-background-color: transparent;
    --xy-node-border: none;
    --xy-node-border-radius: var(--radius-md);
    --xy-node-boxshadow-hover: none;
    --xy-node-boxshadow-selected: none;
    --xy-node-color: inherit;
    --xy-controls-box-shadow: none;
    --xy-controls-button-background-color: var(--surface-solid);
    --xy-controls-button-background-color-hover: var(--tint-hover);
    --xy-controls-button-color: var(--text-secondary);
    --xy-controls-button-color-hover: var(--text-primary);
    --xy-controls-button-border-color: var(--tint-hover);
    --xy-attribution-background-color: transparent;
    font: inherit;
    color: inherit;
  }
  .lineage :global(.svelte-flow__node) { cursor: default; padding: 0; }
  .lineage :global(.svelte-flow__edge.on .svelte-flow__edge-path) { stroke: var(--text-secondary); stroke-width: 1.5; }
  .lineage :global(.svelte-flow__controls) { border-radius: var(--radius-md); overflow: hidden; }
  .lineage :global(.svelte-flow__attribution a) { color: var(--text-muted); }
  .back { display: flex; justify-content: flex-end; margin: -6px 0 6px; }
  .reset { display: inline-flex; align-items: center; gap: 6px; font: var(--text-small) var(--font-family); color: var(--text-primary); background: transparent; border: 1px solid var(--tint-active); border-radius: var(--radius-pill); padding: 6px 12px; cursor: pointer; }
  .reset:hover { background: var(--tint-hover); }
</style>
