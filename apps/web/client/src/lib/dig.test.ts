import type { DigResult, Selection } from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEXTS } from '../texts/index.js';
import { dayBefore, digFrom, gapScopeOf, narrowings, selectionFrom, sharesOf, splitAt, strongestIn, withCondition, withoutCondition } from './dig.js';
import { conditionSaid, digCommon, digGapText, ratioWord, saidText, selectionSaid } from './edaWords.js';

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

/** The rows where lead_channel says nothing, against the rest of Weekly lead volume: more of the rows before 6 January 2025, and from the app. */
const SAYS_NOTHING: Selection = { where: [{ kind: 'saysNothing', field: 'lead_channel' }] };
const FOUND: DigResult = {
  rows: { selected: 40, total: 312 },
  overTime: {
    field: 'week_start',
    unit: 'week',
    periods: [
      { start: '2024-12-23', selected: 10, total: 12 },
      { start: '2024-12-30', selected: 12, total: 12 },
      { start: '2025-01-06', selected: 1, total: 91 },
      { start: '2025-01-13', selected: 0, total: 80 },
    ],
    breakAt: '2025-01-06',
    before: 'more',
  },
  fields: [
    {
      field: 'lead_source',
      kind: 'text',
      values: [
        { value: 'app', selected: 30, rest: 20, ratio: 10.2, real: true },
        { value: 'website', selected: 10, rest: 252, ratio: 0.27, real: true },
      ],
    },
    { field: 'lead_count', kind: 'number', selected: { median: 18, mean: 24 }, rest: { median: 26, mean: 38 } },
  ],
};

describe('the selection of Dig into, as its address keeps it (FR-ED-20, TR-ED-11)', () => {
  it('reads a selection of one to ten conditions of the shape eda takes, and nothing else', () => {
    expect(selectionFrom(JSON.stringify(SAYS_NOTHING))).toEqual(SAYS_NOTHING);
    const mixed = { where: [{ kind: 'empty', field: 'lead_channel' }, { kind: 'equals', field: 'lead_source', value: 'app' }, { kind: 'range', field: 'week_start', before: '2025-01-06' }] };
    expect(selectionFrom(JSON.stringify(mixed))).toEqual(mixed);
    // Anything more than a condition says is left out.
    expect(selectionFrom(JSON.stringify({ where: [{ kind: 'empty', field: 'lead_channel', sql: 'drop' }] }))).toEqual({ where: [{ kind: 'empty', field: 'lead_channel' }] });
    for (const wrong of [
      null,
      '',
      'not json',
      '{}',
      JSON.stringify({ where: [] }),
      JSON.stringify({ where: new Array(11).fill({ kind: 'empty', field: 'lead_channel' }) }),
      JSON.stringify({ where: [{ kind: 'like', field: 'lead_channel' }] }),
      JSON.stringify({ where: [{ kind: 'empty', field: '' }] }),
      JSON.stringify({ where: [{ kind: 'equals', field: 'lead_source', value: 'x'.repeat(1001) }] }),
      JSON.stringify({ where: [{ kind: 'equals', field: 'lead_source', value: null }] }),
      JSON.stringify({ where: [{ kind: 'range', field: 'week_start' }] }),
    ]) {
      expect(selectionFrom(wrong), String(wrong)).toBeNull();
    }
  });

  it('adds a condition it does not hold yet, up to ten, and takes one off', () => {
    const narrowed = withCondition(SAYS_NOTHING, { kind: 'equals', field: 'lead_source', value: 'app' });
    expect(narrowed).toEqual({ where: [{ kind: 'saysNothing', field: 'lead_channel' }, { kind: 'equals', field: 'lead_source', value: 'app' }] });
    expect(withCondition(SAYS_NOTHING, { kind: 'saysNothing', field: 'lead_channel' })).toBeNull();
    expect(withCondition({ where: new Array(10).fill({ kind: 'empty', field: 'x' }) }, { kind: 'empty', field: 'y' })).toBeNull();
    expect(withoutCondition(narrowed as Selection, 0)).toEqual({ where: [{ kind: 'equals', field: 'lead_source', value: 'app' }] });
  });

  it('starts from the rows a result ran on, narrowed by the condition of its row', () => {
    expect(digFrom(undefined, { kind: 'empty', field: 'lead_channel' })).toEqual({ where: [{ kind: 'empty', field: 'lead_channel' }] });
    expect(digFrom({ where: [] }, { kind: 'saysNothing', field: 'lead_channel' })).toEqual(SAYS_NOTHING);
    expect(digFrom({ where: [{ kind: 'range', field: 'week_start', from: '2025-01-06' }] }, { kind: 'equals', field: 'lead_source', value: 'app' })).toEqual({
      where: [
        { kind: 'range', field: 'week_start', from: '2025-01-06' },
        { kind: 'equals', field: 'lead_source', value: 'app' },
      ],
    });
    expect(digFrom(undefined, { kind: 'equals', field: 'lead_source', value: 'x'.repeat(1001) })).toBeNull();
  });

  it('says that a field is empty in words, in English and Dutch', () => {
    expect(conditionSaid({ kind: 'empty', field: 'lead_channel' }, 'en')).toEqual({ key: 'eda.selection.empty', names: { field: 'lead_channel' } });
    expect(saidText(selectionSaid({ where: [{ kind: 'empty', field: 'lead_channel' }] }, 'en'))).toBe('lead_channel is empty');
    setLanguage('nl');
    expect(saidText(selectionSaid({ where: [{ kind: 'empty', field: 'lead_channel' }] }, 'nl'))).toBe('lead_channel leeg is');
    setLanguage('en');
  });
});

describe('what a dig found (FR-ED-20, TR-ED-12)', () => {
  it('sets the share of a value among the selected rows against its share among the other rows', () => {
    expect(sharesOf({ selected: 30, rest: 20 }, FOUND.rows)).toEqual({ selected: 0.75, rest: 20 / 272 });
    expect(sharesOf({ selected: 1, rest: 1 }, { selected: 0, total: 0 })).toEqual({ selected: 0, rest: 0 });
    expect(ratioWord(10.2, 'en')).toBe('×10');
    expect(ratioWord(0.27, 'nl')).toBe('×0,27');
    expect(ratioWord(null, 'en')).toBeNull();
  });

  it('finds the value that sets the selection most apart: real, more often among it, the most above its share in the rest', () => {
    expect(strongestIn(FOUND)).toEqual({ field: 'lead_source', value: FOUND.fields[0] && FOUND.fields[0].kind === 'text' ? FOUND.fields[0].values[0] : null });
    const chance: DigResult = { ...FOUND, fields: [{ field: 'lead_source', kind: 'text', values: [{ value: 'app', selected: 30, rest: 20, ratio: 10.2, real: false }] }] };
    expect(strongestIn(chance)).toBeNull();
    const fewer: DigResult = { ...FOUND, fields: [{ field: 'lead_source', kind: 'text', values: [{ value: 'website', selected: 10, rest: 252, ratio: 0.27, real: true }] }] };
    expect(strongestIn(fewer)).toBeNull();
  });

  it('splits the periods at the break, and proposes the scope of a Known Gap from it', () => {
    expect(splitAt(FOUND.overTime?.periods ?? [], '2025-01-06')).toEqual({ before: { selected: 22, total: 24 }, after: { selected: 1, total: 171 } });
    expect(dayBefore('2025-01-06')).toBe('2025-01-05');
    expect(dayBefore('2025-03-01')).toBe('2025-02-28');
    // More of the rows before the break: until the day before it; the fields that say nothing; the value of the first text.
    expect(gapScopeOf(SAYS_NOTHING, FOUND)).toEqual({ period: { from: null, to: '2025-01-05', dateField: 'week_start' }, fields: ['lead_channel'], rows: { field: 'lead_source', is: 'oneOf', values: ['app'] } });
    // Less of the rows before it: from the break on.
    const later = { ...FOUND, overTime: { ...(FOUND.overTime as NonNullable<DigResult['overTime']>), before: 'less' as const } };
    expect(gapScopeOf({ where: [{ kind: 'empty', field: 'lead_channel' }, { kind: 'empty', field: 'lead_channel' }] }, later)).toMatchObject({ period: { from: '2025-01-06', to: null, dateField: 'week_start' }, fields: ['lead_channel'] });
    // No value: its rows are empty; nothing found and no field: no scope.
    const none: DigResult = { ...FOUND, overTime: null, fields: [{ field: 'lead_source', kind: 'text', values: [{ value: null, selected: 30, rest: 0, ratio: null, real: true }] }] };
    expect(gapScopeOf({ where: [{ kind: 'equals', field: 'lead_channel', value: 'web' }] }, none)).toEqual({ rows: { field: 'lead_source', is: 'empty' } });
    expect(gapScopeOf({ where: [{ kind: 'equals', field: 'lead_channel', value: 'web' }] }, { ...FOUND, overTime: null, fields: [] })).toBeNull();
  });

  it('says what the selected rows have in common, and what the Known Gap would say, in English and Dutch', () => {
    expect(saidText(digCommon(FOUND, 'en'))).toBe(
      '96% of these rows come from before 6 Jan 2025, and for 75% lead_source is app. Before that week 92% of the rows are among them, since then 0.6%. lead_source is app 10 times as often as in the other rows.',
    );
    expect(digGapText(SAYS_NOTHING, FOUND, 'en')).toBe('lead_channel is not filled where lead_source is app before 6 Jan 2025.');
    expect(saidText(digCommon({ ...FOUND, overTime: null }, 'en'))).toBe('For 75% of these rows lead_source is app. lead_source is app 10 times as often as in the other rows.');
    expect(saidText(digCommon({ ...FOUND, overTime: null, fields: [] }, 'en'))).toBe('Nothing found sets these rows apart from the other rows.');
    expect(digGapText({ where: [{ kind: 'equals', field: 'lead_source', value: 'partner' }] }, { ...FOUND, fields: [] }, 'en')).toBe('The rows where lead_source is partner before 6 Jan 2025.');
    setLanguage('nl');
    expect(saidText(digCommon(FOUND, 'nl'))).toBe(
      '96% van deze rijen komt van vóór 6 jan 2025, en bij 75% is lead_source app. Vóór die week hoort 92% van de rijen erbij, sindsdien 0,6%. lead_source is 10 keer zo vaak app als in de andere rijen.',
    );
    expect(digGapText(SAYS_NOTHING, FOUND, 'nl')).toBe('lead_channel is niet ingevuld waar lead_source app is vóór 6 jan 2025.');
    setLanguage('en');
  });

  it('offers to narrow it by the break, the values found and the Key Fields, never by what it holds', () => {
    const fields = [
      { name: 'week_start', keyField: true },
      { name: 'lead_source', keyField: true },
      { name: 'lead_channel', keyField: true },
      { name: 'loaded_at', keyField: false },
    ];
    const offered = narrowings(SAYS_NOTHING, FOUND, fields).map((condition) => saidText([conditionSaid(condition, 'en') as never]));
    expect(offered).toEqual([
      'week_start is before 6 Jan 2025',
      'week_start is on or after 6 Jan 2025',
      'lead_source is app',
      'lead_source is website',
      'week_start is empty',
      'week_start says nothing',
      'lead_source is empty',
      'lead_source says nothing',
      'lead_channel is empty',
    ]);
    expect(narrowings({ where: new Array(10).fill({ kind: 'empty', field: 'x' }) }, FOUND, fields)).toEqual([]);
    expect(narrowings(SAYS_NOTHING, null, fields)).toHaveLength(5);
  });
});
