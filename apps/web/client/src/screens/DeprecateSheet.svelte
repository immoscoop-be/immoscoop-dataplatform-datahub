<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { Collection, ResourceDetail } from '../lib/catalogue.js';

  /**
   * Deprecating a published Resource, in a sheet over its page (FR-SR-50, DEC-UX-101, resource-deprecate):
   * what it does, why, required, and what to use instead, optional, a Resource the User sees. "Deprecate"
   * stays off until a reason is written.
   */
  let {
    resource,
    collection,
    others,
    ondeprecate,
    onclose,
  }: {
    resource: ResourceDetail;
    collection: Collection;
    /** The published Resources the User sees, to use instead, each with its Collection. */
    others: readonly { id: string; displayName: string; collection: string }[];
    ondeprecate: (reason: string, insteadOf: string | null) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  let reason = $state('');
  let instead = $state('');
  let busy = $state(false);
  let failed = $state(false);

  async function deprecate() {
    busy = true;
    failed = !(await ondeprecate(reason.trim(), instead || null));
    busy = false;
  }
</script>

<Sheet title={resource.displayName} roomy {onclose}>
  {#snippet top()}<p class="meta over">{t('deprecate.label')}</p>{/snippet}
  {#snippet head()}<p class="meta">{t('publish.meta', { collection: collection.name, owner: collection.ownerUnit.name })}</p>{/snippet}
  <div class="blocks">
    <section class="block">
      <div class="label">{t('deprecate.does')}</div>
      <p class="line"><Icon name="archive-fill" /><span><b>{t('deprecate.discouraged.title')}</b> {t('deprecate.discouraged.text')}</span></p>
      <p class="line"><Icon name="check-circle-fill" /><span><b>{t('deprecate.open.title')}</b> {t('deprecate.open.text')}</span></p>
      <p class="line"><Icon name="arrow-counter-clockwise" /><span>{t('deprecate.back')}</span></p>
    </section>
    <section class="block">
      <Field label={t('deprecate.reason')}><textarea bind:value={reason} rows="3" maxlength="500"></textarea></Field>
      <Field label={t('deprecate.instead')} hint={t('deprecate.instead.hint')}>
        <select bind:value={instead}>
          <option value="">{t('deprecate.nothing')}</option>
          {#each others as other (other.id)}<option value={other.id}>{other.displayName} · {other.collection}</option>{/each}
        </select>
      </Field>
    </section>
  </div>
  {#snippet foot()}
    <p class="meta history" role={failed ? 'alert' : undefined}>{failed ? t('resource.actionFailed') : t('deprecate.history')}</p>
    <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
    <Button disabled={busy || reason.trim() === ''} onclick={deprecate}><Icon name="archive-fill" />{t('resource.deprecate')}</Button>
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
  .history { flex: 1; margin: 0; }
  textarea, select { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; }
  textarea { resize: vertical; }
  textarea:focus, select:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
</style>
