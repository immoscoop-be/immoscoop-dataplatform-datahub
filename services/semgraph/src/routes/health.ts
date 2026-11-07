import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';

export function healthRoutes(app: FastifyInstance, { registry, mcp }: Dependencies): void {
  const health = async () => ({
    status: 'ok',
    version: registry.version,
    languageVersion: registry.tokens.languageVersion,
    tokensVersion: registry.tokens.version,
    // REQ-091: off, open or oauth, so the platform can check its configuration after a deploy.
    mcp: mcp.mode,
  });
  app.get('/healthz', health);
  // The health check of every Data Hub service. Cloud Run keeps some paths ending in z for itself,
  // so /healthz may not reach the service from outside.
  app.get('/health', health);
}
