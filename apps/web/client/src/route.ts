import { useSyncExternalStore } from 'react';

/** Where the User is in the app; it lives in the hash of the address, so back, forward and links work. */
export type Route = { page: 'search'; query: string } | { page: 'node'; uniqueId: string } | { page: 'charts' } | { page: 'chart'; id: string };

/** `#/search?q=orders`, `#/nodes/<unique ID>`, `#/charts`, `#/charts/<ID>`, or `#<unique ID>`, the links of the first page. */
export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
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
    return { page: 'search', query: new URLSearchParams(path.split('?')[1] ?? '').get('q')?.trim() ?? '' };
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
  if (route.page === 'charts') {
    return '#/charts';
  }
  if (route.page === 'chart') {
    return `#/charts/${encodeURIComponent(route.id)}`;
  }
  return route.query ? `#/search?${new URLSearchParams({ q: route.query })}` : '#/';
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
