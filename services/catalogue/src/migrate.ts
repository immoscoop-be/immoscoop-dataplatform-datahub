import { migrateFromEnv } from '@datahub/db';
import { migrations } from './migrations/index.js';

// Run by the migration job of catalogue, before the service gets a new revision (TR-PF-09).
await migrateFromEnv('catalogue', migrations);
