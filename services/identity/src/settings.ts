import { settingSchema } from '@datahub/contracts';
import type { FastifyInstance } from 'fastify';
import type { Store } from './store.js';

/**
 * The settings of the User who calls, kept in Data Hub as keys and values (DEC-UX-96): the web app
 * reads them when it starts and writes one when the User changes it. A User reaches only their own.
 */
export async function settingsRoutes(app: FastifyInstance, options: { store: Store }): Promise<void> {
  const { store } = options;

  app.get('/me/settings', async (request) => ({ settings: await store.settings(request.user?.sub ?? '') }));

  app.put<{ Params: { key: string }; Body: unknown }>('/me/settings/:key', async (request, reply) => {
    const schema = settingSchema(request.params.key);
    if (!schema) {
      reply.code(404);
      return { error: 'unknown_setting', message: `Data Hub keeps no setting ${request.params.key}.` };
    }
    const body = request.body as { value?: unknown } | undefined;
    const parsed = schema.safeParse(body?.value);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_value', message: `That is no value for ${request.params.key}.` };
    }
    await store.saveSetting(request.user?.sub ?? '', request.params.key, parsed.data);
    return reply.code(204).send();
  });

  app.delete<{ Params: { key: string } }>('/me/settings/:key', async (request, reply) => {
    if (!settingSchema(request.params.key)) {
      reply.code(404);
      return { error: 'unknown_setting', message: `Data Hub keeps no setting ${request.params.key}.` };
    }
    await store.removeSetting(request.user?.sub ?? '', request.params.key);
    return reply.code(204).send();
  });
}
