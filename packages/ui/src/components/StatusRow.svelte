<script lang="ts">
  import Icon from '../foundations/Icon.svelte';
  import { levelName } from '../foundations/levels.js';
  import { t } from '../foundations/texts.svelte.js';
  import MaturityIcon from '../marks/MaturityIcon.svelte';
  import Chip from '../primitives/Chip.svelte';

  /**
   * The state of an object as chips: its Level, whether it is published, and its Owner; no freshness
   * (Status row, DEC-UX-07). An Owner is the name of a group, never translated.
   */
  let { level, published, owner }: { level: number; published: boolean; owner: string | null } = $props();
</script>

<div class="row">
  <Chip><MaturityIcon {level} tooltip={false} />{levelName(level)}</Chip>
  {#if !published}<Chip><Icon name="eye-slash-fill" />{t('status.notPublished')}</Chip>{/if}
  <Chip><Icon name="users-three-fill" />{owner ?? t('status.noOwner')}</Chip>
</div>

<style>
  .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
</style>
