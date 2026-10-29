import type { Migration } from 'kysely/migration';
import * as collections from './0001-collections.js';
import * as resources from './0002-resources.js';
import * as collectionIcon from './0003-collection-icon.js';
import * as resourcesAfresh from './0004-resources-afresh.js';
import * as collectionsAfresh from './0005-collections-afresh.js';
import * as grainAndMappings from './0006-grain-and-mappings.js';
import * as resourceCard from './0007-resource-card.js';
import * as publication from './0008-publication.js';
import * as requests from './0009-requests.js';

/** The migrations of catalogue, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-collections': collections,
  '0002-resources': resources,
  '0003-collection-icon': collectionIcon,
  '0004-resources-afresh': resourcesAfresh,
  '0005-collections-afresh': collectionsAfresh,
  '0006-grain-and-mappings': grainAndMappings,
  '0007-resource-card': resourceCard,
  '0008-publication': publication,
  '0009-requests': requests,
};
