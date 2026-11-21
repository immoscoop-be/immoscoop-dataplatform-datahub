import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataIdToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCatalogue } from './catalogue.js';
import type { EdaDatabase } from './database.js';
import { createEdas } from './edas.js';
import { createQuery } from './query.js';

const database = await connectCloudSql<EdaDatabase>(cloudSqlOptionsFromEnv('eda'));
const app = await buildApp({
  verifier: verifierFromEnv(),
  api: {
    edas: createEdas(database.db),
    // A Resource as the User sees it, asked with their token; told an EDA is Explored as eda itself (TR-ED-05).
    catalogue: createCatalogue(required('DATAHUB_CATALOGUE_URL'), fetch, metadataIdToken()),
    // query runs the SQL of an EDA-Probe as the User: eda reads no data itself (TR-ED-04, DEC-ED-26).
    query: createQuery(required('DATAHUB_QUERY_URL')),
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
