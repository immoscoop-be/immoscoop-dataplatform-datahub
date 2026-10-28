import { SECTIONS, type Section } from './sections.js';

/** The tabs of My page that part 1 builds; Excel keys come with part 9 (DEC-UX-85, DEC-UX-108). */
export const MY_PAGE_TABS = ['profile', 'background'] as const;
export type MyPageTab = (typeof MY_PAGE_TABS)[number];

export type Route =
  | { readonly kind: 'start'; readonly section: Section }
  | { readonly kind: 'me'; readonly tab: MyPageTab }
  /** The page of a Resource, in the section Collections. */
  | { readonly kind: 'resource'; readonly id: string; readonly section: Section }
  | { readonly kind: 'redirect'; readonly to: string }
  | { readonly kind: 'notFound' };

export const HOME = '/collections';
export const myPagePath = (tab: MyPageTab): string => (tab === 'profile' ? '/me' : `/me/${tab}`);
export const resourcePath = (id: string): string => `/resources/${encodeURIComponent(id)}`;

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
  const resource = /^\/resources\/([^/]+)$/.exec(clean)?.[1];
  const collections = SECTIONS.find((candidate) => candidate.id === 'collections');
  if (resource && collections) {
    try {
      return { kind: 'resource', id: decodeURIComponent(resource), section: collections };
    } catch {
      return { kind: 'notFound' };
    }
  }
  return { kind: 'notFound' };
}
