<script lang="ts">
  import { renderLog } from '@datahub/contracts/log';
  import { currentLanguage } from '../foundations/texts.svelte.js';

  /**
   * The latest entries of a Log: each with its Log ID, its text in the language of the reader, and
   * its day (Log list, FR-SR-11, NFR-LOC-10). The text is built here, from the Log ID and parameters.
   */
  let { entries }: { entries: readonly { logId: string; params: Readonly<Record<string, string>>; at: string | Date }[] } = $props();

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = $derived(new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short' }));
</script>

<div class="log">
  {#each entries as entry, index (index)}
    <div class="line">
      <span class="mono id">{entry.logId}</span>
      <span class="text">{renderLog(entry.logId, entry.params, currentLanguage())}</span>
      <span class="at">{day.format(new Date(entry.at))}</span>
    </div>
  {/each}
</div>

<style>
  .log { margin-top: 6px; }
  .line { display: flex; gap: 10px; font-size: var(--text-small); padding: 7px 0; border-top: 1px solid var(--tint-active); }
  .line:first-child { border-top: 0; }
  .id { width: 62px; flex: none; color: var(--text-muted); }
  .text { flex: 1; min-width: 0; }
  .at { color: var(--text-muted); white-space: nowrap; }
</style>
