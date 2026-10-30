import { topicOf } from '@datahub/learning';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Viewer } from './collections.js';
import { LEARNING_STEPS, type LearningStep } from './database.js';
import type { Learning } from './learning.js';

const NO_CARD = { error: 'not_found', message: 'There is no such Learning Card.' };

/**
 * The progress of the User in the Learning Centre (FR-LR-05, FR-LR-32): what they saw, where they stopped and
 * what they understand. A User reads and writes only their own; the Data Team reads everyone's in Cloud SQL
 * Studio (DEC-LR-13). A card is named by its number in the plan.
 */
export async function learningRoutes(app: FastifyInstance, options: { learning: Learning; viewer: (request: FastifyRequest) => Viewer }): Promise<void> {
  const { learning, viewer } = options;

  app.get('/learning/progress', async (request) => ({ progress: await learning.progress(viewer(request).id) }));

  // The User opened a card, or went to another step of it; the first time, they saw it.
  app.put<{ Params: { card: string }; Body: unknown }>('/learning/progress/:card', async (request, reply) => {
    if (!topicOf(request.params.card)) return reply.code(404).send(NO_CARD);
    const step = (request.body as { step?: unknown } | undefined)?.step;
    if (!(LEARNING_STEPS as readonly unknown[]).includes(step)) return reply.code(400).send({ error: 'invalid_request', message: `The step is one of ${LEARNING_STEPS.join(', ')}.` });
    return { progress: await learning.open(viewer(request).id, request.params.card, step as LearningStep) };
  });

  // "I understand it", and undoing it.
  app.put<{ Params: { card: string } }>('/learning/progress/:card/understood', async (request, reply) => {
    if (!topicOf(request.params.card)) return reply.code(404).send(NO_CARD);
    return { progress: await learning.understand(viewer(request).id, request.params.card, true) };
  });
  app.delete<{ Params: { card: string } }>('/learning/progress/:card/understood', async (request, reply) => {
    if (!topicOf(request.params.card)) return reply.code(404).send(NO_CARD);
    return { progress: await learning.understand(viewer(request).id, request.params.card, false) };
  });
}
