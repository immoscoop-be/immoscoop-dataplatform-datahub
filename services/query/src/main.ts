import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, metadataIdToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createBigQuery } from './bigquery.js';
import { createCatalogue } from './catalogue.js';
import type { QueryDatabase } from './database.js';
import { createBeneath } from './preflight.js';
import { createStorage } from './preview.js';
import { createLenses } from './lenses.js';
import { createQueries } from './queries.js';

const database = await connectCloudSql<QueryDatabase>(cloudSqlOptionsFromEnv('query'));
// The jobs run in the project of Data Hub, where the tables of its dbt projects are (DEC-SR-32).
const project = required('DATAHUB_BIGQUERY_PROJECT');
const bigquery = createBigQuery({ project, location: required('DATAHUB_BIGQUERY_LOCATION'), token: metadataAccessToken() });
const beneath = createBeneath(bigquery);

const app = await buildApp({
  verifier: verifierFromEnv(),
  api: {
    queries: createQueries(database.db),
    lenses: createLenses(database.db),
    // What the User may see, asked with their own token (FR-SR-41); about the Lenses as query itself (DEC-PF-30).
    catalogue: createCatalogue(required('DATAHUB_CATALOGUE_URL'), fetch, metadataIdToken()),
    bigquery,
    beneath,
    project,
    // The size and partitions of a Resource, from BigQuery without reading it (FR-SR-39).
    storage: createStorage(bigquery, beneath),
    // The two thresholds, 100 MB and 1 GB as start values (DEC-SR-29).
    thresholds: {
      approve: Number(process.env.DATAHUB_QUERY_APPROVE_BYTES ?? 100_000_000),
      request: Number(process.env.DATAHUB_QUERY_REQUEST_BYTES ?? 1_000_000_000),
    },
    // Cloud Scheduler checks every Lens once a day, with a Google ID token for query's own address (FR-LE-17).
    checkers: createServiceCallerVerifier({
      audience: required('DATAHUB_QUERY_URL'),
      serviceAccounts: [required('DATAHUB_SCHEDULER_SERVICE_ACCOUNT')],
    }),
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
