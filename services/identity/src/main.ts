import { verifierFromEnv } from '@datahub/auth';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { tokenIssuerFromEnv } from './env.js';
import { createKmsKeyService } from './signing-keys.js';

const tokens = tokenIssuerFromEnv(createKmsKeyService());
// Reads the public keys before taking traffic: an instance that cannot reach its key never starts.
await tokens.jwks();

const app = await buildApp({ verifier: verifierFromEnv(), tokens });
await start(app);
