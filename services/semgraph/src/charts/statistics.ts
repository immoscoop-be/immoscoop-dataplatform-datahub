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
  /** A ratio: its numerator and denominator, as the warehouse delivered them (REQ-076). */
  parts?: { numerator: number; denominator: number };
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
  /** A ratio: the numerator and the denominator of the block (REQ-076). */
  numerator?: number | null;
  denominator?: number | null;
  /** periodComparison: the value of the block just before the screen at this position. */
  previous?: Partial<Record<'mean' | 'median' | 'sum' | 'ratio', number | null>> | null;
}

/** Writes a number: an Intl.NumberFormat, or the compact format of the bar charts. */
export interface NumberFormatter {
  format(value: number): string;
}

/** Every field a statistic may carry in a block; the fields of the others do not belong in it. */
export const STATISTIC_FIELDS = ['mean', 'sd', 'median', 'p25', 'p75', 'sum', 'n', 'numerator', 'denominator'] as const;

const VALUE = { type: ['number', 'null'], minimum: 0 };
const N = { description: 'Number of observations behind the value, as counted where the value is computed (REQ-043).', type: 'integer', minimum: 1 };

/**
 * The statistic a chart shows per block: a centre and the spread that belongs to it. The chart
 * language wants one with the other: a mean goes with ±1 sd, a median with P25–P75. The values come
 * from the warehouse (REQ-058); the statistic says which fields belong to it and how to read them.
 * Every time-axis chart uses one of these, so this lives in one place (REQ-024, REQ-025).
 */
export abstract class Statistic {
  abstract readonly id: 'mean' | 'median' | 'sum' | 'ratio';
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

  /** The fields every block carries (null for a block without data). */
  get required(): string[] {
    return [this.id];
  }

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

  /**
   * The checks on the fields of every row, for every family: only the fields of this statistic (a
   * contract may accept the fields of several), what the schema cannot check, and a spread on every
   * row with a value or on none, because half a band would say nothing.
   */
  checkFields(rows: readonly BlockRow[], path = '/points'): IssueSpec[] {
    const issues: IssueSpec[] = [];
    const own = new Set<string>(Object.keys(this.pointProperties()));
    rows.forEach((row, index) => {
      const pointer = `${path}/${index}`;
      for (const field of STATISTIC_FIELDS) {
        if (row[field] !== undefined && !own.has(field)) {
          issues.push({ level: 'inputError', code: 'fieldNotForStatistic', field: `${pointer}/${field}`, params: { statistic: this.id } });
        }
      }
      issues.push(...this.checkRow(row, pointer));
    });
    if (this.hasSpread) {
      const withValue = rows.map((row, index) => ({ row, index })).filter(({ row }) => this.read(row) !== null);
      const withSpread = withValue.filter(({ row }) => this.hasSpreadIn(row));
      if (withSpread.length > 0 && withSpread.length < withValue.length) {
        const first = withValue.find(({ row }) => !this.hasSpreadIn(row))!;
        issues.push({ level: 'inputError', code: 'spreadIncomplete', field: `${path}/${first.index}`, params: { statistic: this.id } });
      }
    }
    return issues;
  }

  /**
   * Whether n counts observations (REQ-057, REQ-063, REQ-070): for a mean or median per unit, such as
   * an amount per lead. An average per day of a count rests on the days of its block.
   */
  countsObservations(measureType: string): boolean {
    return measureType === 'perUnit' && this.fewBelow !== null;
  }

  /** Whether every block should carry n (REQ-062): where n counts observations. */
  wantsN(measureType: string): boolean {
    return this.countsObservations(measureType);
  }

  /** How a value is written next to its point and on hover: whole numbers stay whole, otherwise one decimal below 100. */
  valueFormat(locale: string, highest: number, whole: boolean): NumberFormatter {
    return numberFormatter(locale, highest >= 100 || whole ? 0 : 1);
  }

  /** The labels of the value axis, with the decimals of the step between the ticks. */
  tickLabels(locale: string, ticks: readonly number[]): Record<string, string> {
    const format = numberFormatter(locale, decimals(ticks[1]! - ticks[0]!));
    return Object.fromEntries(ticks.map((tick) => [String(tick), format.format(tick)]));
  }

  /**
   * The points that rest on few observations (REQ-044): n below the threshold of the statistic, or
   * below half the usual n. On a time axis the usual n is the mean of the period before and after
   * (REQ-081), so a trend does not trigger it; between categories, which have no neighbours, it is the
   * median of all n's, once there are five. Never a running period (REQ-054).
   */
  fewObservations<Point extends { key: number; n?: number; running?: boolean }>(points: readonly Point[], relative: 'neighbours' | 'median' = 'neighbours'): number[] {
    if (this.fewBelow === null) return [];
    const counted = points.flatMap((point) => (point.n === undefined ? [] : [point.n]));
    const byKey = new Map(points.map((point) => [point.key, point]));
    const usual = (point: Point) =>
      relative === 'neighbours' ? neighbourMean(byKey, point.key, (other) => other.n) : counted.length >= 5 ? median(counted) : undefined;
    return points
      .filter((point) => {
        if (point.n === undefined || point.running) return false;
        const around = usual(point);
        return point.n < this.fewBelow! || (around !== undefined && point.n < around / 2);
      })
      .map((point) => point.key);
  }

  /** The shape of the point: a diamond for a mean (REQ-006), a dot for a median (REQ-008), a square for a total (REQ-007). */
  get shape(): Shape {
    return SHAPES[this.kind];
  }

  /** Width of the spread bar in pixels: a thin bar for a mean, a wide rounded one for a median. */
  abstract barWidth(tokens: Tokens): number;

  /** "43,7 ± 12,2" or "44,0, P25–P75 38,0–51,0", for hover labels and descriptions. */
  abstract formatStats(t: Translator, format: NumberFormatter, summary: Summary): string;

  /** The spread on its own line on hover: "±1 sd: 12,2" or "P25–P75: 38,0–51,0"; null without spread. */
  abstract spreadLine(t: Translator, format: NumberFormatter, summary: Summary): string | null;

  /** The spread as a detail next to the last value: "± 12,2" or "38,0–51,0". */
  abstract formatDetail(format: NumberFormatter, summary: Summary, locale: string): string;
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

  formatStats(t: Translator, format: NumberFormatter, { centre, spread }: Summary): string {
    if (!spread) return t('chart.stats.noSpread', { value: format.format(centre) });
    return t('chart.stats.mean', { value: format.format(centre), sd: format.format(spread.hi - centre) });
  }

  spreadLine(t: Translator, format: NumberFormatter, { centre, spread }: Summary): string | null {
    return spread ? t('hover.spread.mean', { sd: format.format(spread.hi - centre) }) : null;
  }

  formatDetail(format: NumberFormatter, { centre, spread }: Summary): string {
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

  formatStats(t: Translator, format: NumberFormatter, { centre, spread }: Summary): string {
    if (!spread) return t('chart.stats.noSpread', { value: format.format(centre) });
    return t('chart.stats.median', {
      value: format.format(centre),
      p25: format.format(spread.lo),
      p75: format.format(spread.hi),
    });
  }

  spreadLine(t: Translator, format: NumberFormatter, { spread }: Summary): string | null {
    return spread ? t('hover.spread.median', { p25: format.format(spread.lo), p75: format.format(spread.hi) }) : null;
  }

  formatDetail(format: NumberFormatter, { spread }: Summary): string {
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

  formatStats(t: Translator, format: NumberFormatter, { centre }: Summary): string {
    return t('chart.stats.noSpread', { value: format.format(centre) });
  }

  spreadLine(): string | null {
    return null;
  }

  formatDetail(): string {
    return '';
  }
}

/**
 * A ratio per block (REQ-074, REQ-076): the numerator divided by the denominator, both delivered by the
 * warehouse; the semgraph only divides. Its point is a square in a square, the numerator inside the
 * denominator (REQ-075). It has no spread: the denominator stands behind it as the base (REQ-076, REQ-077).
 * For now only a share, whose numerator is part of its denominator, shown as a percentage.
 */
export class Ratio extends Statistic {
  readonly id = 'ratio';
  readonly kind = 'ratio';
  override readonly hasSpread = false;
  readonly spreadFields = [] as const;
  readonly withoutSpreadCode = 'none';
  readonly description = 'Per block the numerator and the denominator of a share (a square in a square), as the warehouse counted them; the chart only divides.';
  readonly fewBelow = null;

  pointProperties(): Record<string, object> {
    return {
      numerator: { ...VALUE, description: 'The numerator of the block, such as the leads; null when the block has no data.' },
      denominator: { ...VALUE, description: 'The denominator of the block, such as the visitors; null when the block has no data. The numerator of a share is part of it.' },
    };
  }

  override get required(): string[] {
    return ['numerator', 'denominator'];
  }

  read({ numerator, denominator }: BlockRow): Summary | null {
    if (typeof numerator !== 'number' || typeof denominator !== 'number' || denominator <= 0) return null;
    return { centre: numerator / denominator, spread: null, parts: { numerator, denominator } };
  }

  /** A ratio rests on its own counts (REQ-080), not on an n. */
  override countsObservations(measureType: string): boolean {
    return measureType === 'ratio';
  }

  override wantsN(): boolean {
    return false;
  }

  /**
   * REQ-080: few observations for a ratio. Statistically thin: fewer than 10 in the numerator, or fewer
   * than 10 in the denominator without the numerator. An unusual base: a denominator below half the
   * mean of the period before and after. One is enough; a running period never (REQ-054).
   */
  override fewObservations<Point extends { key: number; running?: boolean }>(points: readonly Point[]): number[] {
    return [...this.fewReasons(points as never).keys()];
  }

  fewReasons<Point extends { key: number; running?: boolean; parts?: { numerator: number; denominator: number } }>(points: readonly Point[]): Map<number, 'thin' | 'base'> {
    const byKey = new Map(points.map((point) => [point.key, point]));
    const reasons = new Map<number, 'thin' | 'base'>();
    for (const point of points) {
      if (!point.parts || point.running) continue;
      const { numerator, denominator } = point.parts;
      const around = neighbourMean(byKey, point.key, (other) => other.parts?.denominator);
      if (numerator < 10 || denominator - numerator < 10) reasons.set(point.key, 'thin');
      else if (around !== undefined && denominator < around / 2) reasons.set(point.key, 'base');
    }
    return reasons;
  }

  /** A share as a percentage, with one decimal: "4,2%". */
  override valueFormat(locale: string): NumberFormatter {
    return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  override tickLabels(locale: string, ticks: readonly number[]): Record<string, string> {
    const digits = decimals((ticks[1]! - ticks[0]!) * 100);
    const format = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits });
    return Object.fromEntries(ticks.map((tick) => [String(tick), format.format(tick)]));
  }

  barWidth(): number {
    return 0;
  }

  formatStats(t: Translator, format: NumberFormatter, summary: Summary): string {
    return t('chart.stats.ratio', { value: format.format(summary.centre), parts: this.formatDetail(format, summary, t.locale) });
  }

  /** The numerator and the denominator on hover: "27 / 640". */
  spreadLine(t: Translator, format: NumberFormatter, summary: Summary): string | null {
    return this.formatDetail(format, summary, t.locale) || null;
  }

  /** The numerator is not drawn: it stands under the value, "27 / 640" (REQ-076). */
  formatDetail(_format: NumberFormatter, { parts }: Summary, locale: string): string {
    if (!parts) return '';
    const count = numberFormatter(locale, 0);
    return `${count.format(parts.numerator)} / ${count.format(parts.denominator)}`;
  }
}

/**
 * REQ-080, REQ-081: the mean of a value over the period just before and just after, as far as they
 * exist; at the edges only the neighbour there is. A running period is no neighbour: its value is not
 * complete yet.
 */
export function neighbourMean<Point extends { key: number; running?: boolean }>(
  byKey: ReadonlyMap<number, Point>,
  key: number,
  value: (point: Point) => number | undefined,
): number | undefined {
  const values = [byKey.get(key - 1), byKey.get(key + 1)].flatMap((point) => {
    const found = point && !point.running ? value(point) : undefined;
    return found === undefined ? [] : [found];
  });
  return values.length > 0 ? values.reduce((sum, item) => sum + item, 0) / values.length : undefined;
}

function numberFormatter(locale: string, digits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** The number of decimals a step needs: 2.5 needs one, 20 none. */
function decimals(value: number): number {
  for (let digits = 0; digits < 6; digits++) {
    const scaled = value * 10 ** digits;
    if (Math.abs(Math.round(scaled) - scaled) < 1e-6) return digits;
  }
  return 6;
}

/** The median of a list of numbers. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
