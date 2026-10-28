import type { Migration } from 'kysely/migration';
import * as collections from './0001-collections.js';
import * as resources from './0002-resources.js';
import * as collectionIcon from './0003-collection-icon.js';
import * as resourcesAfresh from './0004-resources-afresh.js';

/** The migrations of catalogue, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-collections': collections,
  '0002-resources': resources,
  '0003-collection-icon': collectionIcon,
  '0004-resources-afresh': resourcesAfresh,
};
