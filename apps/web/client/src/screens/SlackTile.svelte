<script lang="ts">
  import { NO_PASSWORD_MANAGER } from '@datahub/ui/foundations/fields.js';
  import Callout from '@datahub/ui/containers/Callout.svelte';
  import SubTile from '@datahub/ui/containers/SubTile.svelte';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t, type Language } from '@datahub/ui/foundations/texts.svelte.js';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Chip from '@datahub/ui/primitives/Chip.svelte';
  import Field from '@datahub/ui/primitives/Field.svelte';
  import { NotFound } from '../lib/api.js';
  import type { Catalogue, SlackState } from '../lib/catalogue.js';
  import { dayOfMonth } from '../lib/moment.js';

  /**
   * The tile Slack on Profile (DEC-UX-209, FR-LN-07), only where the Slack app of Data Hub is set up (OP-UX-78): the
   * Slack account Data Hub finds the User by, Found by their Google address or Confirmed with its date, with Another
   * address; or, when Slack has no one by it, that notifications come by e-mail alone (EC-LN-01). Another address is
   * looked up first, then a code goes to that Slack account, and it counts once the User types the code (OP-LN-08).
   */
  let {
    slack,
    language,
  }: {
    slack: Pick<Catalogue, 'slack' | 'slackLookup' | 'slackCode' | 'slackConfirm' | 'slackReset'>;
    language: Language;
  } = $props();

  /** What the tile shows: the account, an address being typed, the account found by it, none found, or the code. */
  type Mode = 'shown' | 'typing' | 'found' | 'nomatch' | 'code';

  let shown: SlackState | undefined = $state();
  let mode: Mode = $state('shown');
  let email = $state('');
  let name = $state('');
  let code = $state('');
  /** How many tries a wrong code leaves, or that the code ended; null while nothing went wrong. */
  let wrong: number | 'expired' | null = $state(null);
  let busy = $state(false);
  let failed = $state(false);

  $effect(() => {
    slack.slack().then(
      (state) => (shown = state),
      (error) => console.error('Slack could not be read', error),
    );
  });

  /** A confirmed address, not the Google one. */
  const other = $derived(shown?.confirmedAt != null);
  /** Slack has no one by the address in use: the field shows without asking (EC-LN-01). */
  const missing = $derived(shown !== undefined && shown.name === null);
  const typed = $derived(code.replace(/\s/g, ''));

  /** Runs one step against the catalogue; when Slack or the service does not answer, the tile says so. */
  async function step(work: () => Promise<void>) {
    busy = true;
    failed = false;
    try {
      await work();
    } catch (error) {
      console.error('Slack did not answer', error);
      failed = true;
    } finally {
      busy = false;
    }
  }

  function another() {
    email = '';
    mode = 'typing';
    failed = false;
  }

  function cancel() {
    email = '';
    mode = 'shown';
    failed = false;
  }

  const lookUp = () =>
    step(async () => {
      const found = await slack.slackLookup(email.trim());
      if (found === null) {
        mode = 'nomatch';
      } else {
        name = found;
        mode = 'found';
      }
    });

  const sendCode = () =>
    step(async () => {
      try {
        name = (await slack.slackCode(email.trim(), language)).name;
      } catch (error) {
        if (!(error instanceof NotFound)) throw error;
        mode = 'nomatch';
        return;
      }
      code = '';
      wrong = null;
      mode = 'code';
    });

  const confirm = () =>
    step(async () => {
      const outcome = await slack.slackConfirm(typed);
      if (outcome === 'expired') {
        wrong = 'expired';
      } else if ('wrong' in outcome) {
        wrong = outcome.wrong;
        code = '';
      } else {
        shown = outcome;
        email = '';
        mode = 'shown';
      }
    });

  const backToGoogle = () =>
    step(async () => {
      shown = await slack.slackReset();
      email = '';
      mode = 'shown';
    });

  /** Enter in the field does the main action of the moment: look the address up, or send the code to who has it. */
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    if (mode === 'found') sendCode();
    else lookUp();
  }

  /** Another address typed after it was found is looked up afresh. */
  function retype() {
    if (mode === 'found' || mode === 'nomatch') mode = 'typing';
  }
</script>

{#if shown?.on}
  <SubTile round label={t('me.slack.label')}>
    <p class="meta text">{t('me.slack.text')}</p>
    {#if mode === 'code'}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          if (!busy && typed.length === 6 && wrong !== 'expired' && wrong !== 0) confirm();
        }}
      >
        <p class="meta text sent">{t('me.slack.sent', { name })}</p>
        <div class="code">
          <Field label={t('me.slack.code')}>
            <input {...NO_PASSWORD_MANAGER} class="mono" bind:value={code} inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder={t('me.slack.codePlaceholder')} />
          </Field>
        </div>
        {#if wrong === 'expired'}
          <Callout icon="warning-circle-fill" tone="warning">{t('me.slack.expired')}</Callout>
        {:else if wrong !== null}
          <Callout icon="warning-circle-fill" tone="warning">{t('me.slack.wrong', { count: wrong })}</Callout>
        {/if}
        {#if failed}<p class="meta problem" role="alert">{t('me.slack.failed')}</p>{/if}
        <div class="ways">
          <Button variant="outline" disabled={busy} onclick={sendCode}>{t('me.slack.sendAnother')}</Button>
          <Button type="submit" disabled={busy || typed.length !== 6 || wrong === 'expired' || wrong === 0}>{t('me.slack.confirm')}</Button>
        </div>
      </form>
    {:else if mode === 'shown' && !missing && shown.name}
      <div class="row">
        <span class="item-icon"><Icon name="slack-logo" /></span>
        <span class="row-text">
          <span class="item-title">{shown.name}</span>
          <span class="meta">
            {other && shown.confirmedAt
              ? t('me.slack.byOther', { email: shown.address, date: dayOfMonth(shown.confirmedAt, language) })
              : t('me.slack.byGoogle', { email: shown.address })}
          </span>
        </span>
        <Chip><Icon name="check-circle-fill" />{other ? t('me.slack.confirmed') : t('me.slack.found')}</Chip>
      </div>
      {#if failed}<p class="meta problem" role="alert">{t('me.slack.failed')}</p>{/if}
      <div class="ways">
        <Button variant="outline" disabled={busy} onclick={another}>{t('me.slack.another')}</Button>
        {#if other}<Button variant="outline" disabled={busy} onclick={backToGoogle}>{t('me.slack.backToGoogle')}</Button>{/if}
      </div>
    {:else}
      <form onsubmit={submit}>
        {#if mode === 'shown'}
          <!-- Slack has no one by the address in use: said first, then the field (EC-LN-01). -->
          <div class="first">
            <Callout icon="warning-circle-fill" tone="warning">{other ? t('me.slack.gone', { email: shown.address }) : t('me.slack.absent', { email: shown.address })}</Callout>
          </div>
        {/if}
        <Field label={t('me.slack.field')}>
          <input {...NO_PASSWORD_MANAGER} type="email" bind:value={email} oninput={retype} placeholder={t('me.slack.placeholder')} autocomplete="off" />
        </Field>
        {#if mode === 'found'}
          <div class="row">
            <span class="item-icon"><Icon name="slack-logo" /></span>
            <span class="row-text"><span class="item-title">{name}</span><span class="meta">{t('me.slack.has')}</span></span>
          </div>
          <p class="meta text note">{t('me.slack.codeNote')}</p>
        {:else if mode === 'nomatch'}
          <div class="first">
            <Callout icon="warning-circle-fill" tone="warning">{t('me.slack.nomatch')}</Callout>
          </div>
        {/if}
        {#if failed}<p class="meta problem" role="alert">{t('me.slack.failed')}</p>{/if}
        <div class="ways">
          {#if mode !== 'shown'}<Button variant="outline" disabled={busy} onclick={cancel}>{t('me.slack.cancel')}</Button>{/if}
          {#if mode === 'shown' && other}<Button variant="outline" disabled={busy} onclick={backToGoogle}>{t('me.slack.backToGoogle')}</Button>{/if}
          {#if mode === 'found'}
            <Button type="submit" disabled={busy}><Icon name="paper-plane-tilt" />{t('me.slack.sendCode')}</Button>
          {:else}
            <Button type="submit" disabled={busy || !email.trim()}>{t('me.slack.lookup')}</Button>
          {/if}
        </div>
      </form>
    {/if}
  </SubTile>
{/if}

<style>
  .meta { display: block; }
  .text { line-height: 1.5; margin: 4px 0 12px; }
  .sent { margin: 0 0 10px; }
  .note { margin: 10px 0 12px; }
  .first { margin-bottom: 12px; }
  .first :global(.callout) { margin-top: 0; }
  .code { max-width: 200px; }
  .ways { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .problem { margin: 10px 0 0; color: var(--signal-urgent); }
  .row { display: flex; align-items: center; gap: 10px; padding: 8px 6px; }
  .item-icon { width: 26px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; color: var(--text-secondary); }
  .row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
</style>
