<script lang="ts">
  import DescriptionPair from '@datahub/ui/components/DescriptionPair.svelte';
  import ConfirmBar from '@datahub/ui/containers/ConfirmBar.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Collection, ResourceDetail } from '../lib/catalogue.js';

  /**
   * Publishing a Resource, its first Confirmation, in a sheet over its page (FR-SR-49, DEC-UX-31): who
   * will see it once published, what Data Hub checked, and what its Owner confirms: what it is and what it
   * stands for, as its descriptions say, never the figures in it (DEC-MR-07). The declaration and its
   * button are one bar (DEC-UX-63). Without its descriptions from dbt it stays at 1 · Available and cannot
   * be published (DEC-MR-10).
   */
  let {
    resource,
    collection,
    onpublish,
    onfields,
    onclose,
  }: {
    resource: ResourceDetail;
    collection: Collection;
    onpublish: () => Promise<boolean>;
    /** Shows its fields, on the tab Columns. */
    onfields: () => void;
    onclose: () => void;
  } = $props();

  const ready = $derived(resource.level >= 2);
  const described = $derived(resource.fields.filter((field) => field.description.trim() !== '').length);
  const owner = $derived(collection.ownerUnit.name);
  let busy = $state(false);
  let failed = $state(false);

  async function publish() {
    busy = true;
    failed = !(await onpublish());
    busy = false;
  }
</script>

<Sheet title={resource.displayName} roomy {onclose}>
  {#snippet top()}<p class="meta over">{t('publish.label')}</p>{/snippet}
  {#snippet head()}<p class="meta">{t('publish.meta', { collection: collection.name, owner })}</p>{/snippet}
  <div class="blocks">
    <section class="block">
      <div class="label">{t('publish.who')}</div>
      <p class="line">
        <Icon name="globe-simple-fill" />
        <span><b>{t('publish.who.title', { collection: collection.name })}</b> {t(collection.visibility === 'public' ? 'publish.who.public' : 'publish.who.private', { owner })}</span>
      </p>
    </section>
    <section class="block">
      <div class="label">{t('publish.checked')}</div>
      <p class="line"><Icon name="check-circle-fill" /><span>{t('publish.may', { collection: collection.name, owner })}</span></p>
      {#if ready}
        <p class="line"><Icon name="check-circle-fill" /><span><b>{t('publish.described.title')}</b> {t('publish.described.text', { described, count: resource.fields.length })}</span></p>
      {:else}
        <p class="line missing">
          <Icon name="warning-circle-fill" />
          <span>
            <b>{t('publish.undescribed.title')}</b>
            {resource.description.trim() ? t('publish.undescribed.fields') : t('publish.undescribed.table')}
            {t('publish.undescribed.then')}
          </span>
        </p>
      {/if}
    </section>
    {#if ready}
      <section class="block">
        <div class="label">{t('publish.confirm')}</div>
        <p class="meta text">{t('publish.confirm.text', { owner })}</p>
        <div class="what">
          <DescriptionPair business={resource.card.businessDescription} dbt={resource.description} none={t('resource.noDescription')} />
          <button type="button" class="text-link" onclick={onfields}>{t('publish.fields', { count: resource.fields.length, described })}<Icon name="arrow-right" /></button>
        </div>
        <p class="meta text">{t('publish.notData')}</p>
      </section>
    {:else}
      <section class="block">
        <div class="label">{t('publish.yours')}</div>
        <p class="meta text">{t('publish.yours.text')}</p>
      </section>
    {/if}
  </div>
  {#snippet foot()}
    <div class="foot">
      <p class="meta keep" role={failed ? 'alert' : undefined}>{failed ? t('resource.actionFailed') : t('publish.keep')}</p>
      <Button variant="quiet" onclick={onclose}>{t('collection.cancel')}</Button>
      <ConfirmBar declaration={t('publish.declare', { owner })} disabled={!ready} {busy} onconfirm={publish}>
        <Icon name="globe-simple-fill" />{t('publish.button')}
      </ConfirmBar>
    </div>
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
  .missing :global(.icon) { color: var(--signal-warn); }
  .text { display: block; line-height: 1.5; margin: 0; }
  .what { margin: 8px 0 10px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .text-link { all: unset; display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; width: 100%; }
  .keep { flex: 1 1 100%; margin: 0; line-height: 1.5; }
</style>
