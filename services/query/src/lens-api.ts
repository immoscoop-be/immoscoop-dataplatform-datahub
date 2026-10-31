import { excelKeyFrom, type ExcelKeyExchanger, type ServiceCallerVerifier, type TokenVerifier } from '@datahub/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type BigQuery, BigQueryRefused } from './bigquery.js';
import { missingIn, missingOf } from './broken.js';
import type { Catalogue, QueryRequest, SeenCollection } from './catalogue.js';
import type { LensRange, NamedResource } from './database.js';
import type { Lens, LensParameter, Lenses } from './lenses.js';
import { bind, type Parameter, parseParameters } from './parameters.js';
import { type Preflight, rangeOf, type ResourceOfQuery, type Thresholds } from './preflight.js';
import type { Queries, Query, Viewer } from './queries.js';
import type { Upkeep } from './upkeep.js';

/** What the routes of Lenses share with those of queries: who asks, the checks and a run. */
export interface LensContext {
  lenses: Lenses;
  queries: Queries;
  catalogue: Catalogue;
  thresholds: Thresholds;
  bigquery: BigQuery;
  /** Who may start a check: the scheduler once a day (DEC-LE-20), catalogue after a new Current Version (FR-SR-52), by a Google ID token. */
  checkers: ServiceCallerVerifier;
  /** What keeps queries and Lenses Broken while what they read is missing, and working again (FR-SR-52). */
  upkeep: Upkeep;
  viewer(request: FastifyRequest): Viewer;
  authorization(request: FastifyRequest): string;
  resourcesOf(request: FastifyRequest, of: { resources: NamedResource[] }): Promise<ResourceOfQuery[]>;
  check(sql: string, parameters: Parameter[], resources: ResourceOfQuery[]): Promise<Preflight>;
  /** The SQL with each Resource by its full name in its own case, as BigQuery gets it (DEC-SR-44). */
  ownCase(sql: string, resources: ResourceOfQuery[]): string;
  unavailable(error: unknown, reply: FastifyReply, request: FastifyRequest): FastifyReply | undefined;
  execute(request: FastifyRequest, reply: FastifyReply, query: Query, body: { sql: string; parameters: Parameter[]; approve: boolean }, excel?: { rows: number }): Promise<unknown>;
  excel?: { exchanger: ExcelKeyExchanger; verifier: TokenVerifier } | undefined;
}

/** Excel gets at most this many rows of a Lens per refresh (DEC-CH-06). */
export const EXCEL_ROWS = 10_000;

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

/** A Request as a waiting or refused Lens shows it, with the decision of the Data Team (FR-LE-09, DEC-UX-128). */
const requestView = (request: QueryRequest | undefined) =>
  request ? { id: request.id, state: request.state, sentAt: request.createdAt, reads: request.reads, text: request.text, decision: request.decision } : null;

/**
 * The routes of Lenses (TR-LE-01): making one from a query, with its size check (FR-LE-07, FR-LE-08);
 * reading them as a User may see them (DEC-LE-09, DEC-CO-16), never with their SQL (FR-LE-14); and running
 * one with its Parameters, every run a query in the Query Log (FR-LE-12).
 */
export async function lensRoutes(app: FastifyInstance, context: LensContext): Promise<void> {
  const { lenses, queries, catalogue, thresholds, bigquery, checkers, upkeep: broken, viewer, authorization, resourcesOf, check, ownCase, unavailable, execute, excel } = context;

  async function sightOf(request: FastifyRequest): Promise<Sight> {
    const collections = await catalogue.collections(authorization(request));
    const resources = new Map<string, { level: number; collectionId: string; displayName: string }>();
    for (const collection of collections) for (const resource of collection.resources) resources.set(resource.id, { ...resource, collectionId: collection.id });
    return { who: viewer(request), collections: new Map(collections.map((collection) => [collection.id, collection])), resources };
  }

  /**
   * Whether the User sees the Lens: in a Collection they see, on Resources they may all use (DEC-CO-16);
   * while it waits for the Data Team or once they refused it, only its author and the Data Team (FR-LE-09,
   * DEC-UX-128). catalogue decides the same for the Messages on it.
   */
  function sees(sight: Sight, lens: Lens): boolean {
    if (!sight.collections.has(lens.collectionId)) return false;
    if ((lens.state === 'waiting' || lens.state === 'refused') && lens.authorId !== sight.who.id && !sight.who.dataTeam) return false;
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

  /** Tells catalogue what decides who sees the Messages on a Lens (DEC-PF-30); the daily check tells it again. */
  async function told(lens: Lens, log: FastifyRequest['log']): Promise<Lens> {
    try {
      await catalogue.keepLens(lens);
    } catch (error) {
      log.warn({ err: error, lens: lens.id }, 'catalogue did not hear of a Lens; the daily check tells it again');
    }
    return lens;
  }

  /**
   * A run with its defaults grew. Into large, past 100 MB, it keeps running and Data Hub tells its author
   * (MSG-LEN-02); past 1 GB it stops and Data Hub asks the Data Team to accept it again (MSG-LEN-03).
   */
  async function grown(id: string, range: LensRange, reads: number, log: FastifyRequest['log']): Promise<Lens> {
    const lens = await lenses.grow(id, range, reads);
    if (lens.state === 'stopped') {
      try {
        await catalogue.lensGrew({ lensId: lens.id, reads, threshold: thresholds.request });
      } catch (error) {
        log.error({ err: error, lens: lens.id }, 'The Request on a Lens that stopped could not be sent; the Data Team sends it on deciding');
      }
    } else if (range === 'approve') {
      try {
        await catalogue.lensGrewLarge({ lensId: lens.id, reads, threshold: thresholds.approve });
      } catch (error) {
        log.warn({ err: error, lens: lens.id }, 'The author of a Lens that grew into large could not be told');
      }
    }
    return told(lens, log);
  }

  /** A Lens as its page shows it: everything but its SQL, which no page shows (FR-LE-14, DEC-UX-27). */
  async function viewOf(request: FastifyRequest, sight: Sight, lens: Lens) {
    const [from, versions, log] = await Promise.all([queries.get(lens.queryId), lenses.versions(lens.id), lenses.log(lens.id)]);
    // The name of the query each version came from, for its history (DEC-LE-18).
    const names = new Map<string, string>();
    for (const version of versions) {
      if (!names.has(version.fromQueryId)) names.set(version.fromQueryId, (await queries.get(version.fromQueryId))?.name ?? '');
    }
    let request_: QueryRequest | undefined;
    if (lens.state === 'waiting' || lens.state === 'refused') {
      try {
        // The newest of its author: the one that waits, or the one the Data Team refused.
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
    let resources: ResourceOfQuery[];
    try {
      // A Lens always goes into a Collection its author owns (DEC-CO-20).
      if ((await catalogue.manages(fields.collectionId, authorization(request))) !== true) {
        return reply.code(400).send({ error: 'invalid_request', message: 'A Lens goes into a Collection you own.' });
      }
      resources = await resourcesOf(request, query);
      checked = await check(query.sql, query.parameters, resources);
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
    const lens = await told(
      await lenses.create({
        author: who,
        // A Lens keeps its SQL with its Resources as BigQuery knows them, for its daily check without a User (DEC-SR-44).
        query: { ...query, sql: ownCase(query.sql, resources) },
        collectionId: fields.collectionId,
        name: fields.name,
        question: fields.question,
        shows: fields.shows,
        steps: fields.steps,
        tags: fields.tags,
        parameters,
        range: checked.range,
        reads: checked.bytes ?? 0,
      }),
      request.log,
    );
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

  // The Lenses the User sees, for the panel of Collections, the page of a Collection and its start screen,
  // with when the User last ran each (FR-CO-28, FR-CO-36, FR-CO-37).
  app.get('/lenses', async (request, reply) => {
    try {
      const sight = await sightOf(request);
      const ran = await queries.lensRuns(sight.who.id);
      return { lenses: (await lenses.list()).filter((lens) => sees(sight, lens)).map((lens) => ({ ...itemOf(sight, lens), lastRunAt: ran.get(lens.id) ?? null })) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // The Lenses the User sees that share words with a question, for the search of the start screen of
  // Collections (FR-CO-37, DEC-UX-127): those that share most words first, the shared words marked.
  app.get<{ Querystring: { question?: string } }>('/lenses/search', async (request, reply) => {
    const question = (request.query.question ?? '').trim();
    if (question.length > LIMITS.question) return reply.code(400).send({ error: 'invalid_request', message: `The question has at most ${LIMITS.question} characters.` });
    let sight: Sight;
    try {
      sight = await sightOf(request);
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const seen = (await lenses.list()).filter((lens) => sees(sight, lens));
    const words = await lenses.words(question, seen.map((lens) => lens.id));
    const found = seen
      .flatMap((lens) => {
        const shared = words.get(lens.id);
        return shared && shared.shared > 0
          ? [{ ...itemOf(sight, lens), shared: shared.shared, marked: { name: shared.name, question: shared.question, shows: shared.shows }, sharedTags: shared.tags }]
          : [];
      })
      .sort((a, b) => b.shared - a.shared || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 20);
    return { lenses: found };
  });

  // The Lenses a new query may reuse (FR-SR-47, DEC-UX-22): those on exactly its Resources, then those on
  // them and more; only Lenses the User may use and that run now (DEC-SR-43); in each group, those that
  // share most words with its question first, the shared words marked (FR-SR-48, DEC-SR-42).
  app.get<{ Querystring: { resources?: string; question?: string } }>('/lenses/suggestions', async (request, reply) => {
    const ids = [...new Set((request.query.resources ?? '').split(',').map((id) => id.trim().toLowerCase()).filter(Boolean))];
    const question = (request.query.question ?? '').trim();
    if (ids.length < 1 || ids.length > 10 || !ids.every((id) => UUID.test(id))) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Name 1 to 10 Resources by their ID.' });
    }
    if (question.length > LIMITS.question) return reply.code(400).send({ error: 'invalid_request', message: `The question has at most ${LIMITS.question} characters.` });
    let sight: Sight;
    try {
      sight = await sightOf(request);
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const usable = (await lenses.list()).filter(
      (lens) => lens.state === 'published' && lens.broken === null && sees(sight, lens) && ids.every((id) => lens.resources.some((resource) => resource.id === id)),
    );
    const words = await lenses.words(question, usable.map((lens) => lens.id));
    const ranked = usable
      .map((lens) => {
        const shared = words.get(lens.id);
        return { ...itemOf(sight, lens), exact: lens.resources.length === ids.length, shared: shared?.shared ?? 0, marked: shared ? { name: shared.name, question: shared.question, shows: shared.shows } : null, sharedTags: shared?.tags ?? [] };
      })
      .sort((a, b) => b.shared - a.shared || (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) || a.name.localeCompare(b.name));
    const strip = ({ exact: _exact, ...item }: (typeof ranked)[number]) => item;
    return { exact: ranked.filter((item) => item.exact).map(strip), more: ranked.filter((item) => !item.exact).map(strip) };
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
    if (seen.lens.state === 'refused') return void reply.code(409).send({ error: 'refused', message: 'The Data Team refused this Lens: it does not run until it is updated from its query.' });
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
  async function upkeep(request: FastifyRequest, reply: FastifyReply, lens: Lens, checked: Preflight, defaults: boolean): Promise<Lens | undefined> {
    const missing = missingIn(checked);
    if (missing) {
      // A table not found is of one of its Resources: what else reads it is checked too (FR-SR-52, the third moment).
      const gone = lens.resources.filter((resource) => missing.kind === 'table' && resource.key === missing.name.toLowerCase());
      await broken.lost(
        gone.map((resource) => resource.id),
        request.log,
      );
      const kept = await broken.lens(lens, missing, request.log);
      void reply.code(409).send({ error: 'broken', message: `This Lens reads ${missing.name}, which no longer exists.`, broken: kept.broken });
      return undefined;
    }
    let kept = lens;
    if (lens.broken && checked.runnable) kept = await broken.lens(lens, null, request.log);
    if (defaults && checked.runnable && checked.range && ORDER[checked.range] > ORDER[kept.range]) {
      kept = await grown(lens.id, checked.range, checked.bytes ?? 0, request.log);
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
      if (!(await upkeep(request, reply, run.lens, checked, run.defaults))) return reply;
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
      if (!(await upkeep(request, reply, run.lens, checked, run.defaults))) return reply;
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const query = await queries.lensFor(viewer(request), run.lens);
    return execute(request, reply, query, { sql: run.lens.sql, parameters: run.parameters, approve: run.approve });
  });

  // Excel (DEC-CH-03, DEC-CH-06): the result of a Lens as CSV, with its Parameters at their defaults, at most
  // 10,000 rows. Power Query signs in with Basic, the Excel key as password; query exchanges it at identity for
  // an Access Token of its User (TR-PF-07), and the Lens runs as it would on its page for them.
  if (excel) {
    const askKey = (reply: FastifyReply, message: string) =>
      reply.code(401).header('www-authenticate', 'Basic realm="Data Hub", charset="UTF-8"').send({ error: 'unauthorized', message });
    app.get<{ Params: { id: string } }>('/excel/lenses/:id', { config: { public: true } }, async (request, reply) => {
      const key = excelKeyFrom(request.headers.authorization);
      if (!key) return askKey(reply, 'Sign in with Basic: your e-mail as user name, and an Excel key as password.');
      let token: string | undefined;
      try {
        token = await excel.exchanger.accessToken(key);
      } catch (error) {
        request.log.error({ err: error }, 'identity did not exchange an Excel key');
        return reply.code(503).header('retry-after', '30').send({ error: 'temporarily_unavailable', message: 'Data Hub could not check the key; try again later.' });
      }
      if (!token) return askKey(reply, 'This Excel key is not known, revoked or expired. Make a new one on My page in Data Hub.');
      // From here on the request is the User's, as if it came with their Access Token.
      request.user = await excel.verifier.verify(token);
      request.headers.authorization = `Bearer ${token}`;
      const seen = await seenLens(request, reply);
      if (!seen) return reply;
      const { lens } = seen;
      // As on its page: waiting, refused or stopped, it runs for nobody (DEC-LE-05, DEC-LE-11).
      if (lens.state !== 'published') {
        const why = { waiting: 'it waits for the Data Team', refused: 'the Data Team refused it', stopped: 'it stopped, and waits for the Data Team to accept it again' }[lens.state];
        return reply.code(409).send({ error: lens.state, message: `This Lens does not run now: ${why}.` });
      }
      const parameters = valuesFor(lens, undefined);
      if (typeof parameters === 'string') return reply.code(400).send({ error: 'invalid_request', message: parameters });
      try {
        const checked = await check(lens.sql, parameters, await resourcesOf(request, lens));
        if (!(await upkeep(request, reply, lens, checked, true))) return reply;
      } catch (error) {
        return unavailable(error, reply, request);
      }
      const query = await queries.lensFor(viewer(request), lens);
      return execute(request, reply, query, { sql: lens.sql, parameters, approve: false }, { rows: EXCEL_ROWS });
    });
  }

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
    const lens = await told(await lenses.edit(seen.lens.id, changes), request.log);
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
    let resources: ResourceOfQuery[];
    try {
      resources = await resourcesOf(request, query);
      checked = await check(query.sql, query.parameters, resources);
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
    // Refused, a Lens is no longer frozen: a new version is measured again, and published or sent again (DEC-UX-128).
    const updated = await told(await lenses.version(lens.id, { by: who, query: { ...query, sql: ownCase(query.sql, resources) }, parameters, range: checked.range, reads: checked.bytes ?? 0 }), request.log);
    if (updated.state === 'waiting') {
      try {
        await catalogue.sendLensRequest({ lensId: lens.id, name: lens.name, reads: updated.reads, threshold: thresholds.request, text: text.trim(), partitions: checked.partitions }, authorization(request));
      } catch (error) {
        request.log.error({ err: error }, 'The Request on a new version of a Lens could not be sent');
      }
    }
    return { lens: await viewOf(request, seen.sight, updated), preflight: checked };
  });

  /** No User starts a check, so it takes the Google ID token of the scheduler or catalogue instead of an Access Token. */
  const onlyCheckers = async (request: FastifyRequest, reply: FastifyReply) => {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1] ?? '';
    try {
      await checkers.verify(token);
    } catch (error) {
      request.log.warn({ err: error }, `a call for ${request.url} was refused`);
      return reply.code(401).send({ error: 'unauthorized', message: 'Only the scheduler and catalogue start a check.' });
    }
  };

  // Once a day the scheduler has every Lens dry-run with its defaults (DEC-LE-20): what it misses, what works
  // again, and what grew (DEC-LE-19); and every query with the SQL it kept at its last Pre-flight that passed
  // (FR-SR-52, the second moment). A dry run reads nothing and costs nothing.
  app.post('/internal/lenses/check', { config: { public: true }, onRequest: onlyCheckers }, async (request) => {
    const outcome = { checked: 0, broken: 0, works: 0, grown: 0, stopped: 0 };
    const all = await lenses.list();
    // catalogue hears of every Lens once a day too, in case a change did not reach it (DEC-PF-30).
    await Promise.all(all.map((lens) => told(lens, request.log)));
    for (const lens of all) {
      // A Lens that waits for the Data Team, or that it refused, does not run.
      if (lens.state === 'waiting' || lens.state === 'refused') continue;
      outcome.checked += 1;
      const bound = bind(lens.sql, valuesFor(lens, undefined) as Parameter[]);
      try {
        const dry = await bigquery.dryRun(bound.sql, bound.parameters);
        if (lens.broken) {
          await broken.lens(lens, null, request.log);
          outcome.works += 1;
        }
        const range = rangeOf(dry.bytes, thresholds);
        if (lens.state === 'published' && ORDER[range] > ORDER[lens.range]) {
          const after = await grown(lens.id, range, dry.bytes, request.log);
          outcome[after.state === 'stopped' ? 'stopped' : 'grown'] += 1;
        }
      } catch (error) {
        const missing = error instanceof BigQueryRefused ? missingOf(error.message) : null;
        if (missing) {
          if (!lens.broken) outcome.broken += 1;
          await broken.lens(lens, missing, request.log);
        } else {
          request.log.warn({ err: error, lens: lens.id }, 'A Lens could not be checked');
        }
      }
    }
    const checkedQueries = await broken.checkQueries(undefined, request.log);
    request.log.info({ ...outcome, queries: checkedQueries }, 'Every Lens and query checked');
    return { ...outcome, queries: checkedQueries };
  });

  // After a new Current Version, catalogue tells which Resources were withdrawn, came back, or lost or regained a
  // field: every Lens and query that reads one is dry-run (FR-SR-52, the first moment).
  app.post<{ Body: unknown }>('/internal/checks', { config: { public: true }, onRequest: onlyCheckers }, async (request, reply) => {
    const ids = (request.body as { resources?: unknown } | undefined)?.resources;
    if (!Array.isArray(ids) || ids.length > 5000 || !ids.every((id) => typeof id === 'string' && UUID.test(id))) {
      return reply.code(400).send({ error: 'invalid_request', message: 'Send the Resources that changed, by their IDs.' });
    }
    const outcome = await broken.checkReading([...new Set(ids.map((id: string) => id.toLowerCase()))], request.log);
    request.log.info(outcome, 'What reads the Resources that changed checked');
    return outcome;
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

  // A member of the Data Team accepts or refuses the Request on a Lens, in the Message Centre or in context
  // (FR-LE-09, FR-CV-08): catalogue records the decision as its reply, and the Lens changes with it.
  app.post<{ Params: { id: string }; Body: unknown }>('/lenses/:id/decision', async (request, reply) => {
    const who = viewer(request);
    if (!who.dataTeam) return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team decides on a Request.' });
    const { outcome, text = '' } = (request.body ?? {}) as { outcome?: unknown; text?: unknown };
    if (outcome !== 'accepted' && outcome !== 'refused') return reply.code(400).send({ error: 'invalid_request', message: 'The decision is accepted or refused.' });
    if (typeof text !== 'string' || text.trim().length > 1000) return reply.code(400).send({ error: 'invalid_request', message: 'The reason is a text of at most 1000 characters.' });
    if (outcome === 'refused' && !text.trim()) return reply.code(400).send({ error: 'invalid_request', message: 'A refusal needs a reason.' });
    const seen = await seenLens(request, reply);
    if (!seen) return reply;
    const { lens } = seen;
    if (lens.state !== 'waiting' && lens.state !== 'stopped') return reply.code(409).send({ error: 'not_waiting', message: 'This Lens waits for no decision.' });
    let requestId: string;
    try {
      // A waiting Lens has the Request of its author; a stopped one that of Data Hub, sent now if it is missing.
      const type = lens.state === 'waiting' ? 'MSG-LEN-01' : 'MSG-LEN-03';
      const waiting = (await catalogue.requests(lens.id, authorization(request), 'lens')).find((sent) => sent.state === 'waiting' && sent.type === type);
      const found = waiting?.id ?? (lens.state === 'stopped' ? (await catalogue.lensGrew({ lensId: lens.id, reads: lens.stoppedReads ?? lens.reads, threshold: thresholds.request })).id : undefined);
      if (!found) return reply.code(409).send({ error: 'no_request', message: 'No Request waits on this Lens; its author sends it again.' });
      requestId = found;
      await catalogue.decideLensRequest(requestId, { outcome, text: text.trim(), decider: { id: who.id, name: who.name } });
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const decided = await told(await lenses.decide(lens.id, { outcome, by: who, conversation: requestId, reason: text.trim() }), request.log);
    return { lens: await viewOf(request, seen.sight, decided) };
  });

  // catalogue hears of every Lens when query starts, as it does once a day (DEC-PF-30).
  app.addHook('onReady', async () => {
    void lenses
      .list()
      .then((all) => Promise.all(all.map((lens) => told(lens, app.log))))
      .catch((error: unknown) => app.log.warn({ err: error }, 'The Lenses could not be told to catalogue at the start'));
  });
}
