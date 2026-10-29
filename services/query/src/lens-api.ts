import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Catalogue, QueryRequest, SeenCollection } from './catalogue.js';
import type { NamedResource } from './database.js';
import type { Lens, LensParameter, Lenses } from './lenses.js';
import { type Parameter, parseParameters } from './parameters.js';
import type { Preflight, ResourceOfQuery, Thresholds } from './preflight.js';
import type { Queries, Query, Viewer } from './queries.js';

/** What the routes of Lenses share with those of queries: who asks, the checks and a run. */
export interface LensContext {
  lenses: Lenses;
  queries: Queries;
  catalogue: Catalogue;
  thresholds: Thresholds;
  viewer(request: FastifyRequest): Viewer;
  authorization(request: FastifyRequest): string;
  resourcesOf(request: FastifyRequest, of: { resources: NamedResource[] }): Promise<ResourceOfQuery[]>;
  check(sql: string, parameters: Parameter[], resources: ResourceOfQuery[]): Promise<Preflight>;
  unavailable(error: unknown, reply: FastifyReply, request: FastifyRequest): FastifyReply | undefined;
  execute(request: FastifyRequest, reply: FastifyReply, query: Query, body: { sql: string; parameters: Parameter[]; approve: boolean }): Promise<unknown>;
}

const NO_LENS = { error: 'not_found', message: 'There is no such Lens, or you may not see it.' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TAG = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,29}$/u;
const LIMITS = { name: 120, question: 500, shows: 500, steps: 20, step: 300, tags: 10, label: 60, text: 500 };

/** What its author tells about a Lens when making it from a query (FR-LE-06, FR-LE-07, DEC-LE-16). */
export interface LensFields {
  queryId: string;
  collectionId: string;
  name: string;
  question: string;
  shows: string;
  steps: string[];
  tags: string[];
  /** The name Users see, per Parameter of the query (DEC-DH-11). */
  labels: Record<string, string>;
  /** Its author publishes it anyway, above 100 MB a run (FR-LE-08). */
  approve: boolean;
  /** A word for the Data Team, above 1 GB a run (FR-LE-09). */
  text: string;
}

const texts = (value: unknown, max: number, each: number): string[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || !value.every((item) => typeof item === 'string' && item.trim().length <= each)) return null;
  return value.map((item: string) => item.trim()).filter((item) => item.length > 0);
};

/** The fields of a new Lens; a string says what does not fit. */
export function parseLens(body: unknown): LensFields | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const fields = body as Record<string, unknown>;
  const known = ['queryId', 'collectionId', 'name', 'question', 'shows', 'steps', 'tags', 'labels', 'approve', 'text'];
  const unknown = Object.keys(fields).find((key) => !known.includes(key));
  if (unknown) return `A Lens has no field ${unknown}.`;
  if (typeof fields.queryId !== 'string' || !UUID.test(fields.queryId)) return 'A Lens is made from a query, named by its ID.';
  if (typeof fields.collectionId !== 'string' || !UUID.test(fields.collectionId)) return 'A Lens goes into a Collection, named by its ID.';
  if (typeof fields.name !== 'string' || fields.name.trim().length < 1 || fields.name.trim().length > LIMITS.name) return `The name has 1 to ${LIMITS.name} characters.`;
  for (const key of ['question', 'shows'] as const) {
    const value = fields[key] ?? '';
    if (typeof value !== 'string' || value.trim().length > LIMITS[key]) return `${key === 'question' ? 'The question' : 'What it shows'} has at most ${LIMITS[key]} characters.`;
  }
  const steps = texts(fields.steps, LIMITS.steps, LIMITS.step);
  if (!steps) return `What it does is at most ${LIMITS.steps} steps of ${LIMITS.step} characters.`;
  const tags = texts(fields.tags, LIMITS.tags, 31);
  const cleanTags = tags?.map((tag) => tag.replace(/^#/, '').toLowerCase());
  if (!cleanTags || !cleanTags.every((tag) => TAG.test(tag))) return `A Lens has at most ${LIMITS.tags} tags, each a word of letters, digits, - or _.`;
  const labels = fields.labels ?? {};
  if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) return 'The names Users see are an object, by Parameter.';
  for (const label of Object.values(labels)) {
    if (typeof label !== 'string' || label.trim().length < 1 || label.trim().length > LIMITS.label) return `The name Users see of a Parameter has 1 to ${LIMITS.label} characters.`;
  }
  if (fields.approve !== undefined && typeof fields.approve !== 'boolean') return 'approve is true or false.';
  const text = fields.text ?? '';
  if (typeof text !== 'string' || text.trim().length > LIMITS.text) return `A word for the Data Team has at most ${LIMITS.text} characters.`;
  return {
    queryId: fields.queryId.toLowerCase(),
    collectionId: fields.collectionId.toLowerCase(),
    name: fields.name.trim(),
    question: ((fields.question as string | undefined) ?? '').trim(),
    shows: ((fields.shows as string | undefined) ?? '').trim(),
    steps,
    tags: [...new Set(cleanTags)],
    labels: Object.fromEntries(Object.entries(labels as Record<string, string>).map(([name, label]) => [name, label.trim()])),
    approve: fields.approve === true,
    text: text.trim(),
  };
}

/** A Parameter as BigQuery and the checks need it: without the name Users see. */
const plain = ({ label: _label, ...parameter }: LensParameter): Parameter => parameter as Parameter;

/**
 * The Parameters of a run of a Lens: its own, with the values the User chose instead of the defaults
 * (FR-LE-04, DEC-LE-01). Only values change, never a kind or a list; a string says what does not fit.
 */
export function valuesFor(lens: Pick<Lens, 'parameters'>, values: unknown): Parameter[] | string {
  if (values === undefined) return lens.parameters.map(plain);
  if (typeof values !== 'object' || values === null || Array.isArray(values)) return 'The values are an object, by Parameter.';
  const chosen = values as Record<string, unknown>;
  const stranger = Object.keys(chosen).find((name) => !lens.parameters.some((parameter) => parameter.name === name));
  if (stranger) return `This Lens has no Parameter ${stranger}.`;
  const merged = lens.parameters.map((parameter) => {
    const value = chosen[parameter.name];
    if (value === undefined) return plain(parameter);
    if (parameter.kind === 'period') {
      const { value: from, to } = (typeof value === 'object' && value !== null ? value : {}) as { value?: unknown; to?: unknown };
      return { ...plain(parameter), value: from, to } as unknown as Parameter;
    }
    return { ...plain(parameter), value } as unknown as Parameter;
  });
  return parseParameters(merged);
}

/** What a User may see of Lenses: the Collections they see, the Resources they may use and their Level (DEC-CO-16). */
interface Sight {
  who: Viewer;
  collections: Map<string, SeenCollection>;
  resources: Map<string, { level: number; collectionId: string; displayName: string }>;
}

/** A Request as a waiting Lens shows it (FR-LE-09). */
const requestView = (request: QueryRequest | undefined) => (request ? { state: request.state, sentAt: request.createdAt, reads: request.reads, text: request.text } : null);

/**
 * The routes of Lenses (TR-LE-01): making one from a query, with its size check (FR-LE-07, FR-LE-08);
 * reading them as a User may see them (DEC-LE-09, DEC-CO-16), never with their SQL (FR-LE-14); and running
 * one with its Parameters, every run a query in the Query Log (FR-LE-12).
 */
export async function lensRoutes(app: FastifyInstance, context: LensContext): Promise<void> {
  const { lenses, queries, catalogue, thresholds, viewer, authorization, resourcesOf, check, unavailable, execute } = context;

  async function sightOf(request: FastifyRequest): Promise<Sight> {
    const collections = await catalogue.collections(authorization(request));
    const resources = new Map<string, { level: number; collectionId: string; displayName: string }>();
    for (const collection of collections) for (const resource of collection.resources) resources.set(resource.id, { ...resource, collectionId: collection.id });
    return { who: viewer(request), collections: new Map(collections.map((collection) => [collection.id, collection])), resources };
  }

  /**
   * Whether the User sees the Lens: in a Collection they see, on Resources they may all use (DEC-CO-16);
   * while it waits for the Data Team, only its author and the Data Team (FR-LE-09).
   */
  function sees(sight: Sight, lens: Lens): boolean {
    if (!sight.collections.has(lens.collectionId)) return false;
    if (lens.state === 'waiting' && lens.authorId !== sight.who.id && !sight.who.dataTeam) return false;
    // The Data Team may use every Resource, those without a Collection too.
    return sight.who.dataTeam || lens.resources.every((resource) => sight.resources.has(resource.id));
  }

  /** The Level of a Lens: the lowest of those it is built on (DEC-DH-10). */
  const levelOf = (sight: Sight, lens: Lens) => Math.min(...lens.resources.map((resource) => sight.resources.get(resource.id)?.level ?? 0));

  function itemOf(sight: Sight, lens: Lens) {
    return {
      id: lens.id,
      name: lens.name,
      question: lens.question,
      shows: lens.shows,
      tags: lens.tags,
      collectionId: lens.collectionId,
      level: levelOf(sight, lens),
      state: lens.state,
      resources: lens.resources.map(({ id, displayName }) => ({ id, displayName })),
      authorName: lens.authorName,
      mine: lens.authorId === sight.who.id,
      createdAt: lens.createdAt,
      publishedAt: lens.publishedAt,
    };
  }

  /** A Lens as its page shows it: everything but its SQL, which no page shows (FR-LE-14, DEC-UX-27). */
  async function viewOf(request: FastifyRequest, sight: Sight, lens: Lens) {
    const from = await queries.get(lens.queryId);
    let request_: QueryRequest | undefined;
    if (lens.state === 'waiting') {
      try {
        request_ = (await catalogue.requests(lens.id, authorization(request), 'lens')).find((sent) => sent.writerId === lens.authorId);
      } catch (error) {
        request.log.warn({ err: error }, 'catalogue did not tell the Request on a Lens; it is shown without it');
      }
    }
    return {
      ...itemOf(sight, lens),
      steps: lens.steps,
      parameters: lens.parameters,
      resources: lens.resources.map(({ id, displayName }) => {
        const seen = sight.resources.get(id);
        return { id, displayName: seen?.displayName ?? displayName, collectionId: seen?.collectionId ?? null, level: seen?.level ?? 0 };
      }),
      canManage: sight.who.dataTeam || sight.collections.get(lens.collectionId)?.canManage === true,
      version: lens.version,
      range: lens.range,
      reads: lens.reads,
      fromQuery: from ? { id: from.id, name: from.name } : null,
      request: requestView(request_),
    };
  }

  /** The Lens, if the User may see it, with what they may see; otherwise answered as not found. */
  async function seenLens(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<{ lens: Lens; sight: Sight } | undefined> {
    const lens = await lenses.get(request.params.id);
    if (!lens) {
      void reply.code(404).send(NO_LENS);
      return undefined;
    }
    let sight: Sight;
    try {
      sight = await sightOf(request);
    } catch (error) {
      unavailable(error, reply, request);
      return undefined;
    }
    if (!sees(sight, lens)) {
      void reply.code(404).send(NO_LENS);
      return undefined;
    }
    return { lens, sight };
  }

  // A query becomes a Lens (FR-LE-07): its SQL, Parameters and Resources, measured now (FR-LE-08). Within
  // range or approved it is published; above 1 GB it waits for the Data Team, frozen (FR-LE-09, DEC-LE-05).
  app.post<{ Body: unknown }>('/lenses', async (request, reply) => {
    const fields = parseLens(request.body);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    const who = viewer(request);
    const query = await queries.get(fields.queryId);
    if (!query || query.kind !== 'query' || (query.ownerId !== who.id && !who.dataTeam)) return reply.code(404).send({ error: 'not_found', message: 'There is no such query, or it is not yours.' });
    if (query.ownerId !== who.id) return reply.code(403).send({ error: 'forbidden', message: 'Only who made a query makes it a Lens.' });
    const already = await lenses.ofQuery(query.id);
    if (already) return reply.code(409).send({ error: 'already_a_lens', message: 'This query is used as a Lens already.', lens: { id: already.id, name: already.name } });
    let checked: Preflight;
    try {
      // A Lens always goes into a Collection its author owns (DEC-CO-20).
      if ((await catalogue.manages(fields.collectionId, authorization(request))) !== true) {
        return reply.code(400).send({ error: 'invalid_request', message: 'A Lens goes into a Collection you own.' });
      }
      checked = await check(query.sql, query.parameters, await resourcesOf(request, query));
    } catch (error) {
      return unavailable(error, reply, request);
    }
    if (!checked.runnable || checked.range === null) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
    if (checked.range === 'approve' && !fields.approve) {
      return reply.code(409).send({ error: 'approval_needed', message: 'One run reads more than 100 MB: publish it anyway, or make it read less.', preflight: checked });
    }
    // Its Parameters are those the SQL uses, each with the name Users see (DEC-LE-01, DEC-DH-11).
    const parameters: LensParameter[] = query.parameters
      .filter((parameter) => !checked.unused.includes(parameter.name))
      .map((parameter) => ({ ...parameter, label: fields.labels[parameter.name] ?? parameter.name }));
    const lens = await lenses.create({
      author: who,
      query,
      collectionId: fields.collectionId,
      name: fields.name,
      question: fields.question,
      shows: fields.shows,
      steps: fields.steps,
      tags: fields.tags,
      parameters,
      range: checked.range,
      reads: checked.bytes ?? 0,
    });
    if (lens.state === 'waiting') {
      try {
        await catalogue.sendLensRequest({ lensId: lens.id, name: lens.name, reads: lens.reads, threshold: thresholds.request, text: fields.text, partitions: checked.partitions }, authorization(request));
      } catch (error) {
        // The Lens is kept and waits; its author sends the Request again from it.
        request.log.error({ err: error }, 'The Request on a new Lens could not be sent');
      }
    }
    try {
      const sight = await sightOf(request);
      return reply.code(201).send({ lens: await viewOf(request, sight, lens), preflight: checked });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // The Lenses the User sees, for the panel of Collections and the page of a Collection (FR-CO-28, FR-CO-36).
  app.get('/lenses', async (request, reply) => {
    try {
      const sight = await sightOf(request);
      return { lenses: (await lenses.list()).filter((lens) => sees(sight, lens)).map((lens) => itemOf(sight, lens)) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  app.get<{ Params: { id: string } }>('/lenses/:id', async (request, reply) => {
    const seen = await seenLens(request, reply);
    if (!seen) return reply;
    return { lens: await viewOf(request, seen.sight, seen.lens) };
  });

  /** The Lens and the Parameters of a run of it, if the User may run it; otherwise answered. */
  async function runnable(request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) {
    const body = (request.body ?? {}) as { values?: unknown; approve?: unknown };
    if (typeof body !== 'object' || Array.isArray(body)) return void reply.code(400).send({ error: 'invalid_request', message: 'Send a JSON object.' });
    if (body.approve !== undefined && typeof body.approve !== 'boolean') return void reply.code(400).send({ error: 'invalid_request', message: 'approve is true or false.' });
    const seen = await seenLens(request, reply);
    if (!seen) return undefined;
    // While it waits for the Data Team, a Lens is frozen and does not run (DEC-LE-05).
    if (seen.lens.state === 'waiting') return void reply.code(409).send({ error: 'waiting', message: 'This Lens waits for the Data Team.' });
    const parameters = valuesFor(seen.lens, body.values);
    if (typeof parameters === 'string') return void reply.code(400).send({ error: 'invalid_request', message: parameters });
    return { lens: seen.lens, parameters, approve: body.approve === true };
  }

  // The Pre-flight of a run, in the button that runs it (DEC-UX-28).
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/preflight', async (request, reply) => {
    const run = await runnable(request, reply);
    if (!run) return reply;
    try {
      return { preflight: await check(run.lens.sql, run.parameters, await resourcesOf(request, run.lens)) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // A run, only when a User runs it (DEC-LE-12): a run of their query of this Lens, in the Query Log (FR-LE-12).
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/runs', async (request, reply) => {
    const run = await runnable(request, reply);
    if (!run) return reply;
    const query = await queries.lensFor(viewer(request), run.lens);
    return execute(request, reply, query, { sql: run.lens.sql, parameters: run.parameters, approve: run.approve });
  });

  // Its author sends the Request on a waiting Lens again, when it could not be sent; one that waits is given back.
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/requests', async (request, reply) => {
    const { text = '' } = (request.body ?? {}) as { text?: unknown };
    if (typeof text !== 'string' || text.trim().length > LIMITS.text) return reply.code(400).send({ error: 'invalid_request', message: `A word for the Data Team has at most ${LIMITS.text} characters.` });
    const seen = await seenLens(request, reply);
    if (!seen) return reply;
    if (seen.lens.authorId !== viewer(request).id) return reply.code(403).send({ error: 'forbidden', message: 'Only its author sends a Lens to the Data Team.' });
    if (seen.lens.state !== 'waiting') return reply.code(409).send({ error: 'not_needed', message: 'This Lens does not wait for the Data Team.' });
    try {
      const sent = await catalogue.sendLensRequest(
        { lensId: seen.lens.id, name: seen.lens.name, reads: seen.lens.reads, threshold: thresholds.request, text: text.trim(), partitions: null },
        authorization(request),
      );
      return reply.code(201).send({ request: requestView(sent) });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });
}
