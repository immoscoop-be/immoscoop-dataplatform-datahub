import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataIdToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { createIdentity } from './identity.js';
import { createRegistry } from './registry.js';
import { createResources } from './resources.js';

const database = await connectCloudSql<CatalogueDatabase>(cloudSqlOptionsFromEnv('catalogue'));
// identity issues the Access Tokens, so its address is the issuer (TR-PF-02).
const identityUrl = required('DATAHUB_TOKEN_ISSUER');

const app = await buildApp({
  verifier: verifierFromEnv(),
  api: {
    collections: createCollections(database.db),
    identity: createIdentity(identityUrl),
    resources: createResources(database.db),
    // registry tells the exposed tables with a Google ID token for catalogue's own address (TR-SR-01).
    serviceCallers: createServiceCallerVerifier({
      audience: required('DATAHUB_CATALOGUE_URL'),
      serviceAccounts: [required('DATAHUB_REGISTRY_SERVICE_ACCOUNT')],
    }),
    // The lineage around a Resource, asked as catalogue with a Google ID token for registry (DEC-AR-06).
    registry: createRegistry(required('DATAHUB_REGISTRY_URL'), metadataIdToken()),
  },
});
app.addHook('onClose', () => database.close());
await start(app);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
