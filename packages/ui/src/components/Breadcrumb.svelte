<script lang="ts">
  import { t } from '../foundations/texts.svelte.js';

  /** Where the page sits (Breadcrumb). A step with an address is a link. */
  let { steps }: { steps: readonly { label: string; href?: string }[] } = $props();
</script>

<nav class="breadcrumb" aria-label={t('breadcrumb.label')}>
  {#each steps as step, index (index)}{#if index > 0}{' / '}{/if}{#if step.href}<a href={step.href}>{step.label}</a>{:else}{step.label}{/if}{/each}
</nav>

<style>
  .breadcrumb { font-size: var(--text-small); color: var(--text-muted); }
  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--text-primary); }
</style>
