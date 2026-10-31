import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, metadataIdToken, readSecret } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { createIdentity, createPeople } from './identity.js';
import { createLearning } from './learning.js';
import { createMail } from './mail.js';
import { createMessages } from './messages.js';
import { createNotifications } from './notifications.js';
import { createQueryService } from './query.js';
import { createRegistry } from './registry.js';
import { createRequests } from './requests.js';
import { createResources } from './resources.js';
import { createSlack, slackTokenFrom } from './slack.js';

const database = await connectCloudSql<CatalogueDatabase>(cloudSqlOptionsFromEnv('catalogue'));
// identity issues the Access Tokens, so its address is the issuer (TR-PF-02).
const identityUrl = required('DATAHUB_TOKEN_ISSUER');

const idToken = metadataIdToken();
const catalogueUrl = required('DATAHUB_CATALOGUE_URL');

// Notifications by e-mail through the SMTP relay of Workspace, which knows Data Hub by the fixed address its
// traffic leaves from (DEC-PF-31), and in Slack with the bot token from Secret Manager (DEC-LN-05).
const slackToken = required('DATAHUB_SLACK_BOT_TOKEN');
const accessToken = metadataAccessToken();
const notifications = createNotifications(database.db, {
  people: createPeople(identityUrl, idToken),
  mail: createMail({ host: required('DATAHUB_SMTP_HOST'), port: Number(process.env.DATAHUB_SMTP_PORT ?? 587), from: required('DATAHUB_MAIL_FROM') }),
  slack: createSlack(
    slackTokenFrom(
      () => readSecret(slackToken, accessToken),
      (error) => app.log.warn({ err: error }, 'the Slack bot token has no value yet: notifications go by e-mail alone'),
    ),
  ),
  webUrl: required('DATAHUB_WEB_URL'),
  dataTeam: { email: required('DATAHUB_DATA_TEAM_EMAIL'), role: 'datateam' },
});

const app = await buildApp({
  verifier: verifierFromEnv(),
  notifications: {
    notifications,
    // Cloud Scheduler starts a delivery round with a Google ID token for catalogue's own address.
    schedulerCallers: createServiceCallerVerifier({ audience: catalogueUrl, serviceAccounts: [required('DATAHUB_SCHEDULER_SERVICE_ACCOUNT')] }),
  },
  api: {
    collections: createCollections(database.db),
    identity: createIdentity(identityUrl),
    resources: createResources(database.db),
    // registry tells the exposed tables with a Google ID token for catalogue's own address (TR-SR-01).
    serviceCallers: createServiceCallerVerifier({
      audience: catalogueUrl,
      serviceAccounts: [required('DATAHUB_REGISTRY_SERVICE_ACCOUNT')],
    }),
    // The lineage around a Resource, asked as catalogue with a Google ID token for registry (DEC-AR-06).
    registry: createRegistry(required('DATAHUB_REGISTRY_URL'), idToken),
    requests: createRequests(database.db),
    messages: createMessages(database.db),
    // query tells about its Lenses with a Google ID token for catalogue's own address (DEC-PF-30).
    lensCallers: createServiceCallerVerifier({
      audience: catalogueUrl,
      serviceAccounts: [required('DATAHUB_QUERY_SERVICE_ACCOUNT')],
    }),
    // identity tells about the Excel key of a User the same way (FR-PL-03).
    keyCallers: createServiceCallerVerifier({
      audience: catalogueUrl,
      serviceAccounts: [required('DATAHUB_IDENTITY_SERVICE_ACCOUNT')],
    }),
    learning: createLearning(database.db),
    // After a new Current Version, query checks what reads the Resources that changed, asked as catalogue (FR-SR-52).
    query: createQueryService(required('DATAHUB_QUERY_URL'), idToken),
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
