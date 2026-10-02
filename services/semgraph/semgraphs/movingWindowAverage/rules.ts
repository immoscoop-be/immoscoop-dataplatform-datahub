import { formatDay } from '../../src/core/days.ts';
import type { IssueSpec } from '../../src/core/issues.ts';
import type { SemgraphMetadata } from '../../src/core/semgraph.ts';
import type { MovingWindowAverageComputed, MovingWindowAverageRequest } from './types.ts';

/** Master-leerplan, level 1: 1.2.2 (unique counts), 1.4.2 (rolling periods), 1.5.4 (centre and spread). */
const LEARNING_PLAN_LEVEL_1 = 'https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146';

/**
 * The chart-language rules for a moving window average.
 * Refusal: the chart would mislead. Deviation: the chart informs less well, so it is drawn with a
 * note in the footer and without version label.
 */
export function rules(
  request: MovingWindowAverageRequest,
  computed: MovingWindowAverageComputed,
  { metadata }: { metadata: SemgraphMetadata },
): IssueSpec[] {
  const issues: IssueSpec[] = [];
  const { window, horizon } = request;

  const allowed = metadata.attributes.measureType ?? 'any';
  if (allowed !== 'any' && !allowed.includes(request.measureType)) {
    issues.push({
      level: 'refusal',
      code: 'measureTypeNotAllowed',
      field: '/measureType',
      params: { measureType: request.measureType, allowed: allowed.join(', ') },
    });
  }

  // An average of daily uniques and the uniques over the window are two different metrics.
  if (request.measureType === 'unique') {
    if (request.uniqueAggregation === undefined) {
      issues.push({
        level: 'refusal',
        code: 'uniqueAggregationRequired',
        field: '/uniqueAggregation',
        learnMore: LEARNING_PLAN_LEVEL_1,
      });
    } else if (request.uniqueAggregation === 'overWindow') {
      issues.push({
        level: 'refusal',
        code: 'uniquesOverWindowNotDerivable',
        field: '/uniqueAggregation',
        params: { window },
        learnMore: LEARNING_PLAN_LEVEL_1,
      });
    }
  } else if (request.uniqueAggregation !== undefined) {
    issues.push({ level: 'info', code: 'uniqueAggregationIgnored', field: '/uniqueAggregation' });
  }

  const { minimumPoints } = metadata.data;
  if (computed.valuesInRange < minimumPoints) {
    issues.push({
      level: 'refusal',
      code: 'insufficientData',
      field: '/data',
      params: {
        count: computed.valuesInRange,
        days: horizon + window - 1,
        from: formatDay(computed.rangeStart),
        to: formatDay(computed.reference),
        minimumPoints,
        minHorizon: Math.max(2, minimumPoints - window + 1),
      },
      learnMore: metadata.links.learning,
    });
  } else if (computed.points.length === 0) {
    issues.push({
      level: 'refusal',
      code: 'noCompleteWindow',
      field: '/data',
      params: { window },
      learnMore: metadata.links.learning,
    });
  }

  if (window % 7 !== 0) {
    issues.push({
      level: 'deviation',
      code: 'windowNotMultipleOf7',
      field: '/window',
      params: { window },
      learnMore: LEARNING_PLAN_LEVEL_1,
    });
  }
  if (computed.spread === 'none') {
    issues.push({ level: 'deviation', code: 'meanWithoutSpread', field: '/spread', learnMore: LEARNING_PLAN_LEVEL_1 });
  }

  if (computed.ignoredAfterReference > 0) {
    issues.push({
      level: 'info',
      code: 'daysAfterReferenceIgnored',
      field: '/data',
      params: { count: computed.ignoredAfterReference, day: formatDay(computed.reference) },
    });
  }
  return issues;
}
