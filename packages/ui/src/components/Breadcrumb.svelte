<script lang="ts" module>
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  /** A step of the path, a link when it has an address; something dragged onto it goes there (DEC-UX-157). */
  export interface Step {
    label: string;
    href?: string;
    /** Takes a drop: whether what is dragged would go here, and the events of the drop. */
    target?: { over: boolean } & Pick<HTMLAnchorAttributes, 'ondragover' | 'ondragleave' | 'ondrop'>;
  }
</script>

<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /** Where the page sits (Breadcrumb). A step with an address is a link. */
  let { steps }: { steps: readonly Step[] } = $props();
</script>

<nav class="breadcrumb" aria-label={t('breadcrumb.label')}>
  {#each steps as step, index (index)}{#if index > 0}{' / '}{/if}{#if step.href}<a
      href={step.href}
      class:drop={step.target?.over}
      ondragover={step.target?.ondragover}
      ondragleave={step.target?.ondragleave}
      ondrop={step.target?.ondrop}>{step.label}</a
    >{:else}{step.label}{/if}{/each}
</nav>

<style>
  .breadcrumb { font-size: var(--text-small); color: var(--text-muted); }
  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--text-primary); }
  a.drop { color: var(--text-primary); background: var(--tint-hover); outline: 1.5px dashed var(--text-muted); border-radius: var(--radius-sm); }
</style>
