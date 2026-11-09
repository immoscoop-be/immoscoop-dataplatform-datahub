<script lang="ts">
  import BackgroundLayer from '@datahub/ui/foundations/Background.svelte';
  import { chooseBackground, RANDOM, type Theme } from '@datahub/ui/foundations/backgrounds.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import GlassCard from '@datahub/ui/containers/GlassCard.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Mark from './Mark.svelte';

  /**
   * Signing in (DEC-UX-35): a background of the set of the theme, picked at random as in the app
   * (DEC-UX-173), fills the screen; the sign-in sits on a glass card: the mark, one sentence on what Data
   * Hub is, and "Sign in with Google", the only way in (FR-UM-01). Data Hub keeps no password
   * (FR-UM-03). A refused account is named, with the button to choose another (FR-UM-02).
   */
  let { theme, next, problem, account }: { theme: Theme; next: string; problem?: string; account?: string } = $props();

  /** Signing in returns to the page it started from; after a refused account, Google asks which account. */
  const login = $derived(`/auth/login?${new URLSearchParams({ next, ...(account ? { choose: 'account' } : {}) })}`);

  /** A background of the set of the theme, picked at random, and again when the theme changes: the User is not known yet. */
  const background = $derived(chooseBackground(theme, RANDOM));

  const PROBLEMS: Record<string, string> = {
    access_denied: 'signIn.problem.access_denied',
    server_error: 'signIn.problem.unavailable',
    temporarily_unavailable: 'signIn.problem.unavailable',
    expired: 'signIn.problem.expired',
    refused: 'signIn.problem.refused',
  };
  /** The account refused for its domain, named in bold within its sentence. */
  const refused = $derived(account ? t('signIn.refused', { account }).split(account) : undefined);
  const explanation = $derived(
    !account && problem ? (PROBLEMS[problem] ? t(PROBLEMS[problem]) : t('signIn.problem.other', { code: problem })) : undefined,
  );
</script>

<div class="signin">
  <BackgroundLayer {background} {theme} />
  <div class="place-card">
    <GlassCard as="main">
      <Mark />
      <h1>{t('signIn.title')}</h1>
      <p class="what">{t('signIn.what')}</p>
      {#if refused || explanation}
        <div class="refused" role="alert">
          <span class="warn"><Icon name="warning-circle-fill" /></span>
          <span>
            {#if refused}{refused[0]}<b>{account}</b>{refused[1]}{:else}{explanation}{/if}
          </span>
        </div>
      {/if}
      <div class="button">
        <Button large wide href={login}>
          <span class="google"><Icon name="google-logo" /></span>
          {account ? t('signIn.again') : t('signIn.button')}
        </Button>
      </div>
      <span class="meta note">{t('signIn.note')}</span>
    </GlassCard>
  </div>
</div>

<style>
  .signin { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 440px); align-items: center;
    padding: 40px 8vw; overflow: hidden; }
  .place-card { grid-column: 2; }
  h1 { margin: 44px 0 0; font-size: 40px; font-weight: var(--weight-medium); letter-spacing: -.8px; }
  .what { margin: 8px 0 0; font-size: var(--text-body); line-height: 1.6; color: var(--text-secondary); text-wrap: balance; }
  .refused { display: flex; gap: 10px; align-items: flex-start; margin-top: 22px; padding: 12px 16px; border-radius: var(--radius-lg);
    background: color-mix(in srgb, var(--signal-warn) 16%, var(--surface-solid)); font-size: var(--text-small); line-height: 1.5; }
  .warn { font-size: 20px; color: var(--signal-warn); display: flex; }
  .refused b { font-weight: var(--weight-medium); }
  .button { margin-top: 30px; }
  .google { font-size: 17px; display: flex; }
  .note { display: block; margin-top: 14px; color: var(--text-secondary); text-align: center; text-wrap: balance; }
  @media (max-width: 760px) {
    .signin { grid-template-columns: minmax(0, 1fr); padding: 24px 16px; }
    .place-card { grid-column: 1; }
  }
</style>
