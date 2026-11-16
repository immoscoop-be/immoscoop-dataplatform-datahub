import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import en from '../texts/en.js';
import nl from '../texts/nl.js';
import { missingWords, needLines, roleWords, waitingFor } from './typeFields.js';

const fields = [
  { name: 'week_start', dataType: 'DATE' },
  { name: 'lead_source', dataType: 'STRING' },
  { name: 'lead_count', dataType: 'INT64' },
  { name: 'visitors', dataType: 'INT64' },
];
const list = (items: string[]) => items.join(', ');

beforeEach(() => {
  addTexts({ nl, en });
  setLanguage('en');
});
afterEach(() => setLanguage('nl'));

describe('what a model type asks for, line by line (FR-CO-44, DEC-RC-24)', () => {
  it('lists the counts and sums of an aggregate as one line, with the numbers not marked yet', () => {
    const lines = needLines('aggregate', [{ field: 'lead_source', role: 'groupedBy' }, { field: 'lead_count', role: 'addsUp' }], fields, '');
    expect(lines.map((line) => [line.label, line.state, line.fields.map((one) => one.field), line.unmarked])).toEqual([
      ['role.groupedBy', 'ok', ['lead_source'], []],
      ['role.period', 'optional', [], []],
      ['fields.line.counts', 'missing', ['lead_count'], ['visitors']],
    ]);
  });

  it('marks a required role missing, and a role whose field is gone (FR-RC-29)', () => {
    const lines = needLines('state', [{ field: 'listing_id', role: 'about' }, { field: 'created', role: 'createdAt' }], [...fields, { name: 'created', dataType: 'DATE' }], '');
    expect(lines.map((line) => [line.label, line.state, line.gone.map((one) => one.field)])).toEqual([
      ['role.about', 'missing', ['listing_id']],
      ['role.createdAt', 'ok', []],
      ['role.updatedAt', 'optional', []],
      ['role.asOf', 'optional', []],
    ]);
  });

  it('has no lines for other, nor without a model type', () => {
    expect(needLines('other', [], fields, '')).toEqual([]);
    expect(needLines(null, [], fields, '')).toEqual([]);
  });
});

describe('what is missing, in words', () => {
  it('says a role, a number not marked, and that there is no model type, in a few words (FR-CO-45)', () => {
    expect(missingWords({ kind: 'role', role: 'happenedAt' })).toBe('misses when it happened');
    expect(missingWords({ kind: 'unmarked', field: 'lead_count' })).toBe('lead_count not marked');
    expect(missingWords({ kind: 'modelType' })).toBe('no model type yet');
    expect(roleWords('uniqueCount')).toBe('counts and sums');
    setLanguage('nl');
    expect(missingWords({ kind: 'role', role: 'happenedAt' })).toBe('mist wanneer het gebeurde');
  });

  it('says why Add Resource waits, from the first thing missing', () => {
    expect(waitingFor([], 'event', list)).toBeUndefined();
    expect(waitingFor([{ kind: 'role', role: 'happenedAt' }], 'event', list)).toEqual({ key: 'fields.missing.role', values: { what: 'when it happened' }, names: { type: 'event' } });
    expect(
      waitingFor(
        [
          { kind: 'unmarked', field: 'lead_count' },
          { kind: 'unmarked', field: 'visitors' },
        ],
        'aggregate',
        list,
      ),
    ).toEqual({ key: 'fields.missing.unmarked', values: {}, names: { fields: 'lead_count, visitors' } });
  });
});
