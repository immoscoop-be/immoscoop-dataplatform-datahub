import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type BigQuery, BigQueryRefused, BigQueryUnavailable, type Page, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryRequest, type QueryResource } from './catalogue.js';
import type { NamedResource } from './database.js';
import { bind, type Parameter, parseParameters } from './parameters.js';
import { type Preflight, preflight, type ResourceOfQuery, type Thresholds } from './preflight.js';
import type { Queries, Query, Run, Viewer } from './queries.js';
import { template } from './sql.js';

export interface ApiOptions {
  queries: Queries;
  catalogue: Catalogue;
  bigquery: BigQuery;
  /** The tables beneath a Resource, as BigQuery reads them (see createBeneath). */
  beneath: (resource: QueryResource) => Promise<string[]>;
  /** The project the jobs run in: a Key in it may be written without its project. */
  project: string;
  thresholds: Thresholds;
}

/** The role of the Data Team in the Access Token (TR-PF-03). */
const DATA_TEAM = 'datateam';
/** A page of a result has 100 rows (FR-SR-51). */
export const PAGE_SIZE = 100;
/** How many runs of its history a page holds at most (DEC-UX-74). */
const HISTORY_LIMIT = 50;
/** Above an accepted Request, BigQuery bills at most this much more than the Pre-flight said (DEC-SR-36). */
const ACCEPTED_MARGIN = 1.1;
const NO_QUERY = { error: 'not_found', message: 'There is no such query, or it is not yours.' };
const NOT_YOURS = { error: 'forbidden', message: 'Only who made a query writes and runs it.' };

/**
 * A run as the web app shows it: its SQL and values, what it read, its result's columns and how many rows.
 * Only who made the query and the Data Team see it (DEC-SR-31).
 */
function runView(run: Run) {
  return {
    ref: run.queryRef,
    number: run.number,
    sql: run.sql,
    parameters: run.parameters,
    state: run.state,
    error: run.error,
    userName: run.userName,
    estimatedBytes: run.estimatedBytes,
    approved: run.approved,
    processedBytes: run.processedBytes,
    billedBytes: run.billedBytes,
    partitions: run.partitions,
    rowCount: run.rowCount,
    columns: run.columns,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
  };
}

/** A Request as the bar of the Pre-flight and the panel show it (DEC-UX-116). */
const requestView = (request: QueryRequest | undefined) => (request ? { state: request.state, sentAt: request.createdAt, reads: request.reads, text: request.text } : null);

export interface QueryFields {
  name?: string;
  question?: string;
  resources?: string[];
  sql?: string;
  parameters?: Parameter[];
  /** The query a new one is started from, with another set of Resources (DEC-UX-73). */
  startedFrom?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fields of a new query, or of a change to one; a string says what does not fit. */
export function parseQuery(body: unknown, creating: boolean): QueryFields | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const fields = body as Record<string, unknown>;
  const known = new Set(creating ? ['name', 'question', 'resources', 'sql', 'parameters', 'startedFrom'] : ['name', 'question', 'sql', 'parameters']);
  const unknown = Object.keys(fields).find((key) => !known.has(key));
  if (unknown) return `A query has no field ${unknown} here.`;
  const result: QueryFields = {};
  if (fields.name !== undefined || creating) {
    // A query without a name cannot be run, so it has one from the start (FR-SR-45).
    if (typeof fields.name !== 'string' || fields.name.trim().length < 1 || fields.name.trim().length > 120) return 'The name has 1 to 120 characters.';
    result.name = fields.name.trim();
  }
  if (fields.question !== undefined) {
    if (typeof fields.question !== 'string' || fields.question.trim().length > 500) return 'The question has at most 500 characters.';
    result.question = fields.question.trim();
  }
  if (creating) {
    const ids = fields.resources;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 10 || !ids.every((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) || new Set(ids).size !== ids.length) {
      return 'A query reads 1 to 10 Resources, each named once by its ID.';
    }
    result.resources = ids as string[];
  }
  if (fields.sql !== undefined) {
    if (typeof fields.sql !== 'string' || fields.sql.length > 100_000) return 'The SQL has at most 100,000 characters.';
    result.sql = fields.sql;
  }
  if (fields.parameters !== undefined) {
    const parameters = parseParameters(fields.parameters);
    if (typeof parameters === 'string') return parameters;
    result.parameters = parameters;
  }
  if (fields.startedFrom !== undefined) {
    if (typeof fields.startedFrom !== 'string' || !UUID.test(fields.startedFrom)) return 'A query is started from another by its ID.';
    result.startedFrom = fields.startedFrom.toLowerCase();
  }
  if (!creating && Object.keys(result).length === 0) return 'Send at least one field to change.';
  return result;
}

/** The SQL and Parameters to check or run, whether its author approves what it reads (DEC-SR-29), and a word for the Data Team. */
export function parseRun(body: unknown): { sql: string; parameters: Parameter[]; approve: boolean; text: string } | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const { sql, parameters = [], approve = false, text = '' } = body as Record<string, unknown>;
  if (typeof sql !== 'string' || sql.length > 100_000) return 'The SQL has at most 100,000 characters.';
  const parsed = parseParameters(parameters);
  if (typeof parsed === 'string') return parsed;
  if (typeof approve !== 'boolean') return 'approve is true or false.';
  if (typeof text !== 'string' || text.trim().length > 500) return 'A word for the Data Team has at most 500 characters.';
  return { sql, parameters: parsed, approve, text: text.trim() };
}

/** Whether two lists of Parameters are the same, to keep only what changed. */
const same = (a: readonly Parameter[], b: readonly Parameter[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The routes of query (TR-SR-15, TR-SR-16): queries, their Pre-flight, their runs and the pages of a result.
 * Every route has the Access Token of the User; a query is written and run only by who made it, and seen by
 * them and the Data Team (DEC-LN-01).
 */
export async function apiRoutes(app: FastifyInstance, options: ApiOptions): Promise<void> {
  const { queries, catalogue, bigquery, beneath, project, thresholds } = options;

  function viewer(request: FastifyRequest): Viewer {
    const user = request.user;
    return { id: user?.sub ?? '', name: user?.name || user?.email || '', dataTeam: user?.roles.includes(DATA_TEAM) ?? false };
  }

  const authorization = (request: FastifyRequest) => request.headers.authorization ?? '';

  /** The query, if the User may see it: theirs, or anyone's for the Data Team. */
  async function seen(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<Query | undefined> {
    const query = await queries.get(request.params.id);
    const who = viewer(request);
    if (!query || (query.ownerId !== who.id && !who.dataTeam)) {
      void reply.code(404).send(NO_QUERY);
      return undefined;
    }
    return query;
  }

  /** The query, if it is the User's own, to write or run. */
  async function own(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<Query | undefined> {
    const query = await seen(request, reply);
    if (query && query.ownerId !== viewer(request).id) {
      void reply.code(403).send(NOT_YOURS);
      return undefined;
    }
    return query;
  }

  /** Its Resources as catalogue gives them to this User now. */
  async function resourcesOf(request: FastifyRequest, query: Query): Promise<ResourceOfQuery[]> {
    return Promise.all(query.resources.map(async (named) => ({ named, resource: await catalogue.resource(named.id, authorization(request)) })));
  }

  const check = (sql: string, parameters: Parameter[], resources: ResourceOfQuery[]): Promise<Preflight> =>
    preflight(sql, resources, { bigquery, beneath, project, thresholds }, parameters);

  /** The Requests of who made the query on it, newest first (DEC-SR-36). */
  async function requestsOf(request: FastifyRequest, query: Query): Promise<QueryRequest[]> {
    return (await catalogue.requests(query.id, authorization(request))).filter((sent) => sent.writerId === query.ownerId);
  }

  /** Where a query started: the query, by its name now, and after which of its runs (DEC-UX-73). */
  async function startedFromOf(query: Query) {
    if (!query.startedFrom) return null;
    const from = await queries.get(query.startedFrom);
    return from ? { id: from.id, name: from.name, afterRun: query.startedAfterRun } : null;
  }

  /** A query as its page shows it: its Resources as the User may see them now, its last run, its Request and where it started. */
  async function queryView(request: FastifyRequest, query: Query) {
    const resources = (await resourcesOf(request, query)).map(({ named, resource }) =>
      resource ? { visible: true, ...resource } : { visible: false, id: named.id, displayName: named.displayName },
    );
    const [last, runs, requests, startedFrom] = await Promise.all([queries.lastRun(query.id), queries.runCount(query.id), requestsOf(request, query), startedFromOf(query)]);
    return {
      ...query,
      mine: query.ownerId === viewer(request).id,
      resources,
      lastRun: last ? runView(last) : null,
      runs,
      request: requestView(requests[0]),
      startedFrom,
    };
  }

  /** catalogue or BigQuery not answering is answered as 503, never guessed. */
  function unavailable(error: unknown, reply: FastifyReply, request: FastifyRequest): FastifyReply | undefined {
    if (error instanceof CatalogueUnavailable || error instanceof BigQueryUnavailable) {
      request.log.error({ err: error }, 'A service query depends on did not answer');
      return reply.code(503).send({ error: 'unavailable', message: 'Data Hub cannot check this query right now; try again in a moment.' });
    }
    throw error;
  }

  app.get<{ Querystring: { all?: string } }>('/queries', async (request, reply) => {
    const who = viewer(request);
    const all = request.query.all === 'true';
    if (all && !who.dataTeam) return reply.code(403).send({ error: 'forbidden', message: 'Only the Data Team lists the queries of everyone.' });
    const list = await queries.list(who, all);
    // The label of a query that went to the Data Team (DEC-UX-116); the list shows without it rather than not at all.
    const latest = new Map<string, QueryRequest>();
    try {
      for (const sent of await catalogue.requests(null, authorization(request))) if (!latest.has(sent.subjectId)) latest.set(sent.subjectId, sent);
    } catch (error) {
      if (!(error instanceof CatalogueUnavailable)) throw error;
      request.log.warn({ err: error }, 'catalogue did not tell the Requests; the queries are listed without them');
    }
    return { queries: list.map((item) => ({ ...item, request: requestView(latest.get(item.id)) })) };
  });

  app.post<{ Body: unknown }>('/queries', async (request, reply) => {
    const fields = parseQuery(request.body, true);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    const who = viewer(request);
    // Another set of Resources is a new query, started from one the User sees, after its last run (DEC-UX-73).
    let startedFrom: { id: string; afterRun: number | null } | undefined;
    if (fields.startedFrom) {
      const from = await queries.get(fields.startedFrom);
      if (!from || (from.ownerId !== who.id && !who.dataTeam)) return reply.code(400).send({ error: 'invalid_request', message: 'A query is started from one you may see.' });
      startedFrom = { id: from.id, afterRun: (await queries.lastRun(from.id))?.number ?? null };
    }
    try {
      const found = await Promise.all((fields.resources ?? []).map((id) => catalogue.resource(id, authorization(request))));
      const resources = found.filter((resource): resource is QueryResource => resource !== null);
      if (resources.length !== found.length) return reply.code(400).send({ error: 'invalid_request', message: 'A query reads only Resources you may see.' });
      const named: NamedResource[] = resources.map(({ id, key, displayName }) => ({ id, key, displayName }));
      const query = await queries.create({
        owner: who,
        name: fields.name as string,
        question: fields.question ?? '',
        resources: named,
        sql: fields.sql ?? template(resources),
        parameters: fields.parameters ?? [],
        startedFrom,
      });
      return reply.code(201).send({ query: await queryView(request, query) });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  app.get<{ Params: { id: string } }>('/queries/:id', async (request, reply) => {
    const query = await seen(request, reply);
    if (!query) return reply;
    try {
      return { query: await queryView(request, query) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // Its history: every run a variation of its SQL and values, newest first, a page at a time (DEC-UX-74).
  app.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>('/queries/:id/runs', async (request, reply) => {
    const before = request.query.before === undefined ? undefined : Number(request.query.before);
    const limit = Number(request.query.limit ?? '20');
    if ((before !== undefined && (!Number.isInteger(before) || before < 1)) || !Number.isInteger(limit) || limit < 1 || limit > HISTORY_LIMIT) {
      return reply.code(400).send({ error: 'invalid_request', message: `before is a run number, and limit a number from 1 to ${HISTORY_LIMIT}.` });
    }
    const query = await seen(request, reply);
    if (!query) return reply;
    return { runs: (await queries.runs(query.id, { before, limit })).map(runView) };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>('/queries/:id', async (request, reply) => {
    const fields = parseQuery(request.body, false);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    if (!(await own(request, reply))) return reply;
    const query = await queries.update(request.params.id, fields);
    return { query };
  });

  // The Pre-flight while the SQL is written (FR-SR-36); it keeps what is written, so nothing is lost.
  app.post<{ Params: { id: string }; Body: unknown }>('/queries/:id/preflight', async (request, reply) => {
    const body = parseRun(request.body);
    if (typeof body === 'string') return reply.code(400).send({ error: 'invalid_request', message: body });
    const query = await own(request, reply);
    if (!query) return reply;
    try {
      if (body.sql !== query.sql || !same(body.parameters, query.parameters)) await queries.update(query.id, { sql: body.sql, parameters: body.parameters });
      return { preflight: await check(body.sql, body.parameters, await resourcesOf(request, query)) };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // A run (FR-SR-41): the same checks again, then BigQuery with a byte limit and a label with the User (FR-SR-27).
  app.post<{ Params: { id: string }; Body: unknown }>('/queries/:id/runs', async (request, reply) => {
    const body = parseRun(request.body);
    if (typeof body === 'string') return reply.code(400).send({ error: 'invalid_request', message: body });
    const query = await own(request, reply);
    if (!query) return reply;
    let checked: Preflight;
    let accepted = false;
    try {
      checked = await check(body.sql, body.parameters, await resourcesOf(request, query));
      // Above 1 GB it runs once the Data Team accepted a Request of its author: every run after, also with other SQL (DEC-SR-36).
      if (checked.runnable && checked.range === 'request') accepted = (await requestsOf(request, query)).some((sent) => sent.state === 'accepted');
    } catch (error) {
      return unavailable(error, reply, request);
    }
    if (!checked.runnable) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
    if (checked.range === 'request' && !accepted) {
      return reply.code(409).send({ error: 'request_needed', message: 'This query reads more than 1 GB: the Data Team accepts it first.', preflight: checked });
    }
    if (checked.range !== 'free' && !body.approve) {
      return reply.code(409).send({ error: 'approval_needed', message: 'This query reads enough to need your approval.', preflight: checked });
    }

    const who = viewer(request);
    const bound = bind(body.sql, body.parameters);
    const estimated = checked.bytes ?? 0;
    const run = await queries.startRun({ query, user: who, sql: body.sql, parameters: body.parameters, estimatedBytes: estimated, approved: checked.range !== 'free' });
    try {
      const finished = await bigquery.run(bound.sql, {
        // Never more than the second threshold without an accepted Request (DEC-SR-29); with one, a little above the Pre-flight.
        maximumBytesBilled: accepted ? Math.max(thresholds.request, Math.ceil(estimated * ACCEPTED_MARGIN)) : thresholds.request,
        labels: { 'datahub-user': label(who.id), 'datahub-query': run.queryRef },
        requestId: randomUUID(),
        pageSize: PAGE_SIZE,
        parameters: bound.parameters,
      });
      const done = await queries.finishRun(run.id, {
        jobId: finished.jobId,
        jobLocation: finished.location,
        processedBytes: finished.processedBytes,
        billedBytes: finished.billedBytes,
        partitions: finished.partitions,
        rowCount: finished.totalRows,
        columns: finished.columns,
      });
      return reply.code(201).send({ run: runView(done), page: pageView(finished, 1) });
    } catch (error) {
      const failed = await queries.failRun(run.id, error instanceof Error ? error.message : String(error));
      if (error instanceof BigQueryRefused) return reply.code(422).send({ error: 'failed', message: error.message, run: runView(failed) });
      return unavailable(error, reply, request);
    }
  });

  // A Request to the Data Team to run it above 1 GB (MSG-QRY-01, DEC-UX-116): sent for its author, with the
  // Pre-flight of Data Hub rather than any number of the web app, and kept by catalogue until answered.
  app.post<{ Params: { id: string }; Body: unknown }>('/queries/:id/requests', async (request, reply) => {
    const body = parseRun(request.body);
    if (typeof body === 'string') return reply.code(400).send({ error: 'invalid_request', message: body });
    const query = await own(request, reply);
    if (!query) return reply;
    try {
      const checked = await check(body.sql, body.parameters, await resourcesOf(request, query));
      if (!checked.runnable) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
      if (checked.range !== 'request') return reply.code(409).send({ error: 'not_needed', message: 'This query runs without the Data Team.', preflight: checked });
      if (body.sql !== query.sql || !same(body.parameters, query.parameters)) await queries.update(query.id, { sql: body.sql, parameters: body.parameters });
      const sent = await catalogue.sendRequest({ queryId: query.id, name: query.name, reads: checked.bytes ?? 0, threshold: thresholds.request, text: body.text }, authorization(request));
      return reply.code(201).send({ request: requestView(sent), preflight: checked });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // A page of a result, read from the same run (FR-SR-51, DEC-SR-30); only who ran it reads it.
  app.get<{ Params: { ref: string }; Querystring: { page?: string } }>('/runs/:ref/rows', async (request, reply) => {
    const run = await queries.run(request.params.ref);
    if (!run || run.userId !== viewer(request).id) return reply.code(404).send({ error: 'not_found', message: 'There is no such run, or it is not yours.' });
    const page = Number(request.query.page ?? '1');
    const pages = Math.max(1, Math.ceil((run.rowCount ?? 0) / PAGE_SIZE));
    if (!Number.isInteger(page) || page < 1 || page > pages) return reply.code(400).send({ error: 'invalid_request', message: `The page is a number from 1 to ${pages}.` });
    if (run.state !== 'done' || !run.jobId || !run.jobLocation) return reply.code(409).send({ error: 'not_done', message: 'This run has no result.' });
    try {
      return { page: pageView(await bigquery.page({ jobId: run.jobId, location: run.jobLocation }, (page - 1) * PAGE_SIZE, PAGE_SIZE), page) };
    } catch (error) {
      if (error instanceof ResultExpired) return reply.code(410).send({ error: 'expired', message: 'BigQuery no longer keeps the result of this run.' });
      return unavailable(error, reply, request);
    }
  });
}

function pageView(page: Page, number: number) {
  return { number, size: PAGE_SIZE, totalRows: page.totalRows, columns: page.columns, rows: page.rows };
}

/** A value of a label in BigQuery: lowercase letters, digits, dashes and underscores, at most 63. */
export function label(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 63);
}
