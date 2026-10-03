import type { AnySemgraphImplementation } from '../src/core/semgraph.ts';
import { CalendarAverage } from './calendarAverage/index.ts';
import { CalendarMedian } from './calendarMedian/index.ts';
import { MovingWindowAverage } from './movingWindowAverage/index.ts';
import { MovingWindowMedian } from './movingWindowMedian/index.ts';

/** The code of every available semgraph. Metadata and examples live next to it as files. */
export const implementations: Readonly<Record<string, AnySemgraphImplementation>> = Object.fromEntries(
  [new MovingWindowAverage(), new MovingWindowMedian(), new CalendarAverage(), new CalendarMedian()].map((semgraph) => [semgraph.id, semgraph]),
);
