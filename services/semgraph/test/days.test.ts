import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { currentDay, formatDay, parseDay } from '../src/core/days.ts';

describe('days', () => {
  it('parses only existing calendar days', () => {
    assert.equal(formatDay(parseDay('2026-09-30')!), '2026-09-30');
    assert.equal(parseDay('2028-02-29') !== undefined, true);
    assert.equal(parseDay('2026-02-29'), undefined);
    assert.equal(parseDay('2026-09-31'), undefined);
    assert.equal(parseDay('2026-9-30'), undefined);
  });

  it('takes the current day in Brussels, not in UTC', () => {
    // 22:30 UTC on 1 October is already 00:30 on 2 October in Brussels (summer time).
    assert.equal(formatDay(currentDay(new Date('2026-10-01T22:30:00Z'))), '2026-10-02');
    assert.equal(formatDay(currentDay(new Date('2026-10-01T21:30:00Z'))), '2026-10-01');
    // Winter time: UTC+1.
    assert.equal(formatDay(currentDay(new Date('2026-12-31T23:30:00Z'))), '2027-01-01');
  });

  it('day arithmetic does not move with daylight saving time', () => {
    // The clocks change on 25 October 2026; consecutive days stay one apart.
    assert.equal(parseDay('2026-10-26')! - parseDay('2026-10-25')!, 1);
    assert.equal(parseDay('2026-10-25')! - parseDay('2026-10-24')!, 1);
  });
});
