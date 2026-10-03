import { localizeRange } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { CALENDAR_UNITS, isoWeek, parts, periodStart, shiftPeriod, type CalendarUnit } from './calendar.ts';
import { TimeAxisChart, type LabelContext, type Slot, type TimeAxisRequest } from './time-axis-chart.ts';

export interface CalendarRequest extends TimeAxisRequest {
  unit: CalendarUnit;
}

/** Ticks every k periods: the first k that leaves room for each label. */
const TICK_MULTIPLES: Record<CalendarUnit, number[]> = {
  week: [1, 2, 4, 13, 26, 52],
  month: [1, 2, 3, 6, 12],
  quarter: [1, 2, 4],
  year: [1, 2, 5, 10],
};
/** Estimated width of a tick label in pixels plus some air, e.g. "W40", "sep", "K3 2026", "2026". */
const LABEL_WIDTH: Record<CalendarUnit, number> = { week: 34, month: 34, quarter: 52, year: 36 };

/**
 * Calendar periods: ISO weeks (Monday to Sunday), months, quarters or years, ending with the
 * period that contains the last complete day. When that period is not over yet, it is running: its
 * value covers the days so far and is drawn hollow, because it is not final (REQ-012).
 */
export abstract class CalendarChart extends TimeAxisChart<CalendarRequest> {
  protected readonly periodDescription =
    'Calendar periods (ISO weeks, months, quarters or years), ending with the period of the last complete day; a period that is still running is drawn hollow.';

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

  /** "W40", "sep", "K3 2026" or "2026"; the leftmost label and each new year name the year. */
  protected tickLabel(slot: Slot, { t, isFirst }: LabelContext, { unit }: CalendarRequest): string {
    const { year, month, quarter } = parts(slot.first);
    switch (unit) {
      case 'week': {
        const week = isoWeek(slot.first);
        const label = t('calendar.tick.week', { week: week.week });
        return isFirst || week.week === 1 ? t('calendar.withYear', { label, year: week.year }) : label;
      }
      case 'month': {
        const label = t(`date.month.${month}`);
        return isFirst || month === 1 ? t('calendar.withYear', { label, year }) : label;
      }
      case 'quarter':
        return t('calendar.tick.quarter', { quarter, year });
      case 'year':
        return String(year);
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

  protected noPointIssue({ unit }: CalendarRequest): IssueSpec {
    return {
      level: 'refusal',
      code: 'noCompletePeriod',
      field: '/data',
      params: { unit: { t: `calendar.unit.${unit}` }, none: { t: `calendar.none.${unit}` } },
    };
  }
}
