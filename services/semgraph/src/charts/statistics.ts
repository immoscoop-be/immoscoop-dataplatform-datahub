import type { Translator } from '../core/i18n.ts';
import type { IssueSpec } from '../core/issues.ts';
import type { Tokens } from '../core/tokens.ts';
import { SHAPES, type Kind, type Shape } from './signatures.ts';

/** A centre with its spread, and n when the block carries it; the spread is null when it is left out. */
export interface Summary {
  centre: number;
  spread: { lo: number; hi: number } | null;
  /** The number of observations behind the value (REQ-043), as the warehouse counted it. */
  n?: number;
}

/**
 * One block as the caller delivers it (REQ-058): its name, the end day of a window or the ISO name
 * of a period (REQ-062), and the fields of its statistic. The warehouse computes them; the semgraph
 * computes nothing over days any more, so it can never average averages (REQ-056).
 */
export interface BlockRow {
  end?: string;
  period?: string;
  mean?: number | null;
  sd?: number;
  median?: number | null;
  p25?: number;
  p75?: number;
  sum?: number | null;
  n?: number;
  /** periodComparison: the value of the block just before the screen at this position. */
  previous?: Partial<Record<'mean' | 'median' | 'sum', number | null>> | null;
}

/** Every field a statistic may carry in a block; the fields of the others do not belong in it. */
export const STATISTIC_FIELDS = ['mean', 'sd', 'median', 'p25', 'p75', 'sum', 'n'] as const;

const VALUE = { type: ['number', 'null'], minimum: 0 };
const N = { description: 'Number of observations behind the value, as counted where the value is computed (REQ-043).', type: 'integer', minimum: 1 };

/**
 * The statistic a chart shows per block: a centre and the spread that belongs to it. The chart
 * language wants one with the other: a mean goes with ±1 sd, a median with P25–P75. The values come
 * from the warehouse (REQ-058); the statistic says which fields belong to it and how to read them.
 * Every time-axis chart uses one of these, so this lives in one place (REQ-024, REQ-025).
 */
export abstract class Statistic {
  abstract readonly id: 'mean' | 'median' | 'sum';
  /** What kind of number it gives, which decides the shape of its point. */
  abstract readonly kind: Kind;
  /** Whether it has a spread at all; a total has none. */
  readonly hasSpread: boolean = true;
  /** The fields of a block that carry the spread. */
  abstract readonly spreadFields: readonly (keyof BlockRow)[];
  /** The tolerated deviation when the spread is left out. */
  abstract readonly withoutSpreadCode: string;
  abstract readonly description: string;
  /** Below this n a point rests on few observations (REQ-044); null for a statistic without n. */
  abstract readonly fewBelow: number | null;

  /** The fields of a block for this statistic, in the contract. */
  abstract pointProperties(): Record<string, object>;

  /** Centre, spread and n of a block, or null when the block has no value. */
  abstract read(row: BlockRow): Summary | null;

  /** Whether the block carries (part of) its spread. */
  hasSpreadIn(row: BlockRow): boolean {
    return this.spreadFields.some((field) => row[field] !== undefined);
  }

  /** What the schema cannot check, such as P25 ≤ median ≤ P75. */
  checkRow(_row: BlockRow, _pointer: string): IssueSpec[] {
    return [];
  }

  /** The shape of the point: a diamond for a mean (REQ-006), a dot for a median (REQ-008), a square for a total (REQ-007). */
  get shape(): Shape {
    return SHAPES[this.kind];
  }

  /** Width of the spread bar in pixels: a thin bar for a mean, a wide rounded one for a median. */
  abstract barWidth(tokens: Tokens): number;

  /** "43,7 ± 12,2" or "44,0, P25–P75 38,0–51,0", for hover labels and descriptions. */
  abstract formatStats(t: Translator, format: Intl.NumberFormat, summary: Summary): string;

  /** The spread on its own line on hover: "±1 sd: 12,2" or "P25–P75: 38,0–51,0"; null without spread. */
  abstract spreadLine(t: Translator, format: Intl.NumberFormat, summary: Summary): string | null;

  /** The spread as a detail next to the last value: "± 12,2" or "38,0–51,0". */
  abstract formatDetail(format: Intl.NumberFormat, summary: Summary): string;
}

export class Average extends Statistic {
  readonly id = 'mean';
  readonly kind = 'mean';
  readonly spreadFields = ['sd'] as const;
  readonly withoutSpreadCode = 'meanWithoutSpread';
  readonly description = 'Per block mean (a diamond) with sd, the sample standard deviation (a thin bar of ±1 sd), and n.';
  readonly fewBelow = 30;

  pointProperties(): Record<string, object> {
    return {
      mean: { ...VALUE, description: 'The mean of the block; null when the block has no data.' },
      sd: { description: 'Sample standard deviation (n − 1, like STDDEV in BigQuery).', type: 'number', minimum: 0 },
      n: N,
    };
  }

  read({ mean, sd, n }: BlockRow): Summary | null {
    if (typeof mean !== 'number') return null;
    return { centre: mean, spread: sd === undefined ? null : { lo: mean - sd, hi: mean + sd }, ...(n === undefined ? {} : { n }) };
  }

  barWidth(tokens: Tokens): number {
    return tokens.stroke.spread;
  }

  formatStats(t: Translator, format: Intl.NumberFormat, { centre, spread }: Summary): string {
    if (!spread) return t('chart.stats.noSpread', { value: format.format(centre) });
    return t('chart.stats.mean', { value: format.format(centre), sd: format.format(spread.hi - centre) });
  }

  spreadLine(t: Translator, format: Intl.NumberFormat, { centre, spread }: Summary): string | null {
    return spread ? t('hover.spread.mean', { sd: format.format(spread.hi - centre) }) : null;
  }

  formatDetail(format: Intl.NumberFormat, { centre, spread }: Summary): string {
    return spread ? `± ${format.format(spread.hi - centre)}` : '';
  }
}

export class Median extends Statistic {
  readonly id = 'median';
  readonly kind = 'median';
  readonly spreadFields = ['p25', 'p75'] as const;
  readonly withoutSpreadCode = 'medianWithoutSpread';
  readonly description = 'Per block median (a dot) with p25 and p75 (a wide rounded bar), and n.';
  readonly fewBelow = 10;

  pointProperties(): Record<string, object> {
    return {
      median: { ...VALUE, description: 'The median of the block; null when the block has no data.' },
      p25: { description: '25th percentile (like PERCENTILE_CONT in BigQuery).', type: 'number', minimum: 0 },
      p75: { description: '75th percentile.', type: 'number', minimum: 0 },
      n: N,
    };
  }

  read({ median, p25, p75, n }: BlockRow): Summary | null {
    if (typeof median !== 'number') return null;
    const spread = p25 === undefined || p75 === undefined ? null : { lo: p25, hi: p75 };
    return { centre: median, spread, ...(n === undefined ? {} : { n }) };
  }

  /** P25 and P75 come together, around the median. */
  override checkRow({ median, p25, p75 }: BlockRow, pointer: string): IssueSpec[] {
    if ((p25 === undefined) !== (p75 === undefined)) {
      return [{ level: 'inputError', code: 'spreadPartial', field: `${pointer}/${p25 === undefined ? 'p25' : 'p75'}` }];
    }
    if (typeof median === 'number' && p25 !== undefined && p75 !== undefined && !(p25 <= median && median <= p75)) {
      return [{ level: 'inputError', code: 'spreadOrder', field: pointer }];
    }
    return [];
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

  spreadLine(t: Translator, format: Intl.NumberFormat, { spread }: Summary): string | null {
    return spread ? t('hover.spread.median', { p25: format.format(spread.lo), p75: format.format(spread.hi) }) : null;
  }

  formatDetail(format: Intl.NumberFormat, { spread }: Summary): string {
    return spread ? `${format.format(spread.lo)}–${format.format(spread.hi)}` : '';
  }
}

/** The total per block: an amount (volume), drawn as a square, without spread and without n (REQ-043). */
export class Sum extends Statistic {
  readonly id = 'sum';
  readonly kind = 'amount';
  override readonly hasSpread = false;
  readonly spreadFields = [] as const;
  readonly withoutSpreadCode = 'none';
  readonly description = 'Per block total (a square, an amount, without spread).';
  readonly fewBelow = null;

  pointProperties(): Record<string, object> {
    return { sum: { ...VALUE, description: 'The total of the block; null when the block has no data.' } };
  }

  read({ sum }: BlockRow): Summary | null {
    return typeof sum === 'number' ? { centre: sum, spread: null } : null;
  }

  barWidth(): number {
    return 0;
  }

  formatStats(t: Translator, format: Intl.NumberFormat, { centre }: Summary): string {
    return t('chart.stats.noSpread', { value: format.format(centre) });
  }

  spreadLine(): string | null {
    return null;
  }

  formatDetail(): string {
    return '';
  }
}
