import { CalendarChart, type CalendarRequest } from '../../src/charts/calendar-chart.ts';
import { MovingWindowChart, type MovingWindowRequest } from '../../src/charts/moving-window-chart.ts';
import { Average, Median, Sum, type Statistic } from '../../src/charts/statistics.ts';
import type { TimeAxisComputed } from '../../src/charts/time-axis-chart.ts';
import type { IssueSpec } from '../../src/core/issues.ts';
import type { DrawContext, Drawing, SemgraphImplementation, SemgraphMetadata } from '../../src/core/semgraph.ts';

const ID = 'periodComparison';
const STATISTICS = ['sum', 'mean', 'median'] as const;
type StatisticId = (typeof STATISTICS)[number];

/** Either rolling windows (`window`) or calendar periods (`unit`), with the statistic to compare. */
export type PeriodComparisonRequest = (MovingWindowRequest | CalendarRequest) & { statistic: StatisticId; window?: number; unit?: string };

/** The spreads each statistic allows: a total has none. */
const SPREADS: Record<StatisticId, string[]> = { sum: ['none'], mean: ['stddev', 'none'], median: ['iqr', 'none'] };

const statistic = (id: StatisticId): Statistic => ({ sum: new Sum(), mean: new Average(), median: new Median() })[id];

class RollingComparison extends MovingWindowChart {
  protected override readonly compares = true;
}

class CalendarComparison extends CalendarChart {
  protected override readonly compares = true;
}

type Chart = RollingComparison | CalendarComparison;

/**
 * The current period against the period just before the screen, as long as what the screen shows:
 * what is on the screen can be compared by eye, so the chart brings in what is not (REQ-037). Both
 * lines show the same value: the total, the mean or the median (REQ-035). The time axis follows the
 * time-series rules, with rolling windows or calendar periods. One semgraph, so the request picks
 * the family and the statistic; the drawing is the shared one of the time-axis charts.
 */
export class PeriodComparison implements SemgraphImplementation<PeriodComparisonRequest, TimeAxisComputed> {
  readonly id = ID;
  private readonly rolling = Object.fromEntries(STATISTICS.map((id) => [id, new RollingComparison(ID, statistic(id))])) as Record<StatisticId, Chart>;
  private readonly calendar = Object.fromEntries(STATISTICS.map((id) => [id, new CalendarComparison(ID, statistic(id))])) as Record<StatisticId, Chart>;

  private chartFor(request: PeriodComparisonRequest): Chart {
    return (request.unit === undefined ? this.rolling : this.calendar)[request.statistic];
  }

  schema(): object {
    const rolling = this.rolling.mean.schema() as { properties: Record<string, object> };
    const calendar = this.calendar.mean.schema() as { properties: Record<string, object> };
    const { semgraph, metric, title, measureType, uniqueAggregation, valueAxis, format, locale, context, meta, data } = rolling.properties;
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${ID}/request`,
      title: `${ID} request`,
      description:
        'The current period against the period just before the screen, as long as what the screen shows, as two lines on one time axis: the current one in the focus colour, the earlier one grey, a shortfall hatched. Give either window (rolling windows) or unit (calendar periods). The caller sends raw daily values for both periods; the service computes the rest.',
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', 'statistic', 'horizon', 'data'],
      properties: {
        semgraph,
        metric,
        title,
        measureType,
        uniqueAggregation,
        statistic: {
          description: 'The value both lines show: sum (the total per period, a square), mean (a diamond with ±1 sd) or median (a dot with P25–P75).',
          enum: [...STATISTICS],
        },
        window: { ...rolling.properties.window, description: 'Rolling windows of this many days: 1 or a multiple of 7. Give either window or unit.' },
        unit: { ...calendar.properties.unit, description: 'Calendar periods: week (ISO), month, quarter or year. Give either unit or window.' },
        horizon: {
          description: 'Number of windows or periods on the screen; the comparison covers as many just before them.',
          type: 'integer',
          minimum: 2,
          maximum: 120,
        },
        spread: {
          description: 'The light band of the current period (the comparison never has one): stddev or none for a mean, iqr or none for a median, none for a sum.',
          enum: ['stddev', 'iqr', 'none'],
        },
        valueAxis,
        format,
        locale,
        context,
        meta,
        data: { ...data, description: 'Daily values of the period on the screen and the period just before it. 0 is a measured zero; null or an absent day means no data.' },
      },
    };
  }

  check(request: PeriodComparisonRequest): IssueSpec[] {
    const hasWindow = request.window !== undefined;
    if (hasWindow === (request.unit !== undefined)) {
      return [{ level: 'inputError', code: 'windowOrUnit', field: hasWindow ? '/unit' : '/window' }];
    }
    if (request.spread !== undefined && !SPREADS[request.statistic].includes(request.spread)) {
      return [{ level: 'inputError', code: 'invalidValue', field: '/spread', params: { allowed: SPREADS[request.statistic].join(', ') } }];
    }
    return this.chartFor(request).check(request as never);
  }

  compute(request: PeriodComparisonRequest, context: { now: Date }): TimeAxisComputed {
    return this.chartFor(request).compute(request as never, context);
  }

  rules(request: PeriodComparisonRequest, computed: TimeAxisComputed, context: { metadata: SemgraphMetadata }): IssueSpec[] {
    return this.chartFor(request).rules(request as never, computed, context);
  }

  draw(request: PeriodComparisonRequest, computed: TimeAxisComputed, context: DrawContext): Drawing {
    return this.chartFor(request).draw(request as never, computed, context);
  }
}
