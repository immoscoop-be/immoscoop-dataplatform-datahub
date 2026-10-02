import type { RequestContext } from '../../src/core/semgraph.ts';

/** A request that passed schema.json. */
export interface MovingWindowAverageRequest {
  semgraph: 'movingWindowAverage';
  metric: string;
  title?: string;
  measureType: 'additive' | 'unique' | 'ratio';
  uniqueAggregation?: 'dailyAverage' | 'overWindow';
  window: number;
  horizon: number;
  spread?: 'stddev' | 'none';
  format?: 'svg' | 'png' | 'html' | 'widget';
  locale?: string;
  context?: RequestContext;
  data: { day: string; value: number | null }[];
}

/** One day on the relative axis whose window is complete. */
export interface WindowPoint {
  /** Relative day: 0 is the reference day ("today"), -1 the day before, ... */
  rel: number;
  day: number;
  mean: number;
  /** Sample standard deviation (n - 1) over the same window; null when spread is none. */
  sd: number | null;
}

export interface MovingWindowAverageComputed {
  window: number;
  horizon: number;
  spread: 'stddev' | 'none';
  /** The last complete day in the data, as a day number. */
  reference: number;
  /** True when the reference day is yesterday, so the 0 tick may be called "today". */
  referenceIsYesterday: boolean;
  /** Days in the data after the reference day (the running day, or later). */
  ignoredAfterReference: number;
  /** First day the chart uses: reference - (horizon - 1) - (window - 1). */
  rangeStart: number;
  /** Days with a value between rangeStart and the reference day. */
  valuesInRange: number;
  /** Complete windows only, in order of rel. */
  points: WindowPoint[];
  /** Relative days without a complete window: drawn as missing, never as zero. */
  missing: number[];
  /** Days between rangeStart and the reference day without a value, in order. */
  absentDays: number[];
}
