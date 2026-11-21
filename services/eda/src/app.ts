import type { TokenVerifier } from '@datahub/auth';
import { createServer, type ServerOptions } from '@datahub/server';
import type { FastifyInstance } from 'fastify';

export interface AppOptions {
  verifier: TokenVerifier;
  logger?: ServerOptions['logger'];
}

/** The eda service: the EDA of each Resource, its EDA-Probes, runs and readings. See docs/architecture/services/eda.md. */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  return createServer({ name: 'eda', ...options });
}
