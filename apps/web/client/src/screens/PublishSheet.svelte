<script lang="ts">
  import DescriptionPair from '@datahub/ui/components/DescriptionPair.svelte';
  import ConfirmBar from '@datahub/ui/containers/ConfirmBar.svelte';
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import type { Collection, ResourceDetail } from '../lib/catalogue.js';
  import { checklistOf, type StepPlace } from '../lib/journey.js';

  /**
   * Publishing a Resource, its first Confirmation, in a sheet over its page (FR-SR-49, DEC-UX-31): who
   * will see it once published, what Data Hub checked, and what its Owner confirms: what it is and what it
   * stands for, as its descriptions say, never the figures in it (DEC-MR-07). The declaration and its
   * button are one bar (DEC-UX-63). Without its descriptions from dbt it stays at 1 · Available and cannot
   * be published (DEC-MR-10). What Data Hub checked is the one list of what makes it ready to publish (DEC-MR-15,
   * DEC-MR-16): each open step leads to its part, and Claude takes the Owner through them (DEC-CL-17). What the Owner
   * confirms is the whole card, read back; the declaration accepts every text on it, and goes with the Confirmation
   * (DEC-MR-17).
   */
  let {
    resource,
    collection,
    onpublish,
    onfields,
    onpart,
    onclose,
  }: {
    resource: ResourceDetail;
    collection: Collection;
    /** Publishes it with the declaration the Owner ticked; answers whether it worked. */
    onpublish: (declaration: string) => Promise<boolean>;
    /** Shows its fields, on the tab Columns. */
    onfields: () => void;
    /** Goes to where an open step is done: a part of the Overview, or Columns. */
    onpart: (place: StepPlace) => void;
    onclose: () => void;
  } = $props();

  /** Described in dbt, the first condition (DEC-MR-10). */
  const described = $derived(resource.level >= 2);
  const checks = $derived(resource.journey ? checklistOf(resource.journey) : null);
  /** Ready: Described, and every step required to publish done; an older catalogue without the journey says Described only. */
  const ready = $derived(described && (checks?.ready ?? true));
  const card = $derived(resource.card);
  const dbtFields = $derived(resource.fields.filter((field) => field.description.trim() !== '').length);
  const owner = $derived(collection.ownerUnit.name);
  const day = (value: string) => new Intl.DateTimeFormat(currentLanguage() === 'nl' ? 'nl-BE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  let busy = $state(false);
  let failed = $state(false);

  async function publish() {
    busy = true;
    failed = !(await onpublish(t('publish.declare', { owner })));
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
      {#if described}
        <p class="line"><Icon name="check-circle-fill" /><span><b>{t('publish.described.title')}</b> {t('publish.described.text', { described: dbtFields, count: resource.fields.length })}</span></p>
        {#if checks}
          {#if checks.open.length === 0}
            <p class="line"><Icon name="check-circle-fill" /><span><b>{t('publish.required.done')}</b> {checks.done.join('; ')}.</span></p>
          {:else}
            {#if checks.done.length > 0}<p class="line"><Icon name="check-circle-fill" /><span><b>{t('publish.done')}</b> {checks.done.join('; ')}.</span></p>{/if}
            {#each checks.open as open (open.step)}
              <p class="line missing">
                <Icon name="warning-circle-fill" />
                <span><b>{open.name}:</b> {open.what}.{#if open.place}{' '}<button type="button" class="text-link inline" onclick={() => onpart(open.place as StepPlace)}>{t('publish.goTo')}</button>{/if}</span>
              </p>
            {/each}
          {/if}
          {#if checks.advised.length > 0}
            <p class="line"><Icon name="circle" /><span><b>{t('publish.advised')}</b> {checks.advised.map((line) => line.what).join('; ')}. {t('publish.advised.after')}</span></p>
          {/if}
          {#if checks.eda.length > 0}
            <p class="line eda"><Icon name="diamond" /><span><b>{t('publish.eda')}</b> {checks.eda.map((line) => line.what).join('; ')}.</span></p>
          {/if}
          {#if checks.open.length > 0}<p class="meta text claude"><Icon name="chat-circle-text" /> {t('publish.claude', { name: resource.displayName })}</p>{/if}
        {/if}
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
          <DescriptionPair business={card.businessDescription} dbt={resource.description} none={t('resource.noDescription')} />
          <!-- The rest of the card, read back as a colleague will see it (DEC-MR-17). -->
          {#if card.intendedUse}<div class="label">{t('resource.intendedUse')}</div><p class="read">{card.intendedUse}</p>{/if}
          {#if card.pitfalls}<div class="label">{t('resource.pitfalls')}</div><p class="read">{card.pitfalls}</p>{/if}
          <div class="label">{t('resource.gaps')}{card.reliableSince ? ` · ${t('publish.since', { day: day(card.reliableSince) })}` : ''}</div>
          <p class="read">{card.knownGaps.length > 0 ? card.knownGaps.map((gap) => gap.text).join(' ') : t('publish.gapsNone')}</p>
          <div class="label">{t('resource.keyFields')} · {t('resource.parameters')}</div>
          <p class="read">{card.keyFields.join(', ') || t('publish.none')} · {card.parameters.join(', ') || t('publish.none')}</p>
          <button type="button" class="text-link" onclick={onfields}>{t('publish.fields', { count: resource.fields.length, described: dbtFields })}<Icon name="arrow-right" /></button>
        </div>
        <p class="meta text">{t('publish.notData')}</p>
      </section>
    {:else if described}
      <section class="block">
        <div class="label">{t('publish.yours')}</div>
        <p class="meta text">{t('publish.steps.text')}</p>
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
  .eda :global(.icon) { color: var(--col-olive); }
  .claude { margin-top: 8px; }
  .claude :global(.icon) { vertical-align: -2px; }
  .what .label { margin: 10px 0 2px; }
  .read { margin: 0; color: var(--text-secondary); line-height: 1.5; white-space: pre-line; }
  .text-link.inline { margin-top: 0; display: inline; }
  .text { display: block; line-height: 1.5; margin: 0; }
  .what { margin: 8px 0 10px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); font-size: var(--text-small); }
  .text-link { all: unset; display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
  .text-link:focus-visible { outline: 2px solid var(--text-secondary); }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; width: 100%; }
  .keep { flex: 1 1 100%; margin: 0; line-height: 1.5; }
</style>
