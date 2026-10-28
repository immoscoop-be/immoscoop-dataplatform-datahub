import { SECTIONS, type Section } from './sections.js';

/** The tabs of My page that part 1 builds; Excel keys come with part 9 (DEC-UX-85, DEC-UX-108). */
export const MY_PAGE_TABS = ['profile', 'background'] as const;
export type MyPageTab = (typeof MY_PAGE_TABS)[number];

export type Route =
  | { readonly kind: 'start'; readonly section: Section }
  | { readonly kind: 'me'; readonly tab: MyPageTab }
  /** The page of a Resource, in the section Collections. */
  | { readonly kind: 'resource'; readonly id: string; readonly section: Section }
  /** The page of a Collection (FR-CO-25). */
  | { readonly kind: 'collection'; readonly id: string; readonly section: Section }
  /** An empty Collection page, being made (FR-CO-12). */
  | { readonly kind: 'newCollection'; readonly section: Section }
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'notFound' };

export const HOME = '/collections';
export const myPagePath = (tab: MyPageTab): string => (tab === 'profile' ? '/me' : `/me/${tab}`);
export const resourcePath = (id: string): string => `/resources/${encodeURIComponent(id)}`;
export const collectionPath = (id: string): string => `/collections/${encodeURIComponent(id)}`;
export const NEW_COLLECTION = '/collections/new';

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
    return { kind: 'start', section };
  }
  if (clean === '/me') {
    return { kind: 'me', tab: 'profile' };
  }
  const tab = MY_PAGE_TABS.find((candidate) => clean === `/me/${candidate}` && candidate !== 'profile');
  if (tab) {
    return { kind: 'me', tab };
  }
  const collections = SECTIONS.find((candidate) => candidate.id === 'collections');
  if (!collections) {
    return { kind: 'notFound' };
  }
  if (clean === NEW_COLLECTION) {
    return { kind: 'newCollection', section: collections };
  }
  const [, kind, id] = /^\/(resources|collections)\/([^/]+)$/.exec(clean) ?? [];
  if (kind && id) {
    try {
      return { kind: kind === 'resources' ? 'resource' : 'collection', id: decodeURIComponent(id), section: collections };
    } catch {
      return { kind: 'notFound' };
    }
  }
  return { kind: 'notFound' };
}
