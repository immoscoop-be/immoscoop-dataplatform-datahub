import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';
import { ownDomainGroups } from './naming-convention.js';
import { signInRoutes, type SignInOptions } from './sign-in.js';
import type { TokenIssuer } from './tokens.js';

export interface AppOptions {
  verifier: TokenVerifier;
  tokens: TokenIssuer;
  /** Signing in through Google, for the web app and MCP clients; needs the database. */
  signIn?: SignInOptions;
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

  // The current User, as the Access Token says; the web app shows it.
  app.get('/me', async (request) => {
    const { sub, email, name, groups, roles } = request.user ?? {};
    return { sub, email, name, groups, roles };
  });

  if (options.signIn) {
    const { workspace, domain } = options.signIn;
    // The groups of the User to choose an Owner Unit from, read from Workspace again as at a
    // login, so that a group joined a minute ago is there too (TR-CO-03). catalogue asks it too.
    app.get('/me/groups', async (request, reply) => {
      try {
        return { groups: ownDomainGroups(await workspace.groups(request.user?.email ?? ''), domain) };
      } catch (error) {
        request.log.error({ err: error }, 'Workspace did not return the groups');
        reply.code(503).header('retry-after', '30');
        return { error: 'temporarily_unavailable', message: 'Workspace did not answer; try again later.' };
      }
    });
    await app.register(signInRoutes, options.signIn);
  }

  return app;
}
