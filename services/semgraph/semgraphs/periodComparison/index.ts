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
    const rolling = this.rolling.mean.schema() as { properties: Record<string, any> };
    const calendar = this.calendar.mean.schema() as { properties: Record<string, any> };
    const { semgraph, metric, title, measureType, uniqueAggregation, asOf, valueAxis, format, locale, context, meta, points } = rolling.properties;
    const fields = Object.assign({}, ...STATISTICS.map((id) => statistic(id).pointProperties()));
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `semgraph:${ID}/request`,
      title: `${ID} request`,
      description:
        'The current period against the period just before the screen, as long as what the screen shows, as two lines on one time axis: the current one in the focus colour, the earlier one grey, a shortfall hatched. Give either window (rolling windows) or unit (calendar periods). The warehouse computes each block and the value of the block before the screen at its position (REQ-058).',
      type: 'object',
      additionalProperties: false,
      required: ['semgraph', 'metric', 'measureType', 'statistic', 'points'],
      properties: {
        semgraph,
        metric,
        title,
        measureType,
        uniqueAggregation,
        statistic: {
          description: 'The value both lines show: sum (the total per block, a square), mean (a diamond with ±1 sd) or median (a dot with P25–P75). A block carries only the fields of this statistic.',
          enum: [...STATISTICS],
        },
        window: { ...rolling.properties.window, description: 'Rolling windows of this many days: 1 or a multiple of 7. Give either window or unit.' },
        unit: { ...calendar.properties.unit, description: 'Calendar periods: week (ISO), month, quarter or year. Give either unit or window.' },
        asOf,
        valueAxis,
        format,
        locale,
        context,
        meta,
        points: {
          ...points,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              end: { ...points.items.properties.end, description: 'With window: the last day of the window.' },
              period: { ...(calendar.properties.points.items.properties.period as object), description: 'With unit: the ISO name of the period.' },
              ...fields,
              previous: {
                description: 'The value of the block just before the screen at this position, in the field of the statistic (REQ-037); null when it has no data. For a running period: as many days of the earlier one.',
                type: ['object', 'null'],
                additionalProperties: false,
                properties: Object.fromEntries(STATISTICS.map((id) => [id, { type: ['number', 'null'], minimum: 0 }])),
              },
            },
          },
        },
      },
    };
  }

  check(request: PeriodComparisonRequest): IssueSpec[] {
    const hasWindow = request.window !== undefined;
    if (hasWindow === (request.unit !== undefined)) {
      return [{ level: 'inputError', code: 'windowOrUnit', field: hasWindow ? '/unit' : '/window' }];
    }
    // Every block needs its name and the value of the statistic; the schema cannot tie them to the request.
    const name = hasWindow ? 'end' : 'period';
    const missing = request.points.flatMap((row, index) =>
      [name, request.statistic].filter((field) => !(field in row)).map((field) => ({ level: 'inputError' as const, code: 'missingField', field: `/points/${index}/${field}`, params: { name: field } })),
    );
    return missing.length > 0 ? missing : this.chartFor(request).check(request as never);
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
