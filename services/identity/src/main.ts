import { verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import type { IdentityDatabase } from './database.js';
import { signInSettingsFromEnv, tokenIssuerFromEnv } from './env.js';
import { readGoogleClient } from './google-client.js';
import { createGoogleSignIn, type GoogleSignIn } from './google-sign-in.js';
import { createKmsKeyService } from './signing-keys.js';
import { createStore } from './store.js';
import { createWorkspace } from './workspace.js';

const tokens = tokenIssuerFromEnv(createKmsKeyService());
// Reads the public keys before taking traffic: an instance that cannot reach its key never starts.
await tokens.jwks();

const settings = signInSettingsFromEnv();
const accessToken = metadataAccessToken();
const database = await connectCloudSql<IdentityDatabase>(cloudSqlOptionsFromEnv('identity'));

// The OAuth client is read at the first sign-in, not at start: a secret without a value yet
// does not block a deploy (TR-PF-23).
let google: Promise<GoogleSignIn> | undefined;
function googleSignIn(): Promise<GoogleSignIn> {
  google ??= readGoogleClient(settings.googleClientSecret, accessToken)
    .then((client) => createGoogleSignIn({ ...client, redirectUri: `${settings.issuer}/callback`, domains: settings.domains }))
    .catch((error: unknown) => {
      google = undefined;
      throw error;
    });
  return google;
}

const app = await buildApp({
  verifier: verifierFromEnv(),
  tokens,
  signIn: {
    store: createStore(database.db),
    google: googleSignIn,
    workspace: createWorkspace(accessToken),
    tokens,
    issuer: settings.issuer,
    domains: settings.domains,
    webClient: settings.webClient,
    mcpRedirectUris: settings.mcpRedirectUris,
  },
});
app.addHook('onClose', () => database.close());
await start(app);
