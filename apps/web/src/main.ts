import { fileURLToPath } from 'node:url';
import { verifierFromEnv } from '@datahub/auth';
import { start } from '@datahub/server';
import { buildApp } from './app.js';

const app = await buildApp({
  verifier: verifierFromEnv(),
  webUrl: required('DATAHUB_WEB_URL'),
  identityUrl: required('DATAHUB_TOKEN_ISSUER'),
  registryUrl: required('DATAHUB_REGISTRY_URL'),
  semgraphUrl: required('DATAHUB_SEMGRAPH_URL'),
  clientDir: fileURLToPath(new URL('./client/', import.meta.url)),
});
await start(app);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
