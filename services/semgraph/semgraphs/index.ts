import type { AnySemgraphImplementation } from '../src/core/semgraph.ts';
import { movingWindowAverage } from './movingWindowAverage/index.ts';

/** The code of every available semgraph. Metadata, schema and examples live next to it as files. */
export const implementations: Readonly<Record<string, AnySemgraphImplementation>> = {
  movingWindowAverage,
};
