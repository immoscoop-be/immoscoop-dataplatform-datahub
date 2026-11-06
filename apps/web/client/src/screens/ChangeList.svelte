<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import type { IconName } from '@datahub/ui/foundations/icons.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import type { Change } from '../lib/permissions.js';

  /**
   * What a change does for one User (Change list, FR-PL-07): what they gain, what they lose and what changes
   * otherwise, the old value struck through; and last, that all else stays, their Owner Units too.
   */
  let { lines }: { lines: readonly Change[] } = $props();

  const ICONS: Record<Change['kind'], IconName> = { gain: 'plus-circle-fill', loss: 'minus-circle-fill', change: 'arrows-left-right' };
  const SAID: Record<Change['kind'], string> = { gain: 'users.changes.gain', loss: 'users.changes.loss', change: 'users.changes.change' };
</script>

<ul class="changes">
  {#each lines as line (`${line.key}:${line.detail}`)}
    <li class={line.kind}>
      <Icon name={ICONS[line.kind]} />
      <span><span class="hidden">{t(SAID[line.kind])}</span><b>{line.name}</b>{#if line.detail}<span class="detail"> · {line.detail}</span>{/if}{#if line.was} <del>{line.was}</del>{/if}</span>
    </li>
  {/each}
  <li class="stays"><Icon name="equals-fill" /><span>{t(lines.length > 0 ? 'users.changes.stays' : 'users.changes.same')}</span></li>
</ul>

<style>
  .changes { display: grid; gap: 6px; margin: 8px 0 0; padding: 10px 12px; list-style: none; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  li { display: flex; align-items: flex-start; gap: 8px; line-height: 1.45; }
  li > :global(.icon) { flex: none; margin-top: 2px; font-size: 15px; color: var(--text-secondary); }
  .gain > :global(.icon) { color: var(--col-teal-ink); }
  .loss > :global(.icon) { color: var(--signal-warn); }
  b { font-weight: var(--weight-medium); }
  del { color: var(--text-muted); }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
