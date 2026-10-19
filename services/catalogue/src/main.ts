import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { createIdentity } from './identity.js';

const database = await connectCloudSql<CatalogueDatabase>(cloudSqlOptionsFromEnv('catalogue'));
// identity issues the Access Tokens, so its address is the issuer (TR-PF-02).
const identityUrl = process.env.DATAHUB_TOKEN_ISSUER;
if (!identityUrl) {
  throw new Error('Missing environment variable DATAHUB_TOKEN_ISSUER');
}

const app = await buildApp({
  verifier: verifierFromEnv(),
  api: { collections: createCollections(database.db), identity: createIdentity(identityUrl) },
});
app.addHook('onClose', () => database.close());
await start(app);
