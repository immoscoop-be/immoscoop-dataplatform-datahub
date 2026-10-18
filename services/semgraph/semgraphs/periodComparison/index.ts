import { PeriodComparisonChart } from '../../src/charts/period-comparison.ts';

/** The current period against the period just before the screen (REQ-003, REQ-037). */
export class PeriodComparison extends PeriodComparisonChart {
  constructor() {
    super('periodComparison');
  }
}
