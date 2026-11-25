<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import OriginTag from '@datahub/ui/marks/OriginTag.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import LearningRef from './LearningRef.svelte';

  /**
   * "Seems wrong?" next to a description from dbt opens this form on the Resource, in place of a new Message (FR-CV-17,
   * DEC-UX-338): the description quoted as dbt has it, what is wrong with it, required, and what it should say, optional
   * and filled in with the Business Description when there is one. Sent, it is a Request to the Data Team.
   */
  let {
    field,
    quoted,
    should: proposed,
    owner,
    onsend,
    oncancel,
  }: {
    /** The field whose description it is; null for the description of the Resource. */
    field: string | null;
    /** The description as dbt has it. */
    quoted: string;
    /** What it should say to start with: the Business Description, or empty. */
    should: string;
    /** The name of the Owner Unit, which is told too; null when it has none. */
    owner: string | null;
    /** Sends it; true once sent. */
    onsend: (text: string, should: string) => Promise<boolean>;
    oncancel: () => void;
  } = $props();

  let wrong = $state('');
  // What it should say starts from the Business Description; the User changes it as they like.
  let should = $state((() => proposed)());
  let busy = $state(false);
  let failed = $state(false);
  /** The title, with the term dbt and its ⓘ in it (DEC-UX-340). */
  const [before, after] = $derived((field ? t('dbtReport.titleField', { field, dbt: '\u0000' }) : t('dbtReport.title', { dbt: '\u0000' })).split('\u0000'));

  async function send(): Promise<void> {
    if (!wrong.trim() || busy) return;
    busy = true;
    failed = !(await onsend(wrong.trim(), should.trim()).catch(() => false));
    busy = false;
  }
</script>

<section class="report" aria-label={t('dbtReport.wrong')}>
  <div class="top">
    <span class="label">{before}<LearningRef place="dbt">{#snippet children(mark)}<span>dbt{@render mark?.()}</span>{/snippet}</LearningRef>{after}</span>
    <span class="kind">Request</span>
  </div>
  <div class="quote">
    <div class="quote-head"><span class="label">{field ?? t('dbtReport.quote')}</span><OriginTag origin="dbt" /></div>
    <p>{quoted}</p>
  </div>
  <label class="field">
    <span>{t('dbtReport.wrong')}</span>
    <textarea {...NO_PASSWORD_MANAGER}
      data-autofocus
      rows="3"
      maxlength="4000"
      bind:value={wrong}
      placeholder={t('dbtReport.wrong.placeholder')}
      onkeydown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
        if (event.key === 'Escape') oncancel();
      }}
    ></textarea>
  </label>
  <label class="field">
    <span>{t('dbtReport.should')} <span class="meta">· {t('dbtReport.should.note')}</span></span>
    <textarea {...NO_PASSWORD_MANAGER} rows="3" maxlength="4000" bind:value={should}></textarea>
  </label>
  <div class="foot">
    <p class="meta" role={failed ? 'alert' : undefined}>
      {#if failed}{t('dbtReport.failed')}{:else}<Icon name="bell-simple-fill" />{owner ? t('dbtReport.notify', { owner }) : t('dbtReport.notify.team')}{/if}
    </p>
    <Button variant="quiet" onclick={oncancel}>{t('collection.cancel')}</Button>
    <Button disabled={busy || !wrong.trim()} onclick={send}><Icon name="paper-plane-tilt-fill" />{t('dbtReport.send')}</Button>
  </div>
</section>

<style>
  .report { border-radius: var(--radius-lg); padding: 14px 16px; background: var(--surface-sub); }
  .top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .label { flex: 1; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-secondary); }
  .kind { flex: none; font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); color: var(--text-primary); background: var(--tint-active); }
  .quote { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-solid); font-size: var(--text-small); line-height: 1.5; }
  .quote-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .quote p { margin: 0; color: var(--text-secondary); white-space: pre-line; }
  .field { display: block; margin-top: 10px; }
  .field > span { display: block; margin-bottom: 6px; font-size: var(--text-meta); font-weight: var(--weight-medium); color: var(--text-secondary); }
  .field .meta { display: inline; font-weight: var(--weight-regular); }
  textarea { width: 100%; min-height: 64px; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid);
    border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .foot { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
  .meta { flex: 1; margin: 0; display: flex; align-items: center; gap: 5px; line-height: 1.4; font-size: var(--text-meta); color: var(--text-muted); }
  .meta :global(.icon) { flex: none; }
</style>
