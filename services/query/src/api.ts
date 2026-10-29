import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type BigQuery, BigQueryRefused, BigQueryUnavailable, type Page, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryRequest, type QueryResource } from './catalogue.js';
import type { NamedResource } from './database.js';
import { bind, type Parameter, parseParameters } from './parameters.js';
import { type Preflight, preflight, type ResourceOfQuery, type Thresholds } from './preflight.js';
import { type Choice, choicesOf, chosenParameters, previewSql, type StorageReader, valuesSql, type Window, WINDOWS, windowFilter } from './preview.js';
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
  /** The size and partitions of a Resource, and its newest partitions (FR-SR-39, DEC-SR-39). */
  storage: StorageReader;
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
const NO_RESOURCE = { error: 'not_found', message: 'There is no such Resource, or you may not see it.' };
/** The numbers on top of the tab History count the last 30 days (FR-SR-44). */
const MONTH = 30 * 86_400_000;
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
  const { queries, catalogue, bigquery, beneath, project, thresholds, storage } = options;

  function viewer(request: FastifyRequest): Viewer {
    const user = request.user;
    return { id: user?.sub ?? '', name: user?.name || user?.email || '', dataTeam: user?.roles.includes(DATA_TEAM) ?? false };
  }

  const authorization = (request: FastifyRequest) => request.headers.authorization ?? '';

  /** Whether the User manages a Resource: the Owner Unit of its Collection, or the Data Team. */
  async function manages(request: FastifyRequest, resource: QueryResource): Promise<boolean> {
    if (viewer(request).dataTeam) return true;
    return resource.collectionId !== null && (await catalogue.manages(resource.collectionId, authorization(request))) === true;
  }

  /**
   * The query, if the User may read it: theirs, anyone's for the Data Team, and for the Owner Unit of one of
   * its Resources, every query on what it owns (DEC-SR-31, DEC-SR-41).
   */
  async function seen(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<Query | undefined> {
    const query = await queries.get(request.params.id);
    const who = viewer(request);
    let readable = !!query && (query.ownerId === who.id || who.dataTeam);
    if (query && !readable) {
      try {
        for (const named of query.resources) {
          const resource = await catalogue.resource(named.id, authorization(request));
          if (resource && (await manages(request, resource))) readable = true;
          if (readable) break;
        }
      } catch (error) {
        unavailable(error, reply, request);
        return undefined;
      }
    }
    if (!query || !readable) {
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
    return execute(request, reply, query, body);
  });

  /** Runs a query of the User: checked again, then a job of BigQuery, the run kept in the Query Log. */
  async function execute(request: FastifyRequest, reply: FastifyReply, query: Query, body: { sql: string; parameters: Parameter[]; approve: boolean }) {
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
  }

  // A Request to the Data Team to run it above 1 GB (MSG-QRY-01, DEC-UX-116): sent for its author, with the
  // Pre-flight of Data Hub rather than any number of the web app, and kept by catalogue until answered.
  app.post<{ Params: { id: string }; Body: unknown }>('/queries/:id/requests', async (request, reply) => {
    const body = parseRun(request.body);
    if (typeof body === 'string') return reply.code(400).send({ error: 'invalid_request', message: body });
    const query = await own(request, reply);
    if (!query) return reply;
    return sendRequest(request, reply, query, body);
  });

  /** Sends a query of the User to the Data Team, above 1 GB only. */
  async function sendRequest(request: FastifyRequest, reply: FastifyReply, query: Query, body: { sql: string; parameters: Parameter[]; text: string }) {
    try {
      const checked = await check(body.sql, body.parameters, await resourcesOf(request, query));
      if (!checked.runnable) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
      if (checked.range !== 'request') return reply.code(409).send({ error: 'not_needed', message: 'This query runs without the Data Team.', preflight: checked });
      if (body.sql !== query.sql || !same(body.parameters, query.parameters)) await queries.update(query.id, { sql: body.sql, parameters: body.parameters });
      const sent = await catalogue.sendRequest({ queryId: query.id, name: query.name, reads: checked.bytes ?? 0, threshold: thresholds.request, text: body.text }, authorization(request));
      return reply.code(201).send({ request: requestView(sent), preflight: checked, queryId: query.id });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  }

  /** The Resource, if the User may see it, as catalogue answers with their token. */
  async function resourceOf(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<QueryResource | undefined> {
    try {
      const resource = UUID.test(request.params.id) ? await catalogue.resource(request.params.id, authorization(request)) : null;
      if (!resource) void reply.code(404).send(NO_RESOURCE);
      return resource ?? undefined;
    } catch (error) {
      unavailable(error, reply, request);
      return undefined;
    }
  }

  // Its size and partitions, from BigQuery without reading it (FR-SR-39); for a view, of the table beneath.
  app.get<{ Params: { id: string } }>('/resources/:id/storage', async (request, reply) => {
    const resource = await resourceOf(request, reply);
    if (!resource) return reply;
    try {
      const found = await storage.of(resource);
      return {
        storage: found && { key: found.key, bytes: found.bytes, rows: found.rows, partitions: found.partitions, modifiedAt: found.modifiedAt, beneath: found.key !== resource.key },
      };
    } catch (error) {
      if (error instanceof BigQueryRefused) return { storage: null };
      return unavailable(error, reply, request);
    }
  });

  /** What a Preview of this Resource is, for its window and choices: its filter, its choices and its SQL (FR-SR-38). */
  async function previewOf(resource: QueryResource, window: Window) {
    const partition = resource.partition;
    const from = partition ? await storage.newest(resource, window) : null;
    const dataType = partition ? (resource.fields.find((field) => field.name === partition.field)?.dataType ?? null) : null;
    const filter = partition ? windowFilter(partition.field, dataType, partition.unit, from, window) : null;
    return { from, filter, choices: choicesOf(resource) };
  }

  const windowOf = (value: unknown): Window | null => (WINDOWS.includes(value as Window) ? (value as Window) : null);
  const named = (resource: QueryResource): NamedResource => ({ id: resource.id, key: resource.key, displayName: resource.displayName });
  const previewName = (resource: QueryResource) => `Preview · ${resource.displayName}`;

  // The choices of a Preview, for its window: at most 100 values each, read in one small query that passes
  // the Pre-flight and is kept in the Query Log, not in the history of the previews (DEC-SR-37, DEC-SR-40).
  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/preview/choices', async (request, reply) => {
    const window = windowOf((request.body as { window?: unknown } | undefined)?.window ?? 4);
    if (!window) return reply.code(400).send({ error: 'invalid_request', message: `The window is ${WINDOWS.join(', ')} partitions.` });
    const resource = await resourceOf(request, reply);
    if (!resource) return reply;
    try {
      const { from, filter, choices } = await previewOf(resource, window);
      const values = choices.length > 0 ? await valuesOf(request, resource, filter, choices) : new Map<string, string[]>();
      return {
        window: resource.partition ? { field: resource.partition.field, unit: resource.partition.unit, from, window } : null,
        choices: choices.map(({ field, dataType, role, kind }) => ({ field, dataType, role, kind, values: values.get(field) ?? null })),
      };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  /** The values of the choices, when reading them passes the Pre-flight and costs nothing to approve. */
  async function valuesOf(request: FastifyRequest, resource: QueryResource, filter: string | null, choices: Choice[]): Promise<Map<string, string[]>> {
    const sql = valuesSql(resource, filter, choices);
    const checked = await check(sql, [], [{ named: named(resource), resource }]);
    if (!checked.runnable || checked.range !== 'free') return new Map();
    const who = viewer(request);
    const query = await queries.previewFor(who, named(resource), previewName(resource));
    const run = await queries.startRun({ query, user: who, sql, parameters: [], estimatedBytes: checked.bytes ?? 0, approved: false, purpose: 'values' });
    try {
      const finished = await bigquery.run(sql, { maximumBytesBilled: thresholds.approve, labels: { 'datahub-user': label(who.id), 'datahub-query': run.queryRef }, requestId: randomUUID(), pageSize: 1 });
      await queries.finishRun(run.id, {
        jobId: finished.jobId,
        jobLocation: finished.location,
        processedBytes: finished.processedBytes,
        billedBytes: finished.billedBytes,
        partitions: finished.partitions,
        rowCount: finished.totalRows,
        columns: finished.columns,
      });
      const row = finished.rows[0] ?? [];
      return new Map(finished.columns.map((column, index) => [column.name, row[index] ? (JSON.parse(row[index] as string) as unknown[]).map(String) : []]));
    } catch (error) {
      await queries.failRun(run.id, error instanceof Error ? error.message : String(error));
      if (error instanceof BigQueryRefused) return new Map();
      throw error;
    }
  }

  /** The SQL and Parameters of a Preview, from what the User chose; a string says what does not fit. */
  async function previewRun(request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply: FastifyReply) {
    const body = (request.body ?? {}) as { window?: unknown; values?: unknown; approve?: unknown; text?: unknown };
    const window = windowOf(body.window ?? 4);
    if (!window) return void reply.code(400).send({ error: 'invalid_request', message: `The window is ${WINDOWS.join(', ')} partitions.` });
    if (body.approve !== undefined && typeof body.approve !== 'boolean') return void reply.code(400).send({ error: 'invalid_request', message: 'approve is true or false.' });
    if (body.text !== undefined && (typeof body.text !== 'string' || body.text.trim().length > 500)) {
      return void reply.code(400).send({ error: 'invalid_request', message: 'A word for the Data Team has at most 500 characters.' });
    }
    const resource = await resourceOf(request, reply);
    if (!resource) return undefined;
    const { filter, choices } = await previewOf(resource, window);
    const parameters = chosenParameters(choices, body.values);
    if (typeof parameters === 'string') return void reply.code(400).send({ error: 'invalid_request', message: parameters });
    const sql = previewSql(resource, filter, parameters.map((parameter) => parameter.name));
    return { resource, sql, parameters, approve: body.approve === true, text: typeof body.text === 'string' ? body.text.trim() : '' };
  }

  // The Pre-flight of a Preview: what it scans and how many partitions, before it runs (FR-SR-36).
  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/preview/preflight', async (request, reply) => {
    try {
      const preview = await previewRun(request, reply);
      if (!preview) return reply;
      const known = await queries.previewOf(viewer(request), preview.resource.id);
      return { preflight: await check(preview.sql, preview.parameters, [{ named: named(preview.resource), resource: preview.resource }]), queryId: known?.id ?? null };
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // A Preview runs as a run of the previews of the Resource by the User, one item in the panel of Query (FR-SR-38).
  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/preview/runs', async (request, reply) => {
    try {
      const preview = await previewRun(request, reply);
      if (!preview) return reply;
      const query = await queries.previewFor(viewer(request), named(preview.resource), previewName(preview.resource));
      return execute(request, reply, query, preview);
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // Above 1 GB a Preview goes to the Data Team too (DEC-SR-29, MSG-QRY-01).
  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/preview/requests', async (request, reply) => {
    try {
      const preview = await previewRun(request, reply);
      if (!preview) return reply;
      const query = await queries.previewFor(viewer(request), named(preview.resource), previewName(preview.resource));
      return sendRequest(request, reply, query, preview);
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  // The queries on a Resource, for its tab History: only its Owner Unit and the Data Team (DEC-SR-41, FR-SR-44).
  app.get<{ Params: { id: string } }>('/resources/:id/queries', async (request, reply) => {
    const resource = await resourceOf(request, reply);
    if (!resource) return reply;
    try {
      if (!(await manages(request, resource))) return reply.code(403).send({ error: 'forbidden', message: 'Only the Owner of a Resource and the Data Team see the queries on it.' });
    } catch (error) {
      return unavailable(error, reply, request);
    }
    const who = viewer(request);
    const found = await queries.on(resource.id);
    const recent = found.filter((query) => query.lastRunAt !== null && query.lastRunAt.getTime() > Date.now() - MONTH);
    return {
      summary: { queries: recent.length, lenses: 0, colleagues: new Set(recent.map((query) => query.ownerId)).size },
      queries: found.map(({ ownerId, ...query }) => ({ ...query, mine: ownerId === who.id })),
    };
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
