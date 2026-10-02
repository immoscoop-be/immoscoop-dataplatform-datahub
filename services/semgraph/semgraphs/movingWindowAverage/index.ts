import { checkDailySeries } from '../../src/core/days.ts';
import type { SemgraphImplementation } from '../../src/core/semgraph.ts';
import { draw } from './chart.ts';
import { compute } from './compute.ts';
import { rules } from './rules.ts';
import type { MovingWindowAverageComputed, MovingWindowAverageRequest } from './types.ts';

export const movingWindowAverage: SemgraphImplementation<MovingWindowAverageRequest, MovingWindowAverageComputed> = {
  check: (request) => checkDailySeries(request.data),
  compute,
  rules,
  draw,
};
