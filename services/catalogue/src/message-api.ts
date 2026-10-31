import type { ServiceCallerVerifier } from '@datahub/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Collections, Viewer } from './collections.js';
import {
  FILTER_KINDS,
  FILTER_ON,
  type FilterKind,
  type FilterOn,
  type LensFacts,
  type Messages,
  type Sight,
  VIEWS,
  type View,
  WRITTEN_ON,
  type WrittenKind,
  type WrittenOn,
} from './messages.js';

export interface MessageRouteOptions {
  collections: Collections;
  messages: Messages;
  /** query, which tells about its Lenses and decides on a Request on one (DEC-PF-30). */
  lensCallers: ServiceCallerVerifier;
  /** identity, which tells about an Excel key: it expires within a month, or the Data Team revoked it (FR-PL-03). */
  keyCallers?: ServiceCallerVerifier;
  viewer: (request: FastifyRequest) => Viewer;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_MESSAGE = { error: 'not_found', message: 'No such Message, or not on an object you see.' };
const TEXT = 4000;
const REASON = 1000;

/** The words of a Message: 1 to 4000 characters. */
export function parseText(body: unknown, key = 'text'): string | null {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length >= 1 && text.length <= TEXT ? text : null;
}

/** A decision on a Request: accepted, or refused with a reason (FR-CV-08). */
export function parseDecision(body: unknown): { outcome: 'accepted' | 'refused'; text: string } | string {
  const input = (body ?? {}) as Record<string, unknown>;
  if (input.outcome !== 'accepted' && input.outcome !== 'refused') return 'The decision is accepted or refused.';
  const text = typeof input.text === 'string' ? input.text.trim() : input.text === undefined ? '' : null;
  if (text === null || text.length > REASON) return `The reason is a text of at most ${REASON} characters.`;
  if (input.outcome === 'refused' && text.length === 0) return 'A refusal needs a reason.';
  return { outcome: input.outcome, text };
}

/** What query tells about a Lens. */
export function parseLensFacts(body: unknown): LensFacts | string {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
  if (!text(input.name, 200) || !text(input.authorId, 128) || !text(input.authorName, 200)) return 'A Lens has a name and an author, by ID and name.';
  if (typeof input.collectionId !== 'string' || !UUID.test(input.collectionId)) return 'A Lens is in a Collection, named by its ID.';
  if (!Array.isArray(input.resourceIds) || input.resourceIds.length > 100 || !input.resourceIds.every((id) => typeof id === 'string' && UUID.test(id))) {
    return 'A Lens reads Resources, named by their IDs.';
  }
  if (!['published', 'waiting', 'stopped', 'refused'].includes(input.state as string)) return 'A Lens is published, waiting, stopped or refused.';
  return {
    name: input.name as string,
    collectionId: input.collectionId.toLowerCase(),
    resourceIds: (input.resourceIds as string[]).map((id) => id.toLowerCase()),
    state: input.state as LensFacts['state'],
    authorId: input.authorId as string,
    authorName: input.authorName as string,
  };
}

/**
 * The routes of Messages (TR-CV-01): the Message Centre and its counts, the Messages on an object, one
 * conversation, writing, replying, reading, and the decision on a Request on a query. query tells about its
 * Lenses, sends the Request of Data Hub on a Lens that grew, and records the decision on a Request on a
 * Lens, with its Google ID token: the Lens itself changes in query.
 */
export async function messageRoutes(app: FastifyInstance, options: MessageRouteOptions): Promise<void> {
  const { collections, messages, lensCallers, keyCallers, viewer } = options;

  async function sightOf(request: FastifyRequest): Promise<Sight> {
    const who = viewer(request);
    return messages.sight(who, await collections.list(who));
  }

  /** The ID of an object as catalogue keeps it: a UUID in lower case, or the number of a Learning Card as it is. */
  const objectId = (kind: string, id: string): string | null => (kind === 'learningCard' ? (/^[0-9A-Za-z.]{2,12}$/.test(id) ? id : null) : UUID.test(id) ? id.toLowerCase() : null);

  /** Only query, with its Google ID token, calls the internal routes of Lenses. */
  async function onlyQuery(request: FastifyRequest, reply: FastifyReply) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
    try {
      await lensCallers.verify(token);
    } catch (error) {
      request.log.warn({ err: error, url: request.url }, 'an internal call about Lenses was refused');
      return reply.code(401).send({ error: 'unauthorized', message: 'Only query tells about its Lenses.' });
    }
  }

  // The Message Centre (FR-CV-06): the conversations of a view, filtered on kind, kind of object and words.
  app.get<{ Querystring: { view?: string; kind?: string; on?: string; search?: string } }>('/messages', async (request, reply) => {
    const { view = 'forYou', kind, on, search = '' } = request.query;
    if (!(VIEWS as readonly string[]).includes(view)) return reply.code(400).send({ error: 'invalid_request', message: `The view is one of ${VIEWS.join(', ')}.` });
    if (kind !== undefined && !(FILTER_KINDS as readonly string[]).includes(kind)) return reply.code(400).send({ error: 'invalid_request', message: `The kind is one of ${FILTER_KINDS.join(', ')}.` });
    if (on !== undefined && !(FILTER_ON as readonly string[]).includes(on)) return reply.code(400).send({ error: 'invalid_request', message: `The object is one of ${FILTER_ON.join(', ')}.` });
    if (search.length > 200) return reply.code(400).send({ error: 'invalid_request', message: 'A search has at most 200 characters.' });
    return messages.list(await sightOf(request), { view: view as View, kind: kind as FilterKind | undefined, on: on as FilterOn | undefined, search: search.trim() || undefined });
  });

  // The number on Messages in the rail (FR-CV-06).
  app.get('/messages/unread', async (request) => ({ unread: await messages.unread(await sightOf(request)) }));

  // The Messages on a Collection, a Resource, a Lens or a Learning Card, for its slide-in and its number (FR-CV-04, FR-CV-07).
  app.get<{ Params: { kind: string; id: string } }>('/messages/on/:kind/:id', async (request, reply) => {
    const { kind } = request.params;
    const id = objectId(kind, request.params.id);
    if (!(kind in WRITTEN_ON) || !id) return reply.code(404).send(NO_MESSAGE);
    const sight = await sightOf(request);
    if (!messages.sees(sight, kind as WrittenOn, id)) return reply.code(404).send({ error: 'not_found', message: 'No such object, or not one you see.' });
    return { messages: await messages.on(kind as WrittenOn, id, sight), kinds: WRITTEN_ON[kind as WrittenOn] };
  });

  // One conversation, opened in the Message Centre or in context (FR-CV-09).
  app.get<{ Params: { id: string } }>('/messages/:id', async (request, reply) => {
    const conversation = await messages.conversation(request.params.id, await sightOf(request));
    return conversation ? { message: conversation } : reply.code(404).send(NO_MESSAGE);
  });

  // A Question, Remark or Signal on an object the User sees; its Subject is that object (DEC-CV-01).
  app.post<{ Body: unknown }>('/messages', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const on = body.subjectKind as string;
    const id = typeof body.subjectId === 'string' ? objectId(on, body.subjectId) : null;
    if (!(on in WRITTEN_ON) || !id) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A Message is on a Collection, a Resource or a Lens, named by its ID, or on a Learning Card, named by its number.' });
    }
    const kinds: readonly string[] = WRITTEN_ON[on as WrittenOn];
    if (!kinds.includes(body.kind as string)) return reply.code(400).send({ error: 'invalid_request', message: `A Message on a ${on} is a ${kinds.join(', a ')}.` });
    const text = parseText(body);
    if (text === null) return reply.code(400).send({ error: 'invalid_request', message: `A Message has 1 to ${TEXT} characters.` });
    const sight = await sightOf(request);
    const subject = { kind: on as WrittenOn, id };
    if (!messages.sees(sight, subject.kind, subject.id)) return reply.code(404).send({ error: 'not_found', message: 'No such object, or not one you see.' });
    return reply.code(201).send({ message: await messages.write(sight, subject, body.kind as WrittenKind, text) });
  });

  // A reply in a conversation of a Question, Remark or Signal (MSG-CNV-04).
  app.post<{ Params: { id: string }; Body: unknown }>('/messages/:id/replies', async (request, reply) => {
    const text = parseText(request.body);
    if (text === null) return reply.code(400).send({ error: 'invalid_request', message: `A reply has 1 to ${TEXT} characters.` });
    const outcome = await messages.reply(request.params.id, await sightOf(request), text);
    if (outcome === 'not_found') return reply.code(404).send(NO_MESSAGE);
    if (outcome === 'no_replies') return reply.code(409).send({ error: 'no_replies', message: 'A Request is answered by its decision, and what Data Hub writes takes no reply.' });
    return reply.code(201).send({ message: outcome });
  });

  // The User read a conversation: unread again once someone else moves it.
  app.post<{ Params: { id: string } }>('/messages/:id/read', async (request, reply) =>
    (await messages.read(request.params.id, await sightOf(request))) ? reply.code(204).send() : reply.code(404).send(NO_MESSAGE),
  );

  // The Data Team decides on a Request to run a query above 1 GB (FR-CV-08, DEC-SR-36). A Request on a Lens is
  // decided on the Lens, in query, which publishes it (FR-LE-09).
  app.post<{ Params: { id: string }; Body: unknown }>('/messages/:id/decision', async (request, reply) => {
    const who = viewer(request);
    if (!who.dataTeam) return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team decides on a Request.' });
    const decision = parseDecision(request.body);
    if (typeof decision === 'string') return reply.code(400).send({ error: 'invalid_request', message: decision });
    const sight = await sightOf(request);
    const conversation = await messages.conversation(request.params.id, sight);
    if (!conversation) return reply.code(404).send(NO_MESSAGE);
    if (conversation.subject.kind === 'lens') return reply.code(409).send({ error: 'decided_on_the_lens', message: 'A Request on a Lens is decided on the Lens.' });
    return decided(reply, await messages.decide(conversation.id, decision.outcome, decision.text, { id: who.id, name: who.name }, sight));
  });

  function decided(reply: FastifyReply, outcome: Awaited<ReturnType<Messages['decide']>>) {
    switch (outcome.outcome) {
      case 'decided':
        return { message: outcome.conversation };
      case 'not_found':
        return reply.code(404).send(NO_MESSAGE);
      case 'not_a_request':
        return reply.code(409).send({ error: 'not_a_request', message: 'Only a Request takes a decision.' });
      case 'not_waiting':
        return reply.code(409).send({ error: 'not_waiting', message: 'This Request was decided already.' });
    }
  }

  // identity tells about the Excel key of a User (MSG-KEY-01, MSG-KEY-02); the Message is for that User alone.
  if (keyCallers) {
    app.post<{ Body: unknown }>(
      '/internal/excel-keys/notices',
      {
        config: { public: true },
        onRequest: async (request, reply) => {
          const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
          try {
            await keyCallers.verify(token);
          } catch (error) {
            request.log.warn({ err: error }, 'a notice about an Excel key was refused');
            return reply.code(401).send({ error: 'unauthorized', message: 'Only identity tells about Excel keys.' });
          }
        },
      },
      async (request, reply) => {
        const body = (request.body ?? {}) as Record<string, unknown>;
        const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max;
        const type = body.type;
        if ((type !== 'MSG-KEY-01' && type !== 'MSG-KEY-02') || typeof body.keyId !== 'string' || !UUID.test(body.keyId) || !text(body.userId, 200) || !text(body.name, 80)) {
          return reply.code(400).send({ error: 'invalid_request', message: 'A notice names its type, the key, its User and its name.' });
        }
        if (type === 'MSG-KEY-01' && !(typeof body.expires === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expires))) {
          return reply.code(400).send({ error: 'invalid_request', message: 'A key that expires says on which day, as YYYY-MM-DD.' });
        }
        if (type === 'MSG-KEY-02' && !text(body.actor, 200)) {
          return reply.code(400).send({ error: 'invalid_request', message: 'A revoked key says who of the Data Team revoked it.' });
        }
        const made = await messages.keyNotice({
          type,
          keyId: body.keyId.toLowerCase(),
          userId: body.userId as string,
          name: body.name as string,
          ...(type === 'MSG-KEY-01' ? { expires: body.expires as string } : { actor: body.actor as string }),
        });
        return reply.code(201).send(made);
      },
    );
  }

  // query tells what it keeps about a Lens whenever it changes, and all of them once a day (DEC-PF-30).
  app.put<{ Params: { id: string }; Body: unknown }>('/internal/lenses/:id', { config: { public: true }, onRequest: onlyQuery }, async (request, reply) => {
    if (!UUID.test(request.params.id)) return reply.code(400).send({ error: 'invalid_request', message: 'A Lens is named by its ID.' });
    const facts = parseLensFacts(request.body);
    if (typeof facts === 'string') return reply.code(400).send({ error: 'invalid_request', message: facts });
    await messages.keepLens(request.params.id.toLowerCase(), facts);
    return reply.code(204).send();
  });

  // The Request Data Hub sends when a Lens grew into very large and stopped (MSG-LEN-03, DEC-LE-11).
  app.post<{ Params: { id: string }; Body: unknown }>('/internal/lenses/:id/requests', { config: { public: true }, onRequest: onlyQuery }, async (request, reply) => {
    const input = (request.body ?? {}) as Record<string, unknown>;
    const size = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
    if (!UUID.test(request.params.id) || !size(input.reads) || !size(input.threshold)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A Lens by its ID, with what one run reads and the threshold, in bytes.' });
    }
    if (input.partitions !== undefined && !(typeof input.partitions === 'number' && Number.isSafeInteger(input.partitions) && input.partitions >= 0)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'The partitions one run reads are a count.' });
    }
    const sent = await messages.grew(request.params.id.toLowerCase(), {
      reads: input.reads as number,
      threshold: input.threshold as number,
      ...(input.partitions === undefined ? {} : { partitions: input.partitions as number }),
    });
    return reply.code(sent.sent ? 201 : 200).send({ request: { id: sent.id } });
  });

  // What Data Hub tells the author of a Lens that grew into large and keeps running (MSG-LEN-02, FR-LE-10).
  app.post<{ Params: { id: string }; Body: unknown }>('/internal/lenses/:id/growth', { config: { public: true }, onRequest: onlyQuery }, async (request, reply) => {
    const input = (request.body ?? {}) as Record<string, unknown>;
    const size = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
    if (!UUID.test(request.params.id) || !size(input.reads) || !size(input.threshold)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A Lens by its ID, with what one run reads and the threshold, in bytes.' });
    }
    const told = await messages.grewLarge(request.params.id.toLowerCase(), { reads: input.reads as number, threshold: input.threshold as number });
    return reply.code(201).send({ message: told });
  });

  // The decision on a Request on a Lens, recorded for query, which changes the Lens with it (FR-LE-09).
  app.post<{ Params: { id: string }; Body: unknown }>('/internal/messages/:id/decision', { config: { public: true }, onRequest: onlyQuery }, async (request, reply) => {
    const decision = parseDecision(request.body);
    if (typeof decision === 'string') return reply.code(400).send({ error: 'invalid_request', message: decision });
    const decider = (request.body as { decider?: { id?: unknown; name?: unknown } }).decider;
    if (typeof decider?.id !== 'string' || typeof decider.name !== 'string' || !decider.id || !decider.name) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Name the member of the Data Team who decided, by ID and name.' });
    }
    return decided(reply, await messages.decide(request.params.id, decision.outcome, decision.text, { id: decider.id, name: decider.name }));
  });
}
