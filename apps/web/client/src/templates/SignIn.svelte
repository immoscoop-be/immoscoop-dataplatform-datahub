<script lang="ts">
  import { choosePhoto, type Theme } from '@datahub/ui/foundations/backgrounds.js';
  import Icon from '@datahub/ui/foundations/Icon.svelte';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import GlassCard from '@datahub/ui/containers/GlassCard.svelte';
  import Button from '@datahub/ui/primitives/Button.svelte';
  import Mark from './Mark.svelte';

  /**
   * Signing in (DEC-UX-35): a photo of the set of the theme, as it is, fills the screen, moving very
   * slowly; the sign-in sits on a glass card: the mark, one sentence on what Data Hub is, and "Sign in
   * with Google", the only way in (FR-UM-01). Data Hub keeps no password (FR-UM-03). A refused account
   * is named, with the button to choose another (FR-UM-02). In a corner, the story of the photo.
   */
  let { theme, next, problem, account }: { theme: Theme; next: string; problem?: string; account?: string } = $props();

  /** Signing in returns to the page it started from; after a refused account, Google asks which account. */
  const login = $derived(`/auth/login?${new URLSearchParams({ next, ...(account ? { choose: 'account' } : {}) })}`);

  /** A photo of the set of the theme, picked at random, as a background is (DEC-UX-94). */
  const photo = $derived(choosePhoto(theme));

  // The stories, by photo; for now the stand-ins of the prototype, until Max writes them.
  const STORIES: Record<string, { title: string; text: string; credit: string }> = {
    alpenglow: { title: 'signIn.story.alpenglow.title', text: 'signIn.story.alpenglow.text', credit: 'signIn.story.credit' },
    spring: { title: 'signIn.story.spring.title', text: 'signIn.story.spring.text', credit: 'signIn.story.credit' },
    village: { title: 'signIn.story.village.title', text: 'signIn.story.village.text', credit: 'signIn.story.creditNight' },
  };
  const story = $derived(STORIES[photo.id]);

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
  <div class="photo" style:--photo={`url("${photo.picture}")`} style:--focus={photo.position} aria-hidden="true"></div>
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
  {#if story}
    <div class="place-story">
      <GlassCard as="figure" story>
        <b>{t(story.title)}</b>
        <p>{t(story.text)}</p>
        <span class="meta">{t(story.credit, { name: 'Max' })}</span>
      </GlassCard>
    </div>
  {/if}
</div>

<style>
  .signin { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 440px); align-items: center;
    padding: 40px 8vw; overflow: hidden; background: linear-gradient(120deg, var(--bg-1) 0%, var(--bg-2) 50%, var(--bg-3) 100%); }
  .photo { position: fixed; inset: 0; background: var(--photo) var(--focus) / cover no-repeat; animation: photo-drift var(--photo-cycle) ease-in-out infinite alternate; }
  @keyframes photo-drift { from { transform: scale(1); } to { transform: scale(1.04); } }
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
  .place-story { position: fixed; left: 28px; bottom: 26px; max-width: 360px; }
  .place-story b { display: block; font-size: var(--text-small); font-weight: var(--weight-medium); }
  .place-story p { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: var(--text-secondary); }
  .place-story .meta { display: block; margin-top: 8px; color: var(--text-secondary); }
  @media (max-width: 760px) {
    .signin { grid-template-columns: minmax(0, 1fr); padding: 24px 16px 140px; }
    .place-card { grid-column: 1; }
    .place-story { right: 16px; left: 16px; max-width: none; }
  }
</style>
