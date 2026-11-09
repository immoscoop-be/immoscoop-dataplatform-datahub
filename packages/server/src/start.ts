import type { FastifyInstance } from 'fastify';

/**
 * Listens on the port Cloud Run provides, and closes cleanly when Cloud Run stops the instance.
 */
export async function start(app: FastifyInstance, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const port = Number(env.PORT ?? 8080);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, 'shutting down');
      void app.close().then(() => process.exit(0));
    });
  }
  await app.listen({ host: '0.0.0.0', port });
}
