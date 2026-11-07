import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { isoWeek, periodFromName, periodName, shiftPeriod } from '../src/charts/calendar.ts';
import { formatDay, parseDay } from '../src/core/days.ts';

const day = (text: string) => parseDay(text)!;

describe('calendar periods', () => {
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

  it('names a period the ISO way and reads the name back; a name that does not exist is not a period (REQ-062)', () => {
    assert.equal(periodName(day('2026-09-28'), 'week'), '2026-W40');
    assert.equal(periodName(day('2026-09-01'), 'month'), '2026-09');
    assert.equal(periodName(day('2026-07-01'), 'quarter'), '2026-Q3');
    assert.equal(periodName(day('2026-01-01'), 'year'), '2026');
    // The ISO week year: the week of 29 December 2025 is week 1 of 2026.
    assert.equal(periodName(day('2025-12-29'), 'week'), '2026-W01');
    assert.equal(formatDay(periodFromName('2026-W01', 'week')!), '2025-12-29');
    assert.equal(formatDay(periodFromName('2026-W53', 'week')!), '2026-12-28');
    assert.equal(formatDay(periodFromName('2026-Q3', 'quarter')!), '2026-07-01');
    for (const [name, unit] of [['2025-W53', 'week'], ['2026-W00', 'week'], ['2026-13', 'month'], ['2026-09', 'week'], ['2026-W40', 'month'], ['26', 'year']] as const) {
      assert.equal(periodFromName(name, unit), undefined, `${name} as ${unit}`);
    }
  });
});
