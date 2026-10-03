import { localizeRange } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { CALENDAR_UNITS, isoWeek, parts, periodFromName, shiftPeriod, type CalendarUnit } from './calendar.ts';
import { TimeAxisChart, type LabelContext, type Slot, type TimeAxisRequest } from './time-axis-chart.ts';
import type { ValuesMode } from './value-labels.ts';

export interface CalendarRequest extends TimeAxisRequest {
  unit: CalendarUnit;
}

/** Periods in a year, to call a comparison of whole years "vorig jaar". */
const PER_YEAR: Record<CalendarUnit, number> = { week: 52, month: 12, quarter: 4, year: 1 };

/** Ticks every k periods: the first k that leaves room for each label. */
const TICK_MULTIPLES: Record<CalendarUnit, number[]> = {
  week: [1, 2, 4, 13, 26, 52],
  month: [1, 2, 3, 6, 12],
  quarter: [1, 2, 4],
  year: [1, 2, 5, 10],
};
/** Estimated width of a tick label in pixels plus some air, e.g. "W40", "sep", "K3", "2026". */
const LABEL_WIDTH: Record<CalendarUnit, number> = { week: 34, month: 34, quarter: 30, year: 36 };

/**
 * Calendar periods: ISO weeks (Monday to Sunday), months, quarters or years, each named by its ISO
 * name (REQ-062). A period that ends after the last complete day is running: its value covers the
 * days so far and its column gets the running pattern, because it is not final (REQ-052).
 */
export abstract class CalendarChart extends TimeAxisChart<CalendarRequest> {
  protected readonly periodDescription =
    'Calendar periods (ISO weeks, months, quarters or years), one row per period named by its ISO name; a period that is still running gets the running pattern.';
  protected readonly defaultValues: ValuesMode = 'lastAndPrevious';
  protected readonly blockField = 'period';
  protected readonly mayRun = true;

  protected periodSchema() {
    return {
      required: ['unit'],
      properties: {
        unit: {
          description: 'The calendar period: week (ISO, Monday to Sunday), month, quarter or year.',
          enum: [...CALENDAR_UNITS],
        },
      },
      blockName: { description: 'The ISO name of the period: 2026-W40 (week), 2026-09 (month), 2026-Q3 (quarter) or 2026 (year).', type: 'string', pattern: '^[0-9]{4}(-W[0-9]{2}|-[0-9]{2}|-Q[1-4])?$' },
    };
  }

  protected blockKey(name: string, { unit }: CalendarRequest): number | undefined {
    return periodFromName(name, unit);
  }

  protected slotKey(slot: Slot): number {
    return slot.first;
  }

  protected invalidBlock(name: string, pointer: string, { unit }: CalendarRequest): IssueSpec {
    return { level: 'inputError', code: 'invalidPeriod', field: pointer, params: { value: name, unit: { t: `calendar.unit.${unit}` } } };
  }

  /** Every period from the first block to the last; the one that ends after the last complete day runs. */
  protected slotsBetween(first: number, last: number, asOf: number, { unit }: CalendarRequest): Slot[] {
    const slots: Omit<Slot, 'rel'>[] = [];
    for (let start = first; start <= last; start = shiftPeriod(start, unit, 1)) {
      const fullLast = shiftPeriod(start, unit, 1) - 1;
      slots.push({ first: start, last: Math.min(fullLast, asOf), fullLast, running: fullLast > asOf });
    }
    return slots.map((slot, index) => ({ ...slot, rel: index - (slots.length - 1) }));
  }

  protected slotCount(first: number, last: number, { unit }: CalendarRequest): number {
    if (unit === 'week') return (last - first) / 7 + 1;
    const [from, to] = [parts(first), parts(last)];
    const months = (to.year - from.year) * 12 + (to.month - from.month);
    return { month: months, quarter: months / 3, year: to.year - from.year }[unit] + 1;
  }

  protected tickStep({ unit }: CalendarRequest, _slots: number, slotWidth: number): number {
    const fits = (step: number) => step * slotWidth >= LABEL_WIDTH[unit];
    const multiples = TICK_MULTIPLES[unit];
    return multiples.find(fits) ?? multiples.at(-1)!;
  }

  /** "W40", "sep", "K3" or "2026"; the leftmost label and each new year name the year on a second line. */
  protected tickLabel(slot: Slot, { t, isFirst }: LabelContext, request: CalendarRequest): string[] {
    const { year, month, quarter } = parts(slot.first);
    const withYear = (label: string, labelYear: number) => (isFirst || this.startsYear(slot, request) ? [label, String(labelYear)] : [label]);
    switch (request.unit) {
      case 'week': {
        const week = isoWeek(slot.first);
        return withYear(t('calendar.tick.week', { week: week.week }), week.year);
      }
      case 'month':
        return withYear(t(`date.month.${month}`), year);
      case 'quarter':
        return withYear(t('calendar.tick.quarter', { quarter }), year);
      case 'year':
        return [String(year)];
    }
  }

  /** The first ISO week, January or the first quarter; with whole years every block is a year. */
  protected override startsYear(slot: Slot, { unit }: CalendarRequest): boolean {
    const { month, quarter } = parts(slot.first);
    switch (unit) {
      case 'week':
        return isoWeek(slot.first).week === 1;
      case 'month':
        return month === 1;
      case 'quarter':
        return quarter === 1;
      case 'year':
        return false;
    }
  }

  /** "week 39 (21–27 sep)", "sep 2026", "K3 2026 (jul–sep)" or "2026". */
  protected slotLabel(slot: Slot, { t }: LabelContext, { unit }: CalendarRequest): string {
    const { year, month, quarter } = parts(slot.first);
    switch (unit) {
      case 'week':
        return t('calendar.hover.week', { week: isoWeek(slot.first).week, range: localizeRange(t, slot.first, slot.fullLast) });
      case 'month':
        return t('calendar.hover.month', { month: t(`date.month.${month}`), year });
      case 'quarter':
        return t('calendar.hover.quarter', { quarter, year });
      case 'year':
        return String(year);
    }
  }

  /** "gemiddelde per dag, per week" for an average per day of a count; "gemiddelde per week" for a mean per unit. */
  protected periodCue({ unit, measureType }: CalendarRequest, t: Translator): string {
    const kind = measureType === 'perUnit' ? `perUnit.${this.statistic.id}` : this.statistic.id;
    return t(`cue.calendar.${kind}`, { unit: t(`calendar.unit.${unit}`) });
  }

  protected centreLabel({ measureType }: CalendarRequest, t: Translator): string {
    return t(`hover.centre.calendar.${measureType === 'perUnit' ? `perUnit.${this.statistic.id}` : this.statistic.id}`);
  }

  protected blockSingular({ unit }: CalendarRequest, t: Translator): string {
    return t(`calendar.unit.${unit}`);
  }

  protected blockNoun({ unit }: CalendarRequest): IssueParam {
    return { t: `blocks.${unit}` };
  }

  /**
   * The periods before the screen: as many periods back as the screen shows (REQ-037). A running
   * period is compared with as many days of the earlier period: the warehouse delivers that value,
   * the name says which days it covers.
   */
  protected previousSpan(slots: Slot[], { unit }: CalendarRequest): Slot[] {
    return slots.map((slot) => {
      const first = shiftPeriod(slot.first, unit, -slots.length);
      const fullLast = shiftPeriod(first, unit, 1) - 1;
      const last = slot.running ? Math.min(fullLast, first + (slot.last - slot.first)) : fullLast;
      return { rel: slot.rel, first, last, fullLast, running: false };
    });
  }

  /** "vorig jaar" for 12 months, "vorige 12 weken", "vorige 6 maanden", ... */
  protected comparisonLabel({ unit }: CalendarRequest, t: Translator, blocks: number): string {
    if (blocks % PER_YEAR[unit] === 0) {
      const years = blocks / PER_YEAR[unit];
      return years === 1 ? t('comparison.year') : t('comparison.years', { n: years });
    }
    return t(`comparison.${unit}s`, { n: blocks });
  }
}
