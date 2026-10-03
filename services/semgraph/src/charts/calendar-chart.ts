import { localizeRange } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { CALENDAR_UNITS, isoWeek, parts, periodStart, shiftPeriod, type CalendarUnit } from './calendar.ts';
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
 * Calendar periods: ISO weeks (Monday to Sunday), months, quarters or years, ending with the
 * period that contains the last complete day. When that period is not over yet, it is running: its
 * value covers the days so far and is drawn hollow, because it is not final (REQ-023).
 */
export abstract class CalendarChart extends TimeAxisChart<CalendarRequest> {
  protected readonly periodDescription =
    'Calendar periods (ISO weeks, months, quarters or years), ending with the period of the last complete day; a period that is still running is drawn hollow.';
  protected readonly defaultValues: ValuesMode = 'lastAndPrevious';

  protected periodSchema() {
    return {
      required: ['unit'],
      properties: {
        unit: {
          description: 'The calendar period: week (ISO, Monday to Sunday), month, quarter or year.',
          enum: [...CALENDAR_UNITS],
        },
        horizon: {
          description: 'Number of periods shown, ending with the period of the last complete day.',
          type: 'integer',
          minimum: 2,
          maximum: 120,
        },
      },
    };
  }

  protected slots(reference: number, { unit, horizon }: CalendarRequest): Slot[] {
    const current = periodStart(reference, unit);
    return Array.from({ length: horizon }, (_, index) => {
      const rel = index - (horizon - 1);
      const first = shiftPeriod(current, unit, rel);
      const fullLast = shiftPeriod(first, unit, 1) - 1;
      return { rel, first, last: Math.min(fullLast, reference), fullLast, running: fullLast > reference };
    });
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

  protected periodCue({ unit }: CalendarRequest, t: Translator): string {
    return t(`cue.calendar.${this.statistic.id}`, { unit: t(`calendar.unit.${unit}`) });
  }

  protected centreLabel(_request: CalendarRequest, t: Translator): string {
    return t(`hover.centre.calendar.${this.statistic.id}`);
  }

  protected periodNoun({ unit }: CalendarRequest): IssueParam {
    return { t: `period.${unit}` };
  }

  /**
   * The periods before the screen: as many periods back as the screen shows (REQ-037). A running
   * period is compared with as many days of the earlier period, so a week that has run three days
   * is compared with the first three days of its week.
   */
  protected previousSpan(slots: Slot[], { unit, horizon }: CalendarRequest): Slot[] {
    return slots.map((slot) => {
      const first = shiftPeriod(slot.first, unit, -horizon);
      const fullLast = shiftPeriod(first, unit, 1) - 1;
      const last = slot.running ? Math.min(fullLast, first + (slot.last - slot.first)) : fullLast;
      return { rel: slot.rel, first, last, fullLast, running: false };
    });
  }

  /** "vorig jaar" for 12 months, "vorige 12 weken", "vorige 6 maanden", ... */
  protected comparisonLabel({ unit, horizon }: CalendarRequest, t: Translator): string {
    if (horizon % PER_YEAR[unit] === 0) {
      const years = horizon / PER_YEAR[unit];
      return years === 1 ? t('comparison.year') : t('comparison.years', { n: years });
    }
    return t(`comparison.${unit}s`, { n: horizon });
  }

  protected noPointIssue({ unit }: CalendarRequest): IssueSpec {
    return {
      level: 'refusal',
      code: 'noCompletePeriod',
      field: '/data',
      params: { unit: { t: `calendar.unit.${unit}` }, none: { t: `calendar.none.${unit}` } },
    };
  }
}
