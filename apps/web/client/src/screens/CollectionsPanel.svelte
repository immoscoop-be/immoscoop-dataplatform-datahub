<script lang="ts">
  import ListItem from '@datahub/ui/components/ListItem.svelte';
  import TreeGroup from '@datahub/ui/components/TreeGroup.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import type { Resource } from '../lib/catalogue.js';
  import { resourcePath } from '../lib/routes.js';
  import PanelSoon from './PanelSoon.svelte';

  /**
   * The panel of Collections (What is in the panel). For the Data Team, on top: "Without a Collection",
   * the Resources that wait for one, unfolded (DEC-UX-16, FR-SR-35). The Collections themselves come
   * with part 3.
   */
  let { waiting, current }: { waiting: readonly Resource[] | undefined; current: string | undefined } = $props();
</script>

{#if waiting && waiting.length > 0}
  <div class="top">
    <TreeGroup icon="tray" name={t('collections.unassigned')} urgent>
      {#snippet meta()}<Chip variant="urgent">{waiting.length}</Chip>{t('collections.unassigned.meta')}{/snippet}
      {#each waiting as resource (resource.id)}
        <ListItem href={resourcePath(resource.id)} name={resource.displayName} level={resource.level} current={resource.id === current} />
      {/each}
    </TreeGroup>
  </div>
{/if}
<PanelSoon />

<style>
  .top { margin-top: 30px; }
</style>
