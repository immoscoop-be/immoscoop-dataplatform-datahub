import { describe, expect, it } from 'vitest';
import { ago, day, daysAgo } from './when.js';

const NOW = new Date('2026-10-28T12:00:00Z');

describe('when something happened', () => {
  it('is said as the language says it, up to four weeks ago', () => {
    expect(ago('2026-10-28T11:59:30Z', 'en', NOW)).toBe('now');
    expect(ago('2026-10-28T11:58:00Z', 'en', NOW)).toBe('2 minutes ago');
    expect(ago('2026-10-25T12:00:00Z', 'nl', NOW)).toBe('3 dagen geleden');
    expect(ago('2026-10-27T12:00:00Z', 'en', NOW)).toBe('yesterday');
    expect(ago('2026-10-14T12:00:00Z', 'en', NOW)).toBe('2 weeks ago');
  });

  it('is a day after that', () => {
    expect(ago('2026-09-03T08:00:00Z', 'en', NOW)).toBe('3 Sept 2026');
  });

  it('names a day without its year in the same year', () => {
    expect(day('2026-09-03T08:00:00Z', 'en', NOW)).toBe('3 Sept');
    expect(day('2025-09-03T08:00:00Z', 'en', NOW)).toBe('3 Sept 2025');
  });

  it('says how long ago a day was, by the day', () => {
    expect(daysAgo('2026-10-28', 'en', NOW)).toBe('today');
    expect(daysAgo('2026-10-27', 'nl', NOW)).toBe('gisteren');
    expect(daysAgo('2026-10-25', 'en', NOW)).toBe('3 days ago');
    expect(daysAgo('2026-09-03', 'en', NOW)).toBe('3 Sept');
  });
});
