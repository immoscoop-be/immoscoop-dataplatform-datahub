<script lang="ts">
  import { t } from '@datahub/ui/foundations/texts.svelte.js';

  /**
   * The start screen of a section whose part is not built yet (build order): its name and one calm
   * sentence. Each part replaces it with the start screen of its design.
   */
  let { title }: { title: string } = $props();
</script>

<h1 class="page-title">{title}</h1>
<p class="meta soon">{t('start.soon')}</p>

<style>
  .soon { margin: 10px 0 0; font-size: var(--text-small); }
</style>
