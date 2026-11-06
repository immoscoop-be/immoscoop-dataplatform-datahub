<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';

  /**
   * Deleting a Lens, in a sheet that "Delete this lens…" under Save on its Edit opens, for its Owner Unit and the Data
   * Team (DEC-UX-185, FR-LE-18): what deleting does, explained first, with how many colleagues ran it in the last 30
   * days, who are told; then why, optional; and "Keep it" or "Delete for good".
   */
  let {
    name,
    usedBy,
    ondelete,
    onclose,
  }: {
    name: string;
    /** How many Users ran it in the last 30 days, on its page or from Excel. */
    usedBy: number;
    /** Deletes it with why; false when it did not. */
    ondelete: (reason: string) => Promise<boolean>;
    onclose: () => void;
  } = $props();

  let reason = $state('');
  let busy = $state(false);
  let failed = $state(false);

  async function remove(): Promise<void> {
    busy = true;
    failed = !(await ondelete(reason.trim()));
    busy = false;
  }
</script>

<Sheet title={t('lens.delete.title')} roomy {onclose}>
  {#snippet top()}<p class="meta over">{name}</p>{/snippet}
  <p class="when">{t('lens.delete.when')}</p>
  <div class="does">
    <p class="line"><Icon name="eye-slash-fill" /><span><b>{t('lens.delete.gone.title')}</b> {t('lens.delete.gone.text')}</span></p>
    <p class="line"><Icon name="users-three-fill" /><span><b>{t('lens.delete.used.title', { count: usedBy })}</b> {t(usedBy > 0 ? 'lens.delete.used.told' : 'lens.delete.used.none')}</span></p>
    <p class="line"><Icon name="archive-fill" /><span><b>{t('lens.delete.kept.title')}</b> {t('lens.delete.kept.text')}</span></p>
  </div>
  <div class="why">
    <Field label={t('lens.delete.reason')}><textarea bind:value={reason} rows="3" maxlength="500"></textarea></Field>
  </div>
  {#if failed}<p class="failed" role="alert">{t('lens.delete.failed')}</p>{/if}
  {#snippet foot()}
    <span class="meta history">{t('lens.delete.history')}</span>
    <Button variant="quiet" disabled={busy} onclick={onclose}>{t('lens.delete.keep')}</Button>
    <Button variant="danger" disabled={busy} onclick={remove}><Icon name="trash-fill" />{t('lens.delete.forGood')}</Button>
  {/snippet}
</Sheet>

<style>
  b { font-weight: var(--weight-medium); color: var(--text-primary); }
  .over { margin: 0 0 2px; }
  .when { margin: 12px 0 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .does { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--tint-hover); }
  .line { display: flex; gap: 10px; align-items: flex-start; margin: 0; padding: 4px 0; font-size: var(--text-small); line-height: 1.55; color: var(--text-secondary); }
  .line > :global(.icon) { font-size: 16px; margin-top: 2px; flex: none; }
  .why { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--tint-hover); }
  textarea { width: 100%; box-sizing: border-box; font: var(--text-small) var(--font-family); line-height: 1.5; color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-field); padding: 8px 10px; resize: vertical; }
  textarea:focus { outline: 2px solid var(--text-secondary); outline-offset: 1px; }
  .meta { font-size: var(--text-meta); color: var(--text-muted); }
  .history { flex: 1; }
  .failed { margin: 10px 0 0; font-size: var(--text-small); color: var(--signal-urgent); }
</style>
