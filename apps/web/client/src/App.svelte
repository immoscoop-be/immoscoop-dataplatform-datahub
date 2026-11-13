<script lang="ts">
  import { onMount } from 'svelte';
  import DragGhost from '@datahub/ui/components/DragGhost.svelte';
  import EnvRibbon from '@datahub/ui/marks/EnvRibbon.svelte';
  import type { RailItem } from '@datahub/ui/components/Rail.svelte';
  import Toast from '@datahub/ui/components/Toast.svelte';
  import { addTexts, setLanguage, currentLanguage, type Language } from '@datahub/ui/foundations/texts.svelte.js';
  import { t } from '@datahub/ui/foundations/texts.svelte.js';
  import IconButton from '@datahub/ui/primitives/IconButton.svelte';
  import { levelName } from '@datahub/ui/foundations/levels.js';
  import Loading from '@datahub/ui/primitives/Loading.svelte';
  import { NotFound as Missing, onPermissionRefused, onSignedOut } from './lib/api.js';
  import { Backgrounds } from './lib/background.svelte.js';
  import { createCatalogue, type Collection, type LogEntry, type Resource, type ResourceDetail } from './lib/catalogue.js';
  import { type ChartsOverview, createCharts } from './lib/charts.js';
  import { dragging, type Mover } from './lib/dragging.svelte.js';
  import type { Config } from './lib/config.js';
  import { createIdentity, type GroupSummary, SignedOut, type Me } from './lib/identity.js';
  import { type Conversation, type Counts, createMessages, type Filter, type Message, SUBJECT_TITLES, type WrittenOn } from './lib/messages.js';
  import { initialsOf } from './lib/initials.js';
  import { type OpenedFrom, provideLearning } from './lib/learning-context.js';
  import { type Card, cardsIn, createLearning, drawExample, LEVELS, type LevelId, type Progress, type Step, suggestedLevels, topicOf, writtenCards } from './lib/learning.js';
  import { createQuery, type DeletedLens, type Lens, LensDeleted, type LensItem, type Run } from './lib/query.js';
  import { createRegistry } from './lib/registry.js';
  import { digitOf, flag, markOf, modLabel, MOST_FLAGGED, moveFlag, onMac, placeOf, type QueryStatus, unflag, withMod } from './lib/flags.js';
  import type { QuickRow } from './lib/quick.js';
  import { provideScreenCommands } from './lib/commands.svelte.js';
  import { collectionPath, GROUPS, learningPath, lensPath, messagesOnPath, myPagePath, NEW_COLLECTION, NEW_QUERY, objectPath, queryPath, resourcePath, route } from './lib/routes.js';
  import { Router } from './lib/router.svelte.js';
  import { can, mayQuery, NO_PERMISSIONS, PERMISSION_KEYS, PERMISSION_TEXTS, reach, sees } from './lib/permissions.js';
  import { ADMIN_TOOLS, type AdminTool, SECTIONS, sectionFor, sectionLabel, toolsFor } from './lib/sections.js';
  import { createSession, SignInProblem } from './lib/session.js';
  import { Settings } from './lib/settings.svelte.js';
  import { ThemeOnScreen } from './lib/theme.svelte.js';
  import AdminPanel from './screens/AdminPanel.svelte';
  import type { SummaryData } from './screens/ResourceSummaryWindow.svelte';
  import AdminExcelKeys from './screens/AdminExcelKeys.svelte';
  import AdminPermissionGroups from './screens/AdminPermissionGroups.svelte';
  import AdminUsers from './screens/AdminUsers.svelte';
  import AdminWebhooks from './screens/AdminWebhooks.svelte';
  import AdminWithdrawn from './screens/AdminWithdrawn.svelte';
  import ChartPage from './screens/ChartPage.svelte';
  import ChartsPanel from './screens/ChartsPanel.svelte';
  import CollectionPage from './screens/CollectionPage.svelte';
  import CollectionsPanel from './screens/CollectionsPanel.svelte';
  import CollectionsStart from './screens/CollectionsStart.svelte';
  import FolderPage from './screens/FolderPage.svelte';
  import GroupsPage from './screens/GroupsPage.svelte';
  import LearningCardPage from './screens/LearningCardPage.svelte';
  import LearningPanel from './screens/LearningPanel.svelte';
  import LearningSee from './screens/LearningSee.svelte';
  import LearningStart from './screens/LearningStart.svelte';
  import LearningWindow from './screens/LearningWindow.svelte';
  import LensNew from './screens/LensNew.svelte';
  import LensGone from './screens/LensGone.svelte';
  import LensPage from './screens/LensPage.svelte';
  import MessageCentre from './screens/MessageCentre.svelte';
  import MessagesPanel from './screens/MessagesPanel.svelte';
  import MessagesSheet from './screens/MessagesSheet.svelte';
  import MessageWindow from './screens/MessageWindow.svelte';
  import MyPage from './screens/MyPage.svelte';
  import NotFound from './screens/NotFound.svelte';
  import QueryNew from './screens/QueryNew.svelte';
  import QueryFlags from './screens/QueryFlags.svelte';
  import QueryPanel from './screens/QueryPanel.svelte';
  import QuickWindow from './screens/QuickWindow.svelte';
  import ResourcePage from './screens/ResourcePage.svelte';
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
  /** semgraph, whose gallery Charts shows; open to everyone, so without Access Token (TR-PF-34). */
  const charts = $derived(createCharts(config));
  const router = new Router();
  const themeOnScreen = new ThemeOnScreen();

  type Status =
    | { readonly kind: 'starting' }
    | { readonly kind: 'signedOut'; readonly problem?: string; readonly account?: string }
    | { readonly kind: 'signedIn'; readonly me: Me; readonly settings: Settings; readonly backgrounds: Backgrounds };
  let status = $state<Status>({ kind: 'starting' });
  /** The Groups the User is in or manages, for My page, read when it opens: undefined while they come, null when they did not. */
  let groups: readonly GroupSummary[] | null | undefined = $state();
  /** For the Data Team, the Resources that wait for a Collection, read when Data Hub starts (FR-SR-35). */
  let waiting: readonly Resource[] | undefined = $state();
  /** Every Collection the User sees, read when Data Hub starts and after a change (FR-CO-18). */
  let collections: readonly Collection[] | undefined = $state();
  /** Grows after a new query, a run or a Request: the panel of Query reads its periods again (DEC-UX-139). */
  let queriesVersion = $state(0);
  /** The name of the query that is open, for the breadcrumb. */
  let queryName: { id: string; name: string } | undefined = $state();
  /** A query hidden or shown again from the panel, which its page then shows so (DEC-UX-138). */
  let queryHidden: { id: string; hidden: boolean } | undefined = $state();
  /** The name of a new query being made: it stands in the panel as not run yet. */
  let draft = $state('');
  /** The Lenses the User sees, for the panel of Collections and the page of a Collection (FR-CO-28, FR-CO-36). */
  let lenses: readonly LensItem[] | undefined = $state();
  /** The Lens whose page is open: undefined while it comes, null when it does not exist or may not be seen. */
  /** The Lens whose page or Edit is open: undefined while it comes, null when there is none; a deleted one says how (FR-LE-18). */
  let openedLens: { id: string; lens?: Lens | null; deleted?: DeletedLens } | undefined = $state();
  /** The Resource whose page is open: undefined while it comes, null when it does not exist or may not be seen. */
  let opened: { id: string; resource?: ResourceDetail | null; log?: readonly LogEntry[] } | undefined = $state();
  /** How many conversations for the User moved since they read them, on Messages in the rail (FR-CV-06). */
  let unread = $state(0);
  /** For the Data Team, the deliveries of the webhook to look at, for the panel of Admin (FR-AR-19). */
  let webhooksToLookAt: number | undefined = $state();
  /** How many Excel keys are active, for the panel of Admin, once its page told (FR-PL-03). */
  let activeKeys: number | undefined = $state();
  /** How many Users and Permission groups there are, for the panel of Admin, once their pages told (FR-PL-06, FR-PL-09). */
  let userCount: number | undefined = $state();
  let groupCount: number | undefined = $state();
  let withdrawnCount: number | undefined = $state();
  /** The Permission group Users shows, as "see them on Users" of a group asks (FR-PL-09). */
  let usersOf: string | null = $state(null);
  /** The view of the Message Centre chosen in its panel, and what it holds: null when it could not be read. */
  // It opens on what moved since the User last looked (DEC-UX-136).
  let messageFilter = $state<Filter>({ view: 'unread' });
  let centre: { messages: Message[]; counts: Counts } | null | undefined = $state();
  /** The Message opened in the Message Centre or in context: undefined while it comes, null when it could not be read. */
  let openedMessage: { id: string; message?: Conversation | null } | undefined = $state();
  /** What a person wrote on the object whose page is open, for "Messages" and its slide-in (FR-CV-07). */
  let onObject: { key: string; messages?: Conversation[]; kinds?: readonly string[] } | undefined = $state();
  /** The written Learning Cards this page shows: a draft only outside prod (DEC-LR-25). */
  const shownCards = $derived(writtenCards(config.environment));
  /** The same cards in a language, once its translations are read; in English until then. */
  let translated: { language: Language; cards: ReadonlyMap<string, Card> } | undefined = $state();
  const localCards = $derived(translated?.language === currentLanguage() ? translated.cards : shownCards);
  /** What semgraph offers, for Charts, in the language it was read in: null when semgraph did not answer (FR-CH-06). */
  let chartsOverview: { language: Language; overview: ChartsOverview | null } | undefined = $state();
  /** The language the overview of semgraph was last asked in, so that it is asked once per language. */
  let chartsAsked: Language | undefined;
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
  /** Light or dark: always the system's, unless switched in the rail for this session (DEC-UX-172). */
  const theme = $derived(themeOnScreen.current);
  /**
   * The Permissions of the User, from `GET /me` (FR-PL-14): what the rail, the pages and their actions show, never a
   * role. Before the sign-in, every Permission is no.
   */
  const permissions = $derived(status.kind === 'signedIn' ? status.me.permissions : NO_PERMISSIONS);
  /** The tools of Admin the User may open, chosen in `admin.open`. */
  const adminTools: AdminTool[] = $derived(toolsFor(permissions));
  const page = $derived(route(router.path, adminTools));
  // The filter a group asked of Users holds while Users is open, not on a later visit.
  $effect(() => {
    if (!(page.kind === 'admin' && page.tool === 'users')) usersOf = null;
  });

  let themed = false;
  $effect(() => {
    const root = document.documentElement;
    // Day and night switch at once: every transition is off until the new colours are on screen (DEC-UX-149).
    if (themed && root.dataset.theme !== theme) {
      root.classList.add('theme-switching');
      root.dataset.theme = theme;
      void root.offsetHeight;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    } else {
      root.dataset.theme = theme;
    }
    themed = true;
  });
  $effect(() => {
    if (settings) {
      setLanguage(settings.values.language ?? 'nl');
    }
  });
  // Once it is known who signs in: Admin opens on the first tool the User may open.
  $effect(() => {
    if (page.kind === 'redirect' && status.kind !== 'starting') {
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
  /** The Groups the User is in, by name, to own a new Collection made with a Lens (DEC-CO-24, DEC-UX-200). */
  const groupsOfUser = async () => (await identity.groups()).filter((group) => group.isMember).map(({ id, name }) => ({ id, name }));
  /**
   * The Groups the User is in changed, on Groups: the next Access Token carries them, at once (FR-UM-19), and what
   * the page shows from them is read again: who they are, My page and the Collections they own.
   */
  async function membershipChanged(): Promise<void> {
    session.renew();
    groups = undefined;
    try {
      const me = await identity.me();
      if (status.kind === 'signedIn') status = { ...status, me };
    } catch (error) {
      console.error('Who the User is could not be read again', error);
    }
    refresh();
  }
  /** Who sees all of the catalogue sees the Resources without a Collection too (DEC-PL-02, FR-SR-35). */
  const seesAll = $derived(sees(permissions) === 'all');

  /** The Permission a service last refused for, by its name, for the line on screen (EC-PL-01); a new key shows it again. */
  let lost = $state({ key: 0, name: '' });
  /**
   * A service refused for a Permission the User lacks (EC-PL-01): what they may do changed since their Access Token
   * was made. It is renewed, their Permissions read again, and the page shows what they may do now.
   */
  async function permissionLost(permission: string): Promise<void> {
    session.renew();
    try {
      const me = await identity.me();
      if (status.kind === 'signedIn') status = { ...status, me };
    } catch (error) {
      console.error('The Permissions could not be read again', error);
    }
    const known = PERMISSION_KEYS.find((key) => key === permission);
    lost = { key: lost.key + 1, name: known ? t(PERMISSION_TEXTS[known].name) : permission };
  }
  $effect(() => onPermissionRefused((permission) => void permissionLost(permission)));
  // The session ended while the User worked: the sign-in, which brings them back to this page, not a loader.
  $effect(() =>
    onSignedOut(() => {
      if (status.kind === 'signedIn') signedOut();
    }),
  );

  /** What was moved last, and where to, for the line on screen (DEC-UX-157); a new key shows it again. */
  let moved = $state({ key: 0, name: '', to: '', failed: false });
  /** Moves something of a Collection into one of its folders, or to its top, and says where it went (FR-CO-40). */
  const move: Mover = async (collection, item, to) => {
    try {
      await catalogue.move(collection.id, item.kind, item.id, to?.id ?? null);
      await refresh();
      moved = { key: moved.key + 1, name: item.name, to: to?.name ?? collection.name, failed: false };
    } catch (error) {
      console.error(`${item.name} could not be moved`, error);
      moved = { key: moved.key + 1, name: item.name, to: '', failed: true };
    }
  };

  /** Reads again what the panel shows: the Collections, and for who sees all the Resources that wait. */
  async function refresh(): Promise<void> {
    const read = [
      catalogue.collections().then((found) => (collections = found)),
      ...(seesAll ? [catalogue.waiting().then((found) => (waiting = found))] : []),
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
    queriesVersion += 1;
  }
  // Query opens on the last query of the User, or on a new one when they have none; previews, Lenses and hidden queries do not count (DEC-UX-137).
  $effect(() => {
    if (status.kind !== 'signedIn' || page.kind !== 'start' || page.section.id !== 'query' || !mayQuery(permissions)) return;
    queries.list(false, { show: [], limit: 1 }).then(
      ([last]) => page.kind === 'start' && page.section.id === 'query' && router.go(last ? queryPath(last.id) : NEW_QUERY, { replace: true }),
      (error: unknown) => console.error('The last query could not be read', error),
    );
  });
  // The name of the query that is open, for the breadcrumb; again after a rename.
  $effect(() => {
    if (status.kind !== 'signedIn' || page.kind !== 'query') return;
    const id = page.id;
    void queriesVersion;
    queries.get(id).then(
      (found) => (queryName = { id, name: found.name }),
      () => undefined,
    );
  });
  $effect(() => {
    const language = currentLanguage();
    if ((section?.id !== 'learning' && !learningWanted) || translated?.language === language) return;
    cardsIn(language, shownCards).then((cards) => (translated = { language, cards }));
  });
  // Charts reads what semgraph offers when it opens, and again in another language.
  $effect(() => {
    const language = currentLanguage();
    if (status.kind !== 'signedIn' || section?.id !== 'charts' || chartsAsked === language) return;
    chartsAsked = language;
    charts.overview(language).then(
      (overview) => (chartsOverview = { language, overview }),
      (error: unknown) => {
        console.error('semgraph did not give its charts', error);
        chartsOverview = { language, overview: null };
        chartsAsked = undefined;
      },
    );
  });
  const chartsShown = $derived(chartsOverview?.language === currentLanguage() ? chartsOverview.overview : undefined);
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
        if (error instanceof LensDeleted) openedLens = { id, lens: null, deleted: error.lens };
        else if (error instanceof Missing) openedLens = { id, lens: null };
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
  /** The Summary of a Resource, as its page builds it, for a double-click on its name in the SQL (DEC-UX-221): a piece that does not come leaves out its part. */
  async function summaryOf(id: string): Promise<SummaryData> {
    const [resource, log, related, storage, threads] = await Promise.all([
      catalogue.resource(id),
      catalogue.log(id).catch(() => undefined),
      catalogue.related(id).catch(() => undefined),
      queries.storage(id).catch(() => null),
      messages.on('resource', id).then(
        (found) => found.messages.filter((message) => ['question', 'remark', 'signal'].includes(message.kind)),
        () => undefined,
      ),
    ]);
    return { resource, log, related, storage, threads };
  }

  function readOnObject(subject: { kind: WrittenOn; id: string }): void {
    const key = `${subject.kind}:${subject.id}`;
    if (onObject?.key !== key) onObject = { key };
    messages.on(subject.kind, subject.id).then(
      // What a person writes on it: Questions, Remarks and Signals (FR-CV-07).
      (found) =>
        onObject?.key === key && (onObject = { key, messages: found.messages.filter((message) => ['question', 'remark', 'signal'].includes(message.kind)), kinds: found.kinds }),
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

  /** After a Lens is deleted: the panels lose it, and its Collection opens (FR-LE-18). */
  function deleted(lens: { id: string; collectionId: string }): void {
    openedLens = undefined;
    refresh();
    refreshQueries();
    router.go(collectionPath(lens.collectionId));
  }
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
        : page.kind === 'admin'
          ? ADMIN_TOOLS.find((tool) => tool.id === page.tool)?.name
        : page.kind === 'me' && status.kind === 'signedIn'
          ? status.me.name
        : page.kind === 'groups'
          ? 'Groups'
          : page.kind === 'resource'
            ? opened?.resource?.displayName
            : page.kind === 'collection'
              ? collections?.find((collection) => collection.id === page.id)?.name
              : page.kind === 'folder'
                ? collections?.find((collection) => collection.id === page.collection)?.folders.find((folder) => folder.id === page.id)?.name
              : page.kind === 'newCollection'
                ? t('collections.new')
                : page.kind === 'newQuery'
                  ? t('query.new')
                  : page.kind === 'query'
                    ? (queryName?.id === page.id ? queryName.name : 'Query')
                    : page.kind === 'newLens'
                      ? t('lens.make.title')
                      : page.kind === 'lens'
                        ? openedLens?.lens?.name
                        : page.kind === 'editLens'
                          ? t('lens.edit.title')
                          : page.kind === 'learningCard' || page.kind === 'learningSee'
                            ? cardTitle(page.id)
                            : page.kind === 'chart'
                              ? (chartsShown?.charts.find((chart) => chart.id === page.id)?.title ?? sectionLabel(page.section))
                              : undefined;
    // The title of the tab begins with the environment, as its ribbon does; prod wears nothing (DEC-UX-203).
    const environment = config.environment ?? 'local';
    const named = title ? `Data Hub — ${title}` : 'Data Hub';
    document.title = environment === 'prod' ? named : `${environment} · ${named}`;
  });

  const items: readonly RailItem[] = $derived(
    SECTIONS.filter((section) => sectionFor(section, permissions)).map((section) => ({
      id: section.id,
      label: sectionLabel(section),
      icon: section.icon,
      href: section.path,
      ...(section.id === 'messages' && unread > 0 ? { unread } : {}),
      // Admin, a little apart from the sections above it (DEC-UX-130).
      ...(section.id === 'admin' ? { apart: true } : {}),
    })),
  );
  const section = $derived(
    page.kind === 'start' ||
      page.kind === 'messages' ||
      page.kind === 'resource' ||
      page.kind === 'collection' ||
      page.kind === 'folder' ||
      page.kind === 'newCollection' ||
      page.kind === 'newQuery' ||
      page.kind === 'query' ||
      page.kind === 'newLens' ||
      page.kind === 'lens' ||
      page.kind === 'editLens' ||
      page.kind === 'learningCard' ||
      page.kind === 'learningSee' ||
      page.kind === 'admin' ||
      page.kind === 'chart'
      ? page.section
      : undefined,
  );
  /** Cmd on a Mac, Ctrl elsewhere: how the keys are pressed and written. */
  const mac = onMac();
  /** The queries the User flagged, in their order on top of Query (DEC-UX-236): kept with their settings (OP-UX-84). */
  const flagged: readonly string[] = $derived(settings?.values['query.flagged'] ?? []);
  function setFlagged(ids: string[]): void {
    settings?.set('query.flagged', ids);
  }
  /** The names on the tabs of the flagged queries, as query gives them. */
  let flagNames = $state<Record<string, string>>({});
  /** What each open query tells, for the mark on its tab: a run going, a failure, Broken. */
  let queryStatus = $state<Record<string, QueryStatus>>({});
  /** A run ended while the User was in another query: its tab says so until they open it again. */
  let unseen = $state<Record<string, boolean>>({});
  /** What each open query offers in the quick window (DEC-UX-237). */
  let queryCommands = $state<Record<string, QuickRow[]>>({});
  /** What every other screen can do now, as it tells it (DEC-UX-240). */
  const screenCommands = provideScreenCommands((path) => router.go(path));
  /**
   * The flagged queries opened since this browser tab loaded: each stays as the User left it while they work in another,
   * its result, its tab and a run still going, until the tab closes or reloads (OP-UX-85).
   */
  let kept = $state<string[]>([]);
  const openId = $derived(page.kind === 'query' ? page.id : undefined);
  $effect(() => {
    const id = openId;
    if (!id) return;
    if (flagged.includes(id) && !kept.includes(id)) kept = [...kept, id];
    if (unseen[id]) unseen = { ...unseen, [id]: false };
  });
  /**
   * The query pages that live: those kept and still flagged, and the one open, always, also when it was just unflagged:
   * unflagging takes it off the row on top, never off the screen (DEC-UX-236).
   */
  const alive = $derived.by(() => {
    const live = kept.filter((id) => flagged.includes(id));
    return openId && !live.includes(openId) ? [...live, openId] : live;
  });
  function statusOf(id: string, now: QueryStatus): void {
    const before = queryStatus[id];
    queryStatus = { ...queryStatus, [id]: now };
    if (before?.running && !now.running && openId !== id) unseen = { ...unseen, [id]: true };
  }
  // The names of the flagged queries; one that the User may no longer see leaves the row.
  $effect(() => {
    if (status.kind !== 'signedIn') return;
    for (const id of flagged) {
      if (flagNames[id] !== undefined) continue;
      flagNames = { ...flagNames, [id]: '' };
      queries.get(id).then(
        (found) => (flagNames = { ...flagNames, [id]: found.name }),
        (error: unknown) => {
          if (error instanceof Missing) setFlagged(unflag(flagged, id));
          else console.error(`The name of the query ${id} could not be read`, error);
        },
      );
    }
  });
  // A rename of the open query shows on its tab.
  $effect(() => {
    if (queryName && flagNames[queryName.id] !== undefined && flagNames[queryName.id] !== queryName.name) flagNames = { ...flagNames, [queryName.id]: queryName.name };
  });
  const flagItems = $derived(flagged.map((id) => ({ id, name: flagNames[id] || null, mark: markOf(queryStatus[id], unseen[id] ?? false) })));
  /** On the screens of Query, Cmd+1 to Cmd+0 open the flagged queries; elsewhere they stay the browser's (OP-UX-86). */
  const inQuery = $derived(section?.id === 'query' && mayQuery(permissions));

  /** The quick window, Cmd+Shift+P or Cmd+K anywhere in Data Hub (DEC-UX-237, OP-UX-87). */
  let quickOpen = $state(false);
  $effect(() => {
    if (status.kind !== 'signedIn') return;
    const keys = (event: KeyboardEvent) => {
      if (!withMod(event, mac) || event.altKey) return;
      const letter = event.key.toLowerCase();
      if ((event.shiftKey && (letter === 'p' || event.code === 'KeyP')) || (!event.shiftKey && (letter === 'k' || event.code === 'KeyK'))) {
        event.preventDefault();
        event.stopPropagation();
        quickOpen = !quickOpen;
        return;
      }
      // By where the key is, so that a keyboard that needs Shift for its digits, such as AZERTY, works too.
      const digit = /^Digit([0-9])$/.exec(event.code)?.[1] ?? (/^[0-9]$/.test(event.key) ? event.key : undefined);
      if (!event.shiftKey && digit !== undefined && inQuery) {
        const id = flagged[placeOf(digit)];
        if (id) {
          event.preventDefault();
          event.stopPropagation();
          quickOpen = false;
          router.go(queryPath(id));
        }
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  });
  /** Where the quick window opened, which its commands belong to. */
  const quickWhere = $derived(
    page.kind === 'query'
      ? queryName?.id === page.id
        ? `Query · ${queryName.name}`
        : 'Query'
      : (screenCommands.where ?? (section ? sectionLabel(section) : page.kind === 'me' ? 'My page' : page.kind === 'groups' ? 'Groups' : null)),
  );
  /** Every row of the quick window: the commands of the screen and of Data Hub, the flagged queries, the places and what the User may see (OP-UX-88). */
  const quickRows: QuickRow[] = $derived.by(() => {
    if (status.kind !== 'signedIn') return [];
    const language = currentLanguage();
    const rows: QuickRow[] = [...(page.kind === 'query' ? (queryCommands[page.id] ?? []) : screenCommands.rows)];
    const command = t('quick.kind.command');
    if (mayQuery(permissions) && can(permissions, 'queries.make')) {
      rows.push({ key: 'new-query', group: 'commands', icon: 'plus-circle-fill', title: t('query.new'), kind: command, words: t('quick.new.words'), does: 'do', run: () => router.go(NEW_QUERY) });
    }
    rows.push({ key: 'theme', group: 'commands', icon: theme === 'dark' ? 'sun-fill' : 'moon-fill', title: t('quick.theme'), kind: command, words: t('quick.theme.words'), does: 'do', run: () => themeOnScreen.switch() });
    // On a flagged query, the next and the previous one, round the row (DEC-UX-241).
    const here = openId ? flagged.indexOf(openId) : -1;
    if (here >= 0 && flagged.length > 1) {
      const step = (by: 1 | -1) => (here + by + flagged.length) % flagged.length;
      for (const [by, key, icon] of [[1, 'quick.flags.next', 'arrow-right'], [-1, 'quick.flags.previous', 'arrow-left']] as const) {
        const at = step(by);
        const id = flagged[at];
        if (id) rows.push({ key: `flags:${by > 0 ? 'next' : 'previous'}`, group: 'flagged', icon, title: t(key), meta: `${flagNames[id] || '…'} · ${modLabel(mac)}${digitOf(at)}`, kind: command, words: t('quick.flags.words'), does: 'go', run: () => router.go(queryPath(id)) });
      }
    }
    flagged.forEach((id, at) =>
      rows.push({ key: `flag:${id}`, group: 'flagged', icon: 'flag-fill', title: flagNames[id] || '…', keys: `${modLabel(mac)}${digitOf(at)}`, kind: t('quick.kind.query'), does: 'open', run: () => router.go(queryPath(id)) }),
    );
    for (const collection of collections ?? []) {
      rows.push({ key: `collection:${collection.id}`, group: 'collections', icon: 'stack', title: collection.name, meta: t('quick.collection.meta', { count: collection.resources.filter((item) => !item.withdrawn).length }), kind: 'Collection', does: 'open', run: () => router.go(collectionPath(collection.id)) });
      for (const item of collection.resources) {
        if (item.withdrawn) continue;
        rows.push({ key: `resource:${item.id}`, group: 'resources', icon: 'table', title: item.displayName, meta: `${collection.name} · ${item.level} · ${levelName(item.level)}`, words: item.key, kind: 'Resource', does: 'open', run: () => router.go(resourcePath(item.id)) });
      }
    }
    for (const lens of lenses ?? []) {
      const where = collections?.find((collection) => collection.id === lens.collectionId)?.name ?? '';
      rows.push({ key: `lens:${lens.id}`, group: 'lenses', icon: 'aperture', title: lens.name, meta: where, words: lens.question, kind: 'Lens', does: 'open', run: () => router.go(lensPath(lens.id)) });
    }
    for (const number of localCards.keys()) {
      const topic = topicOf(number);
      if (topic) rows.push({ key: `card:${number}`, group: 'cards', icon: 'graduation-cap-fill', title: topic.title[language], meta: number, kind: 'Learning Card', does: 'open', run: () => router.go(learningPath(number)) });
    }
    for (const one of SECTIONS.filter((candidate) => sectionFor(candidate, permissions))) {
      if (one.id === 'admin') continue;
      rows.push({ key: `section:${one.id}`, group: 'goTo', icon: one.icon, title: sectionLabel(one), meta: one.id === 'messages' && unread > 0 ? t('quick.unread', { count: unread }) : undefined, kind: t('quick.kind.section'), does: 'go', run: () => router.go(one.path) });
    }
    rows.push({ key: 'section:me', group: 'goTo', icon: 'user', title: 'My page', kind: t('quick.kind.section'), does: 'go', run: () => router.go(myPagePath('profile')) });
    rows.push({ key: 'section:groups', group: 'goTo', icon: 'users-three', title: 'Groups', kind: t('quick.kind.section'), does: 'go', run: () => router.go(GROUPS) });
    for (const tool of ADMIN_TOOLS.filter((candidate) => adminTools.includes(candidate.id))) {
      rows.push({ key: `admin:${tool.id}`, group: 'goTo', icon: tool.icon, title: `Admin · ${tool.name}`, kind: t('quick.kind.section'), does: 'go', run: () => router.go(tool.path) });
    }
    return rows;
  });
  /** The User's own queries matching the words typed, newest first. */
  async function findQueries(words: string): Promise<QuickRow[]> {
    if (!mayQuery(permissions)) return [];
    const found = await queries.list(false, { q: words, limit: 4 });
    return found
      .filter((item) => item.kind === 'query')
      .map((item): QuickRow => ({ key: `query:${item.id}`, group: 'queries', icon: 'terminal-window', title: item.name, meta: item.resources.map((resource) => resource.displayName).join(', '), kind: t('quick.kind.query'), does: 'open', run: () => router.go(queryPath(item.id)) }));
  }

  /** The Collection whose page is open, or that holds the Resource or Lens whose page is open (FR-CO-19). */
  const currentCollection = $derived(
    page.kind === 'collection'
      ? page.id
      : page.kind === 'folder'
        ? page.collection
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
      ? suggestedLevels({
          dataAdmin: can(permissions, 'resources.assign'),
          owner: (collections ?? []).some((collection) => status.kind === 'signedIn' && status.me.groups.includes(collection.ownerUnit.id)),
        })
      : suggestedLevels({ dataAdmin: false, owner: false }),
  );
  /** A page of Query, which a User who may neither make queries nor Preview does not have (FR-PL-14). */
  const queryPage = $derived(page.kind === 'newQuery' || page.kind === 'query' || page.kind === 'newLens' || (page.kind === 'start' && page.section.id === 'query'));
  /** The kinds of Message the User may write (`messages.write`, DEC-PL-04). */
  const writes = $derived.by(() => {
    const kinds = permissions['messages.write'].values.kinds;
    return can(permissions, 'messages.write') && Array.isArray(kinds) ? kinds : [];
  });
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

<!-- Every environment but prod wears a ribbon with its name, on every screen, the sign-in included (DEC-UX-203). -->
<EnvRibbon environment={config.environment ?? 'local'} />

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
    myPageActive={page.kind === 'me' || page.kind === 'groups'}
    onselect={select}
    ontheme={() => themeOnScreen.switch()}
    oncollapse={() => signedIn.settings.set('panel.open', false)}
    panel={section ? panel : undefined}
    panelActions={section?.id === 'collections' && can(permissions, 'collections.make') ? newCollection : section?.id === 'query' && can(permissions, 'queries.make') ? newQuery : undefined}
  >
    {#if inQuery && page.kind !== 'query'}
      <!-- The flagged queries on top of every screen of Query (DEC-UX-236). -->
      {@render flagsBar()}
    {/if}
    {#if page.kind === 'start' && page.section.id === 'collections'}
      <CollectionsStart
        {collections}
        {lenses}
        onsearch={async (question) => {
          const [found, lensesFound] = await Promise.all([catalogue.search(question), queries.searchLenses(question)]);
          return { lenses: lensesFound, ...found };
        }}
        groups={signedIn.me.groups}
        makes={can(permissions, 'collections.make')}
        queries={can(permissions, 'queries.make')}
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
        forDataTeam={can(permissions, 'messages.dataTeam')}
        decides={can(permissions, 'requests.decide')}
        {decideLens}
        onchanged={changedMessage}
      />
    {:else if queryPage && !mayQuery(permissions)}
      <NotFound />
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
        {/key}{:else}<Loading />{/if}
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
    {:else if page.kind === 'chart'}
      <ChartPage id={page.id} overview={chartsShown} {charts} language={currentLanguage()} {theme} />
    {:else if page.kind === 'newQuery'}
      {#key page.resource}
        <QueryNew
          initial={page.resource}
          {collections}
          {catalogue}
          outside={can(permissions, 'queries.outside')}
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
      <!-- Its page lives below the others, where the flagged queries stay open (OP-UX-85). -->
    {:else if page.kind === 'newLens'}
      {#key page.query}
        <LensNew
          queryId={page.query}
          client={queries}
          {catalogue}
          {collections}
          me={{ name: signedIn.me.name, groups: signedIn.me.groups }}
          everyLens={reach(permissions, 'lenses.manage') === 'every'}
          canMake={can(permissions, 'lenses.make')}
          loadGroups={groupsOfUser}
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
          everyLens={reach(permissions, 'lenses.manage') === 'every'}
          canMake={can(permissions, 'lenses.make')}
          loadGroups={groupsOfUser}
          onmade={made}
        />
      {:else if openedLens?.lens}
        {@const lens = openedLens.lens}
        <LensPage
          {lens}
          messages={messagesButton}
          excelAddress={can(permissions, 'excel.keys') ? `${config.queryUrl}/excel/lenses/${encodeURIComponent(lens.id)}` : undefined}
          canQuery={can(permissions, 'queries.make')}
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
      {:else if openedLens?.deleted}
        {@const gone = openedLens.deleted}
        <LensGone lens={gone} collection={collections?.find((collection) => collection.id === gone.collectionId)} messages={messagesButton} />
      {:else if openedLens?.lens === null}
        <NotFound />
      {:else}
        <Loading />
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
            everyLens={reach(permissions, 'lenses.manage') === 'every'}
            canMake={can(permissions, 'lenses.make')}
            loadGroups={groupsOfUser}
            onmade={made}
            ondeleted={deleted}
          />
        {/key}
      {:else if openedLens?.lens !== undefined}
        <NotFound />
      {:else}
        <Loading />
      {/if}
    {:else if page.kind === 'collection' || page.kind === 'newCollection'}
      <CollectionPage
        id={page.kind === 'collection' ? page.id : undefined}
        lenses={lenses?.filter((lens) => page.kind === 'collection' && lens.collectionId === page.id)}
        {catalogue}
        {identity}
        {registry}
        assigns={can(permissions, 'resources.assign')}
        removes={reach(permissions, 'resources.remove')}
        anyOwnerUnit={can(permissions, 'collections.make') && permissions['collections.make'].values.ownerUnit === 'any'}
        own={signedIn.me.groups}
        {waiting}
        go={(path) => router.go(path)}
        onchanged={refresh}
        onmove={move}
        listed={page.kind === 'collection' ? collections?.find((collection) => collection.id === page.id) : undefined}
        messages={page.kind === 'collection' ? messagesButton : undefined}
      />
    {:else if page.kind === 'folder'}
      <FolderPage
        collection={collections === undefined ? undefined : (collections.find((collection) => collection.id === page.collection) ?? null)}
        folderId={page.id}
        {lenses}
        {catalogue}
        removes={reach(permissions, 'resources.remove')}
        own={signedIn.me.groups}
        go={(path) => router.go(path)}
        onchanged={refresh}
        onmove={move}
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
        {identity}
        slack={catalogue}
      />
    {:else if page.kind === 'groups'}
      <!-- Groups, from My page, with no place in the rail (DEC-UX-200, FR-UM-18). -->
      <GroupsPage
        {identity}
        {catalogue}
        environment={config.environment ?? 'local'}
        me={{ sub: signedIn.me.sub, email: signedIn.me.email, name: signedIn.me.name }}
        id={page.id}
        making={page.making ?? false}
        makes={can(permissions, 'groups.manage')}
        every={can(permissions, 'groups.all.manage')}
        {collections}
        go={(path) => router.go(path)}
        onmembership={() => void membershipChanged()}
      />
    {:else if page.kind === 'resource'}
      {#if opened?.resource}
        {@const resource = opened.resource}
        <ResourcePage
          {resource}
          messages={messagesButton}
          threads={onObject?.key === `resource:${resource.id}` ? onObject.messages : undefined}
          log={opened.log}
          collection={collections?.find((collection) => collection.id === resource.collectionId)}
          {collections}
          {catalogue}
          {registry}
          {queries}
          {permissions}
          groups={status.kind === 'signedIn' ? status.me.groups : []}
          onchange={(updated) => {
            if (opened?.id === updated.id) {
              opened = { ...opened, resource: updated };
            }
            // Published or deprecated, the panel shows it so.
            refresh();
          }}
          onrun={() => refreshQueries()}
        />
      {:else if opened?.resource === null}
        <NotFound />
      {:else}
        <Loading />
      {/if}
    {:else if page.kind === 'admin'}
      <!-- Admin shows only the tools of `admin.open`; the services refuse the others too (DEC-UX-130, FR-PL-14). -->
      {#if !adminTools.includes(page.tool)}
        <NotFound />
      {:else if page.tool === 'keys'}
        <AdminExcelKeys {identity} environment={config.environment ?? 'local'} me={signedIn.me.sub} onactive={(count) => (activeKeys = count)} />
      {:else if page.tool === 'users'}
        <AdminUsers
          {identity}
          environment={config.environment ?? 'local'}
          me={signedIn.me.sub}
          filter={usersOf}
          user={page.user}
          groupsHref={adminTools.includes('permissionGroups') ? ADMIN_TOOLS.find((tool) => tool.id === 'permissionGroups')?.path : undefined}
          oncount={(count) => (userCount = count)}
        />
      {:else if page.tool === 'permissionGroups'}
        <AdminPermissionGroups
          {identity}
          environment={config.environment ?? 'local'}
          usersHref={adminTools.includes('users') ? ADMIN_TOOLS.find((tool) => tool.id === 'users')?.path : undefined}
          onusers={(group) => (usersOf = group)}
          oncount={(count) => (groupCount = count)}
        />
      {:else if page.tool === 'withdrawn'}
        <AdminWithdrawn {catalogue} environment={config.environment ?? 'local'} go={(path) => router.go(path)} oncount={(count) => (withdrawnCount = count)} />
      {:else}
        <AdminWebhooks {registry} environment={config.environment ?? 'local'} ontolookat={(count) => (webhooksToLookAt = count)} />
      {/if}
    {:else if page.kind === 'notFound'}
      <NotFound />
    {/if}
    {#if mayQuery(permissions) && alive.length > 0}
      <!-- Every flagged query opened since this tab loaded stays as the User left it; only the open one shows (OP-UX-85). -->
      <div class="query-screen" style:display={page.kind === 'query' ? undefined : 'none'}>
        {#if page.kind === 'query'}{@render flagsBar()}{/if}
        <div class="query-pages">
          <!-- The editor of Query comes when a query opens, so that the other pages load without it. -->
          {#await import('./screens/QueryPage.svelte') then { default: QueryPage }}
            {#each alive as id (id)}
              {@const shown = page.kind === 'query' && page.id === id}
              <div class="query-kept" style:display={shown ? undefined : 'none'}>
                <QueryPage
                  {id}
                  opened={shown && page.kind === 'query' ? page.run : null}
                  client={queries}
                  {summaryOf}
                  findTables={can(permissions, 'queries.outside') ? (words, filter) => registry.findTables(words, filter) : undefined}
                  {collections}
                  nonce={config.styleNonce}
                  onran={refreshQueries}
                  onmade={(made) => {
                    refreshQueries();
                    router.go(queryPath(made.id));
                  }}
                  onlens={made}
                  hiddenChange={queryHidden}
                  layout={settings?.values['query.layout'] ?? 'horizontal'}
                  onlayout={(layout) => settings?.set('query.layout', layout)}
                  onhidden={(id, hidden) => {
                    queryHidden = { id, hidden };
                    refreshQueries();
                  }}
                  flagAt={flagged.includes(id) ? flagged.indexOf(id) : null}
                  flagsFull={flagged.length >= MOST_FLAGGED}
                  onflag={(on) => setFlagged(on ? flag(flagged, id) : unflag(flagged, id))}
                  onstatus={statusOf}
                  oncommands={(of, rows) => (queryCommands = { ...queryCommands, [of]: rows })}
                  go={(path) => router.go(path)}
                  {mac}
                />
              </div>
            {/each}
          {/await}
        </div>
      </div>
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
          writes={onObject?.kinds ?? writes}
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
          writes={onObject?.kinds ?? writes}
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
        decides={can(permissions, 'requests.decide')}
        {decideLens}
        onchanged={changedMessage}
        onclose={() => router.go(router.path.replace(/\/messages\/[^/]+$/, ''))}
      />
    {/if}
  </AppShell>
  {#if quickOpen}
    <!-- Cmd+Shift+P or Cmd+K, anywhere in Data Hub (DEC-UX-237). -->
    <QuickWindow where={quickWhere} screenGroup={page.kind === 'query' ? t('quick.group.query') : (screenCommands.group ?? t('quick.group.query'))} rows={quickRows} {findQueries} onclose={() => (quickOpen = false)} />
  {/if}
  <!-- What is dragged, and the line that says where it went (DEC-UX-157). -->
  <DragGhost item={dragging.item} />
  <Toast key={moved.key} tone={moved.failed ? 'failed' : 'done'}>
    {#if moved.failed}{t('folder.moveFailed', { name: moved.name })}{:else}{t('folder.moved', { name: moved.name })} <b>{moved.to}</b>{/if}
  </Toast>
  <!-- A service refused for a Permission the User no longer has: the page follows what they may do now (EC-PL-01). -->
  <Toast key={lost.key} tone="failed">{t('permissions.changed', { permission: lost.name })}</Toast>
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
      currentFolder={page.kind === 'folder' ? page.id : undefined}
      groups={status.me.groups}
      onmove={move}
    />
  {:else if section?.id === 'learning' && status.kind === 'signedIn'}
    <LearningPanel shown={shownCards} progress={progress ?? []} current={page.kind === 'learningCard' || page.kind === 'learningSee' ? page.id : undefined} unfold={unfoldLevel} />
  {:else if section?.id === 'admin' && adminTools.length > 0}
    <AdminPanel
      current={page.kind === 'admin' ? page.tool : undefined}
      tools={adminTools}
      environment={config.environment ?? 'local'}
      counts={{
        ...(webhooksToLookAt === undefined ? {} : { webhooks: webhooksToLookAt }),
        ...(activeKeys === undefined ? {} : { keys: activeKeys }),
        ...(userCount === undefined ? {} : { users: userCount }),
        ...(groupCount === undefined ? {} : { permissionGroups: groupCount }),
        ...(withdrawnCount === undefined ? {} : { withdrawn: withdrawnCount }),
      }}
    />
  {:else if section?.id === 'messages' && status.kind === 'signedIn'}
    <MessagesPanel filter={messageFilter} counts={centre?.counts} onfilter={(filter) => (messageFilter = filter)} />
  {:else if section?.id === 'query' && status.kind === 'signedIn' && mayQuery(permissions)}
    <QueryPanel
      client={queries}
      everyone={reach(permissions, 'queries.seeOthers') === 'every'}
      current={openQuery}
      runs={currentRuns}
      draft={page.kind === 'newQuery' ? draft : null}
      version={queriesVersion}
      onhidden={(id, hidden) => (queryHidden = { id, hidden })}
      {flagged}
    />
  {:else if section?.id === 'charts' && status.kind === 'signedIn'}
    <ChartsPanel overview={chartsShown} current={page.kind === 'chart' ? page.id : undefined} iconUrl={(id) => charts.iconUrl(id)} />
  {/if}
{/snippet}

{#snippet newQuery()}
  <!-- Reads the queries again, such as those Claude made meanwhile (DEC-UX-163). -->
  <IconButton icon="arrows-clockwise" label={t('query.refresh')} onclick={() => refreshQueries()} />
  <IconButton icon="plus-circle-fill" label={t('query.new')} href={NEW_QUERY} />
{/snippet}

{#snippet flagsBar()}
  <QueryFlags
    items={flagItems}
    current={openId}
    {mac}
    onunflag={(id) => setFlagged(unflag(flagged, id))}
    onmove={(from, to) => setFlagged(moveFlag(flagged, from, to))}
    onquick={() => (quickOpen = true)}
    onflag={page.kind === 'query' && !flagged.includes(page.id) && flagged.length < MOST_FLAGGED ? () => openId && setFlagged(flag(flagged, openId)) : undefined}
  />
{/snippet}

{#snippet newCollection()}
  <IconButton icon="plus-circle-fill" label={t('collections.new')} href={NEW_COLLECTION} />
{/snippet}

<style>
  /* A query fills the height of the screen under the row of flagged queries (DEC-UX-144, DEC-UX-236). */
  .query-screen { height: 100%; min-height: 0; display: flex; flex-direction: column; }
  .query-pages { flex: 1; min-height: 0; }
  .query-kept { height: 100%; }
</style>
