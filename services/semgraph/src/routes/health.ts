import type { FastifyInstance } from 'fastify';
import type { Dependencies } from '../app.ts';

export function healthRoutes(app: FastifyInstance, { registry }: Dependencies): void {
  app.get('/healthz', async () => ({
    status: 'ok',
    version: registry.version,
    languageVersion: registry.tokens.languageVersion,
    tokensVersion: registry.tokens.version,
  }));
}
