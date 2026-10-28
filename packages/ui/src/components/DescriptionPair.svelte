<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../foundations/texts.svelte.js';
  import OriginTag from '../marks/OriginTag.svelte';

  /**
   * The two descriptions of a Resource or a field side by side (Description pair, DEC-UX-61): the
   * Business Description on the left, from the Owner, and the one from dbt on the right, each with where
   * it comes from. Neither replaces the other. Without a Business Description, the one from dbt stands
   * alone, unless the page edits it: then the field stands on the left. On a narrow screen the Business
   * Description comes first.
   */
  let {
    business,
    dbt,
    none,
    edit,
    below,
  }: {
    business: string;
    dbt: string;
    /** What stands where dbt has no description. */
    none: string;
    /** The field for the Business Description, while editing. */
    edit?: Snippet;
    /** What stands under the description from dbt, such as that it is not edited here. */
    below?: Snippet;
  } = $props();

  const both = $derived(Boolean(edit) || business.trim() !== '');
</script>

<div class="pair" class:both>
  {#if both}
    <div>
      <div class="head"><span class="label">{t('description.business')}</span><OriginTag origin="owner" /></div>
      {#if edit}{@render edit()}{:else}<p class="prose strong">{business}</p>{/if}
    </div>
  {/if}
  <div>
    <div class="head"><span class="label">{t('description.dbt')}</span><OriginTag origin="dbt" /></div>
    {#if dbt.trim()}<p class="prose">{dbt}</p>{:else}<p class="prose none">{none}</p>{/if}
    {@render below?.()}
  </div>
</div>

<style>
  .pair { display: grid; gap: 14px 28px; }
  .pair.both { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .head .label { margin: 0; }
  .prose { margin: 0; line-height: 1.65; color: var(--text-secondary); white-space: pre-line; }
  .strong { color: var(--text-primary); }
  .none { font-size: var(--text-small); color: var(--text-muted); line-height: 1.5; }
</style>
