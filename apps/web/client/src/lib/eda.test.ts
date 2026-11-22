import { DISGUISED_DEFAULTS, type CategoriesResult, type DateRangeResult, type DisguisedResult, type EdaView, type ProbeView, type ResultView, type VolumeResult } from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEXTS } from '../texts/index.js';
import {
  askedOf,
  asksReading,
  createEda,
  disguisedListsOf,
  fitsFilter,
  hasToAdd,
  isoWeek,
  listStateOf,
  niceTicks,
  overallReading,
  percent,
  sameLists,
  standingOf,
  stepCount,
  stillMissing,
  volumeBlocks,
  withoutValue,
  withValue,
} from './eda.js';
import {
  cardSentence,
  categoriesConclusion,
  categoriesSentence,
  conditionSaid,
  dateRangeConclusion,
  dateRangeSentence,
  disguisedConclusion,
  disguisedWhy,
  distributionSentence,
  grainConclusion,
  nothingName,
  saidNothingOf,
  saidText,
  selectionSaid,
  shapeOf,
  topOf,
  volumeSentence,
} from './edaWords.js';

const config = { identityUrl: 'https://identity.test', catalogueUrl: 'https://catalogue.test', registryUrl: 'https://registry.test', queryUrl: 'https://query.test', edaUrl: 'https://eda.test', semgraphUrl: 'https://semgraph.test' };
const session = { accessToken: async () => 'token' };

beforeAll(() => {
  addTexts(TEXTS);
  setLanguage('en');
});

/** An EDA-Probe as eda shows it on the tab Steps, needed and not added by default. */
function probe(key: ProbeView['key'], more: Partial<ProbeView> = {}): ProbeView {
  return { key, level: 'must', runs: true, needed: true, added: false, complete: false, applies: { table: true, fields: [], needs: [], block: null }, fields: [], params: {}, lastRun: null, ...more };
}

describe('the calls of the page to eda (TR-ED-01)', () => {
  function fake(answers: Record<string, () => Response>) {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const request = (async (input: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({ method, url: input, ...(init.body ? { body: JSON.parse(init.body as string) } : {}) });
      return (answers[`${method} ${input.replace(config.edaUrl, '')}`] ?? (() => Response.json({ error: 'not_found' }, { status: 404 })))();
    }) as typeof fetch;
    return { calls, eda: createEda(config, session, request) };
  }
  const VIEW = { resource: { id: 'r1' }, probes: [] } as unknown as EdaView;

  it('lists the EDAs with the Resources ready for one, and reads none as null', async () => {
    const { eda } = fake({ 'GET /edas': () => Response.json({ edas: [{ resource: { id: 'r1' } }], ready: [{ resource: { id: 'r2' }, level: 3 }] }) });
    expect(await eda.list()).toEqual({ edas: [{ resource: { id: 'r1' } }], ready: [{ resource: { id: 'r2' }, level: 3 }] });
    expect(await eda.get('r9')).toBeNull();
  });

  it('starts an EDA, and answers the one there is when the Resource has one already (409)', async () => {
    const { eda, calls } = fake({ 'POST /resources/r1/eda': () => Response.json(VIEW, { status: 201 }) });
    expect(await eda.start('r1')).toEqual(VIEW);
    const again = fake({ 'POST /resources/r1/eda': () => Response.json({ error: 'conflict' }, { status: 409 }), 'GET /resources/r1/eda': () => Response.json(VIEW) });
    expect(await again.eda.start('r1')).toEqual(VIEW);
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://eda.test/resources/r1/eda' });
  });

  it('runs an EDA-Probe with its fields, parameters and approval; a refusal says why', async () => {
    const { eda, calls } = fake({
      'POST /resources/r1/eda/probes/nullsPerKeyField/runs': () => Response.json({ state: 'approve', bytes: 840_000_000 }),
      'POST /resources/r1/eda/probes/grainHolds/runs': () => Response.json({ error: 'cannot_run', message: 'The Data Team records its grain first.' }, { status: 422 }),
    });
    expect(await eda.run('r1', 'nullsPerKeyField', { fields: ['week_start'], approve: true })).toEqual({ state: 'approve', bytes: 840_000_000 });
    expect(calls[0]?.body).toEqual({ fields: ['week_start'], approve: true });
    expect(await eda.run('r1', 'grainHolds')).toEqual({ state: 'refused', bytes: null, reason: 'The Data Team records its grain first.' });
  });

  it('keeps a reading and answers the EDA as it is now', async () => {
    const { eda, calls } = fake({ 'PUT /resources/r1/eda/probes/nullsPerKeyField/readings': () => Response.json(VIEW) });
    expect(await eda.read('r1', 'nullsPerKeyField', 'lead_source', 'known')).toEqual(VIEW);
    expect(calls[0]?.body).toEqual({ subject: 'lead_source', reading: 'known' });
  });
});

describe('what the screens read from an EDA', () => {
  const view = {
    probes: [
      probe('grainHolds', { added: true, complete: true }),
      probe('howOftenThingsChange', { runs: false }),
      probe('volumeOverTime', { needed: false, level: 'could' }),
      probe('settling', { needed: false, level: 'should', runs: false }),
      probe('nullsPerKeyField', { added: true, applies: { table: false, fields: ['a', 'b'], needs: ['a', 'b'], block: null }, lastRun: { fields: ['a'] } as ProbeView['lastRun'] }),
    ],
  };

  it('counts the needed EDA-Probes per EDA-Step, coming ones too (OP-ED-09)', () => {
    expect(stepCount(view, 'basis')).toEqual({ needed: 2, complete: 1 });
    expect(stepCount(view, 'gaps')).toEqual({ needed: 1, complete: 0 });
    expect(stepCount(view, 'relations')).toEqual({ needed: 0, complete: 0 });
  });

  it('keeps the tile Add probe while an EDA-Step has an EDA-Probe offered that is not added, coming ones too (FR-ED-04)', () => {
    expect(hasToAdd(view, 'basis')).toBe(true);
    expect(hasToAdd({ probes: [probe('howOftenThingsChange', { runs: false })] }, 'basis')).toBe(true);
    expect(hasToAdd(view, 'gaps')).toBe(false);
    expect(hasToAdd(view, 'relations')).toBe(false);
  });

  it('says in the list to add an EDA-Probe where each stands, how much it is asked for, and which a filter shows (FR-ED-13)', () => {
    // Added and not run yet, or set on part of what it needs: it still asks for something.
    expect(view.probes.map(listStateOf)).toEqual(['part', 'coming', 'open', 'coming', 'part']);
    expect(listStateOf(probe('grainHolds', { added: true, complete: true, lastRun: { fields: [] } as unknown as ProbeView['lastRun'] }))).toBe('added');
    expect(listStateOf(probe('volumeOverTime', { added: true, needed: false, lastRun: { fields: [] } as unknown as ProbeView['lastRun'] }))).toBe('added');
    expect(view.probes.map(askedOf)).toEqual(['needed', 'needed', 'onRequest', 'suggested', 'needed']);
    expect(view.probes.filter((one) => fitsFilter(one, 'needed')).map((one) => one.key)).toEqual(['grainHolds', 'howOftenThingsChange', 'nullsPerKeyField']);
    expect(view.probes.filter((one) => fitsFilter(one, 'runs')).map((one) => one.key)).toEqual(['grainHolds', 'volumeOverTime', 'nullsPerKeyField']);
    expect(view.probes.filter((one) => fitsFilter(one, 'added')).map((one) => one.key)).toEqual(['grainHolds', 'nullsPerKeyField']);
    expect(view.probes.filter((one) => fitsFilter(one, 'all'))).toHaveLength(5);
  });

  it('says where an EDA-Probe on the table stands, and which fields a needed one still misses', () => {
    expect(view.probes.map(standingOf)).toEqual(['added', 'needed', 'onRequest', 'suggested', 'added']);
    expect(stillMissing(view.probes[4] as ProbeView)).toEqual(['b']);
  });

  it('reads a run as a whole: look at this before for you to judge before as expected; a filled field has nothing to read', () => {
    expect(overallReading([{ reading: 'expected' }, { reading: 'judge' }])).toBe('judge');
    expect(overallReading([{ reading: 'judge' }, { reading: 'look' }])).toBe('look');
    expect(overallReading([])).toBeNull();
    expect(asksReading('nullsPerKeyField', { reading: 'expected' })).toBe(false);
    expect(asksReading('grainHolds', { reading: 'expected' })).toBe(true);
    // A date that is up to date has nothing to read; one behind has (DEC-ED-34).
    expect(asksReading('dateRange', { reading: 'expected' })).toBe(false);
    expect(asksReading('dateRange', { reading: 'look' })).toBe(true);
    expect(asksReading('distributionOfCategories', { reading: 'judge' })).toBe(true);
  });

  it('writes round numbers and shares', () => {
    expect(niceTicks(2559, 3)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(0)).toEqual([0]);
    expect(percent(130, 16224, 'en')).toBe('0.8%');
    expect(percent(1947, 16224, 'nl')).toBe('12%');
    expect(percent(1, 100_000, 'en')).toBe('< 0.1%');
  });
});

describe('Volume over time, per block of days from a Monday (DEC-ED-23)', () => {
  const weeks: VolumeResult = {
    unit: 'week',
    measure: 'lead_count',
    // Mondays: 1, 8, 15, 22 and 29 April 2024; the week of 8 April has no rows; 29 April is the current week.
    periods: [
      { start: '2024-04-01', rows: 52, sum: 2000 },
      { start: '2024-04-08', rows: 0, sum: 0 },
      { start: '2024-04-15', rows: 52, sum: 2100 },
      { start: '2024-04-22', rows: 51, sum: 1900 },
      { start: '2024-04-29', rows: 20, sum: 800 },
    ],
    empty: ['2024-04-08'],
    current: '2024-04-29',
    units: [],
  };

  it('adds the weeks up per block, the empty and the current block marked', () => {
    expect(volumeBlocks(weeks, 7).map((block) => [block.start, block.rows, block.sum, block.empty, block.current])).toEqual([
      ['2024-04-01', 52, 2000, false, false],
      ['2024-04-08', 0, 0, true, false],
      ['2024-04-15', 52, 2100, false, false],
      ['2024-04-22', 51, 1900, false, false],
      ['2024-04-29', 20, 800, false, true],
    ]);
    expect(volumeBlocks(weeks, 14).map((block) => [block.start, block.sum, block.empty])).toEqual([
      ['2024-04-01', 2000, true],
      ['2024-04-15', 4000, false],
      ['2024-04-29', 800, false],
    ]);
  });

  it('counts the days of a day per block from the Monday on or before the first', () => {
    const days: VolumeResult = { ...weeks, unit: 'day', measure: null, periods: ['2024-04-03', '2024-04-04', '2024-04-08'].map((start) => ({ start, rows: 3, sum: null })), empty: [], current: null };
    expect(volumeBlocks(days, 7).map((block) => [block.start, block.rows, block.sum])).toEqual([
      ['2024-04-01', 6, null],
      ['2024-04-08', 3, null],
    ]);
  });

  it('says the period without rows, and a dip for the User to judge', () => {
    const unit = { days: 7 as const, average: 2061, sd: 228, p25: 1894, median: 2059, p75: 2236, lowest: { value: 980, start: '2026-06-15' }, highest: { value: 2559, start: '2026-04-06' } };
    expect(volumeSentence({ ...weeks, units: [unit] }, 'en').map((part) => part.key)).toEqual(['eda.volume.empty.one', 'eda.volume.empty.rest', 'eda.volume.dip']);
  });
});

describe('the sentences of a result', () => {
  it('says the grain holds, or how many grain values are on more than one row', () => {
    const holds = { rows: 16224, values: 16224, onMoreThanOne: 0, rowsCovered: 0, emptyGrain: 0, buckets: [16224, 0, 0, 0] as [number, number, number, number], examples: [] };
    expect(grainConclusion(holds, ['week_start', 'lead_source'])).toEqual([
      { key: 'eda.grain.holds', names: { grain: 'week_start, lead_source' } },
      { key: 'eda.grain.holds.rest', values: { rows: 16224, values: 16224 } },
    ]);
    expect(grainConclusion({ ...holds, onMoreThanOne: 34, rowsCovered: 70 }, ['week_start']).map((part) => part.key)).toEqual(['eda.grain.twice', 'eda.grain.twice.rest']);
  });

  it('names the shape of a distribution from its mean and median (DEC-ED-14)', () => {
    expect(shapeOf({ median: 25, mean: 38 })).toBe('right');
    expect(shapeOf({ median: 25, mean: 26 })).toBe('even');
    expect(shapeOf({ median: 40, mean: 20 })).toBe('left');
    const result = { rows: 16224, low: 1, p25: 17, median: 25, p75: 38, p95: 120, high: 412, mean: 38, width: 10, tailFrom: 120, start: 0, bins: [], tail: 773 };
    expect(distributionSentence(result, 'en')[1]).toMatchObject({ key: 'eda.distribution.right', values: { apart: '52%', tail: '4.8%' } });
  });

  it('says on a card which Key Fields a needed EDA-Probe still misses', () => {
    const nulls = probe('nullsPerKeyField', {
      added: true,
      applies: { table: false, fields: ['a', 'b'], needs: ['a', 'b'], block: null },
      lastRun: { id: 'run-1', ranAt: '2026-11-21T10:00:00Z', ranBy: { id: '1', name: 'An Claes' }, bytes: 1, fields: ['a'], params: {}, results: [{ subject: 'a', data: { rows: 10, empty: 0, role: null }, reading: 'expected', yours: null }] },
    });
    const said = cardSentence(nulls, { resource: { fields: [] } } as unknown as EdaView, 'en');
    expect(said.at(-1)).toEqual({ key: 'eda.card.missing', names: { fields: 'b' }, warn: true });
  });
});

/** A field of Distribution of categories, its weight a sum of lead_count: values with their share of 1,000. */
function weighed(shares: [string, number][], more: Partial<CategoriesResult> = {}): CategoriesResult {
  const top = shares.map(([value, share]) => ({ value, weight: share * 1000, share }));
  const used = shares.reduce((sum, [, share]) => sum + share, 0);
  return { weighedBy: 'lead_count', total: 1000, values: shares.length, top, others: { values: 0, weight: 0, share: 0 }, empty: { weight: (1 - used) * 1000, share: 1 - used }, small: 0, ...more };
}

describe('Distribution of categories, in words (FR-ED-17, DEC-ED-33)', () => {
  const SOURCES = weighed(
    [
      ['website', 0.41],
      ['app', 0.22],
      ['partner', 0.09],
      ['immoweb', 0.07],
      ['mailing', 0.05],
      ['kbc-app', 0.04],
      ['social', 0.03],
      ['referral', 0.02],
      ['source 9', 0.009],
      ['source 10', 0.006],
    ],
    { values: 54, others: { values: 44, weight: 54, share: 0.054 }, empty: { weight: 1, share: 0.001 }, small: 31 },
  );
  const CHANNELS = weighed([
    ['web', 0.38],
    ['mobile', 0.31],
    ['email', 0.1],
    ['phone', 0.06],
    ['Web', 0.02],
    ['e-mail', 0.01],
  ]);

  it('names the fewest heaviest values that bring three quarters of what is filled in, as Claude does (headOf)', () => {
    expect(topOf(SOURCES)).toMatchObject({ count: 4, spread: false });
    expect(topOf(SOURCES).share).toBeCloseTo(0.79);
    expect(topOf(CHANNELS)).toMatchObject({ count: 2, spread: false });
    // Ten values that bring a little each: the weight is spread, and the ten are named with what they bring.
    const spread = weighed(Array.from({ length: 10 }, (_, index): [string, number] => [`v${index}`, 0.03]), { values: 500, others: { values: 490, weight: 700, share: 0.7 }, empty: { weight: 0, share: 0 } });
    expect(topOf(spread)).toMatchObject({ count: 10, spread: true });
  });

  it('says where the weight lies: on a few values, on two named, on one alone, or spread, with what it is weighed by', () => {
    expect(saidText(categoriesSentence(SOURCES, 'en'))).toBe('4 of 54 values bring 79% of lead_count. 31 values bring less than 0.1% each. 0.1% of lead_count has no value.');
    expect(saidText(categoriesSentence(CHANNELS, 'en'))).toBe('web and mobile bring 69% of lead_count. 12% of lead_count has no value.');
    expect(saidText(categoriesSentence(weighed([['website', 0.9], ['app', 0.1]], { weighedBy: null }), 'en'))).toBe('website alone brings 90% of the rows.');
    const spread = weighed([['a', 0.05]], { values: 500, others: { values: 499, weight: 950, share: 0.95 }, empty: { weight: 0, share: 0 } });
    expect(saidText(categoriesSentence(spread, 'en'))).toBe('The weight is spread: the 1 heaviest of 500 values bring only 5% of lead_count.');
    expect(saidText(categoriesSentence(weighed([], { values: 0, empty: { weight: 1000, share: 1 } }), 'en'))).toBe('No value: the field is empty on every row.');
    // The values and the number go in as names, never translated.
    expect(categoriesSentence(CHANNELS, 'en')[0]).toMatchObject({ key: 'eda.categories.two', names: { first: 'web', second: 'mobile', weighed: 'lead_count' } });
  });

  it('names each field in the conclusion of several, and writes the numbers as the language does', () => {
    const results = [
      { subject: 'lead_source', data: SOURCES, reading: 'judge', yours: null },
      { subject: 'lead_channel', data: CHANNELS, reading: 'judge', yours: null },
    ] satisfies ResultView[];
    expect(saidText(categoriesConclusion(results, 'en'))).toBe('In lead_source, 4 of 54 values bring 79% of lead_count. In lead_channel, web and mobile bring 69% of lead_count.');
    setLanguage('nl');
    try {
      expect(saidText(categoriesConclusion(results, 'nl'))).toBe('In lead_source brengen 4 van 54 waarden 79% van lead_count. In lead_channel brengen web en mobile 69% van lead_count.');
      expect(saidText(categoriesSentence({ ...SOURCES, values: 1540 }, 'nl'))).toMatch(/^4 van 1\.540 waarden brengen 79% van lead_count\./);
    } finally {
      setLanguage('en');
    }
  });
});

describe('Date range, in words (FR-ED-18, DEC-ED-34)', () => {
  const RANGE: DateRangeResult = { unit: 'week', first: '2021-01-04', last: '2026-11-16', periods: 307, current: '2026-11-16', behind: 0, reliableSince: '2025-01-01', beforeReliable: 208 };

  it('numbers a week as ISO 8601 does, with its Monday', () => {
    expect(isoWeek('2026-11-16')).toEqual({ week: 47, year: 2026, monday: '2026-11-16' });
    expect(isoWeek('2021-01-04')).toEqual({ week: 1, year: 2021, monday: '2021-01-04' });
    // 1 January 2021 was a Friday: it belongs to the last week of 2020.
    expect(isoWeek('2021-01-01')).toEqual({ week: 53, year: 2020, monday: '2020-12-28' });
  });

  it('says from when to when a date runs while it is up to date, and what lies before its Reliable Since', () => {
    expect(saidText(dateRangeSentence(RANGE, 'en', 'week_start'))).toBe(
      'From week 1 of 2021 to this week, week 47 of 2026: 307 weeks, up to date. The first 208 weeks lie before its Reliable Since, 1 Jan 2025.',
    );
    expect(saidText(dateRangeSentence({ ...RANGE, last: '2026-11-09', behind: 1, reliableSince: null, beforeReliable: null }, 'en', 'week_start'))).toBe(
      'From week 1 of 2021 to last week, week 46 of 2026: 307 weeks, up to date.',
    );
    const days: DateRangeResult = { unit: 'day', first: '2024-03-01', last: '2026-11-20', periods: 995, current: '2026-11-21', behind: 1, reliableSince: '2024-01-01', beforeReliable: 0 };
    expect(saidText(dateRangeSentence(days, 'en', 'created_at'))).toMatch(/^From 1 Mar 2024 to yesterday, 20 Nov( 2026)?: 995 days, up to date\.$/);
  });

  it('says how far a date is behind, a date after today, and a date without any value', () => {
    const behind = { ...RANGE, last: '2026-10-26', periods: 303, behind: 3 };
    expect(saidText(dateRangeSentence(behind, 'en', 'week_start'))).toBe(
      'The last week is week 44, 26 Oct: 3 weeks behind this one. From week 1 of 2021, 303 weeks; is it still loaded? The first 208 weeks lie before its Reliable Since, 1 Jan 2025.',
    );
    expect(saidText(dateRangeSentence({ ...RANGE, last: '2026-11-30', periods: 309 }, 'en', 'week_start'))).toMatch(/^From week 1 of 2021 to week 49 of 2026, after this week: 309 weeks\. A date in the future is for Impossible values\./);
    expect(saidText(dateRangeSentence({ ...RANGE, first: null, last: null, periods: 0 }, 'en', 'week_start'))).toBe('week_start holds no value: it is empty on every row.');
    const results = [
      { subject: 'week_start', data: RANGE, reading: 'expected', yours: null },
      { subject: 'loaded_at', data: { ...behind, unit: 'day' as const }, reading: 'look', yours: null },
    ] satisfies ResultView[];
    expect(saidText(dateRangeConclusion(results, 'en'))).toBe('1 date is not up to date: loaded_at.');
    setLanguage('nl');
    try {
      expect(saidText(dateRangeSentence(behind, 'nl', 'week_start'))).toMatch(/^De laatste week is week 44, 26 okt\.?: 3 weken achter op deze\. Vanaf week 1 van 2021, 303 weken; wordt hij nog geladen\?/);
    } finally {
      setLanguage('en');
    }
  });

  it('says on a card the date that is not up to date first', () => {
    const lastRun = {
      id: 'run-1',
      ranAt: '2026-11-21T10:00:00Z',
      ranBy: { id: '1', name: 'An Claes' },
      bytes: 1,
      fields: ['week_start', 'loaded_at'],
      params: {},
      results: [
        { subject: 'week_start', data: RANGE, reading: 'expected', yours: null },
        { subject: 'loaded_at', data: { ...RANGE, unit: 'day', last: '2026-11-02', behind: 19 }, reading: 'look', yours: null },
      ],
    } satisfies ProbeView['lastRun'];
    const card = cardSentence(probe('dateRange', { added: true, complete: true, lastRun }), { resource: { fields: [] } } as unknown as EdaView, 'en');
    expect(saidText(card)).toMatch(/^The last day is 2 Nov( 2026)?: 19 days behind today\.$/);
    const upToDate = cardSentence(probe('dateRange', { added: true, complete: true, lastRun: { ...lastRun, results: [lastRun.results[0] as ResultView] } }), { resource: { fields: [] } } as unknown as EdaView, 'en');
    expect(saidText(upToDate)).toBe('From week 1 of 2021 to this week, week 47 of 2026: 307 weeks.');
  });
});

describe('Disguised nulls (DEC-ED-35)', () => {
  it('reads the lists kept with the EDA, each part that is missing or wrong as Data Hub proposes it', () => {
    expect(disguisedListsOf({})).toEqual(DISGUISED_DEFAULTS);
    expect(disguisedListsOf(undefined)).toEqual(DISGUISED_DEFAULTS);
    expect(disguisedListsOf({ lists: { text: ['n/a'], date: 'none', number: [-1, '9'], ninesOnly: false } })).toEqual({ text: ['n/a'], date: DISGUISED_DEFAULTS.date, number: DISGUISED_DEFAULTS.number, ninesOnly: false });
    // What it reads is its own: changing it leaves what Data Hub proposes as it is.
    disguisedListsOf({}).text.push('leeg');
    expect(DISGUISED_DEFAULTS.text).not.toContain('leeg');
  });

  it('adds a value once, a text whatever its capitals and spaces, never 0, and takes one out', () => {
    const lists = disguisedListsOf({});
    expect(withValue(lists, 'text', '  Leeg ')).toMatchObject({ text: [...DISGUISED_DEFAULTS.text, 'Leeg'] });
    expect(withValue(lists, 'text', ' UNKNOWN')).toBeNull();
    expect(withValue(lists, 'text', '   ')).toBeNull();
    expect(withValue(lists, 'date', '2000-01-01')).toMatchObject({ date: [...DISGUISED_DEFAULTS.date, '2000-01-01'] });
    expect(withValue(lists, 'date', '1900-01-01')).toBeNull();
    expect(withValue(lists, 'date', '1 Jan 2000')).toBeNull();
    expect(withValue(lists, 'number', '-99')).toMatchObject({ number: [-1, -99] });
    expect(withValue(lists, 'number', '-1')).toBeNull();
    expect(withValue(lists, 'number', 'many')).toBeNull();
    expect(withValue(lists, 'number', '0')).toBe('zero');
    expect(withoutValue(lists, 'text', 'n/a').text).not.toContain('n/a');
    expect(withoutValue(lists, 'number', -1).number).toEqual([]);
    expect(sameLists(lists, DISGUISED_DEFAULTS)).toBe(true);
    expect(sameLists({ ...lists, text: [...lists.text].reverse().map((one) => one.toUpperCase()) }, DISGUISED_DEFAULTS)).toBe(true);
    expect(sameLists({ ...lists, ninesOnly: false }, DISGUISED_DEFAULTS)).toBe(false);
    expect(sameLists(withoutValue(lists, 'date', '1970-01-01'), DISGUISED_DEFAULTS)).toBe(false);
  });

  it('asks no reading where every row says something', () => {
    expect(asksReading('disguisedNulls', { reading: 'expected' })).toBe(false);
    expect(asksReading('disguisedNulls', { reading: 'judge' })).toBe(true);
    expect(asksReading('disguisedNulls', { reading: 'look' })).toBe(true);
  });

  const CHANNEL: DisguisedResult = { rows: 1000, saysNothing: 160, nulls: 20, found: [{ value: 'unknown', rows: 100 }, { value: ' ', rows: 40 }], role: null };
  const results = [
    { subject: 'lead_source', data: { ...CHANNEL, saysNothing: 5, nulls: 5, found: [], role: 'groupedBy' }, reading: 'look', yours: null },
    { subject: 'lead_channel', data: CHANNEL, reading: 'judge', yours: null },
    { subject: 'week_start', data: { rows: 1000, saysNothing: 0, nulls: 0, found: [], role: 'period' }, reading: 'expected', yours: null },
  ] satisfies ResultView[];

  it('names what says nothing: no value and blanks in words, a value as it is', () => {
    expect(saidNothingOf(CHANNEL)).toEqual([
      { value: null, rows: 20 },
      { value: 'unknown', rows: 100 },
      { value: ' ', rows: 40 },
    ]);
    expect([null, '', ' ', 'n/a'].map((value) => nothingName(value))).toEqual(['null', 'empty text', 'only spaces', 'n/a']);
    expect(nothingName('n/a', true)).toBe('"n/a"');
    expect(disguisedWhy(CHANNEL, null)).toEqual({ key: 'eda.nulls.why.free' });
    expect(disguisedWhy(CHANNEL, 'grouped by')).toEqual({ key: 'eda.disguised.why.role', values: { role: 'grouped by' } });
    expect(disguisedWhy({ ...CHANNEL, saysNothing: 0 }, 'grouped by')).toEqual({ key: 'eda.disguised.why.none' });
  });

  it('says how much of each field says nothing, a field with a role first, and on a card the field that says nothing most', () => {
    expect(saidText(disguisedConclusion(results, 'en', (result) => (result.subject === 'lead_source' ? 'grouped by' : null)))).toBe(
      'lead_source says nothing on 5 rows, though its role, grouped by, needs a real value on every row. In lead_channel, 16% of rows say nothing, "unknown" the most. week_start always says something.',
    );
    const clean = results.slice(2);
    expect(saidText(disguisedConclusion(clean, 'en', () => null))).toBe('Every field it is set on always says something. 1 field, 1,000 rows: no null, and no value of the lists.');
    const lastRun = { id: 'run-1', ranAt: '2026-11-21T10:00:00Z', ranBy: { id: '1', name: 'An Claes' }, bytes: 1, fields: ['lead_source', 'lead_channel', 'week_start'], params: {}, results };
    const card = (runs: ResultView[]) => saidText(cardSentence(probe('disguisedNulls', { added: true, complete: true, lastRun: { ...lastRun, results: runs } }), { resource: { fields: [] } } as unknown as EdaView, 'en'));
    expect(card(results)).toBe('2 fields say nothing on some rows: lead_channel the most, 16% of its rows.');
    expect(card(clean)).toBe('Every row says something in its 1 field.');
  });

  it('says the rows of a selection in words, the fields as names, a range of days or numbers by its bounds', () => {
    expect(conditionSaid({ kind: 'saysNothing', field: 'lead_channel' }, 'en')).toEqual({ key: 'eda.selection.saysNothing', names: { field: 'lead_channel' } });
    expect(conditionSaid({ kind: 'equals', field: 'is_test', value: true }, 'en')).toEqual({ key: 'eda.selection.equals', names: { field: 'is_test', value: 'true' } });
    expect(saidText([conditionSaid({ kind: 'range', field: 'lead_count', from: 1200, before: 2500.5 }, 'en') as never])).toBe('lead_count is at least 1,200 and below 2,500.5');
    expect(saidText([conditionSaid({ kind: 'range', field: 'week_start', before: '2025-01-06' }, 'en') as never])).toBe('week_start is before 6 Jan 2025');
    expect(conditionSaid({ kind: 'range', field: 'week_start' }, 'en')).toBeNull();
    expect(selectionSaid(undefined, 'en')).toEqual([]);
    expect(selectionSaid({ where: [{ kind: 'range', field: 'week_start' }, { kind: 'saysNothing', field: 'lead_channel' }] }, 'en')).toHaveLength(1);
  });
});
