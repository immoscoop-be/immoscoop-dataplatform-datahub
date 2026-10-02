import { currentDay, parseDay } from '../../src/core/days.ts';
import type { MovingWindowAverageComputed, MovingWindowAverageRequest, WindowPoint } from './types.ts';

/**
 * Per relative day, the mean and the sample standard deviation over exactly the same window.
 * Strict: when one day in a window has no value, that window has no point. Missing days are
 * never zero and never interpolated.
 */
export function compute(request: MovingWindowAverageRequest, { now }: { now: Date }): MovingWindowAverageComputed {
  const { window, horizon } = request;
  const spread = request.spread ?? 'stddev';
  const values = new Map<number, number | null>();
  for (const { day, value } of request.data) values.set(parseDay(day)!, value);

  // "Today" is the last day in the data, but never the running day in Brussels: it is not complete yet.
  const yesterday = currentDay(now) - 1;
  const lastDay = Math.max(...values.keys());
  const reference = Math.min(lastDay, yesterday);
  const ignoredAfterReference = [...values.keys()].filter((day) => day > reference).length;

  const rangeStart = reference - (horizon - 1) - (window - 1);
  const absentDays: number[] = [];
  for (let day = rangeStart; day <= reference; day++) {
    if (typeof values.get(day) !== 'number') absentDays.push(day);
  }
  const valuesInRange = horizon + window - 1 - absentDays.length;

  const points: WindowPoint[] = [];
  const missing: number[] = [];
  for (let rel = -(horizon - 1); rel <= 0; rel++) {
    const day = reference + rel;
    const windowValues = completeWindow(values, day, window);
    if (!windowValues) {
      missing.push(rel);
      continue;
    }
    const mean = average(windowValues);
    points.push({ rel, day, mean, sd: spread === 'stddev' ? sampleStandardDeviation(windowValues, mean) : null });
  }

  return {
    window,
    horizon,
    spread,
    reference,
    referenceIsYesterday: reference === yesterday,
    ignoredAfterReference,
    rangeStart,
    valuesInRange,
    points,
    missing,
    absentDays,
  };
}

/** The values of the `window` days ending at `day`, or undefined when one of them is missing. */
function completeWindow(values: ReadonlyMap<number, number | null>, day: number, window: number): number[] | undefined {
  const result: number[] = [];
  for (let offset = window - 1; offset >= 0; offset--) {
    const value = values.get(day - offset);
    if (typeof value !== 'number') return undefined;
    result.push(value);
  }
  return result;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Two passes, n - 1 in the denominator: the same as STDDEV (STDDEV_SAMP) in BigQuery. */
export function sampleStandardDeviation(values: readonly number[], mean = average(values)): number {
  const squares = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}
