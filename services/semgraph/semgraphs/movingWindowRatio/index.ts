import { MovingWindowChart } from '../../src/charts/moving-window-chart.ts';
import { Ratio } from '../../src/charts/statistics.ts';

/** A rolling share: per window its numerator and denominator, the share as a line, the denominator as its base (REQ-076). */
export class MovingWindowRatio extends MovingWindowChart {
  constructor() {
    super('movingWindowRatio', new Ratio());
  }
}
