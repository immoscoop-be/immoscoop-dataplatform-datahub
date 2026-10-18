import { decimalsOf } from './scales.ts';

/** The unit of a metric around its numbers, e.g. "€ " before or " d" after. */
export interface ValueUnit {
  prefix?: string;
  suffix?: string;
}

export const UNIT_SCHEMA = {
  description: 'The unit around every number of the metric, e.g. { "prefix": "€ " } or { "suffix": " d" }.',
  type: 'object',
  additionalProperties: false,
  properties: {
    prefix: { type: 'string', minLength: 1, maxLength: 6 },
    suffix: { type: 'string', minLength: 1, maxLength: 6 },
  },
};

/**
 * Numbers as Figma writes them on bar charts and distributions: compact once the axis reaches a
 * thousand ("1,8k", "€ 390k"), a million ("€ 1,2M"), in the unit of the metric ("45 d"). A value
 * below ten thousands keeps one decimal ("0,6k"); the axis takes the decimals of its step ("0,5k").
 * Zero keeps the prefix but not the rest ("€ 0", "0").
 */
export class CompactFormat {
  readonly divisor: number;
  private readonly letter: string;
  private readonly locale: string;
  private readonly unit: ValueUnit;
  private readonly reach: number;
  private readonly fixed: number | undefined;

  /** `reach` is the highest value on the axis; `fixed` gives every value the same number of decimals. */
  constructor(locale: string, reach: number, unit: ValueUnit = {}, fixed?: number) {
    this.locale = locale;
    this.unit = unit;
    this.reach = reach;
    this.fixed = fixed;
    [this.divisor, this.letter] = reach >= 1e6 ? [1e6, 'M'] : reach >= 1e3 ? [1e3, 'k'] : [1, ''];
  }

  /** A value next to its shape or on hover. */
  value(value: number): string {
    return this.write(value, this.digits(value));
  }

  /** The labels of the axis, all with the decimals of the step between the ticks. */
  ticks(ticks: readonly number[]): Record<string, string> {
    const step = ticks.length > 1 ? ticks[1]! - ticks[0]! : 1;
    const digits = decimalsOf(step / this.divisor);
    return Object.fromEntries(ticks.map((tick) => [String(tick), this.write(tick, digits)]));
  }

  /**
   * The spread after the value, as in Figma: without a currency in front, with a unit behind:
   * "300–510k", "25–60 d".
   */
  range(lo: number, hi: number): string {
    return `${this.number(lo / this.divisor, this.digits(hi))}–${this.number(hi / this.divisor, this.digits(hi))}${this.letter}${this.unit.suffix ?? ''}`;
  }

  /** "± 170k", "± 28 d". */
  plusMinus(value: number): string {
    return `± ${this.number(value / this.divisor, this.digits(value))}${this.letter}${this.unit.suffix ?? ''}`;
  }

  /**
   * A difference under its value, as in Figma's comparison bar: an arrow, no currency in front, the
   * precision of the axis, and more decimals only when the first digit needs them: "▲ 0,2k",
   * "▼ 0,08k", "▲ 3k". No change is "= 0".
   */
  difference(value: number): string {
    return value === 0 ? `= 0${this.unit.suffix ?? ''}` : `${value > 0 ? '▲' : '▼'} ${this.size(value)}`;
  }

  /** The same with a sign instead of an arrow, against a plan: "−0,5k", "+0,04k", "0". */
  signed(value: number): string {
    return value === 0 ? `0${this.unit.suffix ?? ''}` : `${value > 0 ? '+' : '−'}${this.size(value)}`;
  }

  private size(value: number): string {
    const scaled = Math.abs(value) / this.divisor;
    const axis = this.divisor > 1 && this.reach / this.divisor < 10 ? 1 : 0;
    const first = Math.max(0, -Math.floor(Math.log10(scaled)));
    return `${this.number(scaled, Math.max(this.fixed ?? axis, first))}${this.letter}${this.unit.suffix ?? ''}`;
  }

  private digits(value: number): number {
    if (this.fixed !== undefined) return this.fixed;
    const scaled = value / this.divisor;
    return this.divisor > 1 ? (Math.abs(scaled) < 10 ? 1 : 0) : Number.isInteger(value) ? 0 : 1;
  }

  private write(value: number, digits: number): string {
    const prefix = this.unit.prefix ?? '';
    if (value === 0) return `${prefix}0`;
    return `${prefix}${this.number(value / this.divisor, digits)}${this.letter}${this.unit.suffix ?? ''}`;
  }

  private number(value: number, digits: number): string {
    // The real minus sign, as on the other axes.
    return new Intl.NumberFormat(this.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value).replace('-', '−');
  }
}
