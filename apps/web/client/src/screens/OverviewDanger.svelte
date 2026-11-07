<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { ResourceDetail } from '../lib/catalogue.js';
  import { resourcePath } from '../lib/routes.js';

  /**
   * The Danger zone of the Overview, for its Owner Unit and the Data Team (DEC-UX-176): what changes how everyone may
   * rely on the Resource, each explained before its form. Deprecate (FR-SR-50): what it does and when to do it, then
   * why, required, and what to use instead, optional, a published Resource the User sees; once deprecated, who did it,
   * when and why, and "Take it away". Only a published Resource can be deprecated.
   */
  let {
    resource,
    others,
    ondeprecate,
    onundeprecate,
  }: {
    resource: ResourceDetail;
    /** The published Resources the User sees, to use instead, each with its Collection. */
    others: readonly { id: string; displayName: string; collection: string }[];
    ondeprecate: (reason: string, insteadOf: string | null) => Promise<boolean>;
    onundeprecate: () => Promise<boolean>;
  } = $props();

  let reason = $state('');
  let instead = $state('');
  let busy = $state(false);
  let failed = $state(false);

  const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;
  const day = (value: string) => new Intl.DateTimeFormat(LOCALES[currentLanguage()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  const why = $derived(resource.deprecation ? resource.deprecation.reason.replace(/([^.!?])$/, '$1.') : '');

  async function attempt(work: () => Promise<boolean>): Promise<void> {
    busy = true;
    failed = !(await work());
    busy = false;
    if (!failed) {
      reason = '';
      instead = '';
    }
  }

  function deprecate(event: SubmitEvent) {
    event.preventDefault();
    if (reason.trim()) void attempt(() => ondeprecate(reason.trim(), instead || null));
  }
</script>

<section class="danger" aria-labelledby="deprecate-title">
  <div class="head">
    <Icon name="archive-fill" />
    <div>
      <h3 id="deprecate-title">{t('resource.deprecate')}</h3>
      <p>{t('danger.deprecate.when')}</p>
    </div>
  </div>
  <div class="does">
    <p class="line"><Icon name="archive-fill" /><span><b>{t('deprecate.discouraged.title')}</b> {t('deprecate.discouraged.text')}</span></p>
    <p class="line"><Icon name="check-circle-fill" /><span><b>{t('deprecate.open.title')}</b> {t('deprecate.open.text')}</span></p>
    <p class="line"><Icon name="arrow-counter-clockwise" /><span><b>{t('danger.back.title')}</b> {t('danger.back.text')}</span></p>
  </div>
  {#if resource.deprecation}
    <div class="now">
      <p>
        <b>{t('resource.deprecated.title')}</b>
        {t('resource.deprecated.text', { by: resource.deprecation.by, date: day(resource.deprecation.at), reason: why })}
        {#if resource.deprecation.insteadOf}<a href={resourcePath(resource.deprecation.insteadOf.id)}>{t('resource.deprecated.use', { name: resource.deprecation.insteadOf.displayName })}</a>.{/if}
      </p>
      <Button variant="outline" disabled={busy} onclick={() => attempt(onundeprecate)}><Icon name="arrow-counter-clockwise" />{t('resource.takeAway')}</Button>
    </div>
  {:else if !resource.published}
    <p class="not-yet">{t('danger.notPublished')}</p>
  {:else}
    <form class="form" onsubmit={deprecate}>
      <Field label={t('deprecate.reason')}><textarea bind:value={reason} rows="3" maxlength="500"></textarea></Field>
      <Field label={t('deprecate.instead')} hint={t('deprecate.instead.hint')}>
        <select bind:value={instead}>
          <option value="">{t('deprecate.nothing')}</option>
          {#each others as other (other.id)}<option value={other.id}>{other.displayName} · {other.collection}</option>{/each}
        </select>
      </Field>
      <div class="foot">
        <span class="meta">{t('deprecate.history')}</span>
        <Button type="submit" disabled={busy || reason.trim() === ''}><Icon name="archive-fill" />{t('resource.deprecate')}</Button>
      </div>
    </form>
  {/if}
  {#if failed}<p class="failed" role="alert">{t('resource.actionFailed')}</p>{/if}
</section>

<style>
  b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .danger { border-radius: var(--radius-lg); outline: 1px solid var(--tint-active); outline-offset: -1px; padding: 18px 20px; }
  .head { display: flex; gap: 12px; align-items: flex-start; }
  .head > :global(.icon) { font-size: 22px; color: var(--text-secondary); margin-top: 2px; flex: none; }
  h3 { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .head p { margin: 4px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); max-width: 720px; }
  .does { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--tint-hover); }
  .line { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 4px 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .line > :global(.icon) { font-size: 16px; margin-top: 2px; flex: none; }
  .form { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); max-width: 720px; }
  textarea, select { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; }
  textarea { resize: vertical; }
  textarea:focus, select:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .foot { display: flex; align-items: center; gap: 12px; }
  .meta { flex: 1; font-size: var(--text-meta); color: var(--text-muted); }
  .now { display: flex; align-items: center; gap: 14px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
  .now p { flex: 1; margin: 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .now a { color: var(--text-primary); text-underline-offset: 3px; }
  .not-yet { margin: 14px 0 0; padding-top: 14px; border-top: 1px solid var(--tint-hover); font-size: var(--text-small); color: var(--text-secondary); }
  .failed { margin: 10px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>
