import { verifierFromEnv } from '@datahub/auth';
import { start } from '@datahub/server';
import { buildApp } from './app.js';

const app = await buildApp({
  verifier: verifierFromEnv(),
  resource: required('DATAHUB_MCP_RESOURCE'),
  authorizationServer: required('DATAHUB_TOKEN_ISSUER'),
  services: {
    catalogueUrl: required('DATAHUB_CATALOGUE_URL'),
    queryUrl: required('DATAHUB_QUERY_URL'),
    webUrl: required('DATAHUB_WEB_URL'),
  },
});
await start(app);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
