<script lang="ts">
  import { onMount } from 'svelte';
  import type { RailItem } from '@datahub/ui/components/Rail.svelte';
  import { addTexts, setLanguage, currentLanguage, type Language } from '@datahub/ui/foundations/texts.svelte.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { NotFound as Missing } from './lib/api.js';
  import { Backgrounds } from './lib/background.svelte.js';
  import { createCatalogue, type Collection, type LogEntry, type Resource, type ResourceDetail } from './lib/catalogue.js';
  import type { Config } from './lib/config.js';
  import { createIdentity, SignedOut, type Group, type Me } from './lib/identity.js';
  import { initialsOf } from './lib/initials.js';
  import { NEW_COLLECTION, route } from './lib/routes.js';
  import { Router } from './lib/router.svelte.js';
  import { SECTIONS, sectionLabel } from './lib/sections.js';
  import { createSession, SignInProblem } from './lib/session.js';
  import { Settings } from './lib/settings.svelte.js';
  import { SystemTheme, themeOf } from './lib/theme.svelte.js';
  import CollectionPage from './screens/CollectionPage.svelte';
  import CollectionsPanel from './screens/CollectionsPanel.svelte';
  import CollectionsStart from './screens/CollectionsStart.svelte';
  import MyPage from './screens/MyPage.svelte';
  import NotFound from './screens/NotFound.svelte';
  import PanelSoon from './screens/PanelSoon.svelte';
  import ResourcePage from './screens/ResourcePage.svelte';
  import SectionStart from './screens/SectionStart.svelte';
  import AppShell from './templates/AppShell.svelte';
  import SignIn from './templates/SignIn.svelte';
  import { TEXTS } from './texts/index.js';

  let { config }: { config: Config } = $props();

  addTexts(TEXTS);
  const session = createSession();
  const identity = $derived(createIdentity(config, session));
  const catalogue = $derived(createCatalogue(config, session));
  const router = new Router();
  const system = new SystemTheme();

  type Status =
    | { readonly kind: 'starting' }
    | { readonly kind: 'signedOut'; readonly problem?: string; readonly account?: string }
    | { readonly kind: 'signedIn'; readonly me: Me; readonly settings: Settings; readonly backgrounds: Backgrounds };
  let status = $state<Status>({ kind: 'starting' });
  /** The groups of the User for My page, read when it opens: undefined while they come, null when they did not. */
  let groups: readonly Group[] | null | undefined = $state();
  /** For the Data Team, the Resources that wait for a Collection, read when Data Hub starts (FR-SR-35). */
  let waiting: readonly Resource[] | undefined = $state();
  /** Every Collection the User sees, read when Data Hub starts and after a change (FR-CO-18). */
  let collections: readonly Collection[] | undefined = $state();
  /** The Resource whose page is open: undefined while it comes, null when it does not exist or may not be seen. */
  let opened: { id: string; resource?: ResourceDetail | null; log?: readonly LogEntry[] } | undefined = $state();

  /** A sign-in that went wrong comes back with its code in the address, and a refused account in the fragment. */
  function takeProblem(): { problem?: string; account?: string } {
    const problem = new URLSearchParams(location.search).get('error') ?? undefined;
    const account = new URLSearchParams(location.hash.slice(1)).get('account') ?? undefined;
    if (problem || account) {
      history.replaceState(null, '', location.pathname);
    }
    return { problem, account };
  }

  function signedOut(problem?: string, account?: string): void {
    setLanguage('nl');
    status = { kind: 'signedOut', problem, account };
  }

  onMount(async () => {
    const { problem, account } = takeProblem();
    try {
      if (!(await session.accessToken())) {
        return signedOut(problem, account);
      }
      const [me, values] = await Promise.all([identity.me(), identity.settings()]);
      const settings = new Settings(
        values,
        (key, value) => identity.saveSetting(key, value),
        (key) => identity.removeSetting(key),
      );
      status = { kind: 'signedIn', me, settings, backgrounds: new Backgrounds(settings) };
    } catch (error) {
      if (error instanceof SignInProblem) {
        return signedOut(error.code);
      }
      if (error instanceof SignedOut) {
        return signedOut();
      }
      throw error;
    }
  });

  const settings = $derived(status.kind === 'signedIn' ? status.settings : undefined);
  /** Light or dark: the User's choice, or the system's; the sign-in always follows the system (Themes). */
  const theme = $derived(settings ? themeOf(settings, system) : system.current);
  const page = $derived(route(router.path));

  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });
  $effect(() => {
    if (settings) {
      setLanguage(settings.values.language ?? 'nl');
    }
  });
  $effect(() => {
    if (page.kind === 'redirect') {
      router.go(page.to, { replace: true });
    }
  });
  $effect(() => {
    if (status.kind === 'signedIn' && page.kind === 'me' && groups === undefined) {
      identity.groups().then(
        (found) => (groups = found),
        () => (groups = null),
      );
    }
  });
  /** The Data Team, from its Role Group: it sees the Resources without a Collection (Naming Convention). */
  const dataTeam = $derived(status.kind === 'signedIn' && status.me.roles.includes('datateam'));

  /** Reads again what the panel shows: the Collections, and for the Data Team the Resources that wait. */
  async function refresh(): Promise<void> {
    const read = [
      catalogue.collections().then((found) => (collections = found)),
      ...(dataTeam ? [catalogue.waiting().then((found) => (waiting = found))] : []),
    ];
    await Promise.all(read).catch((error: unknown) => console.error('The Collections could not be read', error));
  }
  let started = false;
  $effect(() => {
    if (status.kind === 'signedIn' && !started) {
      started = true;
      refresh();
    }
  });
  $effect(() => {
    if (status.kind !== 'signedIn' || page.kind !== 'resource' || opened?.id === page.id) {
      return;
    }
    const id = page.id;
    opened = { id };
    const missing = (error: unknown) => {
      if (opened?.id !== id) {
        return;
      }
      if (error instanceof Missing) {
        opened = { id, resource: null };
      } else {
        console.error(`The Resource ${id} could not be read`, error);
      }
    };
    catalogue.resource(id).then((resource) => opened?.id === id && (opened = { ...opened, resource }), missing);
    catalogue.log(id).then((log) => opened?.id === id && (opened = { ...opened, log }), missing);
  });
  $effect(() => {
    const title =
      page.kind === 'start'
        ? sectionLabel(page.section)
        : page.kind === 'me' && status.kind === 'signedIn'
          ? status.me.name
          : page.kind === 'resource'
            ? opened?.resource?.displayName
            : page.kind === 'collection'
              ? collections?.find((collection) => collection.id === page.id)?.name
              : page.kind === 'newCollection'
                ? t('collections.new')
                : undefined;
    document.title = title ? `Data Hub — ${title}` : 'Data Hub';
  });

  const items: readonly RailItem[] = $derived(
    SECTIONS.map((section) => ({ id: section.id, label: sectionLabel(section), icon: section.icon, href: section.path })),
  );
  const section = $derived(page.kind === 'start' || page.kind === 'resource' || page.kind === 'collection' || page.kind === 'newCollection' ? page.section : undefined);
  /** The Collection whose page is open, or that holds the Resource whose page is open (FR-CO-19). */
  const currentCollection = $derived(
    page.kind === 'collection' ? page.id : page.kind === 'resource' ? (opened?.resource?.collectionId ?? undefined) : undefined,
  );
  /** The version of the intro of Collections: after a big change it is raised, and the intro shows again. */
  const INTRO_VERSION = 1;
  /** The panel is open unless the User shut it; that is remembered (navigation rule 5). */
  const panelOpen = $derived(settings?.values['panel.open'] ?? true);

  /**
   * The navigation rules: a click on another main item goes to that section and slides its panel
   * open; a click on the main item the page is in slides the panel in or out.
   */
  function select(id: string): void {
    const next = SECTIONS.find((candidate) => candidate.id === id);
    if (!next || !settings) {
      return;
    }
    if (section?.id === id) {
      settings.set('panel.open', !panelOpen);
      return;
    }
    settings.set('panel.open', true);
    router.go(next.path);
  }
</script>

<svelte:document onclick={(event) => router.follow(event)} />

{#if status.kind === 'signedOut'}
  <SignIn {theme} next={router.path} problem={status.problem} account={status.account} />
{:else if status.kind === 'signedIn'}
  {@const signedIn = status}
  <AppShell
    background={signedIn.backgrounds.of(theme)}
    {theme}
    {items}
    section={section?.id}
    panelTitle={section ? sectionLabel(section) : ''}
    {panelOpen}
    initials={initialsOf(signedIn.me.name)}
    myPageActive={page.kind === 'me'}
    onselect={select}
    ontheme={() => signedIn.settings.set('theme', theme === 'dark' ? 'light' : 'dark')}
    oncollapse={() => signedIn.settings.set('panel.open', false)}
    panel={section ? panel : undefined}
    panelActions={section?.id === 'collections' ? newCollection : undefined}
  >
    {#if page.kind === 'start' && page.section.id === 'collections'}
      <CollectionsStart
        {collections}
        groups={signedIn.me.groups}
        intro={signedIn.settings.values['intro.collections'] !== INTRO_VERSION}
        ondismiss={() => signedIn.settings.set('intro.collections', INTRO_VERSION)}
        onshow={() => signedIn.settings.forget('intro.collections')}
      />
    {:else if page.kind === 'start'}
      <SectionStart title={sectionLabel(page.section)} />
    {:else if page.kind === 'collection' || page.kind === 'newCollection'}
      <CollectionPage
        id={page.kind === 'collection' ? page.id : undefined}
        {catalogue}
        {identity}
        {dataTeam}
        own={signedIn.me.groups}
        {waiting}
        go={(path) => router.go(path)}
        onchanged={refresh}
      />
    {:else if page.kind === 'me'}
      <MyPage
        me={signedIn.me}
        initials={initialsOf(signedIn.me.name)}
        tab={page.tab}
        language={currentLanguage()}
        {groups}
        {theme}
        backgroundChoice={signedIn.backgrounds.choiceOf(theme)}
        onlanguage={(language: Language) => signedIn.settings.set('language', language)}
        onbackground={(choice) => signedIn.backgrounds.choose(theme, choice)}
      />
    {:else if page.kind === 'resource'}
      {#if opened?.resource}
        {@const resource = opened.resource}
        <ResourcePage {resource} log={opened.log} collection={collections?.find((collection) => collection.id === resource.collectionId)} />
      {:else if opened?.resource === null}
        <NotFound />
      {/if}
    {:else if page.kind === 'notFound'}
      <NotFound />
    {/if}
  </AppShell>
{/if}

{#snippet panel()}
  {#if section?.id === 'collections' && status.kind === 'signedIn'}
    <CollectionsPanel
      {collections}
      {waiting}
      {currentCollection}
      currentResource={page.kind === 'resource' ? page.id : undefined}
      groups={status.me.groups}
    />
  {:else}
    <PanelSoon />
  {/if}
{/snippet}

{#snippet newCollection()}
  <IconButton icon="plus-circle-fill" label={t('collections.new')} href={NEW_COLLECTION} />
{/snippet}
