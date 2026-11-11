import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEXTS } from '../texts/index.js';
import { adminOptions, changedKeys, changesBetween, keysOf, mayQuery, PARTS, PERMISSION_KEYS, PERMISSION_TEXTS, PERMISSIONS, shownValue, summaryOf } from './permissions.js';
import { route } from './routes.js';
import { sectionFor, SECTIONS, toolsFor } from './sections.js';
import { NO_PERMISSIONS, startingPermissions } from '@datahub/contracts/permissions';

beforeEach(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

afterEach(() => setLanguage('nl'));

describe('the Permissions in the web app (FR-PL-05, FR-PL-14)', () => {
  it('name every Permission in English as the catalogue of contracts does, and in Dutch', () => {
    for (const key of PERMISSION_KEYS) {
      expect([key, PERMISSION_TEXTS[key].name, TEXTS.en[PERMISSION_TEXTS[key].name as keyof typeof TEXTS.en]]).toEqual([key, PERMISSION_TEXTS[key].name, PERMISSIONS[key].name]);
      expect(TEXTS.nl[PERMISSION_TEXTS[key].about as keyof typeof TEXTS.nl]).toBeTruthy();
    }
  });

  it('put every Permission in a part, in the order of the rail, with Groups after Collections (DEC-UX-201)', () => {
    expect(PARTS.map((part) => part.id)).toEqual(['collections', 'groups', 'query', 'lenses', 'messages', 'claude', 'excel', 'admin']);
    expect(keysOf('groups')).toEqual(['groups.manage', 'groups.all.manage']);
    expect(PARTS.flatMap((part) => keysOf(part.id))).toHaveLength(PERMISSION_KEYS.length);
  });

  it('show Query to who makes queries or Previews, and Admin with the tools chosen', () => {
    const lensUser = startingPermissions('lensUser');
    const analyst = startingPermissions('businessAnalyst');
    const admin = startingPermissions('admin');
    const query = SECTIONS.find((section) => section.id === 'query')!;
    const adminSection = SECTIONS.find((section) => section.id === 'admin')!;
    expect([mayQuery(lensUser), mayQuery(analyst)]).toEqual([false, true]);
    expect([sectionFor(query, lensUser), sectionFor(query, analyst)]).toEqual([false, true]);
    expect([sectionFor(adminSection, analyst), sectionFor(adminSection, admin)]).toEqual([false, true]);
    expect(toolsFor(admin)).toEqual(['webhooks', 'keys', 'users', 'permissionGroups']);
    analyst['admin.open'] = { on: true, values: { tools: ['permissionGroups', 'excelKeys'] } };
    expect(toolsFor(analyst)).toEqual(['keys', 'permissionGroups']);
    expect(route('/admin', toolsFor(analyst))).toEqual({ kind: 'redirect', to: '/admin/keys' });
    // admin.open no keeps its tools, and opens none of them.
    analyst['admin.open'].on = false;
    expect(adminOptions(analyst)).toEqual([]);
    expect(sectionFor(adminSection, analyst)).toBe(false);
  });

  it('show a value as a sentence: a number with its unit, no limit, a choice, several', () => {
    expect(shownValue('runs.ranges', 'freeMb', 100)).toBe('100 MB');
    expect(shownValue('excel.keys', 'most', null)).toBe('no limit');
    expect(shownValue('excel.keys', 'lifetimeDays', 1)).toBe('1 day');
    expect(shownValue('collections.manage', 'reach', 'every')).toBe('Every Collection');
    expect(shownValue('messages.write', 'kinds', ['question', 'signal'])).toBe('Questions and Signals');
    expect(shownValue('messages.write', 'kinds', [])).toBe('none');
    expect(summaryOf('runs.ranges', startingPermissions('admin')['runs.ranges'])).toBe('Runs freely up to: 100 MB · Runs once they approve, up to: 1 GB · Above that: They send a Request to the Data Team');
  });

  it('count the Permissions changed, a several choice in any order the same', () => {
    const saved = startingPermissions('lensUser');
    const edited = structuredClone(saved);
    edited['messages.write'].values.kinds = ['signal', 'question'];
    expect(changedKeys(saved, edited)).toEqual([]);
    edited['queries.make'].on = true;
    edited['excel.keys'].values.most = 5;
    expect(changedKeys(saved, edited)).toEqual(['queries.make', 'excel.keys']);
  });
});

describe('what changes for a User between two Permission groups (FR-PL-07)', () => {
  it('lists what a Lens user gains as a Business analyst, and loses nothing', () => {
    const lines = changesBetween(startingPermissions('lensUser'), startingPermissions('businessAnalyst'));
    expect(lines.every((line) => line.kind === 'gain')).toBe(true);
    expect(lines.find((line) => line.key === 'queries.make')).toMatchObject({ name: 'Make and run queries', detail: '', was: '' });
    expect(lines.find((line) => line.key === 'collections.manage')?.detail).toBe('Which Collections: Those of their Owner Units');
    expect(lines.find((line) => line.key === 'claude.results')).toMatchObject({
      detail: 'Where the result shows: In Claude: Claude reads the rows and works on them',
      was: 'In a card only: the rows show in the card, and Claude reads the shape without the values',
    });
    expect(lines.find((line) => line.key === 'messages.write')).toMatchObject({ detail: 'Kinds: Questions, Remarks and Signals', was: 'Questions and Signals' });
    // What stays the same is no line.
    expect(lines.some((line) => line.key === 'excel.keys' || line.key === 'runs.ranges')).toBe(false);
  });

  it('lists the same as losses the other way, gains first, then losses, then the rest', () => {
    const lines = changesBetween(startingPermissions('businessAnalyst'), startingPermissions('lensUser'));
    expect(lines.every((line) => line.kind === 'loss')).toBe(true);
    const from = startingPermissions('businessAnalyst');
    const to = structuredClone(from);
    to['excel.keys'].values.most = 3;
    to['runs.ranges'].values.above = 'refuse';
    to['claude.use'].values.note = 'Answer in Dutch.';
    to['requests.decide'].on = true;
    expect(changesBetween(from, to).map((line) => [line.kind, line.key, line.detail, line.was])).toEqual([
      ['gain', 'requests.decide', '', ''],
      ['loss', 'runs.ranges', 'Above that: It cannot run', 'They send a Request to the Data Team'],
      ['loss', 'excel.keys', 'Keys at most: 3 keys', 'no limit'],
      ['change', 'claude.use', 'A note for Claude: changed', ''],
    ]);
  });

  it('says nothing changes between a group and itself', () => {
    expect(changesBetween(NO_PERMISSIONS, structuredClone(NO_PERMISSIONS))).toEqual([]);
  });
});
