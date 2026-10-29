import { describe, expect, it } from 'vitest';
import { queryRunsPath, route } from './routes.js';

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

  it('has a page per Resource, in the section Collections', () => {
    expect(route('/resources/0d4b1f0e-2a8e')).toMatchObject({ kind: 'resource', id: '0d4b1f0e-2a8e', section: { id: 'collections' } });
    expect(route('/resources/%E0%A4%A')).toEqual({ kind: 'notFound' });
    expect(route('/resources/a/b')).toEqual({ kind: 'notFound' });
  });

  it('has a page per Collection, and an empty one to make a new Collection (FR-CO-12, FR-CO-25)', () => {
    expect(route('/collections/c-1')).toMatchObject({ kind: 'collection', id: 'c-1', section: { id: 'collections' } });
    expect(route('/collections/new')).toMatchObject({ kind: 'newCollection', section: { id: 'collections' } });
    expect(route('/collections/c-1/log')).toEqual({ kind: 'notFound' });
  });

  it('has a page per query, and a new query, also on a Resource, in the section Query (FR-SR-41, FR-SR-46)', () => {
    expect(route('/query/9f1c')).toMatchObject({ kind: 'query', id: '9f1c', section: { id: 'query' } });
    expect(route('/query/new')).toMatchObject({ kind: 'newQuery', resource: null, section: { id: 'query' } });
    expect(route('/query/new/r-1')).toMatchObject({ kind: 'newQuery', resource: 'r-1', section: { id: 'query' } });
    expect(route('/query/%E0%A4%A')).toEqual({ kind: 'notFound' });
    // Its history, at all its runs or at one, as the panel opens it (DEC-UX-74).
    expect(route('/query/9f1c')).toMatchObject({ run: null });
    expect(route('/query/9f1c/runs')).toMatchObject({ kind: 'query', id: '9f1c', run: 'all' });
    expect(route('/query/9f1c/runs/14')).toMatchObject({ kind: 'query', id: '9f1c', run: 14 });
    expect(queryRunsPath('9f1c', 14)).toBe('/query/9f1c/runs/14');
    expect(route('/query/9f1c/runs/0')).toEqual({ kind: 'notFound' });
    expect(route('/query/9f1c/rows')).toEqual({ kind: 'notFound' });
  });

  it('makes a Lens from a query in Query, and has a page per Lens under Collections (DEC-UX-25, DEC-UX-66)', () => {
    expect(route('/query/9f1c/lens')).toMatchObject({ kind: 'newLens', query: '9f1c', section: { id: 'query' } });
    expect(route('/lenses/7c1f')).toMatchObject({ kind: 'lens', id: '7c1f', section: { id: 'collections' } });
    expect(route('/lenses/7c1f/about')).toEqual({ kind: 'notFound' });
  });

  it('has My page, with the tabs Profile and Background (DEC-UX-84, DEC-UX-108)', () => {
    expect(route('/me')).toEqual({ kind: 'me', tab: 'profile' });
    expect(route('/me/background')).toEqual({ kind: 'me', tab: 'background' });
  });

  it('shows the one page for what does not exist, or may not be seen, at every other address (DEC-UX-32)', () => {
    for (const path of ['/me/profile', '/me/keys', '/collections/c-1/edit', '/lenses', '/x']) {
      expect([path, route(path)]).toEqual([path, { kind: 'notFound' }]);
    }
  });
});
