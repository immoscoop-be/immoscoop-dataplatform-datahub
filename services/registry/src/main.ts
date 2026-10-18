import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, readSecret } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createArtifactSets } from './artifact-sets.js';
import type { RegistryDatabase } from './database.js';
import { createIngestStarter } from './ingest-job.js';
import { lazy, settingsFromEnv } from './settings.js';

const settings = settingsFromEnv();
const accessToken = metadataAccessToken();
const database = await connectCloudSql<RegistryDatabase>(cloudSqlOptionsFromEnv('registry'));

const app = await buildApp({
  verifier: verifierFromEnv(),
  webhook: {
    secret: lazy(() => readSecret(settings.webhookSecret, accessToken)),
    accountId: settings.accountId,
    sourceJobs: settings.sourceJobs,
    sets: createArtifactSets(database.db),
    startIngest: createIngestStarter(settings.ingestJob, accessToken),
  },
});
app.addHook('onClose', () => database.close());
await start(app);
