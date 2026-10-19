import { useSyncExternalStore } from 'react';

/** Where the User is in the app; it lives in the hash of the address, so back, forward and links work. */
export type Route =
  | SearchRoute
  | { page: 'node'; uniqueId: string }
  | { page: 'collections' }
  | { page: 'collection'; id: string }
  | { page: 'charts' }
  | { page: 'chart'; id: string };

/** A search, optionally within one dbt project, by its ID. */
export type SearchRoute = { page: 'search'; query: string; project?: string };

/**
 * `#/search?q=orders&project=17121`, `#/nodes/<unique ID>`, `#/collections`, `#/collections/<ID>`,
 * `#/charts`, `#/charts/<ID>`, or `#<unique ID>`, the links of the first page.
 */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/collections' || path === '/collections/') {
    return { page: 'collections' };
  }
  if (path.startsWith('/collections/')) {
    return { page: 'collection', id: decode(path.slice('/collections/'.length)) };
  }
  if (path === '/charts' || path === '/charts/') {
    return { page: 'charts' };
  }
  if (path.startsWith('/charts/')) {
    return { page: 'chart', id: decode(path.slice('/charts/'.length)) };
  }
  if (path.startsWith('/nodes/')) {
    return { page: 'node', uniqueId: decode(path.slice('/nodes/'.length)) };
  }
  if (path.startsWith('/search')) {
    const parameters = new URLSearchParams(path.split('?')[1] ?? '');
    const project = parameters.get('project') ?? '';
    return { page: 'search', query: parameters.get('q')?.trim() ?? '', ...(/^\d+$/.test(project) ? { project } : {}) };
  }
  if (path.length > 0 && !path.startsWith('/')) {
    return { page: 'node', uniqueId: decode(path) };
  }
  return { page: 'search', query: '' };
}

export function hrefFor(route: Route): string {
  if (route.page === 'node') {
    return `#/nodes/${encodeURIComponent(route.uniqueId)}`;
  }
  if (route.page === 'collections') {
    return '#/collections';
  }
  if (route.page === 'collection') {
    return `#/collections/${encodeURIComponent(route.id)}`;
  }
  if (route.page === 'charts') {
    return '#/charts';
  }
  if (route.page === 'chart') {
    return `#/charts/${encodeURIComponent(route.id)}`;
  }
  const parameters = new URLSearchParams({ ...(route.query ? { q: route.query } : {}), ...(route.project ? { project: route.project } : {}) });
  return parameters.size > 0 ? `#/search?${parameters}` : '#/';
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current Route, following the address. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return parseHash(hash);
}
