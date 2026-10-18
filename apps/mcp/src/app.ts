import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { FastifyInstance } from 'fastify';
import { createMcpServer } from './tools.js';

export interface AppOptions {
  verifier: TokenVerifier;
  /** The address of the MCP endpoint, which Claude connects to: the protected resource (RFC 9728). */
  resource: string;
  /** Where MCP clients sign in: identity (TR-PF-06). */
  authorizationServer: string;
  logger?: ServerOptions['logger'];
}

/** The mcp application: Data Hub for Claude, over MCP. See docs/architecture/services/mcp.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const resource = new URL(options.resource);
  const metadataPaths = ['/.well-known/oauth-protected-resource', `/.well-known/oauth-protected-resource${resource.pathname}`];
  const app = await createServer({
    name: 'mcp',
    verifier: options.verifier,
    logger: options.logger,
    // Without a valid Access Token, MCP clients learn here where to sign in.
    challenge: `Bearer resource_metadata="${resource.origin}${metadataPaths[1]}"`,
  });

  const metadata = {
    resource: options.resource,
    authorization_servers: [options.authorizationServer],
    bearer_methods_supported: ['header'],
    resource_name: 'Data Hub',
  };
  for (const path of new Set(metadataPaths)) {
    app.get(path, { config: { public: true } }, async () => metadata);
  }

  // Streamable HTTP without sessions: every request gets its own MCP server, for its own User.
  app.post(resource.pathname, async (request, reply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const server = createMcpServer(user);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    reply.hijack();
    reply.raw.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  // No sessions, so no stream to open or close.
  for (const method of ['GET', 'DELETE'] as const) {
    app.route({
      method,
      url: resource.pathname,
      handler: async (_request, reply) =>
        reply.code(405).header('allow', 'POST').send({ error: 'method_not_allowed', message: 'This MCP server has no sessions; use POST.' }),
    });
  }

  return app;
}
