<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';

  /**
   * The Danger zone at the foot of Edit of a Lens, for its Owner Unit and the Data Team (DEC-UX-185, FR-LE-18): what
   * deleting does, explained first, with how many colleagues ran it in the last 30 days, who are told; then why,
   * optional, and "Delete…", which asks once more in place before it deletes for good.
   */
  let {
    name,
    usedBy,
    ondelete,
  }: {
    name: string;
    /** How many Users ran it in the last 30 days, on its page or from Excel. */
    usedBy: number;
    /** Deletes it with why; false when it did not. */
    ondelete: (reason: string) => Promise<boolean>;
  } = $props();

  let reason = $state('');
  let sure = $state(false);
  let busy = $state(false);
  let failed = $state(false);

  async function remove(): Promise<void> {
    busy = true;
    failed = !(await ondelete(reason.trim()));
    busy = false;
  }
</script>

<section class="card danger" aria-labelledby="delete-lens-title">
  <div class="head">
    <Icon name="trash-fill" />
    <div>
      <h3 id="delete-lens-title">{t('lens.delete.title')}</h3>
      <p>{t('lens.delete.when')}</p>
    </div>
  </div>
  <div class="does">
    <p class="line"><Icon name="eye-slash-fill" /><span><b>{t('lens.delete.gone.title')}</b> {t('lens.delete.gone.text')}</span></p>
    <p class="line"><Icon name="users-three-fill" /><span><b>{t('lens.delete.used.title', { count: usedBy })}</b> {t(usedBy > 0 ? 'lens.delete.used.told' : 'lens.delete.used.none')}</span></p>
    <p class="line"><Icon name="archive-fill" /><span><b>{t('lens.delete.kept.title')}</b> {t('lens.delete.kept.text')}</span></p>
  </div>
  {#if sure}
    <div class="sure" role="alertdialog" aria-labelledby="delete-lens-sure">
      <p id="delete-lens-sure"><b>{t('lens.delete.sure', { name })}</b> {t(usedBy > 0 ? 'lens.delete.sure.told' : 'lens.delete.sure.none', { count: usedBy })}</p>
      <Button variant="quiet" disabled={busy} onclick={() => (sure = false)}>{t('lens.delete.keep')}</Button>
      <Button variant="danger" disabled={busy} onclick={remove}><Icon name="trash-fill" />{t('lens.delete.forGood')}</Button>
    </div>
  {:else}
    <form
      class="form"
      onsubmit={(event) => {
        event.preventDefault();
        sure = true;
      }}
    >
      <Field label={t('lens.delete.reason')}><textarea bind:value={reason} rows="2" maxlength="500"></textarea></Field>
      <div class="foot">
        <span class="meta">{t('lens.delete.history')}</span>
        <Button type="submit" variant="outline"><Icon name="trash-fill" />{t('lens.delete.ask')}</Button>
      </div>
    </form>
  {/if}
  {#if failed}<p class="failed" role="alert">{t('lens.delete.failed')}</p>{/if}
</section>

<style>
  b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .danger { margin-top: 22px; border-radius: var(--radius-lg); outline: 1px solid var(--tint-active); outline-offset: -1px; padding: 18px 20px; }
  .head { display: flex; gap: 12px; align-items: flex-start; }
  .head > :global(.icon) { font-size: 22px; color: var(--text-secondary); margin-top: 2px; flex: none; }
  h3 { margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .head p { margin: 4px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); max-width: 720px; }
  .does { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--tint-hover); }
  .line { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 4px 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .line > :global(.icon) { font-size: 16px; margin-top: 2px; flex: none; }
  .form { display: flex; flex-direction: column; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); max-width: 720px; }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .foot { display: flex; align-items: center; gap: 12px; }
  .foot :global(button) { color: var(--signal-urgent); }
  .meta { flex: 1; font-size: var(--text-meta); color: var(--text-muted); }
  .sure { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
  .sure p { flex: 1 1 280px; margin: 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .failed { margin: 10px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>
