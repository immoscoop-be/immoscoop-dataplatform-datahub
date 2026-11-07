import type { ServiceCallerVerifier, TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { type ExcelKeys, excelKeyRoutes, type Notices } from './excel-keys.js';
import { can, permissionValue } from '@datahub/contracts';
import { ownDomainGroups } from './naming-convention.js';
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
  /** catalogue, which asks who to notify with its Google ID token (DEC-LN-07); needs the database. */
  peopleCallers?: ServiceCallerVerifier;
  /** The Excel keys (FR-PL-01 to FR-PL-03): query exchanges them, Cloud Scheduler asks which expire; needs the database. */
  excelKeys?: { keys: ExcelKeys; exchangers: ServiceCallerVerifier; schedulers?: ServiceCallerVerifier; notices: Notices };
  logger?: ServerOptions['logger'];
}

/** The identity service: sign in with Google, groups from Workspace, Excel keys and access tokens. See docs/architecture/services/identity.md. */
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
    const { workspace, domains } = options.signIn;
    // The groups of the User to choose an Owner Unit from, read from Workspace again as at a
    // login, so that a group joined a minute ago is there too (TR-CO-03). catalogue asks it too.
    app.get('/me/groups', async (request, reply) => {
      try {
        return { groups: ownDomainGroups(await workspace.groups(request.user?.email ?? ''), domains) };
      } catch (error) {
        request.log.error({ err: error }, 'Workspace did not return the groups');
        reply.code(503).header('retry-after', '30');
        return { error: 'temporarily_unavailable', message: 'Workspace did not answer; try again later.' };
      }
    });
    // Every group of the own domains, for who may give a Collection to any of them (FR-CO-35,
    // `collections.make` with any group). catalogue asks it to check the group chosen.
    app.get('/groups', async (request, reply) => {
      const permissions = request.user?.permissions;
      if (!permissions || !can(permissions, 'collections.make') || permissionValue(permissions, 'collections.make', 'ownerUnit') !== 'any') {
        reply.code(403);
        return { error: 'forbidden', message: 'Only who may give a Collection to any group sees every group of the domain.', permission: 'collections.make' };
      }
      try {
        return { groups: ownDomainGroups(await workspace.domainGroups(request.user!.sub), domains) };
      } catch (error) {
        request.log.error({ err: error }, 'Workspace did not list the groups of the domain');
        reply.code(503).header('retry-after', '30');
        return { error: 'temporarily_unavailable', message: 'Workspace did not answer; try again later.' };
      }
    });
    await app.register(signInRoutes, options.signIn);
    await app.register(permissionGroupRoutes, {
      groups: options.signIn.groups,
      ...(options.signIn.userNotices ? { notices: options.signIn.userNotices } : {}),
      ...(options.signIn.webClient ? { webClientId: options.signIn.webClient.clientId } : {}),
    });
    await app.register(settingsRoutes, { store: options.signIn.store });
    if (options.peopleCallers) await app.register(peopleRoutes, { store: options.signIn.store, callers: options.peopleCallers });
    if (options.excelKeys) await app.register(excelKeyRoutes, { ...options.excelKeys, workspace, tokens: options.tokens, domains, groups: options.signIn.groups });
  }

  return app;
}
