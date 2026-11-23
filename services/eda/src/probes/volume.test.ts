import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import type { ProbeContext } from './probe.js';
import { calm, measureOf, mondayOf, unitOf, volumeOf, volumeResults, volumeSql } from './volume.js';

/** Saturday 21 November 2026: the week of Monday 16 November is current. */
const TODAY = '2026-11-21';
const weekly: ProbeContext = { source: WEEKLY, fields: ['week_start'], params: {}, today: TODAY };

/** A row of the answer of query, every value as text. */
const row = (index: number, start: string, rows: number, sum?: number) => ({
  date_index: String(index),
  period_start: start,
  row_count: String(rows),
  ...(sum === undefined ? {} : { measure_sum: String(sum) }),
});

/** Every day from the first to the last, `YYYY-MM-DD`. */
function days(first: string, last: string): string[] {
  const out: string[] = [];
  for (let day = Date.parse(`${first}T00:00:00Z`); day <= Date.parse(`${last}T00:00:00Z`); day += 86_400_000) out.push(new Date(day).toISOString().slice(0, 10));
  return out;
}

describe('Volume over time, with empty periods (FR-ED-09, DEC-ED-23, TR-ED-03)', () => {
  it('counts per week from a Monday for the period of an aggregate, with the sum of what adds up, in one scan', () => {
    expect(volumeSql({ ...weekly, fields: ['week_start', 'loaded_at'] })).toBe(`-- EDA-Probe volumeOverTime on Weekly lead volume: aggregates only (TR-ED-03)
select
  eda_dated.date_index,
  format_date('%F', eda_dated.period) as period_start,
  count(*) as row_count,
  sum(\`lead_count\`) as measure_sum
from \`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume\`
cross join unnest([
  struct(0 as date_index, date_trunc(\`week_start\`, week(monday)) as period),
  struct(1 as date_index, date(\`loaded_at\`, 'Europe/Brussels') as period)
]) as eda_dated
where (\`week_start\` is null or \`week_start\` >= date '0001-01-01')
  and eda_dated.period is not null
group by 1, 2
order by 1, 2`);
  });

  it('counts per day for when an event happened, rows only, without a filter where none is required', () => {
    const sql = volumeSql({ source: LEADS, fields: ['created_at'], params: {}, today: TODAY });
    expect(sql).toContain("struct(0 as date_index, date(`created_at`, 'Europe/Brussels') as period)");
    expect(sql).not.toContain('measure_sum');
    expect(sql).toContain('where eda_dated.period is not null');
  });

  it('takes the field that adds up of an aggregate or a fact, never a unique count, unless rows only were chosen', () => {
    expect(measureOf(WEEKLY, {})).toBe('lead_count');
    expect(measureOf(WEEKLY, { measure: null })).toBeNull();
    expect(measureOf(LEADS, {})).toBeNull();
    expect(unitOf(WEEKLY, 'week_start')).toBe('week');
    expect(unitOf(WEEKLY, 'loaded_at')).toBe('day');
    expect(mondayOf('2026-11-21')).toBe('2026-11-16');
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
  });

  it('gives every week from the first to the last, the empty one and the current one, and how calm each unit is', () => {
    const weeks: [string, number, number][] = [
      ['2026-09-07', 2, 100],
      ['2026-09-14', 2, 110],
      ['2026-09-21', 2, 90],
      ['2026-09-28', 2, 120],
      ['2026-10-05', 2, 100],
      // 12 October has no rows.
      ['2026-10-19', 2, 130],
      ['2026-10-26', 2, 80],
      ['2026-11-02', 2, 100],
      ['2026-11-09', 2, 110],
      ['2026-11-16', 1, 40],
    ];
    const [result, ...others] = volumeResults(
      weeks.map(([start, rows, sum]) => row(0, start, rows, sum)),
      weekly,
    );
    expect(others).toHaveLength(0);
    expect(result?.subject).toBe('week_start');
    expect(result?.reading).toBe('look');
    const data = result!.data as ReturnType<typeof volumeOf>;
    expect(data.unit).toBe('week');
    expect(data.measure).toBe('lead_count');
    expect(data.periods).toHaveLength(11);
    expect(data.periods[5]).toEqual({ start: '2026-10-12', rows: 0, sum: 0 });
    expect(data.empty).toEqual(['2026-10-12']);
    expect(data.current).toBe('2026-11-16');
    // No unit of a day for a weekly unit; the current week counts in none; a block with the empty week is left out.
    expect(data.units.map((unit) => unit.days)).toEqual([7, 14, 21, 28]);
    const [seven, fourteen, twentyOne, twentyEight] = data.units;
    expect(seven).toMatchObject({ days: 7, median: 100, p25: 100, p75: 110, lowest: { value: 80, start: '2026-10-26' }, highest: { value: 130, start: '2026-10-19' } });
    expect(seven?.average).toBeCloseTo(940 / 9);
    expect(seven?.sd).toBeCloseTo(15.09, 2);
    expect(fourteen).toMatchObject({ average: 210, sd: 0, lowest: { value: 210, start: '2026-09-07' } });
    expect(twentyOne).toMatchObject({ average: 305, lowest: { value: 290, start: '2026-10-26' }, highest: { value: 320, start: '2026-09-14' } });
    expect(twentyEight).toMatchObject({ average: 420, sd: 0, median: 420, lowest: { value: 420, start: '2026-10-19' } });
  });

  it('counts per day, a day among the units, and never counts the current day as empty', () => {
    const rows = days('2026-11-02', '2026-11-21')
      .filter((day) => day !== '2026-11-11')
      .map((day) => row(0, day, day === TODAY ? 3 : 10));
    const [result] = volumeResults(rows, { source: LEADS, fields: ['created_at'], params: {}, today: TODAY });
    const data = result!.data as ReturnType<typeof volumeOf>;
    expect(data).toMatchObject({ unit: 'day', measure: null, empty: ['2026-11-11'], current: TODAY });
    expect(data.periods).toHaveLength(20);
    expect(data.periods.every((period) => period.sum === null)).toBe(true);
    // 18 complete days with rows; one week from a Monday without an empty day; no 14 days without one.
    expect(data.units.map((unit) => [unit.days, unit.average, unit.sd])).toEqual([
      [1, 10, 0],
      [7, 70, 0],
    ]);
    expect(data.units[1]?.lowest).toEqual({ value: 70, start: '2026-11-02' });
    expect(result?.reading).toBe('look');
  });

  it('lets weekends be empty when they may be, for a count per day', () => {
    const weekend = ['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15'];
    const rows = days('2026-11-02', '2026-11-20')
      .filter((day) => !weekend.includes(day))
      .map((day) => row(0, day, 10));
    const context = { source: LEADS, fields: ['created_at'], params: { mayBeEmpty: 'weekends' }, today: TODAY };
    const [result] = volumeResults(rows, context);
    const data = result!.data as ReturnType<typeof volumeOf>;
    expect(result?.reading).toBe('expected');
    expect(data.empty).toEqual([]);
    expect(data.current).toBeNull();
    expect(data.units.find((unit) => unit.days === 7)).toMatchObject({ average: 50, lowest: { start: '2026-11-02' }, highest: { start: '2026-11-02' } });
    expect(data.units.find((unit) => unit.days === 14)).toMatchObject({ average: 100 });
    const [strict] = volumeResults(rows, { ...context, params: {} });
    expect(strict?.reading).toBe('look');
    expect((strict!.data as ReturnType<typeof volumeOf>).empty).toEqual(weekend);
  });

  it('gives each date its own result, and nothing to flag without rows', () => {
    const results = volumeResults([row(1, '2026-11-20', 4, 9)], { ...weekly, fields: ['week_start', 'loaded_at'] });
    expect(results.map((result) => [result.subject, result.reading])).toEqual([
      ['week_start', 'expected'],
      ['loaded_at', 'expected'],
    ]);
    expect(results[0]?.data).toEqual({ unit: 'week', measure: 'lead_count', periods: [], empty: [], current: null, units: [] });
    expect(results[1]?.data).toMatchObject({ unit: 'day', periods: [{ start: '2026-11-20', rows: 4, sum: 9 }], units: [{ days: 1, average: 9 }] });
  });

  it('computes how calm a unit is, the standard deviation of a sample', () => {
    expect(calm(7, [])).toBeNull();
    expect(calm(7, [{ value: 2, start: 'a' }, { value: 4, start: 'b' }, { value: 6, start: 'c' }, { value: 8, start: 'd' }])).toEqual({
      days: 7,
      average: 5,
      sd: Math.sqrt(20 / 3),
      p25: 3.5,
      median: 5,
      p75: 6.5,
      lowest: { value: 2, start: 'a' },
      highest: { value: 8, start: 'd' },
    });
  });
});
