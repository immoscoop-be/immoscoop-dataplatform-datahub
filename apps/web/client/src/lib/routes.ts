import { SECTIONS, type Section } from './sections.js';

/** The tabs of My page that part 1 builds; Excel keys come with part 9 (DEC-UX-85, DEC-UX-108). */
export const MY_PAGE_TABS = ['profile', 'background'] as const;
export type MyPageTab = (typeof MY_PAGE_TABS)[number];

/**
 * What an object page shows of its Messages: the slide-in with all of them (FR-CV-07), or one in a floating
 * window over the page, opened in context (FR-CV-09); the address names the Message.
 */
export type Talk = { readonly messages?: true; readonly message?: string };

export type Route =
  | { readonly kind: 'start'; readonly section: Section }
  /** The Message Centre, with one Message opened on the right (FR-CV-06). */
  | { readonly kind: 'messages'; readonly id: string | null; readonly section: Section }
  | { readonly kind: 'me'; readonly tab: MyPageTab }
  /** The page of a Resource, in the section Collections. */
  | ({ readonly kind: 'resource'; readonly id: string; readonly section: Section } & Talk)
  /** The page of a Collection (FR-CO-25). */
  | ({ readonly kind: 'collection'; readonly id: string; readonly section: Section } & Talk)
  /** An empty Collection page, being made (FR-CO-12). */
  | { readonly kind: 'newCollection'; readonly section: Section }
  /** A new query, on a Resource when it starts from its page (FR-SR-46), or for a Collection from its "New Lens" (DEC-UX-123). */
  | { readonly kind: 'newQuery'; readonly resource: string | null; readonly forCollection?: string; readonly section: Section }
  /** A query, in the section Query (FR-SR-41); with `run`, its history, at one run or at all (DEC-UX-74). */
  | ({ readonly kind: 'query'; readonly id: string; readonly run: number | 'all' | null; readonly section: Section } & Talk)
  /** Make it a lens, from a query, in the section Query (DEC-UX-25). */
  | { readonly kind: 'newLens'; readonly query: string; readonly section: Section }
  /** The page of a Lens, in the section Collections (DEC-UX-66). */
  | ({ readonly kind: 'lens'; readonly id: string; readonly section: Section } & Talk)
  /** Edit a Lens, for its Owner Unit (FR-LE-06). */
  | { readonly kind: 'editLens'; readonly id: string; readonly section: Section }
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'notFound' };

export const HOME = '/collections';
export const myPagePath = (tab: MyPageTab): string => (tab === 'profile' ? '/me' : `/me/${tab}`);
export const resourcePath = (id: string): string => `/resources/${encodeURIComponent(id)}`;
export const collectionPath = (id: string): string => `/collections/${encodeURIComponent(id)}`;
export const NEW_COLLECTION = '/collections/new';
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
export const MESSAGES = '/messages';
/** A Message opened in the Message Centre. */
export const messagePath = (id: string): string => `${MESSAGES}/${encodeURIComponent(id)}`;
/** The page of an object a Message is on (FR-CV-02). */
export function objectPath(subject: { kind: string; id: string }): string {
  return subject.kind === 'resource'
    ? resourcePath(subject.id)
    : subject.kind === 'collection'
      ? collectionPath(subject.id)
      : subject.kind === 'lens'
        ? lensPath(subject.id)
        : queryPath(subject.id);
}
/** The Messages on an object, in its slide-in (FR-CV-07). */
export const messagesOnPath = (subject: { kind: string; id: string }): string => `${objectPath(subject)}/messages`;
/** A Message opened in context: the page of its object, with the Message in a floating window (FR-CV-09). */
export const contextPath = (subject: { kind: string; id: string }, message: string): string => `${messagesOnPath(subject)}/${encodeURIComponent(message)}`;

/**
 * What an address shows. Every address that is no page of Data Hub shows the one page for what does
 * not exist or may not be seen, which does not say which of the two it is (DEC-UX-32, FR-CO-32).
 */
export function route(path: string): Route {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (clean === '/') {
    return { kind: 'redirect', to: HOME };
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
    if (under.kind === 'resource' || under.kind === 'collection' || under.kind === 'lens' || (under.kind === 'query' && under.run === null && talked)) {
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
  const query = SECTIONS.find((candidate) => candidate.id === 'query');
  const [, queryId, runs, runNumber] = /^\/query\/([^/]+)(\/runs(?:\/([1-9]\d{0,8}))?)?$/.exec(clean) ?? [];
  const [, newOn] = /^\/query\/new\/([^/]+)$/.exec(clean) ?? [];
  const [, newFor] = /^\/query\/new\/for\/([^/]+)$/.exec(clean) ?? [];
  const [, lensFrom] = /^\/query\/([^/]+)\/lens$/.exec(clean) ?? [];
  try {
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
