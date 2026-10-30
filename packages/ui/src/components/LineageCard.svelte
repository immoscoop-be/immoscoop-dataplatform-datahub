<script lang="ts" module>
  import type { LineageModel } from './Lineage.svelte';

  /** What a card of the Lineage shows, and what a click on it does. */
  export interface LineageCardData {
    [key: string]: unknown;
    model: LineageModel;
    /** The Resource of the page, in the middle. */
    center: boolean;
    /** It has next models to walk to. */
    clickable: boolean;
    /** Its next models are shown. */
    open: boolean;
    onchoose: () => void;
  }
</script>

<script lang="ts">
  import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';
  import Icon from '../foundations/Icon.svelte';
  import MaturityIcon from '../marks/MaturityIcon.svelte';

  /**
   * A model in the Lineage, as a card on the canvas of Svelte Flow (Lineage, DEC-UX-152): its icon, its
   * name on two lines at most, its layer and project, and the Resource it is with its Level. A model with
   * next models is a button that walks to them; the data comes in on its left and goes out on its right.
   */
  let { data }: NodeProps<Node<LineageCardData>> = $props();
</script>

<Handle type="target" position={Position.Left} isConnectable={false} />
<svelte:element
  this={data.clickable ? 'button' : 'div'}
  class="node"
  class:center={data.center}
  class:open={data.open}
  type={data.clickable ? 'button' : undefined}
  aria-expanded={data.clickable ? data.open : undefined}
  title={data.model.name}
  onclick={data.clickable ? data.onchoose : undefined}
  role={data.clickable ? undefined : 'listitem'}
>
  <span class="icon"><Icon name={data.model.icon} /></span>
  <span class="text">
    <span class="mono name">{data.model.name}</span>
    <span class="meta">{data.model.meta}</span>
    {#if data.model.resource}<span class="resource"><MaturityIcon level={data.model.resource.level} tooltip={false} />{data.model.resource.name}</span>{/if}
  </span>
</svelte:element>
<Handle type="source" position={Position.Right} isConnectable={false} />

<style>
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
  /* The data comes in and goes out at the middle of either side; nobody draws a new edge. */
  :global(.svelte-flow__node-model .svelte-flow__handle) { opacity: 0; pointer-events: none; }
</style>
