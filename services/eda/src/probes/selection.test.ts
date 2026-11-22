import { DISGUISED_DEFAULTS, type EdaField, type ProbeKey, type Selection } from '@datahub/contracts/eda';
import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { RUNNERS } from './index.js';
import type { ProbeContext } from './probe.js';
import { checkSelection, disguisedOf, parseSelection } from './selection.js';
import { conditionOf, everyPartition } from './sql.js';

const fieldOf = (name: string, dataType: string | null): EdaField => ({ name, dataType, keyField: false, role: null, grain: false, mapped: false });
/** Weekly lead volume with a field of true or false and one of JSON. */
const WIDER = { ...WEEKLY, resource: { ...WEEKLY.resource, fields: [...WEEKLY.resource.fields, fieldOf('is_test', 'BOOL'), fieldOf('payload', 'JSON')] } };

describe('a selection in a request (OP-ED-12)', () => {
  it('takes at most 10 conditions of the three kinds, each with only its own keys', () => {
    expect(parseSelection({ where: [] })).toEqual({ where: [] });
    const where = [
      { kind: 'saysNothing', field: 'lead_channel' },
      { kind: 'equals', field: 'lead_source', value: 'website' },
      { kind: 'equals', field: 'is_test', value: false },
      { kind: 'range', field: 'week_start', from: '2026-01-05' },
      { kind: 'range', field: 'lead_count', from: 0, before: 100 },
    ];
    expect(parseSelection({ where })).toEqual({ where });
    expect(parseSelection({ where: new Array(10).fill({ kind: 'saysNothing', field: 'lead_channel' }) })).toMatchObject({ where: expect.any(Array) });
  });

  it('says what does not fit its shape', () => {
    expect(parseSelection('lead_channel is null')).toBe('selection is { where: [conditions] }.');
    expect(parseSelection([])).toBe('selection is { where: [conditions] }.');
    expect(parseSelection({ where: 'true' })).toBe('selection is { where: [conditions] }.');
    expect(parseSelection({ where: [], sql: 'true' })).toBe('A selection has no sql.');
    expect(parseSelection({ where: new Array(11).fill({ kind: 'saysNothing', field: 'lead_channel' }) })).toBe('A selection holds at most 10 conditions.');
    expect(parseSelection({ where: [null] })).toBe('Condition 1 is a JSON object.');
    expect(parseSelection({ where: [{ kind: 'raw', field: 'lead_channel', sql: 'true' }] })).toBe('Condition 1 is saysNothing, equals or range, as its kind.');
    expect(parseSelection({ where: [{ kind: 'saysNothing' }] })).toBe('Condition 1 names its field.');
    expect(parseSelection({ where: [{ kind: 'saysNothing', field: 'lead_channel', value: 'x' }] })).toBe('Condition 1, saysNothing, has no value.');
    expect(parseSelection({ where: [{ kind: 'saysNothing', field: 'a' }, { kind: 'equals', field: 'lead_source', value: 'x', sql: 'or true' }] })).toBe(
      'Condition 2, equals, has no sql.',
    );
    expect(parseSelection({ where: [{ kind: 'equals', field: 'lead_source' }] })).toMatch(/^Condition 1, equals, has a value/);
    expect(parseSelection({ where: [{ kind: 'equals', field: 'lead_source', value: { raw: 'true' } }] })).toMatch(/^Condition 1, equals, has a value/);
    expect(parseSelection({ where: [{ kind: 'equals', field: 'lead_source', value: null }] })).toMatch(/^Condition 1, equals, has a value/);
    expect(parseSelection({ where: [{ kind: 'range', field: 'lead_count' }] })).toMatch(/^Condition 1, range, has from, before or both/);
    expect(parseSelection({ where: [{ kind: 'range', field: 'lead_count', from: true }] })).toMatch(/^Condition 1, range, has from, before or both/);
  });

  it('takes only fields of the Resource, and values of the kind of their field', () => {
    const check = (where: unknown[]) => checkSelection({ where } as Selection, WIDER);
    expect(check([])).toBeNull();
    expect(
      check([
        { kind: 'saysNothing', field: 'payload' },
        { kind: 'equals', field: 'lead_source', value: "web'site" },
        { kind: 'equals', field: 'lead_count', value: -1 },
        { kind: 'equals', field: 'loaded_at', value: '2026-11-16' },
        { kind: 'equals', field: 'is_test', value: true },
        { kind: 'range', field: 'week_start', from: '2026-01-05', before: '2026-02-02' },
        { kind: 'range', field: 'lead_count', before: 0.5 },
      ]),
    ).toBeNull();
    expect(check([{ kind: 'saysNothing', field: 'lead_chanel' }])).toBe('lead_chanel is no field of this Resource.');
    // The name of a field is a name of the Resource, never SQL.
    expect(check([{ kind: 'saysNothing', field: 'lead_channel` is null or true or `x' }])).toBe('lead_channel` is null or true or `x is no field of this Resource.');
    expect(check([{ kind: 'equals', field: 'lead_channel', value: 1 }])).toBe('lead_channel equals a text of at most 1000 characters.');
    expect(check([{ kind: 'equals', field: 'lead_channel', value: 'x'.repeat(1001) }])).toBe('lead_channel equals a text of at most 1000 characters.');
    expect(check([{ kind: 'equals', field: 'lead_channel', value: '\udc00' }])).toBe('lead_channel equals a text of at most 1000 characters.');
    expect(check([{ kind: 'equals', field: 'lead_count', value: '1 or 1=1' }])).toBe('lead_count equals a number.');
    expect(check([{ kind: 'equals', field: 'lead_count', value: Number.POSITIVE_INFINITY }])).toBe('lead_count equals a number.');
    expect(check([{ kind: 'equals', field: 'lead_count', value: Number.NaN }])).toBe('lead_count equals a number.');
    expect(check([{ kind: 'equals', field: 'week_start', value: "2026-01-01' or '1'='1" }])).toBe('week_start equals a day, YYYY-MM-DD.');
    expect(check([{ kind: 'equals', field: 'week_start', value: '2026-02-30' }])).toBe('week_start equals a day, YYYY-MM-DD.');
    expect(check([{ kind: 'equals', field: 'is_test', value: 'true' }])).toBe('is_test equals true or false.');
    expect(check([{ kind: 'equals', field: 'payload', value: '{}' }])).toBe('payload is a JSON: a selection on it is only saysNothing.');
    expect(check([{ kind: 'range', field: 'lead_channel', from: 'a' }])).toBe('A range is on a number or a date; lead_channel is a text.');
    expect(check([{ kind: 'range', field: 'week_start', from: 20260105 }])).toBe('The range of week_start is of days, YYYY-MM-DD.');
    expect(check([{ kind: 'range', field: 'lead_count', from: '0) or (1=1' }])).toBe('The range of lead_count is of numbers.');
    expect(check([{ kind: 'range', field: 'lead_count', from: 100, before: 9 }])).toBe('In the range of lead_count, from comes before before.');
    expect(check([{ kind: 'range', field: 'week_start', from: '2026-02-02', before: '2026-02-02' }])).toBe('In the range of week_start, from comes before before.');
  });
});

describe('the values that say nothing in an EDA (DEC-ED-35)', () => {
  it('are those of its Disguised nulls once added with them, list by list, else what Data Hub proposes', () => {
    expect(disguisedOf(undefined)).toEqual(DISGUISED_DEFAULTS);
    expect(disguisedOf({})).toEqual(DISGUISED_DEFAULTS);
    expect(disguisedOf({ text: ['leeg'] })).toEqual(DISGUISED_DEFAULTS);
    expect(disguisedOf({ lists: { text: ['leeg'], ninesOnly: false } })).toEqual({ ...DISGUISED_DEFAULTS, text: ['leeg'], ninesOnly: false });
    expect(disguisedOf({ lists: { text: [], date: ['2000-01-01'], number: [-9, 0] } })).toEqual({ text: [], date: ['2000-01-01'], number: [-9, 0], ninesOnly: true });
    // A list that does not fit is left for Data Hub's.
    expect(disguisedOf({ lists: { text: ['n/a', 1], date: ["1900-01-01' or true"], number: ['-1'], ninesOnly: 'yes' } })).toEqual(DISGUISED_DEFAULTS);
  });
});

/** Each EDA-Probe Data Hub runs, set on fields it takes on Weekly lead volume. */
const SETTINGS: Record<string, Pick<ProbeContext, 'fields' | 'params'>> = {
  grainHolds: { fields: ['week_start', 'lead_source'], params: {} },
  dateRange: { fields: ['week_start', 'loaded_at'], params: {} },
  volumeOverTime: { fields: ['week_start'], params: {} },
  nullsPerKeyField: { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {} },
  distributionOfNumbers: { fields: ['lead_count'], params: {} },
  distributionOfCategories: { fields: ['lead_source', 'lead_channel'], params: {} },
  disguisedNulls: { fields: ['week_start', 'lead_source', 'lead_count', 'lead_channel'], params: {} },
};

describe('every EDA-Probe runs on a selection of rows (OP-ED-12)', () => {
  const selection: Selection = {
    where: [
      { kind: 'saysNothing', field: 'lead_channel' },
      { kind: 'range', field: 'week_start', from: '2026-01-05', before: '2026-02-02' },
      { kind: 'equals', field: 'lead_source', value: "web'site" },
    ],
  };
  const conditions = selection.where.map((condition) => conditionOf(condition, WEEKLY));
  const partition = everyPartition(WEEKLY) ?? '';

  it('has a setting for each of them here', () => {
    expect(Object.keys(RUNNERS).sort()).toEqual(Object.keys(SETTINGS).sort());
  });

  for (const [key, runner] of Object.entries(RUNNERS)) {
    it(`${key}: the same SQL as on the whole table, aggregates only, with the conditions beside the filter on every partition`, () => {
      const context: ProbeContext = { source: WEEKLY, today: '2026-11-21', ...(SETTINGS[key as ProbeKey] ?? { fields: [], params: {} }) };
      const whole = runner?.sql(context) ?? '';
      const selected = runner?.sql({ ...context, selection }) ?? '';
      // The conditions follow the filter that keeps every partition, at the indent of its where, and nothing else changes.
      const indent = /\n( *)where /.exec(whole)?.[1] ?? '';
      expect(whole).toContain(`where ${partition}`);
      expect(selected).toBe(whole.replace(`where ${partition}`, `where ${partition}${conditions.map((condition) => `\n${indent}  and ${condition}`).join('')}`));
      expect(selected).toContain("and `lead_source` = 'web\\'site'");
      // The whole table, as an empty selection, is the SQL as it was.
      expect(runner?.sql({ ...context, selection: { where: [] } })).toBe(whole);
    });
  }

  it('on a table without a filter on its partitions, the conditions are its where', () => {
    const nulls = RUNNERS.nullsPerKeyField?.sql({ source: LEADS, fields: ['channel'], params: {}, today: '2026-11-21', selection: { where: [{ kind: 'equals', field: 'channel', value: 'web' }] } });
    expect(nulls).toBe(`-- EDA-Probe nullsPerKeyField on Leads: aggregates only (TR-ED-03)
select
  count(*) as row_count,
  countif(\`channel\` is null) as empty_0
from \`immoscoop-dataplatform.dbt_prod_stacks.leads\`
where \`channel\` = 'web'`);
  });

  it('says nothing by the lists of its EDA when given, else by what Data Hub proposes', () => {
    const context: ProbeContext = { source: WEEKLY, fields: ['lead_source'], params: {}, today: '2026-11-21', selection: { where: [{ kind: 'saysNothing', field: 'lead_channel' }] } };
    expect(RUNNERS.nullsPerKeyField?.sql(context)).toContain("in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd')");
    expect(RUNNERS.nullsPerKeyField?.sql({ ...context, disguised: { ...DISGUISED_DEFAULTS, text: ['leeg'] } })).toContain("lower(trim(`lead_channel`)) in ('', 'leeg')");
  });
});
