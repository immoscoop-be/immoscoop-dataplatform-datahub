import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import type { Dependencies } from '../app.ts';
import { bearerChallenge, createTokenVerifier, resourceMetadata, resourceMetadataUrl, type FetchJson } from '../mcp/auth.ts';
import { chartAppHtml } from '../mcp/chart-app.ts';
import { createMcpServer } from '../mcp/server.ts';

export const MCP_PATH = '/mcp';

/**
 * REQ-090: the MCP server on POST /mcp, Streamable HTTP without sessions: every request gets its own server,
 * so the container keeps no state. Answers are plain JSON, never an event stream, so nothing has to stream
 * through CloudFront. REQ-091: with OAuth, a request without a valid access token gets a 401 that points to
 * the protected resource metadata, where Claude finds out how to sign in.
 */
export async function mcpRoutes(app: FastifyInstance, { registry, now, mcp }: Dependencies, { fetchJson }: { fetchJson?: FetchJson } = {}): Promise<void> {
  const appHtml = await chartAppHtml(registry);
  const verifyToken = mcp.mode === 'oauth' ? createTokenVerifier(mcp, { now, ...(fetchJson ? { fetchJson } : {}) }) : undefined;

  app.post(MCP_PATH, async (request, reply) => {
    if (mcp.mode === 'off') {
      return reply.code(503).send(rpcError('The MCP server is not configured: set MCP_AUTH_ISSUER, MCP_AUTH_CLIENT_IDS and MCP_RESOURCE_URL, or MCP_AUTH=none.'));
    }
    if (mcp.mode === 'oauth') {
      const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
      if (token === undefined) return unauthorized(reply, bearerChallenge(mcp), 'Sign in with your account of the internal tools to use semgraph.');
      if (!(await verifyToken!(token))) return unauthorized(reply, bearerChallenge(mcp, 'invalid_token'), 'The access token is not valid or has expired.');
    }
    const server = createMcpServer({
      registry,
      now,
      log: request.log,
      appHtml,
      ...(mcp.mode === 'oauth' ? { serverUrl: mcp.resource } : {}),
    });
    // The web-standard transport works on a Request and a Response, so Fastify keeps the connection: the body
    // is parsed already (JSON, 1 MB at most), and the answer goes back as a normal reply.
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const response = await transport.handleRequest(webRequest(request), { parsedBody: request.body });
      reply.code(response.status);
      response.headers.forEach((value, name) => void reply.header(name, value));
      return reply.send(await response.text());
    } finally {
      await transport.close();
      await server.close();
    }
  });

  // Without sessions there is no event stream to open and no session to end.
  const notAllowed = async (_request: unknown, reply: FastifyReply) =>
    reply.code(405).header('allow', 'POST').send(rpcError('Only POST is supported on /mcp.'));
  app.get(MCP_PATH, notAllowed);
  app.delete(MCP_PATH, notAllowed);

  if (mcp.mode === 'oauth') {
    const metadata = resourceMetadata(mcp);
    const paths = new Set(['/.well-known/oauth-protected-resource', new URL(resourceMetadataUrl(mcp.resource)).pathname]);
    for (const path of paths) app.get(path, async () => metadata);
  }
}

function unauthorized(reply: FastifyReply, challenge: string, description: string) {
  return reply.code(401).header('www-authenticate', challenge).send({ error: 'unauthorized', error_description: description });
}

/** The request as the transport reads it: method, URL and headers; the body is passed on parsed. */
function webRequest(request: FastifyRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_BY_HOP.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return new Request(`http://${request.headers.host ?? 'localhost'}${request.url}`, { method: request.method, headers });
}

const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'content-length', 'upgrade']);

const rpcError = (message: string) => ({ jsonrpc: '2.0', id: null, error: { code: -32000, message } });
