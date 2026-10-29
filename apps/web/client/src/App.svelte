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
  import { createQuery, type Lens, type LensItem, type QueryItem, type Run } from './lib/query.js';
  import { createRegistry } from './lib/registry.js';
  import { lensPath, NEW_COLLECTION, NEW_QUERY, queryPath, route } from './lib/routes.js';
  import { Router } from './lib/router.svelte.js';
  import { SECTIONS, sectionLabel } from './lib/sections.js';
  import { createSession, SignInProblem } from './lib/session.js';
  import { Settings } from './lib/settings.svelte.js';
  import { SystemTheme, themeOf } from './lib/theme.svelte.js';
  import CollectionPage from './screens/CollectionPage.svelte';
  import CollectionsPanel from './screens/CollectionsPanel.svelte';
  import CollectionsStart from './screens/CollectionsStart.svelte';
  import LensNew from './screens/LensNew.svelte';
  import LensPage from './screens/LensPage.svelte';
  import MyPage from './screens/MyPage.svelte';
  import NotFound from './screens/NotFound.svelte';
  import PanelSoon from './screens/PanelSoon.svelte';
  import QueryNew from './screens/QueryNew.svelte';
  import QueryPanel from './screens/QueryPanel.svelte';
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
  const registry = $derived(createRegistry(config, session));
  const queries = $derived(createQuery(config, session));
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
  /** The queries of the User, for the panel of Query (FR-SR-43); everyone's for the Data Team, once asked. */
  let ownQueries: readonly QueryItem[] | undefined = $state();
  let everyone: readonly QueryItem[] | undefined = $state();
  /** The name of a new query being made: it stands in the panel as not run yet. */
  let draft = $state('');
  /** The Lenses the User sees, for the panel of Collections and the page of a Collection (FR-CO-28, FR-CO-36). */
  let lenses: readonly LensItem[] | undefined = $state();
  /** The Lens whose page is open: undefined while it comes, null when it does not exist or may not be seen. */
  let openedLens: { id: string; lens?: Lens | null } | undefined = $state();
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
    // The panel shows the Collections even when query does not tell the Lenses.
    queries.lenses().then(
      (found) => (lenses = found),
      (error: unknown) => console.error('The Lenses could not be read', error),
    );
    await Promise.all(read).catch((error: unknown) => console.error('The Collections could not be read', error));
  }
  /** The last runs of the query that is open, which unfolds to them in the panel (DEC-UX-74). */
  let currentRuns: readonly Run[] | undefined = $state();
  const openQuery = $derived(page.kind === 'query' ? page.id : undefined);
  function readRuns(id: string): void {
    queries.runs(id, { limit: 3 }).then(
      (found) => {
        if (openQuery === id) currentRuns = found;
      },
      (error: unknown) => console.error('The runs could not be read', error),
    );
  }
  $effect(() => {
    currentRuns = undefined;
    if (openQuery && status.kind === 'signedIn') readRuns(openQuery);
  });
  /** Reads again the queries in the panel of Query, after a new one, a run or a Request. */
  async function refreshQueries(): Promise<void> {
    if (openQuery) readRuns(openQuery);
    await Promise.all([
      queries.list().then((found) => (ownQueries = found)),
      ...(everyone ? [queries.list(true).then((found) => (everyone = found))] : []),
    ]).catch((error: unknown) => console.error('The queries could not be read', error));
  }
  $effect(() => {
    if (status.kind === 'signedIn' && section?.id === 'query' && ownQueries === undefined) {
      refreshQueries();
    }
  });
  // Query opens on the last query of the User, or on a new one when they have none.
  $effect(() => {
    if (page.kind === 'start' && page.section.id === 'query' && ownQueries) {
      router.go(ownQueries[0] ? queryPath(ownQueries[0].id) : NEW_QUERY, { replace: true });
    }
  });
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
    if (status.kind !== 'signedIn' || page.kind !== 'lens' || openedLens?.id === page.id) {
      return;
    }
    const id = page.id;
    openedLens = { id };
    queries.lens(id).then(
      (lens) => openedLens?.id === id && (openedLens = { id, lens }),
      (error: unknown) => {
        if (openedLens?.id !== id) return;
        if (error instanceof Missing) openedLens = { id, lens: null };
        else console.error(`The Lens ${id} could not be read`, error);
      },
    );
  });
  /** After a Lens is made: the panels show it, and its page opens. */
  async function made(lens: Lens): Promise<void> {
    openedLens = { id: lens.id, lens };
    refresh();
    refreshQueries();
    router.go(lensPath(lens.id));
  }
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
                : page.kind === 'newQuery'
                  ? t('query.new')
                  : page.kind === 'query'
                    ? (ownQueries?.find((item) => item.id === page.id)?.name ?? 'Query')
                    : page.kind === 'newLens'
                      ? t('lens.make.title')
                      : page.kind === 'lens'
                        ? openedLens?.lens?.name
                        : undefined;
    document.title = title ? `Data Hub — ${title}` : 'Data Hub';
  });

  const items: readonly RailItem[] = $derived(
    SECTIONS.map((section) => ({ id: section.id, label: sectionLabel(section), icon: section.icon, href: section.path })),
  );
  const section = $derived(
    page.kind === 'start' ||
      page.kind === 'resource' ||
      page.kind === 'collection' ||
      page.kind === 'newCollection' ||
      page.kind === 'newQuery' ||
      page.kind === 'query' ||
      page.kind === 'newLens' ||
      page.kind === 'lens'
      ? page.section
      : undefined,
  );
  /** The Collection whose page is open, or that holds the Resource or Lens whose page is open (FR-CO-19). */
  const currentCollection = $derived(
    page.kind === 'collection'
      ? page.id
      : page.kind === 'resource'
        ? (opened?.resource?.collectionId ?? undefined)
        : page.kind === 'lens'
          ? (openedLens?.lens?.collectionId ?? undefined)
          : undefined,
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
    panelActions={section?.id === 'collections' ? newCollection : section?.id === 'query' ? newQuery : undefined}
  >
    {#if page.kind === 'start' && page.section.id === 'collections'}
      <CollectionsStart
        {collections}
        groups={signedIn.me.groups}
        intro={signedIn.settings.values['intro.collections'] !== INTRO_VERSION}
        ondismiss={() => signedIn.settings.set('intro.collections', INTRO_VERSION)}
        onshow={() => signedIn.settings.forget('intro.collections')}
      />
    {:else if page.kind === 'start' && page.section.id !== 'query'}
      <SectionStart title={sectionLabel(page.section)} />
    {:else if page.kind === 'newQuery'}
      {#key page.resource}
        <QueryNew
          initial={page.resource}
          {collections}
          {catalogue}
          ondraft={(name) => (draft = name)}
          onstart={async (fields) => {
            try {
              const made = await queries.create(fields);
              await refreshQueries();
              router.go(queryPath(made.id));
              return true;
            } catch (error) {
              console.error('The query could not be made', error);
              return false;
            }
          }}
        />
      {/key}
    {:else if page.kind === 'query'}
      <!-- The editor of Query comes when a query opens, so that the other pages load without it. -->
      {#await import('./screens/QueryPage.svelte') then { default: QueryPage }}
        <QueryPage
          id={page.id}
          opened={page.run}
          client={queries}
          {collections}
          nonce={config.styleNonce}
          onran={refreshQueries}
          onmade={(made) => {
            refreshQueries();
            router.go(queryPath(made.id));
          }}
        />
      {/await}
    {:else if page.kind === 'newLens'}
      {#key page.query}
        <LensNew
          queryId={page.query}
          client={queries}
          {catalogue}
          {collections}
          me={{ name: signedIn.me.name, groups: signedIn.me.groups }}
          {dataTeam}
          loadGroups={() => identity.groups()}
          onmade={made}
        />
      {/key}
    {:else if page.kind === 'lens'}
      {#if openedLens?.lens?.state === 'waiting'}
        <!-- A Lens that waits for the Data Team opens as its author made it, frozen (lens-new-context, DEC-LE-05). -->
        <LensNew
          lens={openedLens.lens}
          client={queries}
          {catalogue}
          {collections}
          me={{ name: signedIn.me.name, groups: signedIn.me.groups }}
          {dataTeam}
          loadGroups={() => identity.groups()}
          onmade={made}
        />
      {:else if openedLens?.lens}
        {@const lens = openedLens.lens}
        <LensPage {lens} client={queries} collection={collections?.find((collection) => collection.id === lens.collectionId)} />
      {:else if openedLens?.lens === null}
        <NotFound />
      {/if}
    {:else if page.kind === 'collection' || page.kind === 'newCollection'}
      <CollectionPage
        id={page.kind === 'collection' ? page.id : undefined}
        lenses={lenses?.filter((lens) => page.kind === 'collection' && lens.collectionId === page.id)}
        {catalogue}
        {identity}
        {registry}
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
        <ResourcePage
          {resource}
          log={opened.log}
          collection={collections?.find((collection) => collection.id === resource.collectionId)}
          {collections}
          {catalogue}
          {registry}
          {queries}
          {dataTeam}
          groups={status.kind === 'signedIn' ? status.me.groups : []}
          onchange={(updated) => {
            if (opened?.id === updated.id) {
              opened = { ...opened, resource: updated };
            }
            // Published or deprecated, the panel shows it so.
            refresh();
          }}
          onrun={() => ownQueries !== undefined && refreshQueries()}
        />
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
      {lenses}
      {waiting}
      {currentCollection}
      currentResource={page.kind === 'resource' ? page.id : undefined}
      currentLens={page.kind === 'lens' ? page.id : undefined}
      groups={status.me.groups}
    />
  {:else if section?.id === 'query' && status.kind === 'signedIn'}
    <QueryPanel
      queries={ownQueries}
      {everyone}
      {dataTeam}
      current={openQuery}
      runs={currentRuns}
      draft={page.kind === 'newQuery' ? draft : null}
      onall={() => queries.list(true).then((found) => (everyone = found), (error: unknown) => console.error('The queries could not be read', error))}
    />
  {:else}
    <PanelSoon />
  {/if}
{/snippet}

{#snippet newQuery()}
  <IconButton icon="plus-circle-fill" label={t('query.new')} href={NEW_QUERY} />
{/snippet}

{#snippet newCollection()}
  <IconButton icon="plus-circle-fill" label={t('collections.new')} href={NEW_COLLECTION} />
{/snippet}
