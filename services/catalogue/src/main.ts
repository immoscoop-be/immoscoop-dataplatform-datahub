import { createServiceCallerVerifier, verifierFromEnv } from '@datahub/auth';
import { cloudSqlOptionsFromEnv, connectCloudSql } from '@datahub/db';
import { metadataAccessToken, metadataIdToken, readSecret } from '@datahub/google';
import { start } from '@datahub/server';
import { buildApp } from './app.js';
import { createCollections } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { createGroupMoves, createIdentity, createPeople } from './identity.js';
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
  // The Data Team by its address, and in Slack the Users who get the Messages for the Data Team (TR-PL-08).
  dataTeam: { email: required('DATAHUB_DATA_TEAM_EMAIL'), permission: 'messages.dataTeam' },
});

const collections = createCollections(database.db);
const app = await buildApp({
  verifier: verifierFromEnv(),
  notifications: {
    notifications,
    // Cloud Scheduler starts a delivery round with a Google ID token for catalogue's own address.
    schedulerCallers: createServiceCallerVerifier({ audience: catalogueUrl, serviceAccounts: [required('DATAHUB_SCHEDULER_SERVICE_ACCOUNT')] }),
  },
  api: {
    collections,
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

// The Owner Units of Google become Groups of Data Hub once (FR-UM-20, TR-UM-04): told to identity at every start,
// tried again a few times while identity is not up yet. identity changes nothing for a Group that exists.
void (async () => {
  const move = createGroupMoves(identityUrl, idToken);
  for (const wait of [0, 10_000, 60_000, 300_000, 1_800_000]) {
    await new Promise((resolve) => setTimeout(resolve, wait).unref());
    try {
      const moved = await move(await collections.ownerUnits());
      if (moved.length) app.log.info({ moved }, 'Owner Units moved from Google to Groups of Data Hub');
      return;
    } catch (error) {
      app.log.warn({ err: error }, 'identity did not take the Owner Units yet; trying again');
    }
  }
})();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}
