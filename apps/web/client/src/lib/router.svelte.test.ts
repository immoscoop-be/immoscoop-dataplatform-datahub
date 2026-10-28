import { afterEach, describe, expect, it } from 'vitest';
import { Router } from './router.svelte.js';

function click(href: string, init: MouseEventInit = {}, attributes: Record<string, string> = {}): { router: Router; event: MouseEvent } {
  const router = new Router();
  const link = document.createElement('a');
  link.setAttribute('href', href);
  for (const [name, value] of Object.entries(attributes)) {
    link.setAttribute(name, value);
  }
  const text = link.appendChild(document.createElement('span'));
  document.body.append(link);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  link.addEventListener('click', (clicked) => router.follow(clicked));
  // The test document cannot open another one.
  document.addEventListener('click', (clicked) => clicked.preventDefault(), { once: true });
  text.dispatchEvent(event);
  return { router, event };
}

describe('the router', () => {
  afterEach(() => {
    document.body.replaceChildren();
    history.replaceState(null, '', '/');
  });

  it('follows a link to a page of Data Hub without loading it again', () => {
    const { router } = click('/me/background');
    expect(router.path).toBe('/me/background');
    expect(location.pathname).toBe('/me/background');
  });

  it('leaves signing in, other sites, new tabs and modifier clicks to the browser', () => {
    for (const [href, init, attributes] of [
      ['/auth/login?next=%2Fme', {}, {}],
      ['https://www.immoscoop.be/', {}, {}],
      ['//www.immoscoop.be/', {}, {}],
      ['/me', {}, { target: '_blank' }],
      ['/me', { metaKey: true }, {}],
      ['/me', { button: 1 }, {}],
    ] as const) {
      expect(click(href, init, attributes).router.path, href).toBe('/');
    }
  });

  it('goes back with the browser', () => {
    const router = new Router();
    router.go('/query');
    history.replaceState(null, '', '/collections');
    dispatchEvent(new PopStateEvent('popstate'));
    expect(router.path).toBe('/collections');
  });
});
