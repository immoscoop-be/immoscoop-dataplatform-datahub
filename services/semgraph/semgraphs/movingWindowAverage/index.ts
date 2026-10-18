import { MovingWindowChart } from '../../src/charts/moving-window-chart.ts';
import { Average } from '../../src/charts/statistics.ts';

/** A rolling average: per day, the mean of the window ending on it, with ±1 sd. */
export class MovingWindowAverage extends MovingWindowChart {
  constructor() {
    super('movingWindowAverage', new Average());
  }
}
