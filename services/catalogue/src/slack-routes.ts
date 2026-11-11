import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { SlackAddresses, SlackUser } from './slack-addresses.js';

export interface SlackRouteOptions {
  addresses: SlackAddresses;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The address by which Data Hub finds the User in Slack, on Profile of My page (FR-LN-07): each User reads and
 * changes only their own, behind their Access Token. Without the token of the Slack app, `on` is false and the
 * web app shows no tile (OP-UX-78).
 */
export async function slackRoutes(app: FastifyInstance, options: SlackRouteOptions): Promise<void> {
  const { addresses } = options;
  const me = (request: FastifyRequest): SlackUser => ({ id: request.user?.sub ?? '', email: request.user?.email ?? '' });
  const address = (value: unknown) => (typeof value === 'string' && value.trim().length <= 254 && EMAIL.test(value.trim()) ? value.trim() : null);

  app.get('/me/slack', async (request) => addresses.state(me(request)));

  // Names the Slack account that has an address, before a code goes there.
  app.post<{ Body: { email?: unknown } }>('/me/slack/lookup', async (request, reply) => {
    const email = address(request.body?.email);
    if (!email) return reply.code(400).send({ error: 'invalid_request', message: 'An e-mail address is required.' });
    const found = await addresses.find(email);
    if (found === 'off') return reply.code(409).send({ error: 'slack_off', message: 'The Slack app of Data Hub is not set up here.' });
    if (!found) return reply.code(404).send({ error: 'not_found', message: 'No one in Slack has this address.' });
    return found;
  });

  app.post<{ Body: { email?: unknown; language?: unknown } }>('/me/slack/code', async (request, reply) => {
    const email = address(request.body?.email);
    if (!email) return reply.code(400).send({ error: 'invalid_request', message: 'An e-mail address is required.' });
    const language = request.body?.language === 'en' ? 'en' : 'nl';
    const sent = await addresses.sendCode(me(request), email, language);
    if (sent === 'off') return reply.code(409).send({ error: 'slack_off', message: 'The Slack app of Data Hub is not set up here.' });
    if (sent === 'absent') return reply.code(404).send({ error: 'not_found', message: 'No one in Slack has this address.' });
    request.log.info({ userId: me(request).id }, 'a code was sent to confirm an address in Slack');
    return reply.code(202).send(sent);
  });

  app.post<{ Body: { code?: unknown } }>('/me/slack/confirm', async (request, reply) => {
    const code = typeof request.body?.code === 'string' ? request.body.code : '';
    const outcome = await addresses.confirm(me(request), code);
    if (outcome.state === 'wrong') return reply.code(400).send({ error: 'wrong_code', message: 'That code is not right.', triesLeft: outcome.triesLeft });
    if (outcome.state === 'expired') return reply.code(410).send({ error: 'expired', message: 'The code no longer holds; send another one.' });
    if (outcome.state === 'none') return reply.code(409).send({ error: 'no_code', message: 'No code was sent; send one first.' });
    request.log.info({ userId: me(request).id }, 'an address in Slack was confirmed');
    return addresses.state(me(request));
  });

  app.delete('/me/slack', async (request) => {
    await addresses.reset(me(request));
    return addresses.state(me(request));
  });
}
