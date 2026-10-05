import { localizeDay, localizeRange, parseDay } from '../core/days.ts';
import type { Translator } from '../core/i18n.ts';
import type { IssueParam, IssueSpec } from '../core/issues.ts';
import { ticksEvery } from './scales.ts';
import { LEARNING_PLAN_LEVEL_1 } from './measure.ts';
import { sizeOf } from '../core/size.ts';
import { MAX_TICKS, maxTicks, TimeAxisChart, type LabelContext, type Slot, type TimeAxisComputed, type TimeAxisRequest } from './time-axis-chart.ts';
import type { ValuesMode } from './value-labels.ts';

export interface MovingWindowRequest extends TimeAxisRequest {
  window: number;
}

/**
 * Rolling windows as blocks of time that do not overlap (REQ-029): every point is one window, on a
 * relative axis in steps of the window (−42d … nu). A window is named after its last day (REQ-062)
 * and is always complete, never running. A window of one day shows the daily values (REQ-031).
 */
export abstract class MovingWindowChart extends TimeAxisChart<MovingWindowRequest> {
  protected readonly periodDescription =
    'Rolling windows of days as blocks that do not overlap, one row per window named after its last day, on a relative time axis.';
  protected readonly defaultValues: ValuesMode = 'last';
  protected readonly blockField = 'end';
  protected readonly mayRun = false;

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
      },
      blockName: { description: 'The last day of the window. Windows follow each other without overlap: their ends lie a whole number of windows apart.', type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' },
    };
  }

  protected blockKey(name: string): number | undefined {
    return parseDay(name);
  }

  protected slotKey(slot: Slot): number {
    return slot.last;
  }

  protected invalidBlock(name: string, pointer: string): IssueSpec {
    return { level: 'inputError', code: 'invalidDate', field: pointer, params: { value: name } };
  }

  /** Windows touch but never overlap (REQ-029): their ends lie a whole number of windows apart. */
  protected override blockChecks(keys: { key: number; pointer: string; name: string }[], { window }: MovingWindowRequest): IssueSpec[] {
    const first = Math.min(...keys.map(({ key }) => key));
    const off = keys.find(({ key }) => (key - first) % window !== 0);
    return off ? [{ level: 'inputError', code: 'windowsNotAligned', field: off.pointer, params: { block: off.name, window } }] : [];
  }

  /** Every window from the first end to the last, in steps of the window. */
  protected slotsBetween(first: number, last: number, _asOf: number, { window }: MovingWindowRequest): Slot[] {
    const count = (last - first) / window + 1;
    return Array.from({ length: count }, (_, index) => {
      const end = first + index * window;
      return { rel: index - (count - 1), first: end - window + 1, last: end, fullLast: end, running: false };
    });
  }

  protected slotCount(first: number, last: number, { window }: MovingWindowRequest): number {
    return Math.floor((last - first) / window) + 1;
  }

  protected tickStep(request: MovingWindowRequest, slots: number): number {
    return relativeTickStep(slots, request.window, maxTicks(sizeOf(request).layout));
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

  protected blockSingular({ window }: MovingWindowRequest, t: Translator): string {
    return window === 1 ? t('blocks.oneDay') : t('blocks.oneWindow', { window });
  }

  protected blockNoun({ window }: MovingWindowRequest): IssueParam {
    return { t: window === 1 ? 'blocks.day' : 'blocks.window' };
  }

  /** The windows before the screen: as many days back as the screen shows (REQ-037). */
  protected previousSpan(slots: Slot[], { window }: MovingWindowRequest): Slot[] {
    const days = window * slots.length;
    return slots.map((slot) => ({ ...slot, first: slot.first - days, last: slot.last - days, fullLast: slot.fullLast - days, running: false }));
  }

  /** "vorig jaar" for 364 days, "vorige 7 weken" for 49, "vorige 10 dagen" otherwise. */
  protected comparisonLabel({ window }: MovingWindowRequest, t: Translator, blocks: number): string {
    const days = window * blocks;
    if (days % 364 === 0) return days === 364 ? t('comparison.year') : t('comparison.years', { n: days / 364 });
    if (days % 7 === 0) return t('comparison.weeks', { n: days / 7 });
    return t('comparison.days', { n: days });
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
function relativeTickStep(windows: number, window: number, most = MAX_TICKS): number {
  const base = window === 1 && windows > most ? 7 : 1;
  const count = (step: number) => Math.floor((windows - 1) / step) + 1;
  return [1, 2, 4, 13, 26, 52].map((multiple) => multiple * base).find((step) => count(step) <= most) ?? 52 * base;
}

/** The labelled windows, as positions on the axis (0 is the last window). */
export function relativeTicks(windows: number, window: number, most = MAX_TICKS): number[] {
  return ticksEvery(relativeTickStep(windows, window, most), windows);
}

/** "−7d"; for the last window "nu" when it ends yesterday (REQ-030), and its date otherwise. */
function relativeLabel(days: number, t: Translator, computed: TimeAxisComputed): string {
  if (days !== 0) return t('axis.daysAgo', { n: -days });
  return computed.referenceIsYesterday ? t('axis.now') : localizeDay(t, computed.reference, 'short');
}
