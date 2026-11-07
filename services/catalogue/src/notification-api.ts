import type { ServiceCallerVerifier } from '@datahub/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Delivered, Notifications } from './notifications.js';

export interface NotificationRouteOptions {
  notifications: Notifications;
  /** Who may start a delivery round: the scheduler, by its Google ID token for catalogue's address. */
  schedulerCallers: ServiceCallerVerifier;
}

const DELIVER = '/internal/notifications/deliver';

/**
 * A Message notifies at once (DEC-LN-02). Every request that may have written one sends what is due before
 * it answers, within a few seconds, as Cloud Run gives a service no time once it answered; the scheduler
 * sends what is left every few minutes, and what failed again later.
 */
export async function notificationRoutes(app: FastifyInstance, options: NotificationRouteOptions): Promise<void> {
  const { notifications, schedulerCallers } = options;

  const logged = (request: FastifyRequest, outcome: Delivered) => {
    for (const { messageId, failure } of outcome.failures) request.log.warn({ messageId, failure }, 'a notification did not go out wholly');
    if (outcome.abandoned > 0) request.log.error({ abandoned: outcome.abandoned }, 'notifications given up after the last try');
  };

  app.addHook('onSend', async (request, _reply, payload) => {
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS' || request.url === DELIVER) return payload;
    try {
      logged(request, await notifications.deliver({ within: 4_000 }));
    } catch (error) {
      request.log.error({ err: error }, 'notifications could not be sent; the scheduler tries again');
    }
    return payload;
  });

  async function onlyScheduler(request: FastifyRequest, reply: FastifyReply) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
    try {
      await schedulerCallers.verify(token);
    } catch (error) {
      request.log.warn({ err: error }, 'a delivery round was refused');
      return reply.code(401).send({ error: 'unauthorized', message: 'Only the scheduler starts a delivery round.' });
    }
  }

  app.post(DELIVER, { config: { public: true }, onRequest: onlyScheduler }, async (request) => {
    const outcome = await notifications.deliver({ within: 50_000, limit: 500 });
    logged(request, outcome);
    request.log.info({ sent: outcome.sent, failed: outcome.failed, abandoned: outcome.abandoned }, 'notifications delivered');
    return { sent: outcome.sent, failed: outcome.failed, abandoned: outcome.abandoned };
  });
}
