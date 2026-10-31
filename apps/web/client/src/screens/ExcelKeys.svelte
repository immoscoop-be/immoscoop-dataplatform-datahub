<script lang="ts">
  import Sheet from '@datahub/ui/containers/Sheet.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import CopyButton from '@datahub/ui/primitives/CopyButton.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import type { ExcelKey, Identity } from '../lib/identity.js';

  /**
   * The tab Excel keys of My page (FR-PL-01, FR-PL-02, DEC-DH-79): a sentence on what a key does, "New Excel
   * key", and every key of the User with when it was made, last used and expires; one that expires within a
   * month has its date in the warning colour. Revoke asks to confirm in the place of the row; a revoked key
   * stays, struck through. New Excel key is a sheet: a name, then the key, shown once, with Copy, and the
   * three steps in Excel, signing in with Basic (DEC-CH-06).
   */
  let { identity }: { identity: Pick<Identity, 'excelKeys' | 'makeExcelKey' | 'revokeExcelKey'> } = $props();

  const MONTH = 30 * 24 * 60 * 60 * 1000;
  let keys: ExcelKey[] | null | undefined = $state();
  let making = $state(false);
  let name = $state('');
  let problem = $state('');
  let busy = $state(false);
  let made: { key: ExcelKey; secret: string } | undefined = $state();
  let revoking: string | undefined = $state();

  async function load() {
    try {
      keys = await identity.excelKeys();
    } catch (error) {
      console.error('The Excel keys could not be read', error);
      keys = null;
    }
  }
  $effect(() => {
    load();
  });

  function open() {
    [making, name, problem, made] = [true, '', '', undefined];
  }

  async function make(event: SubmitEvent) {
    event.preventDefault();
    const wanted = name.trim();
    if (wanted.length < 1 || wanted.length > 80) {
      problem = t('keys.problem.name');
      return;
    }
    busy = true;
    try {
      made = await identity.makeExcelKey(wanted);
      await load();
    } catch (error) {
      console.error('The Excel key could not be made', error);
      problem = t('keys.problem.failed');
    }
    busy = false;
  }

  async function revoke(key: ExcelKey) {
    busy = true;
    try {
      await identity.revokeExcelKey(key.id);
      revoking = undefined;
      await load();
    } catch (error) {
      console.error(`The Excel key ${key.name} could not be revoked`, error);
    }
    busy = false;
  }

  const soon = (key: ExcelKey) => new Date(key.expiresAt).getTime() - Date.now() < MONTH;
</script>

<div class="section-head">
  <h2>{t('keys.title')}</h2>
  <Button onclick={open}><Icon name="key-fill" />{t('keys.new')}</Button>
</div>
<p class="meta intro">{t('keys.intro')}</p>

{#if keys === null}
  <p class="meta">{t('keys.failed')}</p>
{:else if keys && keys.length === 0}
  <p class="meta">{t('keys.none')}</p>
{:else if keys}
  <Table label={t('keys.title')}>
    {#snippet head()}
      <tr>
        <th>{t('keys.column.name')}</th>
        <th>{t('keys.column.made')}</th>
        <th>{t('keys.column.used')}</th>
        <th>{t('keys.column.expires')}</th>
        <th><span class="hidden">{t('keys.revoke')}</span></th>
      </tr>
    {/snippet}
    {#each keys as key (key.id)}
      {#if revoking === key.id}
        <tr class="confirm">
          <td colspan="5">
            <span class="confirm-row">
              <span class="sign"><Icon name="warning-fill" /></span>
              <span class="grow"><b>{t('keys.revoke.title', { name: key.name })}</b> {t('keys.revoke.text')}</span>
              <Button variant="outline" onclick={() => (revoking = undefined)}>{t('keys.cancel')}</Button>
              <Button variant="danger" disabled={busy} onclick={() => revoke(key)}>{t('keys.revoke')}</Button>
            </span>
          </td>
        </tr>
      {:else}
        <tr class:revoked={key.revokedAt !== null}>
          <td><span class="name"><Icon name="key" /><span class="key-name">{key.name}</span></span></td>
          <td class="muted nowrap">{day(key.createdAt, currentLanguage())}</td>
          <td class="nowrap" class:muted={!key.lastUsedAt}>{key.lastUsedAt ? ago(key.lastUsedAt, currentLanguage()) : t('keys.notYet')}</td>
          <td class="nowrap">
            {#if key.revokedAt}
              <span class="muted">{t('keys.revokedOn', { day: day(key.revokedAt, currentLanguage()) })}</span>
            {:else}
              <span class:soon={soon(key)} class:muted={!soon(key)}>{day(key.expiresAt, currentLanguage())}</span>
            {/if}
          </td>
          <td class="end">{#if !key.revokedAt}<Button variant="outline" onclick={() => (revoking = key.id)}>{t('keys.revoke')}</Button>{/if}</td>
        </tr>
      {/if}
    {/each}
    {#snippet after()}<p class="meta foot">{t('keys.foot')}</p>{/snippet}
  </Table>
{/if}

{#if making}
  <Sheet title={t('keys.new')} onclose={() => (making = false)}>
    {#snippet head()}<span class="meta">{t('me.tabs')}</span>{/snippet}
    {#if made}
      <div class="once">
        <span class="label">{t('keys.yours')}</span>
        <div class="box"><span class="mono secret">{made.secret}</span><CopyButton text={made.secret} label={t('keys.copy')} /></div>
        <p class="warn"><span class="sign"><Icon name="eye-slash-fill" /></span><span><b>{t('keys.once.title')}</b> {t('keys.once.text')}</span></p>
      </div>
      <span class="label steps-label">{t('keys.inExcel')}</span>
      <ol class="steps">
        <li>{t('keys.step.web')}</li>
        <li>{t('keys.step.basic')}</li>
        <li>{t('keys.step.refresh')}</li>
      </ol>
    {:else}
      <form id="new-key" onsubmit={make} novalidate>
        <Field label={t('keys.field.name')} problem={problem || undefined}>
          <input bind:value={name} maxlength="80" placeholder={t('keys.field.placeholder')} />
        </Field>
        <p class="meta">{t('keys.field.hint')}</p>
      </form>
    {/if}
    {#snippet foot()}
      {#if made}
        <span class="meta grow">{t('keys.inList')}</span>
        <Button onclick={() => (making = false)}>{t('keys.done')}</Button>
      {:else}
        <span class="meta grow">{t('keys.personal')}</span>
        <Button variant="outline" onclick={() => (making = false)}>{t('keys.cancel')}</Button>
        <Button type="submit" form="new-key" disabled={busy}><Icon name="key-fill" />{t('keys.make')}</Button>
      {/if}
    {/snippet}
  </Sheet>
{/if}

<style>
  .section-head { display: flex; align-items: center; gap: 12px; margin: 4px 0 8px; }
  .section-head h2 { flex: 1; margin: 0; font-size: var(--text-section); font-weight: var(--weight-medium); }
  .intro { display: block; max-width: 720px; line-height: 1.5; margin: 0 0 12px; }
  .name { display: inline-flex; align-items: center; gap: 8px; font-weight: var(--weight-medium); }
  .name :global(svg) { color: var(--text-muted); }
  .muted { color: var(--text-muted); }
  .nowrap { white-space: nowrap; }
  .soon { color: var(--signal-warn); }
  .end { text-align: right; width: 1%; }
  .revoked td { color: var(--text-muted); }
  .revoked .key-name { text-decoration: line-through; }
  .confirm-row { display: flex; align-items: center; gap: 10px; font-size: var(--text-small); line-height: 1.5; }
  .confirm-row .sign { display: inline-flex; color: var(--signal-urgent); font-size: 18px; }
  .grow { flex: 1; }
  .foot { display: block; margin: 8px 10px 2px; line-height: 1.5; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .once { padding: 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
  .label { display: block; font-size: var(--text-meta); color: var(--text-muted); }
  .box { display: flex; align-items: center; gap: 10px; margin-top: 6px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-solid); }
  .secret { flex: 1; font-size: 13px; word-break: break-all; }
  .warn { display: flex; gap: 8px; margin: 10px 0 0; font-size: var(--text-small); line-height: 1.5; }
  .warn .sign { display: inline-flex; color: var(--signal-warn); font-size: 17px; margin-top: 1px; }
  .steps-label { margin-top: 16px; }
  .steps { margin: 6px 0 0; padding-left: 20px; font-size: var(--text-small); line-height: 1.6; }
</style>
