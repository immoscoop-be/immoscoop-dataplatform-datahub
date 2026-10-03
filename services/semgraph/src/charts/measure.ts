import type { IssueSpec } from '../core/issues.ts';
import type { SemgraphMetadata } from '../core/semgraph.ts';
import type { Statistic } from './statistics.ts';

/** Master-leerplan, level 1: unique counts (1.2.2), rolling periods (1.4.2), centre and spread (1.5.4). */
export const LEARNING_PLAN_LEVEL_1 = 'https://immoscoop.atlassian.net/wiki/spaces/DATA/pages/1354629146';

/** What every request says about its numbers. */
export interface MeasureRequest {
  measureType: 'additive' | 'unique' | 'perUnit' | 'ratio';
  uniqueAggregation?: 'daily' | 'overPeriod';
}

/**
 * The rules about the kind of number, the same for every family: a measure type the semgraph allows,
 * no total of ratios, and unique counts that say how they were counted.
 */
export function measureRules(request: MeasureRequest, statistic: Statistic, metadata: SemgraphMetadata): IssueSpec[] {
  const issues: IssueSpec[] = [];
  const allowed = metadata.attributes.measureType ?? 'any';
  if (request.measureType === 'ratio') {
    // REQ-070: a share needs its numerator and denominator; that contract follows in its own requirement.
    issues.push({ level: 'refusal', code: 'ratioNeedsNumerator', field: '/measureType' });
  } else if (allowed !== 'any' && !allowed.includes(request.measureType)) {
    issues.push({
      level: 'refusal',
      code: 'measureTypeNotAllowed',
      field: '/measureType',
      params: { measureType: request.measureType, allowed: allowed.join(', ') },
    });
  } else if (request.measureType === 'perUnit' && statistic.kind === 'amount') {
    // A total of means per unit means nothing: an average price per lead does not add up over a week.
    issues.push({ level: 'refusal', code: 'perUnitNotSummable', field: '/measureType' });
  }

  // Daily uniques and the uniques over a whole block are two different metrics: the caller says which.
  if (request.measureType === 'unique') {
    const total = statistic.kind === 'amount';
    if (request.uniqueAggregation === undefined) {
      issues.push({ level: 'refusal', code: 'uniqueAggregationRequired', field: '/uniqueAggregation', learnMore: LEARNING_PLAN_LEVEL_1 });
    } else if (request.uniqueAggregation === 'daily' && total) {
      // REQ-035: a total of daily uniques counts someone who comes back on several days several times.
      issues.push({ level: 'refusal', code: 'dailyUniquesNotSummable', field: '/uniqueAggregation', learnMore: LEARNING_PLAN_LEVEL_1 });
    } else if (request.uniqueAggregation === 'overPeriod' && !total) {
      // REQ-064: the uniques over a block are one count, counted in the warehouse: only as a total.
      issues.push({ level: 'refusal', code: 'uniquesOverPeriodNotAveraged', field: '/uniqueAggregation', learnMore: LEARNING_PLAN_LEVEL_1 });
    }
  } else if (request.uniqueAggregation !== undefined) {
    issues.push({ level: 'info', code: 'uniqueAggregationIgnored', field: '/uniqueAggregation' });
  }
  return issues;
}
