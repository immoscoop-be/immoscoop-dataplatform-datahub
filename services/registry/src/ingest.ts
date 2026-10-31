import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, metadataIdToken, readSecret } from '@datahub/google';
import { createArtifactSets } from './artifact-sets.js';
import { createBucket } from './bucket.js';
import { createCatalogue } from './catalogue.js';
import { createChanges } from './changes.js';
import type { RegistryDatabase } from './database.js';
import { createDbtCloud } from './dbt-cloud.js';
import { createProcessing, type Log } from './processing.js';
import { lazy, settingsFromEnv } from './settings.js';

// The ingest job of registry (TR-AR-02, DEC-PF-20): processes every pending Artifact Set, then stops.
// A set that fails keeps its reason and does not fail the job; only an error outside the sets does.

/** One JSON line per entry, which Cloud Logging reads with its severity. */
const log: Log = {
  info: (details, message) => console.log(JSON.stringify({ severity: 'INFO', message, ...details })),
  error: (details, message) => console.error(JSON.stringify({ severity: 'ERROR', message, ...details, err: describe(details) })),
};

function describe(details: object): string | undefined {
  const error = (details as { err?: unknown }).err;
  return error instanceof Error ? (error.stack ?? error.message) : undefined;
}

const settings = settingsFromEnv();
const accessToken = metadataAccessToken();
const database = await connectCloudSql<RegistryDatabase>(cloudSqlOptionsFromEnv('registry'));
try {
  const processing = createProcessing({
    sets: createArtifactSets(database.db),
    bucket: createBucket(settings.bucket, accessToken),
    dbtCloud: createDbtCloud({
      url: settings.dbtCloudUrl,
      accountId: settings.accountId,
      token: lazy(() => readSecret(settings.dbtCloudToken, accessToken)),
    }),
    catalogue: createCatalogue(settings.catalogueUrl, metadataIdToken()),
    changes: createChanges(database.db),
    log,
  });
  const result = await processing.runPending();
  log.info(result, `ingest done: ${result.processed} processed, ${result.failed} failed`);
} finally {
  await database.close();
}
