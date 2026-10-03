import type { AnySemgraphImplementation } from '../src/core/semgraph.ts';
import { CalendarAverage } from './calendarAverage/index.ts';
import { CalendarMedian } from './calendarMedian/index.ts';
import { CalendarRatio } from './calendarRatio/index.ts';
import { CategoryComparison } from './categoryComparison/index.ts';
import { Distribution } from './distribution/index.ts';
import { KpiStatus } from './kpiStatus/index.ts';
import { KpiTile } from './kpiTile/index.ts';
import { MovingWindowAverage } from './movingWindowAverage/index.ts';
import { MovingWindowMedian } from './movingWindowMedian/index.ts';
import { MovingWindowRatio } from './movingWindowRatio/index.ts';
import { PeriodComparison } from './periodComparison/index.ts';

/** The code of every available semgraph. Metadata and examples live next to it as files. */
export const implementations: Readonly<Record<string, AnySemgraphImplementation>> = Object.fromEntries(
  [new MovingWindowAverage(), new MovingWindowMedian(), new CalendarAverage(), new CalendarMedian(), new MovingWindowRatio(), new CalendarRatio(), new PeriodComparison(), new CategoryComparison(), new Distribution(), new KpiTile(), new KpiStatus()].map((semgraph) => [semgraph.id, semgraph]),
);
