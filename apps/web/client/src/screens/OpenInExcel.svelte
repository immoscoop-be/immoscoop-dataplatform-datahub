<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import { myPagePath } from '../lib/routes.js';

  /**
   * "Open in Excel" on the page of a Lens (DEC-UX-159): the address of the Lens for Power Query, to copy, and
   * the three steps in Excel, signing in with Basic, the e-mail and an Excel key (DEC-CH-06). Excel gets its
   * result as data, with the Parameters at their defaults, at most 10,000 rows.
   */
  let { lens, address, onclose }: { lens: string; address: string; onclose: () => void } = $props();
</script>

<Sheet title={t('excel.title')} {onclose}>
  {#snippet head()}<span class="meta">{lens}</span>{/snippet}
  <p class="meta intro">{t('excel.intro')}</p>
  <div class="once">
    <span class="label">{t('excel.address')}</span>
    <div class="box"><span class="mono address">{address}</span><CopyButton text={address} label={t('excel.copy')} /></div>
  </div>
  <span class="label steps-label">{t('keys.inExcel')}</span>
  <ol class="steps">
    <li>{t('excel.step.web')}</li>
    <li>{t('excel.step.basic')} <a href={myPagePath('keys')}>{t('excel.step.key')}</a></li>
    <li>{t('excel.step.load')}</li>
  </ol>
  {#snippet foot()}
    <span class="meta grow">{t('excel.yourName')}</span>
    <Button onclick={onclose}>{t('keys.done')}</Button>
  {/snippet}
</Sheet>

<style>
  .intro { display: block; line-height: 1.5; margin: 4px 0 12px; }
  .once { padding: 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .label { display: block; font-size: var(--text-meta); color: var(--text-muted); }
  .box { display: flex; align-items: center; gap: 10px; margin-top: 6px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-solid); }
  .address { flex: 1; font-size: 13px; word-break: break-all; }
  .steps-label { margin-top: 16px; }
  .steps { margin: 6px 0 0; padding-left: 20px; font-size: var(--text-small); line-height: 1.6; }
  .steps a { color: var(--text-primary); text-underline-offset: 3px; }
  .grow { flex: 1; }
</style>
