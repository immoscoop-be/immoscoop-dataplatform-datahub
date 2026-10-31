import type { Migration } from 'kysely/migration';
import * as artifactSets from './0001-artifact-sets.js';
import * as search from './0002-search.js';
import * as nodeMeta from './0003-node-meta.js';
import * as domainModel from './0004-domain-model.js';
import * as storage from './0005-storage.js';
import * as webhooks from './0006-webhooks.js';

/** The migrations of registry, by name; they run in the order of their names (TR-PF-09). */
export const migrations: Record<string, Migration> = {
  '0001-artifact-sets': artifactSets,
  '0002-search': search,
  '0003-node-meta': nodeMeta,
  '0004-domain-model': domainModel,
  '0005-storage': storage,
  '0006-webhooks': webhooks,
};
