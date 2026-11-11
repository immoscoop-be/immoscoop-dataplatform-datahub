import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, metadataIdToken } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCatalogueNotices, createCatalogueOwnerUnits, createCatalogueUserNotices } from './catalogue.js';
import { createExcelKeys } from './excel-keys.js';
import type { IdentityDatabase } from './database.js';
import { signInSettingsFromEnv, tokenIssuerFromEnv } from './env.js';
import { readGoogleClient } from './google-client.js';
import { createGoogleSignIn, type GoogleSignIn } from './google-sign-in.js';
import { createPermissionGroups } from './permission-groups.js';
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
    // What each User may do: their Permission group, in every Access Token (TR-PL-05); catalogue is told
    // when one changes for a User, or when Admin is given back to the way back in (FR-PL-12, EC-PL-03).
    groups: createPermissionGroups(database.db),
    userNotices: createCatalogueUserNotices(required('DATAHUB_CATALOGUE_URL'), fetch, metadataIdToken()),
    // The addresses that get Admin when no User of Admin can still sign in, from Terraform (TR-UM-06).
    breakGlass: (process.env.DATAHUB_BREAK_GLASS_ADMINS ?? '').split(',').map((address) => address.trim()).filter(Boolean),
  },
  // catalogue says what a Group owns before it is deleted (TR-UM-05).
  owners: createCatalogueOwnerUnits(required('DATAHUB_CATALOGUE_URL'), fetch, metadataIdToken()),
  // catalogue asks who to notify, and moves its Owner Units, with a Google ID token for identity's own address (DEC-LN-07, TR-UM-04).
  peopleCallers: createServiceCallerVerifier({ audience: settings.issuer, serviceAccounts: [required('DATAHUB_CATALOGUE_SERVICE_ACCOUNT')] }),
  // query exchanges the Excel key Excel sends for an Access Token (TR-PF-07); Cloud Scheduler asks once a day
  // which keys expire within a month, and catalogue puts the Message (FR-PL-03).
  excelKeys: {
    keys: createExcelKeys(database.db),
    exchangers: createServiceCallerVerifier({ audience: settings.issuer, serviceAccounts: [required('DATAHUB_QUERY_SERVICE_ACCOUNT')] }),
    schedulers: createServiceCallerVerifier({ audience: settings.issuer, serviceAccounts: [required('DATAHUB_SCHEDULER_SERVICE_ACCOUNT')] }),
    notices: createCatalogueNotices(required('DATAHUB_CATALOGUE_URL'), fetch, metadataIdToken()),
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
