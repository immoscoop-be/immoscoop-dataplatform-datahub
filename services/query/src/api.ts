import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type BigQuery, BigQueryRefused, BigQueryUnavailable, type Page, ResultExpired } from './bigquery.js';
import { type Catalogue, CatalogueUnavailable, type QueryResource } from './catalogue.js';
import type { NamedResource } from './database.js';
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
const NO_QUERY = { error: 'not_found', message: 'There is no such query, or it is not yours.' };
const NOT_YOURS = { error: 'forbidden', message: 'Only who made a query writes and runs it.' };

/** A run as the web app shows it: what it read, its result's columns and how many rows, never the SQL of someone else. */
function runView(run: Run) {
  return {
    ref: run.queryRef,
    number: run.number,
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

/** The fields of a new query, or of a change to one; a string says what does not fit. */
export function parseQuery(body: unknown, creating: boolean): { name?: string; question?: string; resources?: string[]; sql?: string } | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const fields = body as Record<string, unknown>;
  const known = new Set(creating ? ['name', 'question', 'resources'] : ['name', 'question', 'sql']);
  const unknown = Object.keys(fields).find((key) => !known.has(key));
  if (unknown) return `A query has no field ${unknown} here.`;
  const result: { name?: string; question?: string; resources?: string[]; sql?: string } = {};
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
  if (!creating && Object.keys(result).length === 0) return 'Send at least one field to change.';
  return result;
}

/** The SQL to check or run, and whether its author approves what it reads (DEC-SR-29). */
export function parseRun(body: unknown): { sql: string; approve: boolean } | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const { sql, approve = false } = body as Record<string, unknown>;
  if (typeof sql !== 'string' || sql.length > 100_000) return 'The SQL has at most 100,000 characters.';
  if (typeof approve !== 'boolean') return 'approve is true or false.';
  return { sql, approve };
}

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

  const check = (sql: string, resources: ResourceOfQuery[]): Promise<Preflight> => preflight(sql, resources, { bigquery, beneath, project, thresholds });

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
    return { queries: await queries.list(who, all) };
  });

  app.post<{ Body: unknown }>('/queries', async (request, reply) => {
    const fields = parseQuery(request.body, true);
    if (typeof fields === 'string') return reply.code(400).send({ error: 'invalid_request', message: fields });
    try {
      const found = await Promise.all((fields.resources ?? []).map((id) => catalogue.resource(id, authorization(request))));
      const resources = found.filter((resource): resource is QueryResource => resource !== null);
      if (resources.length !== found.length) return reply.code(400).send({ error: 'invalid_request', message: 'A query reads only Resources you may see.' });
      const named: NamedResource[] = resources.map(({ id, key, displayName }) => ({ id, key, displayName }));
      const query = await queries.create({ owner: viewer(request), name: fields.name as string, question: fields.question ?? '', resources: named, sql: template(resources) });
      return reply.code(201).send({ query: { ...query, mine: true, resources: resources.map((resource) => ({ visible: true, ...resource })), lastRun: null } });
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });

  app.get<{ Params: { id: string } }>('/queries/:id', async (request, reply) => {
    const query = await seen(request, reply);
    if (!query) return reply;
    try {
      const resources = (await resourcesOf(request, query)).map(({ named, resource }) =>
        resource ? { visible: true, ...resource } : { visible: false, id: named.id, displayName: named.displayName },
      );
      const last = await queries.lastRun(query.id);
      return { query: { ...query, mine: query.ownerId === viewer(request).id, resources, lastRun: last ? runView(last) : null } };
    } catch (error) {
      return unavailable(error, reply, request);
    }
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
      if (body.sql !== query.sql) await queries.update(query.id, { sql: body.sql });
      return { preflight: await check(body.sql, await resourcesOf(request, query)) };
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
    try {
      checked = await check(body.sql, await resourcesOf(request, query));
    } catch (error) {
      return unavailable(error, reply, request);
    }
    if (!checked.runnable) return reply.code(409).send({ error: 'not_runnable', message: 'This query cannot run as it is.', preflight: checked });
    if (checked.range === 'request') {
      return reply.code(409).send({ error: 'request_needed', message: 'This query reads more than the Data Team allows without a Request.', preflight: checked });
    }
    if (checked.range === 'approve' && !body.approve) {
      return reply.code(409).send({ error: 'approval_needed', message: 'This query reads enough to need your approval.', preflight: checked });
    }

    const who = viewer(request);
    const run = await queries.startRun({ query, user: who, sql: body.sql, estimatedBytes: checked.bytes ?? 0, approved: checked.range === 'approve' });
    try {
      const finished = await bigquery.run(body.sql, {
        // Never more than the second threshold without an accepted Request (DEC-SR-29).
        maximumBytesBilled: thresholds.request,
        labels: { 'datahub-user': label(who.id), 'datahub-query': run.queryRef },
        requestId: randomUUID(),
        pageSize: PAGE_SIZE,
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
