import { PROBE_KEYS, type ProbeKey } from '@datahub/contracts/eda';
import { FIRST_CHART } from './charts.js';
import { ADMIN_TOOLS, type AdminTool, SECTIONS, type Section } from './sections.js';

/** The tabs of My page that part 1 builds; Excel keys come with part 9 (DEC-UX-85, DEC-UX-108). */
export const MY_PAGE_TABS = ['profile', 'keys', 'background'] as const;
export type MyPageTab = (typeof MY_PAGE_TABS)[number];

/**
 * What an object page shows of its Messages: the slide-in with all of them (FR-CV-07), or one in a floating
 * window over the page, opened in context (FR-CV-09); the address names the Message.
 */
export type Talk = { readonly messages?: true; readonly message?: string };

/**
 * A spot on the page of a Resource, at an address of its own after it (DEC-CL-19, DEC-UX-274): a tab, or a part of
 * its Overview. A link from Claude opens the part that a step of the Owner Journey writes, such as its Known Gaps.
 */
export const RESOURCE_SPOTS = ['columns', 'lineage', 'history', 'preview', 'summary', 'description', 'behaviour', 'gaps', 'querying', 'entities', 'maturity', 'changes', 'danger'] as const;
export type ResourceSpot = (typeof RESOURCE_SPOTS)[number];

/** The tabs of the page of an EDA (DEC-UX-321): Steps is where it opens, at the address of the EDA itself. */
export const EDA_TABS = ['overview', 'steps', 'profile'] as const;
export type EdaTab = (typeof EDA_TABS)[number];

export type Route =
  | { readonly kind: 'start'; readonly section: Section }
  /** The Message Centre, with one Message opened on the right (FR-CV-06). */
  | { readonly kind: 'messages'; readonly id: string | null; readonly section: Section }
  | { readonly kind: 'me'; readonly tab: MyPageTab }
  /**
   * Groups, reached from My page, with no place in the rail (DEC-UX-200): the list, one Group opened on the right, or
   * the sheet of a new Group over the list (FR-UM-13, FR-UM-18).
   */
  | { readonly kind: 'groups'; readonly id: string | null; readonly making?: true }
  /** The page of a Resource, in the section Collections. */
  | ({ readonly kind: 'resource'; readonly id: string; readonly section: Section; readonly at?: ResourceSpot } & Talk)
  /** The page of a Collection (FR-CO-25). */
  | ({ readonly kind: 'collection'; readonly id: string; readonly section: Section } & Talk)
  /** The page of a folder of a Collection (FR-CO-38). */
  | { readonly kind: 'folder'; readonly collection: string; readonly id: string; readonly section: Section }
  /** An empty Collection page, being made (FR-CO-12). */
  | { readonly kind: 'newCollection'; readonly section: Section }
  /** A new query, on a Resource when it starts from its page (FR-SR-46), or for a Collection from its "New Lens" (DEC-UX-123). */
  | { readonly kind: 'newQuery'; readonly resource: string | null; readonly forCollection?: string; readonly section: Section }
  /** A query, in the section Query (FR-SR-41); with `run`, its history, at one run or at all (DEC-UX-74). */
  | ({ readonly kind: 'query'; readonly id: string; readonly run: number | 'all' | null; readonly section: Section } & Talk)
  /** The page of a Project, in the section Query (DEC-UX-285). */
  | { readonly kind: 'project'; readonly id: string; readonly section: Section }
  /** Make it a lens, from a query, in the section Query (DEC-UX-25). */
  | { readonly kind: 'newLens'; readonly query: string; readonly section: Section }
  /** The page of a Lens, in the section Collections (DEC-UX-66). */
  | ({ readonly kind: 'lens'; readonly id: string; readonly section: Section } & Talk)
  /** Edit a Lens, for its Owner Unit (FR-LE-06). */
  | { readonly kind: 'editLens'; readonly id: string; readonly section: Section }
  /** A Learning Card, by its number, in five steps (FR-LR-27); its Messages too (FR-LR-06). */
  | ({ readonly kind: 'learningCard'; readonly id: string; readonly section: Section } & Talk)
  /** See it of a Learning Card, on a page of its own (FR-LR-29). */
  | { readonly kind: 'learningSee'; readonly id: string; readonly section: Section }
  /** A tool of Admin, for the Data Team (DEC-UX-130); on Users, with one User opened (FR-PL-07). */
  | { readonly kind: 'admin'; readonly tool: AdminTool; readonly section: Section; readonly user?: string }
  /** A chart of semgraph, in Charts, its gallery (FR-CH-06). */
  | { readonly kind: 'chart'; readonly id: string; readonly section: Section }
  /**
   * The EDA of a Resource, in the section EDA, by the ID of its Resource, on one of its tabs; on Steps, the detail of one
   * of its EDA-Probes in place of its rows (DEC-UX-321, DEC-UX-324).
   */
  | { readonly kind: 'eda'; readonly id: string; readonly tab: EdaTab; readonly probe: ProbeKey | null; readonly section: Section }
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'notFound' };

export const HOME = '/collections';
export const myPagePath = (tab: MyPageTab): string => (tab === 'profile' ? '/me' : `/me/${tab}`);
export const resourcePath = (id: string, at?: ResourceSpot): string => `/resources/${encodeURIComponent(id)}${at ? `/${at}` : ''}`;
/** Groups, and one Group opened in it (FR-UM-18). */
export const GROUPS = '/groups';
export const groupPath = (id: string): string => `${GROUPS}/${encodeURIComponent(id)}`;
/** The sheet of a new Group, over the list (FR-UM-13). */
export const NEW_GROUP = `${GROUPS}/new`;
export const collectionPath = (id: string): string => `/collections/${encodeURIComponent(id)}`;
export const NEW_COLLECTION = '/collections/new';
/** A folder of a Collection, at an address under it (FR-CO-38). */
export const folderPath = (collection: string, id: string): string => `${collectionPath(collection)}/folders/${encodeURIComponent(id)}`;
export const NEW_QUERY = '/query/new';
export const queryPath = (id: string): string => `/query/${encodeURIComponent(id)}`;
/** The history of a query, at one of its runs or at all of them, as the panel opens it (DEC-UX-74). */
export const queryRunsPath = (id: string, run?: number): string => `${queryPath(id)}/runs${run === undefined ? '' : `/${run}`}`;
/** A new query on a Resource, as "Query" on its page starts it (FR-SR-46). */
export const newQueryPath = (resource: string): string => `${NEW_QUERY}/${encodeURIComponent(resource)}`;
/** Make it a lens, from a query (DEC-UX-25). */
export const newLensPath = (query: string): string => `${queryPath(query)}/lens`;
export const lensPath = (id: string): string => `/lenses/${encodeURIComponent(id)}`;
export const editLensPath = (id: string): string => `${lensPath(id)}/edit`;
/** "New Lens" on a Collection: a new query, whose "Make it a lens" offers that Collection first (DEC-UX-123). */
export const newLensForPath = (collection: string): string => `${NEW_QUERY}/for/${encodeURIComponent(collection)}`;
/** A Learning Card, at its own address (DEC-LR-12). */
export const learningPath = (number: string): string => `/learning/${encodeURIComponent(number)}`;
/** See it of a Learning Card, on its own (FR-LR-29). */
export const seePath = (number: string): string => `${learningPath(number)}/see`;
export const MESSAGES = '/messages';
/** The EDA of a Resource, on a tab; Steps at the address of the EDA itself (DEC-UX-321). */
export const edaPath = (id: string, tab: EdaTab = 'steps'): string => `/eda/${encodeURIComponent(id)}${tab === 'steps' ? '' : `/${tab}`}`;
/** The detail of an EDA-Probe of the EDA of a Resource, in its tab Steps (DEC-UX-324). */
export const probePath = (id: string, probe: ProbeKey): string => `/eda/${encodeURIComponent(id)}/probes/${probe}`;
/** A chart in Charts, by the id semgraph gives it (FR-CH-06). */
export const chartPath = (id: string): string => `/charts/${encodeURIComponent(id)}`;
/** A Message opened in the Message Centre. */
export const messagePath = (id: string): string => `${MESSAGES}/${encodeURIComponent(id)}`;
/** Users in Admin, with one User opened (FR-PL-07). */
export const usersPath = (googleId?: string): string => (googleId ? `/admin/users/${encodeURIComponent(googleId)}` : '/admin/users');
/**
 * The page of an object a Message is on (FR-CV-02). A Message about a User, of their Permission group (FR-PL-12),
 * leads that User to My page, and the Data Team to that User on Users when Admin was given back (MSG-USR-02) or
 * when they are new (MSG-USR-03).
 */
export function objectPath(subject: { kind: string; id: string }, type?: string, params?: Readonly<Record<string, string>>): string {
  if (subject.kind === 'user') {
    // A Project shared with the User, or deleted, opens its page; taken out of one, Query (MSG-QRY-03 to MSG-QRY-05).
    if ((type === 'MSG-QRY-03' || type === 'MSG-QRY-05') && params?.projectId) return `/query/projects/${encodeURIComponent(params.projectId)}`;
    if (type === 'MSG-QRY-04') return '/query';
    return type === 'MSG-USR-02' || type === 'MSG-USR-03' ? usersPath(subject.id) : myPagePath('profile');
  }
  return subject.kind === 'resource'
    ? resourcePath(subject.id)
    : subject.kind === 'collection'
      ? collectionPath(subject.id)
      : subject.kind === 'lens'
        ? lensPath(subject.id)
        : subject.kind === 'learningCard'
          ? learningPath(subject.id)
          : // An Excel key is listed on My page, with the other keys of its User (FR-PL-02).
            subject.kind === 'excelKey'
            ? myPagePath('keys')
            : queryPath(subject.id);
}
/** The Messages on an object, in its slide-in (FR-CV-07). */
export const messagesOnPath = (subject: { kind: string; id: string }): string => `${objectPath(subject)}/messages`;
/** A Message opened in context: the page of its object, with the Message in a floating window (FR-CV-09); notifications link to it too. */
export { contextPath } from '@datahub/contracts/messages';

/**
 * What an address shows. Every address that is no page of Data Hub shows the one page for what does
 * not exist or may not be seen, which does not say which of the two it is (DEC-UX-32, FR-CO-32). Admin opens on
 * the first of the tools the User may open, every tool when they are not given.
 */
export function route(path: string, adminTools: readonly AdminTool[] = ADMIN_TOOLS.map((tool) => tool.id)): Route {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (clean === '/') {
    return { kind: 'redirect', to: HOME };
  }
  // Admin opens on its first tool the User may open (OP-UX-52, FR-PL-14).
  const admin = SECTIONS.find((candidate) => candidate.id === 'admin');
  if (admin && clean === admin.path) {
    return { kind: 'redirect', to: (ADMIN_TOOLS.find((tool) => adminTools.includes(tool.id)) ?? ADMIN_TOOLS[0]).path };
  }
  const tool = ADMIN_TOOLS.find((candidate) => candidate.path === clean);
  if (admin && tool) {
    return { kind: 'admin', tool: tool.id, section: admin };
  }
  const [, user] = /^\/admin\/users\/([^/]+)$/.exec(clean) ?? [];
  if (admin && user) {
    try {
      return { kind: 'admin', tool: 'users', section: admin, user: decodeURIComponent(user) };
    } catch {
      return { kind: 'notFound' };
    }
  }
  // Charts opens on its first chart (DEC-UX-182).
  const charts = SECTIONS.find((candidate) => candidate.id === 'charts');
  if (charts && clean === charts.path) {
    return { kind: 'redirect', to: chartPath(FIRST_CHART) };
  }
  const [, chart] = /^\/charts\/([^/]+)$/.exec(clean) ?? [];
  if (charts && chart) {
    try {
      return { kind: 'chart', id: decodeURIComponent(chart), section: charts };
    } catch {
      return { kind: 'notFound' };
    }
  }
  // The EDA of a Resource: a tab of it, or on Steps the detail of one of its EDA-Probes (DEC-UX-321, DEC-UX-324).
  const eda = SECTIONS.find((candidate) => candidate.id === 'eda');
  const [, edaOf, edaAt] = /^\/eda\/([^/]+)(?:\/(.+))?$/.exec(clean) ?? [];
  if (eda && edaOf) {
    let id: string;
    try {
      id = decodeURIComponent(edaOf);
    } catch {
      return { kind: 'notFound' };
    }
    if (edaAt === undefined) {
      return { kind: 'eda', id, tab: 'steps', probe: null, section: eda };
    }
    const tab = EDA_TABS.find((one) => one === edaAt && one !== 'steps');
    if (tab) {
      return { kind: 'eda', id, tab, probe: null, section: eda };
    }
    const probe = PROBE_KEYS.find((key) => edaAt === `probes/${key}`);
    return probe ? { kind: 'eda', id, tab: 'steps', probe, section: eda } : { kind: 'notFound' };
  }
  const section = SECTIONS.find((candidate) => candidate.path === clean);
  if (section) {
    return section.id === 'messages' ? { kind: 'messages', id: null, section } : { kind: 'start', section };
  }
  const messages = SECTIONS.find((candidate) => candidate.id === 'messages');
  const [, opened] = /^\/messages\/([^/]+)$/.exec(clean) ?? [];
  if (messages && opened) {
    try {
      return { kind: 'messages', id: decodeURIComponent(opened), section: messages };
    } catch {
      return { kind: 'notFound' };
    }
  }
  // The Messages on an object, or one of them in context, after the address of its page.
  const [, page, , talked] = /^(.+?)\/messages(\/([^/]+))?$/.exec(clean) ?? [];
  if (page && !page.startsWith('/messages')) {
    const under = route(page);
    if (under.kind === 'resource' || under.kind === 'collection' || under.kind === 'lens' || under.kind === 'learningCard' || (under.kind === 'query' && under.run === null && talked)) {
      try {
        return talked ? { ...under, message: decodeURIComponent(talked) } : { ...under, messages: true };
      } catch {
        return { kind: 'notFound' };
      }
    }
    return { kind: 'notFound' };
  }
  if (clean === '/me') {
    return { kind: 'me', tab: 'profile' };
  }
  const tab = MY_PAGE_TABS.find((candidate) => clean === `/me/${candidate}` && candidate !== 'profile');
  if (tab) {
    return { kind: 'me', tab };
  }
  // Groups, from My page: the list, a new Group, or one Group opened (FR-UM-18).
  if (clean === GROUPS) {
    return { kind: 'groups', id: null };
  }
  if (clean === NEW_GROUP) {
    return { kind: 'groups', id: null, making: true };
  }
  const [, groupId] = /^\/groups\/([^/]+)$/.exec(clean) ?? [];
  if (groupId) {
    try {
      return { kind: 'groups', id: decodeURIComponent(groupId) };
    } catch {
      return { kind: 'notFound' };
    }
  }
  const learning = SECTIONS.find((candidate) => candidate.id === 'learning');
  const [, card, see] = /^\/learning\/([^/]+)(\/see)?$/.exec(clean) ?? [];
  if (learning && card) {
    try {
      const id = decodeURIComponent(card);
      return see ? { kind: 'learningSee', id, section: learning } : { kind: 'learningCard', id, section: learning };
    } catch {
      return { kind: 'notFound' };
    }
  }
  const query = SECTIONS.find((candidate) => candidate.id === 'query');
  const [, queryId, runs, runNumber] = /^\/query\/([^/]+)(\/runs(?:\/([1-9]\d{0,8}))?)?$/.exec(clean) ?? [];
  const [, newOn] = /^\/query\/new\/([^/]+)$/.exec(clean) ?? [];
  const [, newFor] = /^\/query\/new\/for\/([^/]+)$/.exec(clean) ?? [];
  const [, lensFrom] = /^\/query\/([^/]+)\/lens$/.exec(clean) ?? [];
  const [, projectId] = /^\/query\/projects\/([^/]+)$/.exec(clean) ?? [];
  try {
    if (query && projectId) {
      return { kind: 'project', id: decodeURIComponent(projectId), section: query };
    }
    if (query && clean === NEW_QUERY) {
      return { kind: 'newQuery', resource: null, section: query };
    }
    if (query && newFor) {
      return { kind: 'newQuery', resource: null, forCollection: decodeURIComponent(newFor), section: query };
    }
    if (query && newOn) {
      return { kind: 'newQuery', resource: decodeURIComponent(newOn), section: query };
    }
    if (query && lensFrom && lensFrom !== 'new') {
      return { kind: 'newLens', query: decodeURIComponent(lensFrom), section: query };
    }
    if (query && queryId && queryId !== 'new') {
      return { kind: 'query', id: decodeURIComponent(queryId), run: runNumber ? Number(runNumber) : runs ? 'all' : null, section: query };
    }
  } catch {
    return { kind: 'notFound' };
  }
  const collections = SECTIONS.find((candidate) => candidate.id === 'collections');
  if (!collections) {
    return { kind: 'notFound' };
  }
  if (clean === NEW_COLLECTION) {
    return { kind: 'newCollection', section: collections };
  }
  const [, editing] = /^\/lenses\/([^/]+)\/edit$/.exec(clean) ?? [];
  if (editing) {
    try {
      return { kind: 'editLens', id: decodeURIComponent(editing), section: collections };
    } catch {
      return { kind: 'notFound' };
    }
  }
  const [, inCollection, folder] = /^\/collections\/([^/]+)\/folders\/([^/]+)$/.exec(clean) ?? [];
  if (inCollection && folder) {
    try {
      return { kind: 'folder', collection: decodeURIComponent(inCollection), id: decodeURIComponent(folder), section: collections };
    } catch {
      return { kind: 'notFound' };
    }
  }
  // A spot on the page of a Resource: one of its tabs, or a part of its Overview (DEC-CL-19).
  const [, spotted, spot] = /^\/resources\/([^/]+)\/([^/]+)$/.exec(clean) ?? [];
  if (spotted && spot) {
    const at = RESOURCE_SPOTS.find((one) => one === spot);
    if (!at) {
      return { kind: 'notFound' };
    }
    try {
      return { kind: 'resource', id: decodeURIComponent(spotted), section: collections, at };
    } catch {
      return { kind: 'notFound' };
    }
  }
  const [, kind, id] = /^\/(resources|collections|lenses)\/([^/]+)$/.exec(clean) ?? [];
  if (kind && id) {
    try {
      return { kind: kind === 'resources' ? 'resource' : kind === 'lenses' ? 'lens' : 'collection', id: decodeURIComponent(id), section: collections };
    } catch {
      return { kind: 'notFound' };
    }
  }
  return { kind: 'notFound' };
}
