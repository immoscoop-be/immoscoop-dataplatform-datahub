import { localizeDay, localizeRange } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { ticksEvery } from './scales.ts';
import { LEARNING_PLAN_LEVEL_1, MAX_TICKS, TimeAxisChart, type LabelContext, type Slot, type TimeAxisComputed, type TimeAxisRequest } from './time-axis-chart.ts';
import type { ValuesMode } from './value-labels.ts';

export interface MovingWindowRequest extends TimeAxisRequest {
  window: number;
}

/**
 * Rolling windows as blocks of time that do not overlap (REQ-029): every point is one window, on a
 * relative axis in steps of the window (−42d … nu). The last window ends on the last complete day,
 * so a window is always complete and never running. A window of one day shows the daily values
 * (REQ-031).
 */
export abstract class MovingWindowChart extends TimeAxisChart<MovingWindowRequest> {
  protected readonly periodDescription =
    'Rolling windows of days as blocks that do not overlap, one point per window, on a relative time axis that ends at the last complete day.';
  protected readonly defaultValues: ValuesMode = 'last';

  protected periodSchema() {
    return {
      required: ['window'],
      properties: {
        window: {
          description: 'Length of the rolling window in days: 1 for the daily values, or a multiple of 7 (another length is a tolerated deviation).',
          type: 'integer',
          minimum: 1,
          maximum: 364,
        },
        horizon: {
          description: 'Number of windows (points) on the relative axis, the last one ending at the last complete day.',
          type: 'integer',
          minimum: 2,
          maximum: 730,
        },
      },
    };
  }

  /** Blocks that do not overlap: window `rel` ends `rel` windows before the last complete day. */
  protected slots(reference: number, { window, horizon }: MovingWindowRequest): Slot[] {
    return Array.from({ length: horizon }, (_, index) => {
      const rel = index - (horizon - 1);
      const last = reference + rel * window;
      return { rel, first: last - window + 1, last, fullLast: last, running: false };
    });
  }

  protected tickStep({ window }: MovingWindowRequest, slots: number): number {
    return relativeTickStep(slots, window);
  }

  protected tickLabel(slot: Slot, { t, computed }: LabelContext): string[] {
    return [relativeLabel(slot.last - computed.reference, t, computed)];
  }

  protected slotLabel(slot: Slot, { t, computed }: LabelContext): string {
    const day = localizeDay(t, slot.last, 'short');
    const days = slot.last - computed.reference;
    return days === 0 && !computed.referenceIsYesterday ? day : `${day} (${relativeLabel(days, t, computed)})`;
  }

  protected override slotExtras(slot: Slot, { t }: LabelContext, { window }: MovingWindowRequest): string[] {
    return window === 1 ? [] : [t('chart.window', { range: localizeRange(t, slot.first, slot.last) })];
  }

  /** One day has no spread: it is the value of that day (REQ-031). */
  protected override spreadApplies({ window }: MovingWindowRequest): boolean {
    return window > 1;
  }

  protected periodCue({ window }: MovingWindowRequest, t: Translator): string {
    return window === 1 ? t('cue.rolling.daily') : t(`cue.rolling.${this.statistic.id}`, { window });
  }

  protected centreLabel({ window }: MovingWindowRequest, t: Translator): string {
    return window === 1 ? t('hover.centre.rolling.daily') : t(`hover.centre.rolling.${this.statistic.id}`, { window });
  }

  protected periodNoun({ window }: MovingWindowRequest): IssueParam {
    return window === 1 ? { t: 'period.day' } : { t: 'period.window', params: { window } };
  }

  /** The windows before the screen: as many days back as the screen shows (REQ-037). */
  protected previousSpan(slots: Slot[], { window, horizon }: MovingWindowRequest): Slot[] {
    const days = window * horizon;
    return slots.map((slot) => ({ ...slot, first: slot.first - days, last: slot.last - days, fullLast: slot.fullLast - days, running: false }));
  }

  /** "vorig jaar" for 364 days, "vorige 7 weken" for 49, "vorige 10 dagen" otherwise. */
  protected comparisonLabel({ window, horizon }: MovingWindowRequest, t: Translator): string {
    const days = window * horizon;
    if (days % 364 === 0) return days === 364 ? t('comparison.year') : t('comparison.years', { n: days / 364 });
    if (days % 7 === 0) return t('comparison.weeks', { n: days / 7 });
    return t('comparison.days', { n: days });
  }

  protected noPointIssue({ window }: MovingWindowRequest): IssueSpec {
    return { level: 'refusal', code: 'noCompleteWindow', field: '/data', params: { window } };
  }

  /**
   * A window in multiples of 7 counts every weekday equally often, and a window of one day is the
   * daily value (REQ-031); anything else is a tolerated deviation.
   */
  protected override periodRules({ window }: MovingWindowRequest): IssueSpec[] {
    if (window === 1 || window % 7 === 0) return [];
    return [{ level: 'deviation', code: 'windowNotMultipleOf7', field: '/window', params: { window }, learnMore: LEARNING_PLAN_LEVEL_1 }];
  }
}

/**
 * A label for every window, or for every 2, 4, 13, 26 or 52 windows when that would give more than
 * eight labels. Daily values are labelled per week once they do not all fit.
 */
function relativeTickStep(windows: number, window: number): number {
  const base = window === 1 && windows > MAX_TICKS ? 7 : 1;
  const count = (step: number) => Math.floor((windows - 1) / step) + 1;
  return [1, 2, 4, 13, 26, 52].map((multiple) => multiple * base).find((step) => count(step) <= MAX_TICKS) ?? 52 * base;
}

/** The labelled windows, as positions on the axis (0 is the last window). */
export function relativeTicks(windows: number, window: number): number[] {
  return ticksEvery(relativeTickStep(windows, window), windows);
}

/** "−7d"; for the last window "nu" when it ends yesterday (REQ-030), and its date otherwise. */
function relativeLabel(days: number, t: Translator, computed: TimeAxisComputed): string {
  if (days !== 0) return t('axis.daysAgo', { n: -days });
  return computed.referenceIsYesterday ? t('axis.now') : localizeDay(t, computed.reference, 'short');
}
