import { describe, expect, it } from 'vitest';
import { firstActive, picksOf, type QuickGroup, type QuickRow, rowsFor, scoreOf, stepFrom, used } from './quick.js';

const row = (group: QuickGroup, title: string, more: Partial<QuickRow> = {}): QuickRow => ({
  key: `${group}:${title}`,
  group,
  icon: 'x',
  title,
  kind: group,
  does: 'open',
  run: () => undefined,
  ...more,
});

describe('the quick window (DEC-UX-237)', () => {
  it('finds a row by the start of its name best, then by the start of a word, then anywhere', () => {
    expect(scoreOf({ title: 'Leads per day' }, 'lea')).toBe(3);
    expect(scoreOf({ title: 'Weekly lead volume' }, 'lea')).toBe(2);
    expect(scoreOf({ title: 'New query from this one', words: 'copy duplicate' }, 'copy')).toBe(2);
    expect(scoreOf({ title: 'Put the query next to the result', words: 'landscape view' }, 'scape')).toBe(1);
    expect(scoreOf({ title: 'Listings' }, 'lea')).toBe(0);
  });

  it('lists the commands of the screen, the flagged queries and Go to when nothing is typed (OP-UX-88)', () => {
    const rows = [row('goTo', 'Collections'), row('resources', 'Leads'), row('flagged', 'Leads per source'), row('screen', 'Flag this query')];
    expect(rowsFor(rows, '').map((one) => one.title)).toEqual(['Flag this query', 'Leads per source', 'Collections']);
  });

  it('searches every group in its order, four at most a group, the best first (OP-UX-88)', () => {
    const rows = [
      row('goTo', 'Learning Centre'),
      ...['Weekly lead volume', 'Lead sources', 'Leads per day', 'Lead quality', 'Lead owners'].map((title) => row('resources', title)),
      row('lenses', 'Leads per source name'),
      row('screen', 'Format the SQL'),
    ];
    const found = rowsFor(rows, 'lea').map((one) => `${one.group}:${one.title}`);
    expect(found).toEqual(['resources:Lead sources', 'resources:Leads per day', 'resources:Lead quality', 'resources:Lead owners', 'lenses:Leads per source name', 'goTo:Learning Centre']);
  });

  it('lists first what was done from it in this session, most recent first, five at most and only what can be done now (DEC-UX-242)', () => {
    const rows = [
      row('screen', 'Run'),
      row('screen', 'Fold all'),
      row('screen', 'Flag this query', { why: 'Ten queries are flagged.' }),
      row('flagged', 'Leads per source'),
      row('goTo', 'Collections'),
      row('resources', 'Leads'),
    ];
    const recent = ['goTo:Collections', 'screen:Flag this query', 'resources:Leads', 'screen:Fold all'];
    const shown = rowsFor(rows, '', recent);
    expect(shown.map((one) => `${one.group}:${one.title}`)).toEqual([
      'recent:Collections',
      'recent:Fold all',
      'screen:Run',
      'screen:Flag this query',
      'flagged:Leads per source',
    ]);
    const many = Array.from({ length: 7 }, (_, at) => row('screen', `Command ${at}`));
    expect(rowsFor(many, '', many.map((one) => one.key)).filter((one) => one.group === 'recent')).toHaveLength(5);
    // Typed, what was used more lately comes first among rows that match as well.
    const matches = [row('screen', 'Fold all'), row('screen', 'Format the SQL'), row('screen', 'Flag this query')];
    expect(rowsFor(matches, 'f', ['screen:Format the SQL']).map((one) => one.title)).toEqual(['Format the SQL', 'Fold all', 'Flag this query']);
  });

  it('keeps what was just done first, each once', () => {
    expect(used(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(used([], 'a')).toEqual(['a']);
  });

  it('gives Cmd+1 to Cmd+9 to the first nine rows that can be done, none to a greyed one (DEC-UX-242)', () => {
    const rows = [row('screen', 'Flag', { why: 'Ten are flagged.' }), ...Array.from({ length: 10 }, (_, at) => row('goTo', `Place ${at}`))];
    expect(picksOf(rows)).toEqual([null, 1, 2, 3, 4, 5, 6, 7, 8, 9, null]);
  });

  it('never makes a greyed row the one Enter does, and steps past it', () => {
    const rows = [row('screen', 'Flag this query', { why: 'Ten queries are flagged.' }), row('screen', 'Fold all'), row('screen', 'Format the SQL')];
    expect(firstActive(rows)).toBe(1);
    expect(stepFrom(rows, 1, 1)).toBe(2);
    expect(stepFrom(rows, 2, 1)).toBe(1);
    expect(stepFrom(rows, 1, -1)).toBe(2);
    expect(firstActive([rows[0] as QuickRow])).toBe(-1);
  });
});
