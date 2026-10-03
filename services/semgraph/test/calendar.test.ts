import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isoWeek, periodStart, shiftPeriod } from '../src/charts/calendar.ts';
import { formatDay, parseDay } from '../src/core/days.ts';

const day = (text: string) => parseDay(text)!;

describe('calendar periods', () => {
  it('finds the start of the week (Monday), month, quarter and year', () => {
    assert.equal(formatDay(periodStart(day('2026-09-30'), 'week')), '2026-09-28');
    assert.equal(formatDay(periodStart(day('2026-09-27'), 'week')), '2026-09-21'); // a Sunday
    assert.equal(formatDay(periodStart(day('2026-09-30'), 'month')), '2026-09-01');
    assert.equal(formatDay(periodStart(day('2026-09-30'), 'quarter')), '2026-07-01');
    assert.equal(formatDay(periodStart(day('2026-09-30'), 'year')), '2026-01-01');
  });

  it('moves whole periods back and forth, also across years and short months', () => {
    assert.equal(formatDay(shiftPeriod(day('2026-01-01'), 'month', -2)), '2025-11-01');
    assert.equal(formatDay(shiftPeriod(day('2026-01-01'), 'quarter', -1)), '2025-10-01');
    assert.equal(formatDay(shiftPeriod(day('2026-02-01'), 'month', 1)), '2026-03-01');
    assert.equal(formatDay(shiftPeriod(day('2024-01-01'), 'year', 2)), '2026-01-01');
    assert.equal(formatDay(shiftPeriod(day('2026-09-28'), 'week', -12)), '2026-07-06');
  });

  it('numbers weeks the ISO way: a week belongs to the year of its Thursday', () => {
    assert.deepEqual(isoWeek(day('2026-09-30')), { week: 40, year: 2026 });
    assert.deepEqual(isoWeek(day('2026-01-01')), { week: 1, year: 2026 }); // a Thursday
    assert.deepEqual(isoWeek(day('2027-01-01')), { week: 53, year: 2026 }); // a Friday
    assert.deepEqual(isoWeek(day('2024-12-30')), { week: 1, year: 2025 }); // a Monday
  });
});
