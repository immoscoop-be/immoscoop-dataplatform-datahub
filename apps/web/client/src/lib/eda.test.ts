import type { EdaView, ProbeView, VolumeResult } from '@datahub/contracts/eda';
import { addTexts, setLanguage } from '@datahub/ui/foundations/texts.svelte.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { TEXTS } from '../texts/index.js';
import { askedOf, asksReading, createEda, fitsFilter, hasToAdd, listStateOf, niceTicks, overallReading, percent, standingOf, stepCount, stillMissing, volumeBlocks } from './eda.js';
import { cardSentence, distributionSentence, grainConclusion, shapeOf, volumeSentence } from './edaWords.js';

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
      probe('dateRange', { runs: false }),
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
    expect(hasToAdd({ probes: [probe('dateRange', { runs: false })] }, 'basis')).toBe(true);
    expect(hasToAdd(view, 'gaps')).toBe(false);
    expect(hasToAdd(view, 'relations')).toBe(false);
  });

  it('says in the list to add an EDA-Probe where each stands, how much it is asked for, and which a filter shows (FR-ED-13)', () => {
    // Added and not run yet, or set on part of what it needs: it still asks for something.
    expect(view.probes.map(listStateOf)).toEqual(['part', 'coming', 'open', 'coming', 'part']);
    expect(listStateOf(probe('grainHolds', { added: true, complete: true, lastRun: { fields: [] } as unknown as ProbeView['lastRun'] }))).toBe('added');
    expect(listStateOf(probe('volumeOverTime', { added: true, needed: false, lastRun: { fields: [] } as unknown as ProbeView['lastRun'] }))).toBe('added');
    expect(view.probes.map(askedOf)).toEqual(['needed', 'needed', 'onRequest', 'suggested', 'needed']);
    expect(view.probes.filter((one) => fitsFilter(one, 'needed')).map((one) => one.key)).toEqual(['grainHolds', 'dateRange', 'nullsPerKeyField']);
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
