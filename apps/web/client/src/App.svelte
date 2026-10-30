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
  import { type Conversation, type Counts, createMessages, type Filter, type Message, SUBJECT_TITLES, type WrittenOn } from './lib/messages.js';
  import { initialsOf } from './lib/initials.js';
  import { type OpenedFrom, provideLearning } from './lib/learning-context.js';
  import { type Card, cardsIn, createLearning, drawExample, LEVELS, type LevelId, type Progress, type Step, suggestedLevels, topicOf, writtenCards } from './lib/learning.js';
  import { createQuery, type Lens, type LensItem, type QueryItem, type Run } from './lib/query.js';
  import { createRegistry } from './lib/registry.js';
  import { lensPath, messagePath, messagesOnPath, NEW_COLLECTION, NEW_QUERY, objectPath, queryPath, route } from './lib/routes.js';
  import { Router } from './lib/router.svelte.js';
  import { SECTIONS, sectionLabel } from './lib/sections.js';
  import { createSession, SignInProblem } from './lib/session.js';
  import { Settings } from './lib/settings.svelte.js';
  import { SystemTheme, themeOf } from './lib/theme.svelte.js';
  import CollectionPage from './screens/CollectionPage.svelte';
  import CollectionsPanel from './screens/CollectionsPanel.svelte';
  import CollectionsStart from './screens/CollectionsStart.svelte';
  import LearningCardPage from './screens/LearningCardPage.svelte';
  import LearningPanel from './screens/LearningPanel.svelte';
  import LearningSee from './screens/LearningSee.svelte';
  import LearningStart from './screens/LearningStart.svelte';
  import LearningWindow from './screens/LearningWindow.svelte';
  import LensNew from './screens/LensNew.svelte';
  import LensPage from './screens/LensPage.svelte';
  import MessageCentre from './screens/MessageCentre.svelte';
  import MessagesPanel from './screens/MessagesPanel.svelte';
  import MessagesSheet from './screens/MessagesSheet.svelte';
  import MessageWindow from './screens/MessageWindow.svelte';
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
  const messages = $derived(createMessages(config, session));
  const learning = $derived(createLearning(config, session));
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
  /** How many conversations for the User moved since they read them, on Messages in the rail (FR-CV-06). */
  let unread = $state(0);
  /** The view of the Message Centre chosen in its panel, and what it holds: null when it could not be read. */
  // It opens on what moved since the User last looked (DEC-UX-136).
  let messageFilter = $state<Filter>({ view: 'unread' });
  let centre: { messages: Message[]; counts: Counts } | null | undefined = $state();
  /** The Message opened in the Message Centre or in context: undefined while it comes, null when it could not be read. */
  let openedMessage: { id: string; message?: Conversation | null } | undefined = $state();
  /** What a person wrote on the object whose page is open, for "Messages" and its slide-in (FR-CV-07). */
  let onObject: { key: string; messages?: Conversation[] } | undefined = $state();
  /** The written Learning Cards this page shows: a draft only outside prod (DEC-LR-25). */
  const shownCards = $derived(writtenCards(config.environment));
  /** The same cards in a language, once its translations are read; in English until then. */
  let translated: { language: Language; cards: ReadonlyMap<string, Card> } | undefined = $state();
  const localCards = $derived(translated?.language === currentLanguage() ? translated.cards : shownCards);
  /** What the User did with the Learning Cards, read when the Learning Centre opens (FR-LR-32): null when it could not be read. */
  let progress: readonly Progress[] | null | undefined = $state();
  /** A Learning Level the start screen of the Learning Centre unfolds in its panel. */
  let unfoldLevel: { id: LevelId } | undefined = $state();
  /** The step the page of a card opens on, asked for by See it on its own; taken when that page opens. */
  let openOn: { card: string; step: Step } | undefined;
  /** A page explains its system text: the progress and the translations are read, once (FR-LR-36). */
  let learningWanted = $state(false);
  /** The card open in the floating window, over the page, and where it was opened from (FR-LR-12). */
  let windowCard: { card: string; from: OpenedFrom } | undefined = $state();
  provideLearning({
    get shown() {
      return shownCards;
    },
    get cards() {
      return localCards;
    },
    get progress() {
      return progress;
    },
    get window() {
      return windowCard;
    },
    want: () => (learningWanted = true),
    open: (card, from) => (windowCard = { card, from }),
    seen: (card) => {
      if (progress && !progress.some((one) => one.card === card)) openStep(card, 'core');
    },
    understand: (card, understood) => understandCard(card, understood),
  });

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
  // Query opens on the last query of the User, or on a new one when they have none; the runs of a Lens are on its page.
  $effect(() => {
    if (page.kind === 'start' && page.section.id === 'query' && ownQueries) {
      const last = ownQueries.find((item) => item.kind !== 'lens');
      router.go(last ? queryPath(last.id) : NEW_QUERY, { replace: true });
    }
  });
  $effect(() => {
    const language = currentLanguage();
    if ((section?.id !== 'learning' && !learningWanted) || translated?.language === language) return;
    cardsIn(language, shownCards).then((cards) => (translated = { language, cards }));
  });
  $effect(() => {
    if (status.kind === 'signedIn' && (section?.id === 'learning' || learningWanted) && progress === undefined) {
      learning.progress().then(
        (found) => (progress = found),
        (error: unknown) => {
          console.error('The progress in the Learning Centre could not be read', error);
          progress = null;
        },
      );
    }
  });
  /** What the User did with a card, as catalogue keeps it now. */
  function keepProgress(card: string, entry: Progress | undefined): void {
    progress = [...(progress ?? []).filter((one) => one.card !== card), ...(entry ? [entry] : [])];
  }
  /** The User opened a step of a card: it is seen, and Continue opens it there (FR-LR-32). */
  function openStep(card: string, step: Step): void {
    openOn = undefined;
    learning.open(card, step).then(
      (entry) => keepProgress(card, entry),
      (error: unknown) => console.error(`The progress on ${card} could not be kept`, error),
    );
  }
  /** "I understand it", or undone: shown at once, then as catalogue keeps it (FR-LR-28). */
  function understandCard(card: string, understood: boolean): void {
    const before = progress?.find((one) => one.card === card);
    const now = new Date().toISOString();
    keepProgress(card, { card, seenAt: before?.seenAt ?? now, lastAt: now, step: before?.step ?? 'why', understoodAt: understood ? now : null });
    learning.understand(card, understood).then(
      (entry) => keepProgress(card, entry),
      (error: unknown) => {
        console.error(`Understanding ${card} could not be kept`, error);
        keepProgress(card, before);
      },
    );
  }
  /** The step a card opens on: the one asked for, or where the User stopped while they do not understand it yet. */
  function startOf(card: string): Step {
    if (openOn?.card === card) return openOn.step;
    const entry = progress?.find((one) => one.card === card);
    return entry && !entry.understoodAt ? entry.step : 'why';
  }
  const drawCard = (chart: Parameters<typeof drawExample>[1], drawn: 'light' | 'dark') => drawExample(config, chart, drawn);
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
    if (status.kind !== 'signedIn' || (page.kind !== 'lens' && page.kind !== 'editLens') || openedLens?.id === page.id) {
      return;
    }
    readLens(page.id);
  });
  /** Reads the Lens whose page is open: again too, after it stopped or broke while it was checked. */
  function readLens(id: string): void {
    if (openedLens?.id !== id) openedLens = { id };
    queries.lens(id).then(
      (lens) => openedLens?.id === id && (openedLens = { id, lens }),
      (error: unknown) => {
        if (openedLens?.id !== id) return;
        if (error instanceof Missing) openedLens = { id, lens: null };
        else console.error(`The Lens ${id} could not be read`, error);
      },
    );
  }
  /** The number on Messages in the rail, read when Data Hub starts, every minute, and after a Message moves. */
  function readUnread(): void {
    messages.unread().then(
      (count) => (unread = count),
      (error: unknown) => console.error('The unread Messages could not be counted', error),
    );
  }
  $effect(() => {
    if (status.kind !== 'signedIn') return;
    readUnread();
    const timer = setInterval(readUnread, 60_000);
    return () => clearInterval(timer);
  });
  /** The Messages of the view chosen in the panel of the Message Centre. */
  function readCentre(): void {
    const filter = messageFilter;
    messages.list(filter).then(
      (found) => filter === messageFilter && (centre = found),
      (error: unknown) => {
        console.error('The Messages could not be read', error);
        if (filter === messageFilter) centre = null;
      },
    );
  }
  const inCentre = $derived(page.kind === 'messages');
  $effect(() => {
    if (status.kind === 'signedIn' && inCentre && messageFilter) readCentre();
  });
  /** The object whose page is open, whose Messages "Messages" counts and its slide-in shows. */
  const talkedAbout: { kind: WrittenOn; id: string } | undefined = $derived(
    page.kind === 'resource' || page.kind === 'collection' || page.kind === 'lens' || page.kind === 'learningCard' ? { kind: page.kind, id: page.id } : undefined,
  );
  /** The Message the address names: opened in the Message Centre, or in context over the page of its object. */
  const talkedId = $derived(
    page.kind === 'messages'
      ? page.id
      : page.kind === 'resource' || page.kind === 'collection' || page.kind === 'lens' || page.kind === 'query' || page.kind === 'learningCard'
        ? (page.message ?? null)
        : null,
  );
  function readOnObject(subject: { kind: WrittenOn; id: string }): void {
    const key = `${subject.kind}:${subject.id}`;
    if (onObject?.key !== key) onObject = { key };
    messages.on(subject.kind, subject.id).then(
      // What a person writes on it: Questions, Remarks and Signals (FR-CV-07).
      (found) => onObject?.key === key && (onObject = { key, messages: found.filter((message) => ['question', 'remark', 'signal'].includes(message.kind)) }),
      (error: unknown) => {
        if (!(error instanceof Missing)) console.error('The Messages on this page could not be read', error);
        if (onObject?.key === key) onObject = { key, messages: [] };
      },
    );
  }
  $effect(() => {
    if (status.kind === 'signedIn' && talkedAbout && onObject?.key !== `${talkedAbout.kind}:${talkedAbout.id}`) readOnObject(talkedAbout);
  });
  /** Opens a Message, and marks it read: the dot and the number in the rail follow. */
  function openMessage(id: string): void {
    openedMessage = { id };
    messages.conversation(id).then(
      (message) => {
        if (openedMessage?.id !== id) return;
        openedMessage = { id, message };
        if (message.unread) {
          messages.read(id).then(
            () => {
              readUnread();
              if (centre) centre = { ...centre, messages: centre.messages.map((item) => (item.id === id ? { ...item, unread: false } : item)) };
            },
            (error: unknown) => console.error('The Message could not be marked read', error),
          );
        }
      },
      (error: unknown) => {
        if (!(error instanceof Missing)) console.error(`The Message ${id} could not be read`, error);
        if (openedMessage?.id === id) openedMessage = { id, message: null };
      },
    );
  }
  $effect(() => {
    if (status.kind === 'signedIn' && talkedId && openedMessage?.id !== talkedId) openMessage(talkedId);
  });
  /** After a reply or a decision: the Message as it is now, in the list and on the page of its object. */
  function changedMessage(message: Conversation): void {
    openedMessage = { id: message.id, message };
    if (centre) centre = { ...centre, messages: centre.messages.map((item) => (item.id === message.id ? { ...message, unread: false } : item)) };
    if (talkedAbout) readOnObject(talkedAbout);
    readUnread();
  }
  /** The decision of the Data Team on a Request on a Lens, in query, which changes the Lens with it (FR-LE-09). */
  async function decideLens(lensId: string, outcome: 'accepted' | 'refused', text: string): Promise<void> {
    const lens = await queries.decideLens(lensId, outcome, text);
    if (openedLens?.id === lensId) openedLens = { id: lensId, lens };
    refresh();
  }
  /** "Messages" in the head of the page, with their number once they are read. */
  const messagesButton = $derived(talkedAbout ? { count: onObject?.messages?.length ?? null, href: messagesOnPath(talkedAbout) } : undefined);

  /** After a Lens is made, edited or updated from its query: the panels show it, and its page opens. */
  async function made(lens: Lens): Promise<void> {
    openedLens = { id: lens.id, lens };
    refresh();
    refreshQueries();
    router.go(lensPath(lens.id));
  }
  $effect(() => {
    const title =
      page.kind === 'start' || page.kind === 'messages'
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
                        : page.kind === 'editLens'
                          ? t('lens.edit.title')
                          : page.kind === 'learningCard' || page.kind === 'learningSee'
                            ? cardTitle(page.id)
                            : undefined;
    document.title = title ? `Data Hub — ${title}` : 'Data Hub';
  });

  const items: readonly RailItem[] = $derived(
    SECTIONS.map((section) => ({ id: section.id, label: sectionLabel(section), icon: section.icon, href: section.path, ...(section.id === 'messages' && unread > 0 ? { unread } : {}) })),
  );
  const section = $derived(
    page.kind === 'start' ||
      page.kind === 'messages' ||
      page.kind === 'resource' ||
      page.kind === 'collection' ||
      page.kind === 'newCollection' ||
      page.kind === 'newQuery' ||
      page.kind === 'query' ||
      page.kind === 'newLens' ||
      page.kind === 'lens' ||
      page.kind === 'editLens' ||
      page.kind === 'learningCard' ||
      page.kind === 'learningSee'
      ? page.section
      : undefined,
  );
  /** The Collection whose page is open, or that holds the Resource or Lens whose page is open (FR-CO-19). */
  const currentCollection = $derived(
    page.kind === 'collection'
      ? page.id
      : page.kind === 'resource'
        ? (opened?.resource?.collectionId ?? undefined)
        : page.kind === 'lens' || page.kind === 'editLens'
          ? (openedLens?.lens?.collectionId ?? undefined)
          : undefined,
  );
  /** The version of the intro of Collections: after a big change it is raised, and the intro shows again. */
  const INTRO_VERSION = 1;
  /** The version of the intro of the Learning Centre. */
  const LEARNING_INTRO = 1;
  /** A Learning Card by its number and title, in the language of the User. */
  function cardTitle(number: string): string | undefined {
    const topic = topicOf(number);
    return topic && `${topic.number} ${topic.title[currentLanguage()]}`;
  }
  /** The Learning Levels Data Hub suggests to the User: Learning Level 4 also to a member of an Owner Unit that owns a Collection (DEC-LR-27). */
  const levels = $derived(
    status.kind === 'signedIn'
      ? suggestedLevels({ dataTeam, owner: (collections ?? []).some((collection) => status.kind === 'signedIn' && status.me.groups.includes(collection.ownerUnit.id)) })
      : suggestedLevels({ dataTeam: false, owner: false }),
  );
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
        {lenses}
        onsearch={async (question) => {
          const [found, lensesFound] = await Promise.all([catalogue.search(question), queries.searchLenses(question)]);
          return { lenses: lensesFound, ...found };
        }}
        groups={signedIn.me.groups}
        intro={signedIn.settings.values['intro.collections'] !== INTRO_VERSION}
        ondismiss={() => signedIn.settings.set('intro.collections', INTRO_VERSION)}
        onshow={() => signedIn.settings.forget('intro.collections')}
      />
    {:else if page.kind === 'messages'}
      <MessageCentre
        filter={messageFilter}
        found={centre}
        opened={page.id ? openedMessage : undefined}
        client={messages}
        {dataTeam}
        {decideLens}
        onchanged={changedMessage}
      />
    {:else if page.kind === 'start' && page.section.id === 'learning'}
      <LearningStart
        shown={shownCards}
        cards={localCards}
        progress={progress ?? undefined}
        {levels}
        intro={signedIn.settings.values['intro.learning'] !== LEARNING_INTRO}
        ondismiss={() => signedIn.settings.set('intro.learning', LEARNING_INTRO)}
        onshow={() => signedIn.settings.forget('intro.learning')}
        onlevel={(id) => {
          unfoldLevel = { id };
          signedIn.settings.set('panel.open', true);
        }}
      />
    {:else if page.kind === 'learningCard' || page.kind === 'learningSee'}
      {@const topic = topicOf(page.id)}
      {@const card = localCards.get(page.id)}
      {@const understood = Boolean(progress?.find((one) => one.card === page.id)?.understoodAt)}
      {#if topic && card && page.kind === 'learningCard'}
        <!-- A card opens where the User stopped, so it waits for their progress. -->
        {#if progress !== undefined}{#key topic.number}
          <LearningCardPage
            {topic}
            {card}
            cards={localCards}
            {understood}
            start={startOf(topic.number)}
            {theme}
            draw={drawCard}
            messages={messagesButton ?? { href: messagesOnPath({ kind: 'learningCard', id: topic.number }), count: null }}
            onstep={(step) => openStep(topic.number, step)}
            onunderstand={(yes) => understandCard(topic.number, yes)}
          />
        {/key}{/if}
      {:else if topic && card?.see}
        <LearningSee
          {topic}
          card={{ ...card, see: card.see }}
          {understood}
          {theme}
          draw={drawCard}
          onopen={() => openStep(topic.number, 'see')}
          onunderstand={(yes) => understandCard(topic.number, yes)}
          onwhole={(step) => (openOn = { card: topic.number, step })}
          onback={() => history.back()}
        />
      {:else}
        <NotFound />
      {/if}
    {:else if page.kind === 'start' && page.section.id !== 'query'}
      <SectionStart title={sectionLabel(page.section)} />
    {:else if page.kind === 'newQuery'}
      {#key page.resource}
        <QueryNew
          initial={page.resource}
          {collections}
          {catalogue}
          lensesOn={(on, words) => queries.suggestions(on, words)}
          ondraft={(name) => (draft = name)}
          onstart={async (fields) => {
            try {
              // From "New Lens" on a Collection, the query remembers it, for "Make it a lens" (DEC-UX-123).
              const made = await queries.create(page.forCollection ? { ...fields, forCollection: page.forCollection } : fields);
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
          onlens={made}
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
      {#if openedLens?.lens?.state === 'waiting' || openedLens?.lens?.state === 'refused'}
        <!-- A Lens that waits for the Data Team opens as its author made it, frozen (lens-new-context, DEC-LE-05); refused, it says so (DEC-UX-128). -->
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
        <LensPage
          {lens}
          messages={messagesButton}
          client={queries}
          collection={collections?.find((collection) => collection.id === lens.collectionId)}
          onchanged={() => {
            readLens(lens.id);
            refresh();
          }}
          onopened={(id) => {
            refreshQueries();
            router.go(queryPath(id));
          }}
        />
      {:else if openedLens?.lens === null}
        <NotFound />
      {/if}
    {:else if page.kind === 'editLens'}
      <!-- Its Owner Unit edits what a Lens tells; a Lens that waits for the Data Team is not changed (DEC-LE-05). -->
      {#if openedLens?.lens && openedLens.lens.canManage && openedLens.lens.state !== 'waiting'}
        {#key openedLens.lens.id}
          <LensNew
            editing={openedLens.lens}
            client={queries}
            {catalogue}
            {collections}
            me={{ name: signedIn.me.name, groups: signedIn.me.groups }}
            {dataTeam}
            loadGroups={() => identity.groups()}
            onmade={made}
          />
        {/key}
      {:else if openedLens?.lens !== undefined}
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
        messages={page.kind === 'collection' ? messagesButton : undefined}
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
          messages={messagesButton}
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
    {#if talkedAbout && (page.kind === 'resource' || page.kind === 'collection' || page.kind === 'lens') && page.messages}
      {@const about = talkedAbout}
      {@const collection =
        page.kind === 'collection'
          ? collections?.find((one) => one.id === about.id)
          : collections?.find((one) => one.id === (page.kind === 'resource' ? opened?.resource?.collectionId : openedLens?.lens?.collectionId))}
      {@const name = page.kind === 'collection' ? collection?.name : page.kind === 'resource' ? opened?.resource?.displayName : openedLens?.lens?.name}
      {#if name}
        <MessagesSheet
          subject={{ ...about, name }}
          meta={page.kind === 'collection' ? `Collection · ${collection?.ownerUnit.name ?? ''}` : `${SUBJECT_TITLES[about.kind]}${collection ? ` · ${collection.name}` : ''}`}
          owner={collection?.ownerUnit.name ?? null}
          messages={onObject?.messages}
          client={messages}
          onchanged={() => {
            readOnObject(about);
            readUnread();
          }}
          onclose={() => router.go(objectPath(about))}
        />
      {/if}
    {/if}
    {#if page.kind === 'learningCard' && page.messages}
      {@const about = { kind: 'learningCard' as const, id: page.id }}
      {@const name = cardTitle(page.id)}
      {#if name && localCards.has(page.id)}
        <MessagesSheet
          subject={{ ...about, name }}
          meta={t('learning.messages.meta', { level: LEVELS.find((level) => level.id === topicOf(page.id)?.level)?.name ?? '' })}
          owner={null}
          messages={onObject?.messages}
          client={messages}
          onchanged={() => {
            readOnObject(about);
            readUnread();
          }}
          onclose={() => router.go(objectPath(about))}
        />
      {/if}
    {/if}
    {#if windowCard}
      {@const opened = windowCard}
      {@const topic = topicOf(opened.card)}
      {@const card = localCards.get(opened.card)}
      {#if topic && card}
        {#key opened.card}
          <LearningWindow
            {topic}
            {card}
            cards={localCards}
            understood={Boolean(progress?.find((one) => one.card === opened.card)?.understoodAt)}
            start={startOf(opened.card)}
            {theme}
            draw={drawCard}
            onstep={(step) => openStep(opened.card, step)}
            onunderstand={(yes) => understandCard(opened.card, yes)}
            onclose={() => (windowCard = undefined)}
          />
        {/key}
      {/if}
    {/if}
    {#if talkedId && page.kind !== 'messages'}
      {@const id = talkedId}
      <MessageWindow
        {id}
        message={openedMessage?.id === id ? openedMessage.message : undefined}
        count={talkedAbout ? (onObject?.messages?.length ?? 0) : null}
        client={messages}
        {dataTeam}
        {decideLens}
        onchanged={changedMessage}
        onclose={() => router.go(messagePath(id))}
      />
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
  {:else if section?.id === 'learning' && status.kind === 'signedIn'}
    <LearningPanel shown={shownCards} progress={progress ?? []} current={page.kind === 'learningCard' || page.kind === 'learningSee' ? page.id : undefined} unfold={unfoldLevel} />
  {:else if section?.id === 'messages' && status.kind === 'signedIn'}
    <MessagesPanel filter={messageFilter} counts={centre?.counts} onfilter={(filter) => (messageFilter = filter)} />
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
