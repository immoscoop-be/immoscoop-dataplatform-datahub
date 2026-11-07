<script lang="ts">
  import type { Snippet } from 'svelte';
  import Explained from '../containers/Explained.svelte';
  import Icon from '../foundations/Icon.svelte';
  import { levelName } from '../foundations/levels.js';
  import { t } from '../foundations/texts.svelte.js';
  import Marker from '../marks/Marker.svelte';
  import MaturityIcon from '../marks/MaturityIcon.svelte';
  import Chip from '../primitives/Chip.svelte';

  /**
   * The state of an object as chips: its Level, whether it is published, and its Owner; no freshness
   * (Status row, DEC-UX-07). An Owner is the name of a group, never translated. A deprecated object
   * carries "Deprecated" with its reason on hover (DEC-UX-101). The page can have the Learning Centre explain
   * the Level: it then carries the marker, and its pop-out (DEC-UX-57).
   */
  let {
    level,
    published,
    owner,
    deprecated = null,
    explainLevel,
  }: {
    level: number;
    published: boolean;
    owner: string | null;
    deprecated?: string | null;
    /** What explains the Level: its pop-out, what it is for a screen reader, and whether it stays tinted. */
    explainLevel?: { label: string; active: boolean; pop: Snippet<[() => void]> };
  } = $props();
</script>

<div class="row">
  {#if explainLevel}
    <Explained label={explainLevel.label} shape="pill" active={explainLevel.active} pop={explainLevel.pop}>
      <Chip><MaturityIcon {level} tooltip={false} />{levelName(level)}<Marker /></Chip>
    </Explained>
  {:else}
    <Chip><MaturityIcon {level} tooltip={false} />{levelName(level)}</Chip>
  {/if}
  {#if published}<Chip><Icon name="globe-simple-fill" />{t('status.published')}</Chip>{:else}<Chip><Icon name="eye-slash-fill" />{t('status.notPublished')}</Chip>{/if}
  <Chip><Icon name="users-three-fill" />{owner ?? t('status.noOwner')}</Chip>
  {#if deprecated !== null}<span class="deprecated" title={deprecated}><Chip variant="warn"><Icon name="archive-fill" />{t('status.deprecated')}</Chip></span>{/if}
</div>

<style>
  .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .deprecated { display: inline-flex; }
</style>
