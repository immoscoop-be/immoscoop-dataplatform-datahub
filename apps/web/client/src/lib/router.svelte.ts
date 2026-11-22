/**
 * The address of the page, kept in the history of the browser, so that back, forward and links work.
 * A link to a page of Data Hub changes the page without loading it again; the routes of the server,
 * such as signing in, load as usual. The address keeps its query, which a page such as Dig into reads
 * (FR-ED-20); which page it is follows from its path alone.
 */
export class Router {
  path = $state('/');

  constructor() {
    if (typeof location !== 'undefined') {
      this.path = location.pathname + location.search;
      addEventListener('popstate', () => {
        this.path = location.pathname + location.search;
      });
    }
  }

  go(path: string, { replace = false } = {}): void {
    if (path !== this.path || replace) {
      history[replace ? 'replaceState' : 'pushState'](null, '', path);
      this.path = path;
    }
  }

  /** Follows a click on a link to a page of Data Hub; any other click is the browser's. */
  follow(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = (event.target as Element | null)?.closest?.('a[href]');
    const href = link?.getAttribute('href');
    if (!link || !href || link.getAttribute('target') || !href.startsWith('/') || href.startsWith('//') || href.startsWith('/auth/')) {
      return;
    }
    event.preventDefault();
    this.go(href);
  }
}
