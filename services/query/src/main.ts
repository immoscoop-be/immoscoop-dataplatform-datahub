import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createBigQuery } from './bigquery.js';
import { createCatalogue } from './catalogue.js';
import type { QueryDatabase } from './database.js';
import { createBeneath } from './preflight.js';
import { createQueries } from './queries.js';

const database = await connectCloudSql<QueryDatabase>(cloudSqlOptionsFromEnv('query'));
// The jobs run in the project of Data Hub, where the tables of its dbt projects are (DEC-SR-32).
const project = required('DATAHUB_BIGQUERY_PROJECT');
const bigquery = createBigQuery({ project, location: required('DATAHUB_BIGQUERY_LOCATION'), token: metadataAccessToken() });

const app = await buildApp({
  verifier: verifierFromEnv(),
  api: {
    queries: createQueries(database.db),
    // What the User may see, asked with their own token (FR-SR-41).
    catalogue: createCatalogue(required('DATAHUB_CATALOGUE_URL')),
    bigquery,
    beneath: createBeneath(bigquery),
    project,
    // The two thresholds, 100 MB and 1 GB as start values (DEC-SR-29).
    thresholds: {
      approve: Number(process.env.DATAHUB_QUERY_APPROVE_BYTES ?? 100_000_000),
      request: Number(process.env.DATAHUB_QUERY_REQUEST_BYTES ?? 1_000_000_000),
    },
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
