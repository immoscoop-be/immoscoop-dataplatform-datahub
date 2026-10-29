import { describe, expect, it } from 'vitest';
import { dayOf, isFunction, namesOf, SUGGESTED } from './parameters.js';

describe('the value of a Parameter (DEC-LE-14, DEC-UX-118)', () => {
  it('is a value of its kind, or a function', () => {
    expect(isFunction('date', '2026-10-25')).toBe(false);
    expect(isFunction('date', '2026-02-30')).toBe(true);
    expect(isFunction('date', 'CURRENT_DATE()')).toBe(true);
    expect(isFunction('number', '10')).toBe(false);
    expect(isFunction('decimal', '350000.50')).toBe(false);
    expect(isFunction('text', 'Gent (Zuid)')).toBe(false);
    expect(isFunction('text', "CONCAT('a', 'b')")).toBe(true);
    expect(isFunction('choice', 'f(x)')).toBe(false);
  });

  it('gives a day for a date and for each suggested function, worked out in UTC as BigQuery does', () => {
    // A Thursday.
    const today = new Date('2026-10-29T08:12:00Z');
    const gives = Object.fromEntries(SUGGESTED.map((suggested) => [suggested.key, dayOf(suggested.sql, today)]));
    expect(gives).toEqual({
      today: '2026-10-29',
      minus3: '2026-10-26',
      week: '2026-10-26',
      month: '2026-10-01',
      quarter: '2026-10-01',
      year: '2026-01-01',
      lastWeek: '2026-10-25',
      lastMonth: '2026-09-30',
    });
    expect(dayOf('date_trunc(current_date(),  year)', today)).toBe('2026-01-01');
    expect(dayOf('2026-01-01', today)).toBe('2026-01-01');
    // Any other function is worked out at every run.
    expect(dayOf('DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)', today)).toBeNull();
    // On a Sunday the week started six days before.
    expect(dayOf('DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY))', new Date('2026-11-01T12:00:00Z'))).toBe('2026-10-26');
  });

  it('names a Period by two @names', () => {
    expect(namesOf({ name: 'weeks', kind: 'period', value: '2026-01-01', to: 'CURRENT_DATE()' })).toEqual(['weeks_from', 'weeks_to']);
    expect(namesOf({ name: 'dateFrom', kind: 'date', value: '2026-01-01' })).toEqual(['dateFrom']);
  });
});
