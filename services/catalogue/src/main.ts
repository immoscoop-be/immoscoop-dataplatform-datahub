import { verifierFromEnv } from '@datahub/auth';
import { start } from '@datahub/server';
import { buildApp } from './app.js';

const app = await buildApp({ verifier: verifierFromEnv() });
await start(app);
