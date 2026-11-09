import { describe, expect, it } from 'vitest';
import { formatBytes } from './bytes.js';

describe('what a query reads, as people say it', () => {
  it('is in units of 1000, with one decimal below 10', () => {
    expect(formatBytes(840_000_000, 'en')).toBe('840 MB');
    expect(formatBytes(4_800_000_000, 'en')).toBe('4.8 GB');
    expect(formatBytes(1_000_000_000, 'en')).toBe('1 GB');
    expect(formatBytes(2_048_000, 'en')).toBe('2 MB');
    expect(formatBytes(12_500, 'en')).toBe('13 kB');
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(0, 'en')).toBe('0 B');
  });

  it('writes the decimal as the language does', () => {
    expect(formatBytes(4_800_000_000, 'nl')).toBe('4,8 GB');
  });
});
