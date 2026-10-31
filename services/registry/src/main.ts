import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, readSecret } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createArtifactSets } from './artifact-sets.js';
import type { RegistryDatabase } from './database.js';
import { createDbtCloud } from './dbt-cloud.js';
import { createDeliveries } from './deliveries.js';
import { COLLECTOR_URL, createDomainModelSource } from './domain-model.js';
import { createIngestStarter } from './ingest-job.js';
import { createProposals } from './proposal.js';
import { createReading } from './reading.js';
import { lazy, settingsFromEnv } from './settings.js';
import { createSourceJobs } from './source-jobs.js';

const settings = settingsFromEnv();
const accessToken = metadataAccessToken();
const database = await connectCloudSql<RegistryDatabase>(cloudSqlOptionsFromEnv('registry'));
const sets = createArtifactSets(database.db);
const startIngest = createIngestStarter(settings.ingestJob, accessToken);
const reading = createReading(database.db);
// The Source Jobs: those of the configuration, until a Data Admin sets another on the page Webhooks (FR-AR-18).
const sourceJobs = createSourceJobs(database.db, settings.sourceJobs);
const deliveries = createDeliveries(database.db);
const dbtCloud = createDbtCloud({
  url: settings.dbtCloudUrl,
  accountId: settings.accountId,
  token: lazy(() => readSecret(settings.dbtCloudToken, accessToken)),
});
const registryUrl = required('DATAHUB_REGISTRY_URL');
// The collector of Colleciónes, for the Domain Model in use (DEC-AR-04); the same for every environment.
const domainModel = createDomainModelSource(process.env.DATAHUB_COLLECTOR_URL || COLLECTOR_URL);

const app = await buildApp({
  verifier: verifierFromEnv(),
  webhook: {
    secret: lazy(() => readSecret(settings.webhookSecret, accessToken)),
    accountId: settings.accountId,
    sourceJobs: () => sourceJobs.current(),
    sets,
    deliveries,
    startIngest,
  },
  api: {
    reading,
    sets,
    dbtCloud,
    sourceJobs: () => sourceJobs.current(),
    startIngest,
    domainModel,
    proposals: createProposals(reading, domainModel),
  },
  // catalogue asks the lineage around a Resource as itself, with a Google ID token for registry's own
  // address, for a User it checked (DEC-AR-06).
  internal: {
    reading,
    serviceCallers: createServiceCallerVerifier({
      audience: registryUrl,
      serviceAccounts: [required('DATAHUB_CATALOGUE_SERVICE_ACCOUNT')],
    }),
  },
  admin: { sourceJobs, deliveries, dbtCloud, reading, configured: settings.sourceJobs, webhookUrl: `${registryUrl.replace(/\/$/, '')}/webhooks/dbt-cloud` },
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
