<script lang="ts">
  import Breadcrumb from '@datahub/ui/components/Breadcrumb.svelte';
  import Search from '@datahub/ui/components/Search.svelte';
  import Table from '@datahub/ui/containers/Table.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
  import { ago, day } from '@datahub/ui/foundations/when.js';
  import Avatar from '@datahub/ui/primitives/Avatar.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Segmented from '@datahub/ui/primitives/Segmented.svelte';
  import type { Identity, KeyOfUser } from '../lib/identity.js';
  import { initialsOf } from '../lib/initials.js';

  /**
   * Excel keys, a tool of Admin (FR-PL-03, DEC-UX-130): every Excel key of this environment with its User, the
   * name they gave it, when it was made, last used and expires, newest last used on top. A search on a User or a
   * key, and a filter: the active keys, those expiring within a month, or the revoked ones. The Data Team revokes
   * a key at once, after a confirmation in the place of the row, as on My page; its User gets a Message that says
   * so (MSG-KEY-02). A revoked key stays, struck through, with when and by whom.
   */
  let {
    identity,
    environment,
    me,
    onactive,
  }: {
    identity: Pick<Identity, 'allExcelKeys' | 'revokeAnyExcelKey'>;
    /** The environment of Data Hub, such as uat. */
    environment: string;
    /** The Google ID of the User, whose own revocations read "by you". */
    me: string;
    /** How many keys are active, for the panel of Admin. */
    onactive?: (count: number) => void;
  } = $props();

  type Shown = 'active' | 'soon' | 'revoked';
  const NONE: Record<Shown, string> = { active: 'admin.keys.none.active', soon: 'admin.keys.none.soon', revoked: 'admin.keys.none.revoked' };
  const MONTH = 30 * 24 * 60 * 60 * 1000;

  let keys: KeyOfUser[] | null | undefined = $state();
  let shown: Shown = $state('active');
  let search = $state('');
  let revoking: string | undefined = $state();
  let busy = $state(false);
  let failed = $state(false);
  /** Keys revoked here, which stay in their place, struck through, until the filter changes. */
  let revokedHere: string[] = $state([]);

  async function load() {
    try {
      keys = await identity.allExcelKeys();
    } catch (error) {
      console.error('The Excel keys could not be read', error);
      keys = null;
    }
  }
  $effect(() => {
    load();
  });

  const soon = (key: KeyOfUser) => !key.revokedAt && new Date(key.expiresAt).getTime() - Date.now() < MONTH;
  const of = (wanted: Shown) => (key: KeyOfUser) =>
    wanted === 'revoked' ? key.revokedAt !== null : key.revokedAt === null && (wanted === 'active' || soon(key));
  const count = (wanted: Shown) => (keys ?? []).filter(of(wanted)).length;

  $effect(() => {
    if (keys) onactive?.(count('active'));
  });

  const words = $derived(search.trim().toLowerCase());
  const latest = (key: KeyOfUser) => new Date(key.lastUsedAt ?? key.createdAt).getTime();
  const listed = $derived(
    (keys ?? [])
      .filter((key) => of(shown)(key) || revokedHere.includes(key.id))
      .filter((key) => !words || [key.name, key.user.name, key.user.email].some((text) => text.toLowerCase().includes(words)))
      .sort((one, other) => (shown === 'revoked' ? new Date(other.revokedAt ?? 0).getTime() - new Date(one.revokedAt ?? 0).getTime() : latest(other) - latest(one))),
  );

  function choose(value: Shown) {
    [revokedHere, revoking] = [[], undefined];
    shown = value;
  }

  async function revoke(key: KeyOfUser) {
    busy = true;
    failed = false;
    try {
      await identity.revokeAnyExcelKey(key.id);
      revokedHere = [...revokedHere, key.id];
      revoking = undefined;
      await load();
    } catch (error) {
      console.error(`The Excel key ${key.name} could not be revoked`, error);
      failed = true;
    }
    busy = false;
  }

  function revokedBy(key: KeyOfUser): string {
    const when = new Date(key.revokedAt ?? 0).toDateString() === new Date().toDateString() ? t('admin.keys.today') : day(key.revokedAt ?? '', currentLanguage());
    return key.revokedById === me ? t('admin.keys.revokedByYou', { when }) : t('admin.keys.revokedBy', { when, name: key.revokedBy ?? '' });
  }
</script>

<Breadcrumb steps={[{ label: 'Admin' }]} />
<div class="head">
  <div class="what">
    <h1 class="page-title">{t('keys.title')}</h1>
    <p class="meta lead">{t('admin.keys.lead', { environment })}</p>
  </div>
  <Chip><Icon name="cloud-fill" />Data Hub {environment}</Chip>
</div>

{#if keys === null}
  <p class="meta problem">{t('keys.failed')}</p>
{:else if keys}
  <div class="tools">
    <div class="find"><Search bind:value={search} placeholder={t('admin.keys.search')} surface="solid" /></div>
    <Segmented
      options={[
        { value: 'active', label: `${t('admin.keys.active')} ${count('active')}` },
        { value: 'soon', label: `${t('admin.keys.soon')} ${count('soon')}` },
        { value: 'revoked', label: `${t('admin.keys.revoked')} ${count('revoked')}` },
      ]}
      value={shown}
      onchange={choose}
      label={t('admin.keys.which')}
    />
  </div>
  {#if failed}<p class="meta problem" role="alert">{t('admin.keys.failed')}</p>{/if}
  <Table label={t('keys.title')}>
    {#snippet head()}
      <tr>
        <th>{t('admin.keys.column.user')}</th>
        <th>{t('admin.keys.column.key')}</th>
        <th>{t('keys.column.made')}</th>
        <th>{t('keys.column.used')}</th>
        <th>{t('keys.column.expires')}</th>
        <th><span class="hidden">{t('keys.revoke')}</span></th>
      </tr>
    {/snippet}
    {#each listed as key (key.id)}
      {#if revoking === key.id}
        <tr class="confirm">
          <td colspan="6">
            <span class="confirm-row">
              <span class="sign"><Icon name="warning-fill" /></span>
              <span class="grow"><b>{t('admin.keys.revoke.title', { name: key.name, user: key.user.name })}</b> {t('admin.keys.revoke.text', { user: key.user.name })}</span>
              <Button variant="outline" onclick={() => (revoking = undefined)}>{t('keys.cancel')}</Button>
              <Button variant="danger" disabled={busy} onclick={() => revoke(key)}>{t('keys.revoke')}</Button>
            </span>
          </td>
        </tr>
      {:else}
        <tr class:revoked={key.revokedAt !== null}>
          <td>
            <span class="who">
              <Avatar initials={initialsOf(key.user.name || key.user.email)} size="mini" />
              <span>{key.user.name}<span class="meta email">{key.user.email}</span></span>
            </span>
          </td>
          <td><span class="name"><Icon name="key" /><span class="key-name">{key.name}</span></span></td>
          <td class="muted nowrap">{day(key.createdAt, currentLanguage())}</td>
          <td class="nowrap" class:muted={!key.lastUsedAt}>{key.lastUsedAt ? ago(key.lastUsedAt, currentLanguage()) : t('keys.notYet')}</td>
          <td class="nowrap">
            {#if key.revokedAt}
              <span class="muted">{revokedBy(key)}</span>
            {:else}
              <span class:soon={soon(key)} class:muted={!soon(key)}>{day(key.expiresAt, currentLanguage())}</span>
            {/if}
          </td>
          <td class="end">{#if !key.revokedAt}<Button variant="outline" onclick={() => (revoking = key.id)}>{t('keys.revoke')}</Button>{/if}</td>
        </tr>
      {/if}
    {:else}
      <tr><td colspan="6" class="muted none">{words ? t('admin.keys.noMatch') : t(NONE[shown])}</td></tr>
    {/each}
    {#snippet after()}<p class="meta foot">{t('admin.keys.foot')}</p>{/snippet}
  </Table>
{/if}

<style>
  .head { display: flex; align-items: flex-end; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .what { flex: 1; min-width: 280px; }
  .lead { display: block; margin-top: 4px; line-height: 1.5; max-width: 720px; }
  .tools { display: flex; align-items: center; gap: 10px; margin: 18px 0 12px; flex-wrap: wrap; }
  .find { flex: 1; max-width: 420px; min-width: 220px; }
  .problem { display: block; margin: 12px 0; }
  .who { display: inline-flex; align-items: center; gap: 10px; }
  .email { display: block; }
  .name { display: inline-flex; align-items: center; gap: 8px; font-weight: var(--weight-medium); }
  .name :global(svg) { color: var(--text-muted); }
  .muted { color: var(--text-muted); }
  .nowrap { white-space: nowrap; }
  .soon { color: var(--signal-warn); }
  .end { text-align: right; width: 1%; }
  .none { padding: 14px 10px; }
  .revoked td { color: var(--text-muted); }
  .revoked .key-name { text-decoration: line-through; }
  .confirm-row { display: flex; align-items: center; gap: 10px; font-size: var(--text-small); line-height: 1.5; }
  .confirm-row .sign { display: inline-flex; color: var(--signal-urgent); font-size: 18px; }
  .grow { flex: 1; }
  .foot { display: block; margin: 8px 10px 2px; line-height: 1.5; }
  .hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
