<script lang="ts">
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';

  /**
   * One page for a link to something that does not exist and to something the User may not see; it
   * does not say which of the two (DEC-UX-32, FR-CO-32, FR-CO-17). It says what to do instead, and
   * offers no "Ask for access" (OP-CO-13).
   */
</script>

<div class="gone">
  <svg width="160" height="84" viewBox="0 0 160 84" aria-hidden="true">
    <circle cx="62" cy="42" r="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 5" />
    <circle cx="98" cy="42" r="34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 5" />
  </svg>
  <h1>{t('notFound.title')}</h1>
  <p>{t('notFound.text')}</p>
  <div class="ways">
    <div class="way card">
      <span class="icon"><Icon name="paper-plane-tilt" /></span>
      <span><b>{t('notFound.colleague.title')}</b> {t('notFound.colleague.text')}</span>
    </div>
    <div class="way card">
      <span class="icon"><Icon name="magnifying-glass" /></span>
      <span><b>{t('notFound.search.title')}</b> {t('notFound.search.text')}</span>
    </div>
  </div>
  <div class="actions">
    <Button variant="outline" href="/collections"><Icon name="stack-fill" />Collections</Button>
  </div>
</div>

<style>
  .gone { max-width: 520px; margin: 11vh auto 0; text-align: center; }
  svg { color: var(--text-muted); }
  h1 { font-size: 24px; font-weight: var(--weight-medium); margin: 12px 0 0; }
  .gone > p { margin: 8px 0 0; font-size: var(--text-small); line-height: 1.6; color: var(--text-secondary); }
  .ways { display: grid; gap: 8px; margin-top: 22px; text-align: left; }
  .way { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius-md); font-size: var(--text-small); line-height: 1.5; }
  .way .icon { font-size: 20px; color: var(--text-secondary); display: flex; }
  .way b { font-weight: var(--weight-medium); }
  .way > span:last-child { flex: 1; min-width: 0; }
  .actions { display: flex; justify-content: center; gap: 14px; margin-top: 22px; }
</style>
