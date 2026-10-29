import type { Migration } from 'kysely/migration';
import * as queries from './0001-queries.js';
import * as parameters from './0002-parameters.js';
import * as previews from './0003-previews.js';
import * as lenses from './0004-lenses.js';
import * as lensUpkeep from './0005-lens-upkeep.js';
import * as lensWords from './0006-lens-words.js';
import * as lensDecisions from './0007-lens-decisions.js';

/** The migrations of query, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-queries': queries,
  '0002-parameters': parameters,
  '0003-previews': previews,
  '0004-lenses': lenses,
  '0005-lens-upkeep': lensUpkeep,
  '0006-lens-words': lensWords,
  '0007-lens-decisions': lensDecisions,
};
