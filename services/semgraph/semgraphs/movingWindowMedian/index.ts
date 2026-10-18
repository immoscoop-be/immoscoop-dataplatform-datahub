import { MovingWindowChart } from '../../src/charts/moving-window-chart.ts';
import { Median } from '../../src/charts/statistics.ts';

/** A rolling median: per day, the median of the window ending on it, with P25–P75. */
export class MovingWindowMedian extends MovingWindowChart {
  constructor() {
    super('movingWindowMedian', new Median());
  }
}
