import { DistributionChart } from '../../src/charts/distribution-chart.ts';

/** The distribution of one continuous value, after Figma's Chart/Distribution. */
export class Distribution extends DistributionChart {
  constructor() {
    super('distribution');
  }
}
