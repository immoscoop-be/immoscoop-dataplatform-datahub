import { describe, expect, it } from 'vitest';
import { periodOf, periodsOf } from './periods.js';

// Friday 30 October 2026: this week runs from Monday 26 October, last month is September.
const NOW = new Date(2026, 9, 30, 15, 0);
const day = (month: number, date: number) => new Date(2026, month - 1, date);

describe('the periods of the panel of Query (DEC-UX-139)', () => {
  it('are days in this week, weeks back to the first of last month, then months', () => {
    expect(periodOf(day(10, 30), NOW)).toMatchObject({ kind: 'day', from: day(10, 30), to: day(10, 31) });
    expect(periodOf(day(10, 26), NOW)).toMatchObject({ kind: 'day', from: day(10, 26) });
    expect(periodOf(day(10, 25), NOW)).toMatchObject({ kind: 'week', from: day(10, 19), to: day(10, 26) });
    expect(periodOf(day(10, 1), NOW)).toMatchObject({ kind: 'week', from: day(9, 28), to: day(10, 5) });
    // The week that starts in August holds only its days of September; the rest goes to August.
    expect(periodOf(day(9, 2), NOW)).toMatchObject({ kind: 'week', from: day(9, 1), to: day(9, 7) });
    expect(periodOf(day(8, 31), NOW)).toMatchObject({ kind: 'month', from: day(8, 1), to: day(9, 1) });
    expect(periodOf(new Date(2025, 11, 24), NOW)).toMatchObject({ kind: 'month', from: new Date(2025, 11, 1), to: new Date(2026, 0, 1) });
  });

  it('count what the panel shows, the chips adding theirs, and leave out a period with none (DEC-UX-137)', () => {
    const days = [
      { day: '2026-10-30', queries: 2, previews: 1, lenses: 0, hidden: 0 },
      { day: '2026-10-21', queries: 1, previews: 0, lenses: 0, hidden: 0 },
      { day: '2026-10-20', queries: 2, previews: 0, lenses: 1, hidden: 0 },
      { day: '2026-08-04', queries: 0, previews: 3, lenses: 0, hidden: 1 },
    ];
    expect(periodsOf(days, new Set(), NOW).map(({ kind, count }) => [kind, count])).toEqual([
      ['day', 2],
      ['week', 3],
    ]);
    expect(periodsOf(days, new Set(['previews', 'lenses', 'hidden']), NOW).map(({ kind, count }) => [kind, count])).toEqual([
      ['day', 3],
      ['week', 4],
      ['month', 4],
    ]);
  });
});
