import type { ServiceCallerVerifier, TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type ExcelKeys, excelKeyRoutes, type Notices } from './excel-keys.js';
import { groupRoutes, type OwnerUnits } from './groups.js';
import { permissionGroupRoutes } from './permission-groups.js';
import { peopleRoutes } from './people.js';
import { settingsRoutes } from './settings.js';
import { signInRoutes, type SignInOptions } from './sign-in.js';
import type { TokenIssuer } from './tokens.js';

export interface AppOptions {
  verifier: TokenVerifier;
  tokens: TokenIssuer;
  /** Signing in through Google, for the web app and MCP clients; needs the database. */
  signIn?: SignInOptions;
  /** catalogue, which asks who to notify and moves its Owner Units, with its Google ID token (DEC-LN-07, TR-UM-04); needs the database. */
  peopleCallers?: ServiceCallerVerifier;
  /** catalogue, asked what a Group owns before it is deleted (TR-UM-05). */
  owners?: OwnerUnits;
  /** The Excel keys (FR-PL-01 to FR-PL-03): query exchanges them, Cloud Scheduler asks which expire; needs the database. */
  excelKeys?: { keys: ExcelKeys; exchangers: ServiceCallerVerifier; schedulers?: ServiceCallerVerifier; notices: Notices };
  logger?: ServerOptions['logger'];
}

/** The identity service: sign in with Google, the Groups kept in Data Hub, Excel keys and access tokens. See docs/architecture/services/identity.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = await createServer({ name: 'identity', verifier: options.verifier, logger: options.logger });

  // Every service validates Access Tokens against these keys (TR-PF-02, TR-PF-03).
  app.get('/.well-known/jwks.json', { config: { public: true } }, async (_request, reply) => {
    reply.header('cache-control', 'public, max-age=300');
    return options.tokens.jwks();
  });

  // The current User, as the Access Token says, with their Permission group and Permissions; the web
  // app shows what they may do from them (FR-PL-14).
  app.get('/me', async (request) => {
    const { sub, email, name, groups, permissionGroup, permissions } = request.user ?? {};
    return { sub, email, name, groups, permissionGroup, permissions };
  });

  if (options.signIn) {
    const { workspace, domains, store } = options.signIn;
    // The Groups kept in Data Hub (DEC-UM-10, TR-UM-02); catalogue asks /me/groups and /groups to check an Owner Unit.
    await app.register(groupRoutes, {
      groups: store.dataHubGroups,
      domains,
      owners: options.owners ?? { collectionsOf: async () => ({ count: 0, names: [] }) },
      ...(options.peopleCallers ? { movers: options.peopleCallers } : {}),
    });
    await app.register(signInRoutes, options.signIn);
    await app.register(permissionGroupRoutes, {
      groups: options.signIn.groups,
      ...(options.signIn.userNotices ? { notices: options.signIn.userNotices } : {}),
      ...(options.signIn.webClient ? { webClientId: options.signIn.webClient.clientId } : {}),
    });
    await app.register(settingsRoutes, { store: options.signIn.store });
    if (options.peopleCallers) await app.register(peopleRoutes, { store: options.signIn.store, callers: options.peopleCallers });
    if (options.excelKeys) await app.register(excelKeyRoutes, { ...options.excelKeys, workspace, tokens: options.tokens, memberships: store, groups: options.signIn.groups });
  }

  return app;
}
