import { localizeDay, localizeRange } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { ticksEvery } from './scales.ts';
import { LEARNING_PLAN_LEVEL_1, MAX_TICKS, TimeAxisChart, type LabelContext, type Slot, type TimeAxisComputed, type TimeAxisRequest } from './time-axis-chart.ts';

export interface MovingWindowRequest extends TimeAxisRequest {
  window: number;
}

/**
 * A rolling window: one slot per day on a relative axis (−21d … today), each summarizing the
 * `window` days that end on it. Windows always end on a complete day, so nothing is running.
 */
export abstract class MovingWindowChart extends TimeAxisChart<MovingWindowRequest> {
  protected readonly periodDescription =
    'A rolling window of days, per day on a relative time axis that ends at the last complete day.';

  protected periodSchema() {
    return {
      required: ['window'],
      properties: {
        window: {
          description: 'Length of the rolling window in days. The chart language uses multiples of 7.',
          type: 'integer',
          minimum: 2,
          maximum: 364,
        },
        horizon: {
          description: 'Number of days on the relative axis, ending at the last complete day.',
          type: 'integer',
          minimum: 2,
          maximum: 728,
        },
      },
    };
  }

  protected slots(reference: number, { window, horizon }: MovingWindowRequest): Slot[] {
    return Array.from({ length: horizon }, (_, index) => {
      const rel = index - (horizon - 1);
      const last = reference + rel;
      return { rel, first: last - window + 1, last, fullLast: last, running: false };
    });
  }

  protected tickStep({ window }: MovingWindowRequest, slots: number): number {
    return relativeTickStep(slots, window);
  }

  protected tickLabel(slot: Slot, { t, computed }: LabelContext): string {
    return relativeLabel(slot.rel, t, computed);
  }

  protected slotLabel(slot: Slot, { t, computed }: LabelContext): string {
    const day = localizeDay(t, slot.last, 'short');
    return slot.rel === 0 && !computed.referenceIsYesterday ? day : `${day} (${relativeLabel(slot.rel, t, computed)})`;
  }

  protected override slotExtras(slot: Slot, { t }: LabelContext): string[] {
    return [t('chart.window', { range: localizeRange(t, slot.first, slot.last) })];
  }

  protected periodCue({ window }: MovingWindowRequest, t: Translator): string {
    return t(`cue.rolling.${this.statistic.id}`, { window });
  }

  protected centreLabel({ window }: MovingWindowRequest, t: Translator): string {
    return t(`hover.centre.rolling.${this.statistic.id}`, { window });
  }

  protected periodNoun({ window }: MovingWindowRequest): IssueParam {
    return { t: 'period.window', params: { window } };
  }

  protected noPointIssue({ window }: MovingWindowRequest): IssueSpec {
    return { level: 'refusal', code: 'noCompleteWindow', field: '/data', params: { window } };
  }

  /** A window in multiples of 7 counts every weekday equally often; anything else is a tolerated deviation. */
  protected override periodRules({ window }: MovingWindowRequest): IssueSpec[] {
    if (window % 7 === 0) return [];
    return [{ level: 'deviation', code: 'windowNotMultipleOf7', field: '/window', params: { window }, learnMore: LEARNING_PLAN_LEVEL_1 }];
  }
}

/**
 * Steps of the window (7 when the horizon is shorter than two windows), times 2, 4, 13, 26 or 52
 * when that would give more than eight labels.
 */
function relativeTickStep(horizon: number, window: number): number {
  const base = horizon >= 2 * window ? window : 7;
  const count = (step: number) => Math.floor((horizon - 1) / step) + 1;
  return [1, 2, 4, 13, 26, 52].map((multiple) => multiple * base).find((step) => count(step) <= MAX_TICKS) ?? 52 * base;
}

export function relativeTicks(horizon: number, window: number): number[] {
  return ticksEvery(relativeTickStep(horizon, window), horizon);
}

/** "−7d", or for 0 "today" when the reference day is yesterday and the date otherwise. */
function relativeLabel(rel: number, t: Translator, computed: TimeAxisComputed): string {
  if (rel !== 0) return t('axis.daysAgo', { n: -rel });
  return computed.referenceIsYesterday ? t('axis.today') : localizeDay(t, computed.reference, 'short');
}
