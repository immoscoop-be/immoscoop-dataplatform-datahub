import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';

export function healthRoutes(app: FastifyInstance, { registry, mcp }: Dependencies): void {
  app.get('/healthz', async () => ({
    status: 'ok',
    version: registry.version,
    languageVersion: registry.tokens.languageVersion,
    tokensVersion: registry.tokens.version,
    // REQ-091: off, open or oauth, so the platform can check its configuration after a deploy.
    mcp: mcp.mode,
  }));
}
