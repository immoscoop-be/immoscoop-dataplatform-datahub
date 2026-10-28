import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, readSecret } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createArtifactSets } from './artifact-sets.js';
import type { RegistryDatabase } from './database.js';
import { createDbtCloud } from './dbt-cloud.js';
import { COLLECTOR_URL, createDomainModelSource } from './domain-model.js';
import { createIngestStarter } from './ingest-job.js';
import { createProposals } from './proposal.js';
import { createReading } from './reading.js';
import { lazy, settingsFromEnv } from './settings.js';

const settings = settingsFromEnv();
const accessToken = metadataAccessToken();
const database = await connectCloudSql<RegistryDatabase>(cloudSqlOptionsFromEnv('registry'));
const sets = createArtifactSets(database.db);
const startIngest = createIngestStarter(settings.ingestJob, accessToken);
const reading = createReading(database.db);
// The collector of Colleciónes, for the Domain Model in use (DEC-AR-04); the same for every environment.
const domainModel = createDomainModelSource(process.env.DATAHUB_COLLECTOR_URL || COLLECTOR_URL);

const app = await buildApp({
  verifier: verifierFromEnv(),
  webhook: {
    secret: lazy(() => readSecret(settings.webhookSecret, accessToken)),
    accountId: settings.accountId,
    sourceJobs: settings.sourceJobs,
    sets,
    startIngest,
  },
  api: {
    reading,
    sets,
    dbtCloud: createDbtCloud({
      url: settings.dbtCloudUrl,
      accountId: settings.accountId,
      token: lazy(() => readSecret(settings.dbtCloudToken, accessToken)),
    }),
    sourceJobs: settings.sourceJobs,
    startIngest,
    domainModel,
    proposals: createProposals(reading, domainModel),
  },
});
app.addHook('onClose', () => database.close());
await start(app);
