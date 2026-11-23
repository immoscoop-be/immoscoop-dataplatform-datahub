import { describe, expect, it } from 'vitest';
import { keyAt, lastRunOf, putBack, readsOf } from './projectPage.js';
import type { ProjectQuery } from './projects.js';

const query = (id: string, startedAt: string | null): ProjectQuery => ({
  id,
  name: id,
  owner: { id: 'u', name: 'An Claes' },
  lastRun: startedAt ? { userName: `by ${id}`, state: 'done', startedAt } : null,
  position: 0,
  locked: false,
});

describe('the page of a Project (DEC-UX-285)', () => {
  it('gives the first ten places their key, 1 to 9 and then 0, and no key further on (DEC-UX-283)', () => {
    expect([0, 1, 8, 9, 10, 13].map(keyAt)).toEqual(['1', '2', '9', '0', null, null]);
  });

  it('says what a query reads in a few words, and nothing for an empty query (FR-SR-68)', () => {
    expect(readsOf([{ displayName: 'Weekly lead volume' }, { displayName: 'Lead sources' }])).toEqual({ first: 'Weekly lead volume', more: 1 });
    expect(readsOf([{ displayName: 'Listings' }])).toEqual({ first: 'Listings', more: 0 });
    expect(readsOf([])).toBeNull();
    expect(readsOf(undefined)).toBeNull();
  });

  it('finds the last run of all its queries', () => {
    expect(lastRunOf([query('a', '2026-11-18T08:00:00Z'), query('b', null), query('c', '2026-11-19T07:12:00Z')])?.userName).toBe('by c');
    expect(lastRunOf([query('b', null)])).toBeNull();
  });

  it('puts a query taken out back at its place, as Undo does (OP-UX-106)', () => {
    expect(putBack(['a', 'c', 'd'], 'b', 1)).toEqual(['a', 'b', 'c', 'd']);
    expect(putBack(['a', 'b'], 'z', 9)).toEqual(['a', 'b', 'z']);
    expect(putBack(['a', 'b', 'z'], 'z', 0)).toEqual(['z', 'a', 'b']);
  });
});
