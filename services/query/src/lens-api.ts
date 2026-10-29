import type { ServiceCallerVerifier } from '@datahub/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type BigQuery, BigQueryRefused } from './bigquery.js';
import { missingIn, missingOf } from './broken.js';
import type { Catalogue, QueryRequest, SeenCollection } from './catalogue.js';
import type { LensRange, NamedResource } from './database.js';
import type { Lens, LensParameter, Lenses } from './lenses.js';
import { bind, type Parameter, parseParameters } from './parameters.js';
import { type Preflight, rangeOf, type ResourceOfQuery, type Thresholds } from './preflight.js';
import type { Queries, Query, Viewer } from './queries.js';

/** What the routes of Lenses share with those of queries: who asks, the checks and a run. */
export interface LensContext {
  lenses: Lenses;
  queries: Queries;
  catalogue: Catalogue;
  thresholds: Thresholds;
  bigquery: BigQuery;
  /** Who may start the daily check of every Lens: the scheduler, by a Google ID token (DEC-LE-20). */
  checkers: ServiceCallerVerifier;
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
/** The ranges of one run, from small to large (DEC-SR-29). */
const ORDER: Record<LensRange, number> = { free: 0, approve: 1, request: 2 };

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

/** What its Owner Unit changes about a Lens: its texts, tags and the names Users see, never its SQL. */
export function parseEdit(body: unknown): Partial<Pick<LensFields, 'name' | 'question' | 'shows' | 'steps' | 'tags' | 'labels'>> | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const fields = body as Record<string, unknown>;
  const editable = ['name', 'question', 'shows', 'steps', 'tags', 'labels'];
  const unknown = Object.keys(fields).find((key) => !editable.includes(key));
  if (unknown) return `A Lens has no field ${unknown} to change here.`;
  if (Object.keys(fields).length === 0) return 'Send at least one field to change.';
  // The same rules as when it was made, on a query and a Collection that do not change.
  const parsed = parseLens({ queryId: '00000000-0000-4000-8000-000000000000', collectionId: '00000000-0000-4000-8000-000000000000', name: 'x', ...fields });
  if (typeof parsed === 'string') return parsed;
  const changes: Partial<Pick<LensFields, 'name' | 'question' | 'shows' | 'steps' | 'tags' | 'labels'>> = {};
  if (fields.name !== undefined) changes.name = parsed.name;
  if (fields.question !== undefined) changes.question = parsed.question;
  if (fields.shows !== undefined) changes.shows = parsed.shows;
  if (fields.steps !== undefined) changes.steps = parsed.steps;
  if (fields.tags !== undefined) changes.tags = parsed.tags;
  if (fields.labels !== undefined) changes.labels = parsed.labels;
  return changes;
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
  const { lenses, queries, catalogue, thresholds, bigquery, checkers, viewer, authorization, resourcesOf, check, unavailable, execute } = context;

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
      // What it misses, for the red dot wherever it is listed (DEC-UX-81).
      broken: lens.broken,
    };
  }

  /** Whether the User may change the Lens: its Owner Unit and the Data Team (DEC-CO-15, DEC-CO-18). */
  const managesLens = (sight: Sight, lens: Lens) => sight.who.dataTeam || sight.collections.get(lens.collectionId)?.canManage === true;

  /** A Lens as its page shows it: everything but its SQL, which no page shows (FR-LE-14, DEC-UX-27). */
  async function viewOf(request: FastifyRequest, sight: Sight, lens: Lens) {
    const [from, versions, log] = await Promise.all([queries.get(lens.queryId), lenses.versions(lens.id), lenses.log(lens.id)]);
    // The name of the query each version came from, for its history (DEC-LE-18).
    const names = new Map<string, string>();
    for (const version of versions) {
      if (!names.has(version.fromQueryId)) names.set(version.fromQueryId, (await queries.get(version.fromQueryId))?.name ?? '');
    }
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
      canManage: managesLens(sight, lens),
      version: lens.version,
      range: lens.range,
      reads: lens.reads,
      stoppedAt: lens.stoppedAt,
      stoppedReads: lens.stoppedReads,
      fromQuery: from ? { id: from.id, name: from.name } : null,
      request: requestView(request_),
      versions: versions.map(({ version, madeByName, madeAt, fromQueryId }) => ({ version, madeByName, madeAt, fromQuery: names.get(fromQueryId) ?? '' })),
      log,
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
    const already = (await lenses.ofQuery(query.id)) ?? (query.forLens ? await lenses.get(query.forLens) : undefined);
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
    // While it waits for the Data Team, a Lens is frozen and does not run (DEC-LE-05); stopped, it runs for nobody (DEC-LE-11).
    if (seen.lens.state === 'waiting') return void reply.code(409).send({ error: 'waiting', message: 'This Lens waits for the Data Team.' });
    if (seen.lens.state === 'stopped') return void reply.code(409).send({ error: 'stopped', message: 'This Lens stopped: it waits for the Data Team to accept it again.' });
    const parameters = valuesFor(seen.lens, body.values);
    if (typeof parameters === 'string') return void reply.code(400).send({ error: 'invalid_request', message: parameters });
    const defaults = JSON.stringify(parameters) === JSON.stringify(valuesFor(seen.lens, undefined));
    return { lens: seen.lens, parameters, defaults, approve: body.approve === true };
  }

  /**
   * What a Pre-flight of a Lens tells about the Lens itself: it misses a table or a column, or works again
   * (FR-LE-17); and with its defaults, whether it grew past its range (DEC-LE-11, DEC-LE-19). It answers
   * when the Lens can no longer run.
   */
  async function upkeep(reply: FastifyReply, lens: Lens, checked: Preflight, defaults: boolean): Promise<Lens | undefined> {
    const missing = missingIn(checked);
    if (missing) {
      const broken = await lenses.breaks(lens.id, missing);
      void reply.code(409).send({ error: 'broken', message: `This Lens reads ${missing.name}, which no longer exists.`, broken: broken.broken });
      return undefined;
    }
    let kept = lens;
    if (lens.broken && checked.runnable) kept = await lenses.works(lens.id);
    if (defaults && checked.runnable && checked.range && ORDER[checked.range] > ORDER[kept.range]) {
      kept = await lenses.grow(lens.id, checked.range, checked.bytes ?? 0);
      if (kept.state === 'stopped') {
        void reply.code(409).send({ error: 'stopped', message: 'One run with its defaults now reads more than 1 GB: the Lens stopped until the Data Team accepts it again.', stoppedReads: kept.stoppedReads });
        return undefined;
      }
    }
    return kept;
  }

  // The Pre-flight of a run, in the button that runs it (DEC-UX-28).
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/preflight', async (request, reply) => {
    const run = await runnable(request, reply);
    if (!run) return reply;
    try {
      const checked = await check(run.lens.sql, run.parameters, await resourcesOf(request, run.lens));
      if (!(await upkeep(reply, run.lens, checked, run.defaults))) return reply;
      return { preflight: checked };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // A run, only when a User runs it (DEC-LE-12): a run of their query of this Lens, in the Query Log (FR-LE-12).
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/runs', async (request, reply) => {
    const run = await runnable(request, reply);
    if (!run) return reply;
    try {
      const checked = await check(run.lens.sql, run.parameters, await resourcesOf(request, run.lens));
      if (!(await upkeep(reply, run.lens, checked, run.defaults))) return reply;
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const query = await queries.lensFor(viewer(request), run.lens);
    return execute(request, reply, query, { sql: run.lens.sql, parameters: run.parameters, approve: run.approve });
  });

  /** The Lens, if the User sees it and may change it; while it waits for the Data Team, nobody changes it (DEC-LE-05). */
  async function managed(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const seen = await seenLens(request, reply);
    if (!seen) return undefined;
    if (!managesLens(seen.sight, seen.lens)) return void reply.code(403).send({ error: 'forbidden', message: 'Only its Owner Unit and the Data Team change a Lens.' });
    return seen;
  }

  // Its Owner Unit changes what a Lens tells, never its SQL: that is its query (FR-LE-06, DEC-UX-27).
  app.patch<{ Params: { id: string }; Body: unknown }>('/lenses/:id', async (request, reply) => {
    const changes = parseEdit(request.body);
    if (typeof changes === 'string') return reply.code(400).send({ error: 'invalid_request', message: changes });
    const seen = await managed(request, reply);
    if (!seen) return reply;
    if (seen.lens.state === 'waiting') return reply.code(409).send({ error: 'waiting', message: 'This Lens waits for the Data Team: nobody changes it until they decide.' });
    const lens = await lenses.edit(seen.lens.id, changes);
    return { lens: await viewOf(request, seen.sight, lens) };
  });

  // "Open in Query" (DEC-LE-18): its query for its author; a query of their own, used as the Lens, for anyone else.
  app.post<{ Params: { id: string } }>('/lenses/:id/query', async (request, reply) => {
    const seen = await managed(request, reply);
    if (!seen) return reply;
    const who = viewer(request);
    const source = await queries.get(seen.lens.queryId);
    if (source && source.ownerId === who.id) return { queryId: source.id };
    const own = await queries.forLens(who, seen.lens);
    return reply.code(own.created ? 201 : 200).send({ queryId: own.query.id });
  });

  // "Update the lens" (FR-LE-16): the SQL and Parameters of a query used as it, measured again, as its next version.
  app.put<{ Params: { id: string }; Body: unknown }>('/lenses/:id/version', async (request, reply) => {
    const body = (request.body ?? {}) as { queryId?: unknown; approve?: unknown; text?: unknown };
    if (typeof body.queryId !== 'string' || !UUID.test(body.queryId)) return reply.code(400).send({ error: 'invalid_request', message: 'A Lens is updated from a query, named by its ID.' });
    if (body.approve !== undefined && typeof body.approve !== 'boolean') return reply.code(400).send({ error: 'invalid_request', message: 'approve is true or false.' });
    const text = body.text ?? '';
    if (typeof text !== 'string' || text.trim().length > LIMITS.text) return reply.code(400).send({ error: 'invalid_request', message: `A word for the Data Team has at most ${LIMITS.text} characters.` });
    const seen = await managed(request, reply);
    if (!seen) return reply;
    const { lens } = seen;
    if (lens.state === 'waiting') return reply.code(409).send({ error: 'waiting', message: 'This Lens waits for the Data Team: nobody changes it until they decide.' });
    const who = viewer(request);
    const query = await queries.get(body.queryId);
    // Only a query of the User that is used as this Lens updates it (DEC-LE-04, DEC-LE-18).
    if (!query || query.ownerId !== who.id || (query.id !== lens.queryId && query.forLens !== lens.id)) {
      return reply.code(400).send({ error: 'invalid_request', message: 'A Lens is updated from a query of yours that is used as it.' });
    }
    let checked: Preflight;
    try {
      checked = await check(query.sql, query.parameters, await resourcesOf(request, query));
    } catch (error) {
      return unavailable(error, reply, request);
    }
    if (!checked.runnable || checked.range === null) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
    if (checked.range === 'approve' && body.approve !== true) {
      return reply.code(409).send({ error: 'approval_needed', message: 'One run reads more than 100 MB: update it anyway, or make it read less.', preflight: checked });
    }
    // A Parameter keeps the name Users see; a new one is named as in the query, until its Owner Unit names it.
    const parameters: LensParameter[] = query.parameters
      .filter((parameter) => !checked.unused.includes(parameter.name))
      .map((parameter) => ({ ...parameter, label: lens.parameters.find((known) => known.name === parameter.name)?.label ?? parameter.name }));
    const updated = await lenses.version(lens.id, { by: who, query, parameters, range: checked.range, reads: checked.bytes ?? 0 });
    if (updated.state === 'waiting') {
      try {
        await catalogue.sendLensRequest({ lensId: lens.id, name: lens.name, reads: updated.reads, threshold: thresholds.request, text: text.trim(), partitions: checked.partitions }, authorization(request));
      } catch (error) {
        request.log.error({ err: error }, 'The Request on a new version of a Lens could not be sent');
      }
    }
    return { lens: await viewOf(request, seen.sight, updated), preflight: checked };
  });

  // Once a day the scheduler has every Lens dry-run with its defaults (DEC-LE-20): what it misses, what works
  // again, and what grew (DEC-LE-19). A dry run reads nothing and costs nothing. No User starts it, so it
  // takes the Google ID token of the scheduler instead of an Access Token.
  app.post(
    '/internal/lenses/check',
    {
      config: { public: true },
      onRequest: async (request, reply) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
        try {
          await checkers.verify(token);
        } catch (error) {
          request.log.warn({ err: error }, 'a call for /internal/lenses/check was refused');
          return reply.code(401).send({ error: 'unauthorized', message: 'Only the scheduler checks every Lens.' });
        }
      },
    },
    async (request) => {
      const outcome = { checked: 0, broken: 0, works: 0, grown: 0, stopped: 0 };
      for (const lens of await lenses.list()) {
        if (lens.state === 'waiting') continue;
        outcome.checked += 1;
        const bound = bind(lens.sql, valuesFor(lens, undefined) as Parameter[]);
        try {
          const dry = await bigquery.dryRun(bound.sql, bound.parameters);
          if (lens.broken) {
            await lenses.works(lens.id);
            outcome.works += 1;
          }
          const range = rangeOf(dry.bytes, thresholds);
          if (lens.state === 'published' && ORDER[range] > ORDER[lens.range]) {
            const grown = await lenses.grow(lens.id, range, dry.bytes);
            outcome[grown.state === 'stopped' ? 'stopped' : 'grown'] += 1;
          }
        } catch (error) {
          const missing = error instanceof BigQueryRefused ? missingOf(error.message) : null;
          if (missing) {
            if (!lens.broken) outcome.broken += 1;
            await lenses.breaks(lens.id, missing);
          } else {
            request.log.warn({ err: error, lens: lens.id }, 'A Lens could not be checked');
          }
        }
      }
      request.log.info(outcome, 'Every Lens checked');
      return outcome;
    },
  );

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
