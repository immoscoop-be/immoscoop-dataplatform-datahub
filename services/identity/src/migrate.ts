import { migrateFromEnv } from '@datahub/db';
import { migrations } from './migrations/index.js';

// Run by the migration job of identity, before the service gets a new revision (TR-PF-09).
await migrateFromEnv('identity', migrations);
