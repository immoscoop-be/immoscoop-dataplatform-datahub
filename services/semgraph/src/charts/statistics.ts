import type { Translator } from '../core/i18n.ts';
import type { Tokens } from '../core/tokens.ts';

/** A centre with its spread; the spread is null when it is left out or cannot be computed. */
export interface Summary {
  centre: number;
  spread: { lo: number; hi: number } | null;
}

/**
 * The statistic a chart shows per period: a centre and the spread that belongs to it. The chart
 * language never shows one without the other: a mean goes with ±1 sd, a median with P25–P75.
 * Every time-axis chart uses one of these, so the calculation lives in one place.
 */
export abstract class Statistic {
  abstract readonly id: 'mean' | 'median';
  /** The value of `spread` in the contract that asks for the spread, e.g. stddev or iqr. */
  abstract readonly spreadName: string;
  /** The tolerated deviation when the spread is left out. */
  abstract readonly withoutSpreadCode: string;
  abstract readonly description: string;

  abstract summarize(values: readonly number[], withSpread: boolean): Summary;

  /** Width of the spread bar in pixels: a thin bar for a mean, a wide rounded one for a median. */
  abstract barWidth(tokens: Tokens): number;

  /** "43,7 ± 12,2" or "44,0, P25–P75 38,0–51,0", for hover labels and descriptions. */
  abstract formatStats(t: Translator, format: Intl.NumberFormat, summary: Summary): string;

  /** The spread as a detail next to the last value: "± 12,2" or "38,0–51,0". */
  abstract formatDetail(format: Intl.NumberFormat, summary: Summary): string;

  /** The `spread` property of the contract. */
  spreadSchema(): object {
    return {
      description: `Spread around the ${this.id}: ${this.spreadName} (the chart language default) or none.`,
      enum: [this.spreadName, 'none'],
      default: this.spreadName,
    };
  }
}

export class Average extends Statistic {
  readonly id = 'mean';
  readonly spreadName = 'stddev';
  readonly withoutSpreadCode = 'meanWithoutSpread';
  readonly description = 'The mean is a dot over a thin bar of ±1 sample standard deviation (n − 1, like STDDEV in BigQuery).';

  summarize(values: readonly number[], withSpread: boolean): Summary {
    const centre = mean(values);
    if (!withSpread || values.length < 2) return { centre, spread: null };
    const sd = sampleStandardDeviation(values, centre);
    return { centre, spread: { lo: centre - sd, hi: centre + sd } };
  }

  barWidth(tokens: Tokens): number {
    return tokens.stroke.spread;
  }

  formatStats(t: Translator, format: Intl.NumberFormat, { centre, spread }: Summary): string {
    if (!spread) return t('chart.stats.noSpread', { value: format.format(centre) });
    return t('chart.stats.mean', { value: format.format(centre), sd: format.format(spread.hi - centre) });
  }

  formatDetail(format: Intl.NumberFormat, { centre, spread }: Summary): string {
    return spread ? `± ${format.format(spread.hi - centre)}` : '';
  }
}

export class Median extends Statistic {
  readonly id = 'median';
  readonly spreadName = 'iqr';
  readonly withoutSpreadCode = 'medianWithoutSpread';
  readonly description = 'The median is a dot inside a wide rounded bar from P25 to P75 (linear interpolation, like PERCENTILE_CONT in BigQuery).';

  summarize(values: readonly number[], withSpread: boolean): Summary {
    const sorted = [...values].sort((a, b) => a - b);
    const centre = percentile(sorted, 0.5);
    if (!withSpread || values.length < 2) return { centre, spread: null };
    return { centre, spread: { lo: percentile(sorted, 0.25), hi: percentile(sorted, 0.75) } };
  }

  barWidth(tokens: Tokens): number {
    return tokens.stroke.spreadWide;
  }

  formatStats(t: Translator, format: Intl.NumberFormat, { centre, spread }: Summary): string {
    if (!spread) return t('chart.stats.noSpread', { value: format.format(centre) });
    return t('chart.stats.median', {
      value: format.format(centre),
      p25: format.format(spread.lo),
      p75: format.format(spread.hi),
    });
  }

  formatDetail(format: Intl.NumberFormat, { spread }: Summary): string {
    return spread ? `${format.format(spread.lo)}–${format.format(spread.hi)}` : '';
  }
}

export function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Two passes, n - 1 in the denominator: the same as STDDEV (STDDEV_SAMP) in BigQuery. */
export function sampleStandardDeviation(values: readonly number[], centre = mean(values)): number {
  const squares = values.reduce((sum, value) => sum + (value - centre) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

/** Linear interpolation between the closest ranks: the same as PERCENTILE_CONT in BigQuery. */
export function percentile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const below = Math.floor(position);
  const above = Math.ceil(position);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (position - below);
}
