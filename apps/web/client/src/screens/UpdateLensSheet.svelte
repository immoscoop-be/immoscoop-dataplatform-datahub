<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { formatBytes } from '@datahub/ui/foundations/bytes.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { Lens, Preflight, Query, QueryClient } from '../lib/query.js';

  /**
   * "Update the Lens" (DEC-UX-77, FR-LE-16), in a sheet over a query used as the Lens: what it replaces, its
   * SQL and Parameters; what stays; and the size check of the query as it is now. Within range the Lens is
   * updated at once; above 100 MB the User updates it anyway; above 1 GB it goes to the Data Team and waits
   * (FR-LE-08, FR-LE-09). The version it has now stays in its history.
   */
  let {
    query,
    lens,
    collection,
    preflight,
    client,
    onupdated,
    onclose,
  }: {
    query: Query;
    lens: NonNullable<Query['lens']>;
    collection: string;
    /** The Pre-flight of the query as it is now; null while it is checked. */
    preflight: Preflight | null;
    client: QueryClient;
    onupdated: (lens: Lens) => void;
    onclose: () => void;
  } = $props();

  let busy = $state(false);
  let failed = $state(false);
  let text = $state('');
  /** The size check as query measured it on the update, when that differs from what the page knew. */
  let measured = $state<Preflight | null>(null);

  const language = $derived(currentLanguage());
  const bytes = (value: number) => formatBytes(value, language);
  const check = $derived(measured ?? preflight);

  async function update(approve: boolean): Promise<void> {
    busy = true;
    failed = false;
    try {
      const outcome = await client.updateLens(lens.id, query.id, approve, text.trim());
      if (outcome.kind === 'refused') measured = outcome.preflight;
      else onupdated(outcome.lens);
    } catch (error) {
      console.error('The Lens could not be updated', error);
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<Sheet title={lens.name} roomy {onclose}>
  {#snippet top()}<p class="meta over">{t('lens.update.title')}</p>{/snippet}
  {#snippet head()}<p class="meta">{t('lens.update.meta', { collection })}</p>{/snippet}
  <div class="blocks">
    <section class="block">
      <div class="label">{t('lens.update.replaces')}</div>
      <p class="line"><Icon name="arrows-clockwise" /><span><b>{t('lens.update.replaces.what')}</b> {t('lens.update.replaces.text')}</span></p>
    </section>
    <section class="block">
      <div class="label">{t('lens.update.stays')}</div>
      <p class="line"><Icon name="check-circle-fill" /><span>{t('lens.update.stays.text')}</span></p>
    </section>
    <section class="block">
      <div class="label">{t('lens.size.title')}</div>
      {#if check === null}
        <p class="line"><Icon name="circle-dashed-fill" /><span>{t('query.checking')}</span></p>
      {:else if !check.runnable || check.bytes === null || check.range === null}
        <p class="line warn"><Icon name="warning-fill" /><span>{t('lens.update.cannot')}</span></p>
      {:else if check.range === 'free'}
        <p class="line"><Icon name="check-circle-fill" /><span><b>{t('lens.update.free', { bytes: bytes(check.bytes) })}</b> {t('lens.update.free.text', { approve: bytes(check.thresholds.approve), request: bytes(check.thresholds.request) })}</span></p>
      {:else if check.range === 'approve'}
        <p class="line warn"><Icon name="warning-fill" /><span><b>{t('lens.update.large', { bytes: bytes(check.bytes) })}</b> {t('lens.update.large.text', { approve: bytes(check.thresholds.approve) })}</span></p>
      {:else}
        <p class="line urgent"><Icon name="warning-circle-fill" /><span><b>{t('lens.update.veryLarge', { bytes: bytes(check.bytes) })}</b> {t('lens.update.veryLarge.text', { request: bytes(check.thresholds.request) })}</span></p>
        <Field label={t('lens.size.word')}><textarea rows="2" maxlength="500" bind:value={text}></textarea></Field>
      {/if}
    </section>
  </div>
  {#snippet foot()}
    <p class="meta note" role={failed ? 'alert' : undefined}>{failed ? t('lens.update.failed') : t('lens.update.note')}</p>
    <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
    {#if check?.range === 'request'}
      <Button disabled={busy || !check.runnable} onclick={() => update(false)}><Icon name="paper-plane-tilt" />{t('lens.size.send')}</Button>
    {:else}
      <Button disabled={busy || !check?.runnable} onclick={() => update(check?.range === 'approve')}
        ><Icon name="arrows-clockwise" />{t(check?.range === 'approve' ? 'lens.update.anyway' : 'lens.update.button')}</Button
      >
    {/if}
  {/snippet}
</Sheet>

<style>
  b { font-weight: var(--weight-medium); }
  .over { display: block; margin: 0 0 2px; }
  .blocks { flex: 1; overflow: auto; margin: 8px -4px 0; padding: 0 4px; }
  .block { padding: 14px 0; border-top: 1px solid var(--tint-active); }
  .block:first-child { border-top: 0; padding-top: 4px; }
  .line { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 3px 0; font-size: var(--text-small); line-height: 1.5; }
  .line :global(.icon) { font-size: 17px; margin-top: 1px; color: var(--text-secondary); flex: none; }
  .warn :global(.icon) { color: var(--signal-warn); }
  .urgent :global(.icon) { color: var(--signal-urgent); }
  .note { flex: 1; margin: 0; }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
</style>
