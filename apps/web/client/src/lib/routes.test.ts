import { describe, expect, it } from 'vitest';
import { route } from './routes.js';

describe('the addresses of the web app', () => {
  it('opens on the start screen of Collections', () => {
    expect(route('/')).toEqual({ kind: 'redirect', to: '/collections' });
  });

  it('has a start screen per section, with or without a slash at the end', () => {
    for (const id of ['collections', 'query', 'charts', 'messages', 'learning']) {
      expect(route(`/${id}`)).toMatchObject({ kind: 'start', section: { id } });
      expect(route(`/${id}/`)).toMatchObject({ kind: 'start', section: { id } });
    }
  });

  it('has My page, with the tabs Profile and Background (DEC-UX-84, DEC-UX-108)', () => {
    expect(route('/me')).toEqual({ kind: 'me', tab: 'profile' });
    expect(route('/me/background')).toEqual({ kind: 'me', tab: 'background' });
  });

  it('shows the one page for what does not exist, or may not be seen, at every other address (DEC-UX-32)', () => {
    for (const path of ['/me/profile', '/me/keys', '/collections/c-1', '/lenses', '/x']) {
      expect([path, route(path)]).toEqual([path, { kind: 'notFound' }]);
    }
  });
});
