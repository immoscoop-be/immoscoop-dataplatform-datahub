import { type EdaListItem, type EdaView, type OwnerReading, PROBE_KEYS, type ProbeKey, type ProbeRunAnswer, type RunAnswer } from '@datahub/contracts/eda';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { explores, forbidden, whoOf } from './access.js';
import { type Catalogue, CatalogueUnavailable, type EdaSource, type SeenResource } from './catalogue.js';
import type { Eda, Edas } from './edas.js';
import { AnswerMismatch, type Outcome, RUNNERS, settingOf } from './probes/index.js';
import { ResultRefused, TIME_ZONE } from './probes/sql.js';
import { type Query, QueryRefused, QueryUnavailable } from './query.js';
import { coversOf, explorable, NEEDED, type NeededOf, viewOf } from './view.js';

export interface ApiOptions {
  edas: Edas;
  catalogue: Catalogue;
  query: Query;
  /** How many needed EDA-Probes are complete: by default those Data Hub cannot run yet count too (OP-ED-09). */
  needed?: NeededOf;
  /** The clock, which says what today is; tests set it. */
  now?: () => Date;
}

/** A Resource ready for an EDA, in the panel of the section EDA (FR-ED-03): at 3 · Confirmed or above, without one. */
export interface ReadyItem {
  resource: EdaListItem['resource'];
  level: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_RESOURCE = { error: 'not_found', message: 'There is no such Resource, or you may not see it.' };
const NO_EDA = { error: 'not_found', message: 'This Resource has no EDA yet.' };
const NO_PROBE = { error: 'not_found', message: 'There is no such EDA-Probe.' };
const READINGS: readonly OwnerReading[] = ['expected', 'known', 'problem'];
/** An EDA starts from 3 · Confirmed (FR-ED-02). */
const CONFIRMED = 3;

/** The fields and parameters of a run, and whether the User approves what it reads; a string says what does not fit. */
export function parseRun(body: unknown): { fields?: string[]; params?: Record<string, unknown>; approve: boolean } | string {
  if (body === undefined || body === null) return { approve: false };
  if (typeof body !== 'object' || Array.isArray(body)) return 'Send a JSON object.';
  const { fields, params, approve = false, ...rest } = body as Record<string, unknown>;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) return `A run has no field ${unknown}.`;
  if (fields !== undefined && (!Array.isArray(fields) || !fields.every((field) => typeof field === 'string') || fields.length > 1000)) {
    return 'fields is a list of the names of fields.';
  }
  if (params !== undefined && (typeof params !== 'object' || params === null || Array.isArray(params))) return 'params is a JSON object.';
  if (typeof approve !== 'boolean') return 'approve is true or false.';
  return { ...(fields === undefined ? {} : { fields: fields as string[] }), ...(params === undefined ? {} : { params: params as Record<string, unknown> }), approve };
}

/** The reading of a result: its subject, '' for the table as a whole or a field, and the reading (FR-ED-11). */
export function parseReading(body: unknown): { subject: string; reading: OwnerReading } | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const { subject, reading, ...rest } = body as Record<string, unknown>;
  const unknown = Object.keys(rest)[0];
  if (unknown !== undefined) return `A reading has no field ${unknown}.`;
  if (typeof subject !== 'string') return "subject is '' for the table as a whole, or the name of a field.";
  if (typeof reading !== 'string' || !(READINGS as readonly string[]).includes(reading)) return 'reading is expected, known or problem.';
  return { subject, reading: reading as OwnerReading };
}

/** Today, `YYYY-MM-DD`, in the time zone of Immoscoop. */
export function todayAt(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const isProbe = (key: string): key is ProbeKey => (PROBE_KEYS as readonly string[]).includes(key);

/**
 * The routes of eda (TR-ED-01): the EDAs of the Resources the User sees, starting one, the EDA with everything its tab
 * Steps shows, running an EDA-Probe through query and the readings of its results. Every route needs the Access Token
 * of a User whose Permission group holds `eda.use` (TR-ED-06); a Resource is what catalogue answers with that token.
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { edas, catalogue, query, needed = NEEDED, now = () => new Date() } = options;

  // Every route of eda, and nothing else: the health check stays public (TR-ED-06, TR-PL-06).
  app.addHook('onRequest', async (request, reply) => {
    if (!explores(request)) return forbidden(reply, 'Only who may explore Resources works on an EDA.');
  });

  const authorization = (request: FastifyRequest) => request.headers.authorization ?? '';

  /** catalogue or query not answering is answered as 503, never guessed. */
  function unavailable(error: unknown, reply: FastifyReply, request: FastifyRequest): FastifyReply {
    if (error instanceof CatalogueUnavailable || error instanceof QueryUnavailable) {
      request.log.error({ err: error }, 'A service eda depends on did not answer');
      return reply.code(503).send({ error: 'unavailable', message: 'Data Hub cannot reach the EDA right now; try again in a moment.' });
    }
    throw error;
  }

  /** The Resource as the User sees it now; null when they may not, or for an ID that is none. */
  async function sourceOf(request: FastifyRequest<{ Params: { id: string } }>): Promise<EdaSource | null> {
    return UUID.test(request.params.id) ? catalogue.resource(request.params.id, authorization(request)) : null;
  }

  /** The Collection of a Resource, by its name as the User sees it. */
  async function collectionOf(request: FastifyRequest, source: EdaSource): Promise<{ id: string; name: string } | null> {
    if (!source.collectionId) return null;
    const name = await catalogue.collectionName(source.collectionId, authorization(request));
    return name === null ? null : { id: source.collectionId, name };
  }

  /**
   * The EDA as it is now (FR-ED-04): computed from the Resource and what the EDA holds. When every needed EDA-Probe is
   * complete, an EDA in progress becomes Explored and catalogue is told, until it heard it (FR-ED-12, TR-ED-05).
   */
  async function settle(request: FastifyRequest, source: EdaSource, eda: Eda): Promise<EdaView> {
    const [state, collection] = await Promise.all([edas.state(eda.id), collectionOf(request, source)]);
    const counted = needed(source.resource, coversOf(state));
    let current = eda;
    if (explorable(current, counted)) {
      current = await edas.explore(eda.id);
      request.log.info({ eda: eda.id, resource: source.resource.id }, 'The EDA-Setup is complete: the EDA is Explored');
    }
    if (counted.total !== current.needed.total || counted.complete !== current.needed.complete) {
      await edas.count(eda.id, counted);
    }
    // Told until it heard it, and again whenever catalogue does not keep it.
    if (current.status === 'explored' && (current.toldAt === null || source.explored === false)) {
      try {
        await catalogue.explored(source.resource.id);
        await edas.told(eda.id);
      } catch (error) {
        // catalogue is told again the next time the EDA is read or run.
        if (!(error instanceof CatalogueUnavailable)) throw error;
        request.log.warn({ err: error, eda: eda.id }, 'catalogue did not hear that the EDA is Explored; it is told again later');
      }
    }
    return viewOf(source, collection, current, state, needed);
  }

  // The EDAs of the Resources the User sees, and those ready for one, for the panel of the section EDA (FR-ED-03).
  app.get('/edas', async (request, reply) => {
    let seen: SeenResource[];
    try {
      seen = await catalogue.seen(authorization(request));
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const started = new Map((await edas.ofResources(seen.map((resource) => resource.id))).map((eda) => [eda.resourceId, eda]));
    const itemOf = (resource: SeenResource): EdaListItem['resource'] => ({ id: resource.id, displayName: resource.displayName, collection: resource.collection });
    const list: EdaListItem[] = seen.flatMap((resource) => {
      const eda = started.get(resource.id);
      return eda ? [{ resource: itemOf(resource), status: eda.status, needed: eda.needed }] : [];
    });
    const ready: ReadyItem[] = seen.filter((resource) => !started.has(resource.id) && resource.level >= CONFIRMED).map((resource) => ({ resource: itemOf(resource), level: resource.level }));
    return { edas: list, ready };
  });

  // Starts the EDA of a Resource the User sees at 3 · Confirmed or above, In progress (FR-ED-02, DEC-ED-20).
  app.post<{ Params: { id: string } }>('/resources/:id/eda', async (request, reply) => {
    try {
      const source = await sourceOf(request);
      if (!source) return reply.code(404).send(NO_RESOURCE);
      if (source.resource.level < CONFIRMED) {
        return reply.code(422).send({ error: 'not_confirmed', message: 'An EDA starts once its Resource is 3 · Confirmed.' });
      }
      const eda = await edas.start(source.resource.id, whoOf(request));
      if (eda === 'exists') return reply.code(409).send({ error: 'conflict', message: 'This Resource has an EDA already.' });
      return reply.code(201).send(await settle(request, source, eda));
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // The EDA with everything the tab Steps and the ladder show (FR-ED-04).
  app.get<{ Params: { id: string } }>('/resources/:id/eda', async (request, reply) => {
    try {
      const source = await sourceOf(request);
      if (!source) return reply.code(404).send(NO_RESOURCE);
      const eda = await edas.ofResource(source.resource.id);
      if (!eda) return reply.code(404).send(NO_EDA);
      return await settle(request, source, eda);
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // Adds an EDA-Probe if it is not yet, with its fields and parameters, and runs it through query as the User
  // (FR-ED-06, TR-ED-03, TR-ED-04): the EDA as it is after, or what the Pre-flight asks.
  app.post<{ Params: { id: string; probe: string }; Body: unknown }>('/resources/:id/eda/probes/:probe/runs', async (request, reply) => {
    const probe = request.params.probe;
    if (!isProbe(probe)) return reply.code(404).send(NO_PROBE);
    const asked = parseRun(request.body);
    if (typeof asked === 'string') return reply.code(400).send({ error: 'invalid_request', message: asked });
    try {
      const source = await sourceOf(request);
      if (!source) return reply.code(404).send(NO_RESOURCE);
      const eda = await edas.ofResource(source.resource.id);
      if (!eda) return reply.code(404).send(NO_EDA);
      // Without fields or parameters, an EDA-Probe added before runs again as it is set: on its own fields and
      // parameters, not those it would start from (FR-ED-06).
      let given: { fields?: string[]; params?: Record<string, unknown> } = asked;
      if (asked.fields === undefined && asked.params === undefined) {
        const kept = (await edas.state(eda.id)).probes.find((one) => one.probe === probe);
        if (kept) given = { fields: kept.fields, params: kept.params };
      }
      const setting = settingOf(probe, source, given);
      if ('problem' in setting) {
        return reply.code(setting.problem === 'invalid' ? 400 : 422).send({ error: setting.problem === 'invalid' ? 'invalid_request' : 'cannot_run', message: setting.message });
      }
      const runner = RUNNERS[probe];
      if (!runner) return reply.code(422).send({ error: 'cannot_run', message: 'Data Hub does not run this EDA-Probe yet.' });
      const context = { source, ...setting, today: todayAt(now()) };
      const sql = runner.sql(context);

      let answer: ProbeRunAnswer;
      try {
        answer = await query.run(source.resource.id, { probe, sql, approve: asked.approve }, authorization(request));
      } catch (error) {
        if (error instanceof QueryRefused) return reply.code(error.status).send({ error: error.status === 404 ? 'not_found' : 'forbidden', message: error.message });
        throw error;
      }
      // What the Pre-flight asks is passed on: to approve, or that it cannot run (FR-ED-06).
      if (answer.state !== 'ran') return answer satisfies RunAnswer;

      let results: Outcome[];
      try {
        results = runner.results(answer.rows, context);
      } catch (error) {
        if (error instanceof ResultRefused) return reply.code(422).send({ error: 'cannot_read', message: error.message });
        if (!(error instanceof AnswerMismatch)) throw error;
        request.log.error({ err: error, probe, runId: answer.runId }, 'The answer of query does not have the shape of the SQL of the EDA-Probe');
        return reply.code(502).send({ error: 'bad_answer', message: 'The answer of this EDA-Probe could not be read; it is in the Query Log.' });
      }
      await edas.keepRun(eda.id, { probe, fields: setting.fields, params: setting.params, ranBy: whoOf(request), bytes: answer.bytes, queryRunId: answer.runId, results });
      return { state: 'ran', eda: await settle(request, source, eda) } satisfies RunAnswer;
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // The reading of a result by who works on the EDA, which can be changed (FR-ED-11); the EDA as it is after.
  app.put<{ Params: { id: string; probe: string }; Body: unknown }>('/resources/:id/eda/probes/:probe/readings', async (request, reply) => {
    const probe = request.params.probe;
    if (!isProbe(probe)) return reply.code(404).send(NO_PROBE);
    const asked = parseReading(request.body);
    if (typeof asked === 'string') return reply.code(400).send({ error: 'invalid_request', message: asked });
    try {
      const source = await sourceOf(request);
      if (!source) return reply.code(404).send(NO_RESOURCE);
      const eda = await edas.ofResource(source.resource.id);
      if (!eda) return reply.code(404).send(NO_EDA);
      const last = (await edas.state(eda.id)).lastRuns.find((run) => run.probe === probe);
      if (!last?.results.some((result) => result.subject === asked.subject)) {
        return reply.code(404).send({ error: 'not_found', message: `This EDA-Probe has no result for ${asked.subject === '' ? 'the table as a whole' : asked.subject} to read.` });
      }
      await edas.read(eda.id, { probe, subject: asked.subject, reading: asked.reading, by: whoOf(request) });
      return await settle(request, source, eda);
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });
}
