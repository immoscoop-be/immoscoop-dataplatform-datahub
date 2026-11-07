import type { ServiceCallerVerifier } from '@datahub/auth';
import { PERMISSION_KEYS } from '@datahub/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Store } from './store.js';

const MAX = 500;

/**
 * Who catalogue notifies (DEC-LN-03, DEC-LN-07): the Users it names, and the members of the Groups and
 * the Users with the Permissions it names (TR-PL-08) that Data Hub knows, from their last sign-in. Only catalogue asks,
 * with its Google ID token for identity's own address; the route is public to Access Tokens.
 */
export async function peopleRoutes(app: FastifyInstance, options: { store: Store; callers: ServiceCallerVerifier }): Promise<void> {
  const { store, callers } = options;

  async function onlyCatalogue(request: FastifyRequest, reply: FastifyReply) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
    try {
      await callers.verify(token);
    } catch (error) {
      request.log.warn({ err: error }, 'a call for people was refused');
      return reply.code(401).send({ error: 'unauthorized', message: 'Only catalogue asks who to notify.' });
    }
  }

  const names = (value: unknown): string[] | null =>
    value === undefined ? [] : Array.isArray(value) && value.length <= MAX && value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 200) ? (value as string[]) : null;

  app.post<{ Body: unknown }>('/internal/people', { config: { public: true }, onRequest: onlyCatalogue }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const [users, groups, permissions] = [names(body.users), names(body.groups), names(body.permissions)];
    if (!users || !groups || !permissions || !permissions.every((key) => (PERMISSION_KEYS as string[]).includes(key))) {
      return reply.code(400).send({ error: 'invalid_request', message: `Users, groups and Permissions are lists of at most ${MAX} IDs or keys.` });
    }
    return { people: await store.people({ users, groups, permissions }) };
  });
}
