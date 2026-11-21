import { randomUUID } from 'node:crypto';
import { can, rangesOf } from '@datahub/contracts';
import { PROBE_KEYS, type ProbeKey, type ProbeRunAnswer } from '@datahub/contracts/eda';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, permissionsOf } from './access.js';
import { type BigQuery, BigQueryRefused, type Page } from './bigquery.js';
import type { QueryResource } from './catalogue.js';
import type { NamedResource } from './database.js';
import type { Parameter } from './parameters.js';
import type { Preflight, Problem, ResourceOfQuery, Thresholds } from './preflight.js';
import type { Queries, Viewer } from './queries.js';

/** What the route of the EDA-Probes shares with those of queries: who asks, the checks and the Resource (TR-ED-04). */
export interface EdaContext {
  queries: Queries;
  bigquery: BigQuery;
  viewer(request: FastifyRequest): Viewer;
  /** The Resource, if the User may see it, as catalogue answers with their token; otherwise answered as not found. */
  resourceOf(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<QueryResource | undefined>;
  /** The Pre-flight of SQL on these Resources: without the request of the User, it reads no table outside Data Hub. */
  check(sql: string, parameters: Parameter[], resources: ResourceOfQuery[], ranges: Thresholds): Promise<Preflight>;
  ownCase(sql: string, resources: ResourceOfQuery[], outside?: Preflight['tables']): string;
  unavailable(error: unknown, reply: FastifyReply, request: FastifyRequest): FastifyReply | undefined;
  /** A value of a label in BigQuery. */
  label(value: string): string;
}

/** What eda asks query to run: an EDA-Probe, its SQL, and whether the User approves what it reads. */
export interface ProbeRun {
  probe: ProbeKey;
  sql: string;
  approve: boolean;
}

/** An EDA-Probe answers at most this many rows: its SQL returns aggregates, never the rows of the table (TR-ED-03, TR-ED-04). */
export const PROBE_ROWS = 10_000;

/** The run of an EDA-Probe, in a request (TR-ED-04); a string says what does not fit. */
export function parseProbeRun(body: unknown): ProbeRun | string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return 'Send a JSON object.';
  const { probe, sql, approve = false } = body as Record<string, unknown>;
  if (typeof probe !== 'string' || !(PROBE_KEYS as readonly string[]).includes(probe)) return 'The probe is one of the EDA-Probes, by its key.';
  if (typeof sql !== 'string' || sql.trim() === '' || sql.length > 100_000) return 'The SQL has 1 to 100,000 characters.';
  if (typeof approve !== 'boolean') return 'approve is true or false.';
  return { probe: probe as ProbeKey, sql, approve };
}

/** A nested value, a list or a record, which a page of a result keeps as JSON text (see rowsOf in bigquery.ts). */
const NESTED = /^(?:ARRAY|STRUCT)\b/;

/**
 * The rows of a result as eda reads them: one object per row, by the names of its columns. A value is as BigQuery
 * writes it, as text, and null is null; a list or a record is a JSON value, its own values as text too.
 */
export function recordsOf(page: Pick<Page, 'columns' | 'rows'>): Record<string, unknown>[] {
  return page.rows.map((row) =>
    Object.fromEntries(
      page.columns.map((column, index) => {
        const value = row[index] ?? null;
        return [column.name, value !== null && NESTED.test(column.type) ? (JSON.parse(value) as unknown) : value];
      }),
    ),
  );
}

/** Bytes as a User reads them: in MB below a GB, in GB above. */
function size(bytes: number): string {
  return bytes >= 1_000_000_000 ? `${Number((bytes / 1_000_000_000).toFixed(1))} GB` : `${Number((bytes / 1_000_000).toFixed(1))} MB`;
}

/** Why an EDA-Probe cannot run, from the first problem of its Pre-flight, in a sentence. */
export function reasonOf(problem: Problem | undefined): string {
  switch (problem?.kind) {
    case 'tooLarge':
      // Above the ranges of the User it does not run: a Request for an EDA-Probe comes with OP-ED-05.
      return `It reads ${size(problem.bytes)}, more than one run of yours may read (${size(problem.limit)}), so it does not run.`;
    case 'outside':
    case 'unknown':
      return `It reads ${problem.name}, which is not the table of this Resource: an EDA-Probe reads only its own Resource.`;
    case 'notVisible':
      return 'You may not see this Resource.';
    case 'notSelect':
      return `An EDA-Probe only reads; this SQL is a ${problem.statementType}.`;
    case 'undefinedParameter':
      return `@${problem.name} has no value: an EDA-Probe runs without Parameters.`;
    case 'filterRequired':
      return `It does not filter on ${problem.column}, the partition column of this Resource, which every query of it must.`;
    case 'invalid':
      return `BigQuery refused it: ${problem.message}`;
    case 'empty':
    case undefined:
      return 'There is no SQL to run.';
  }
}

/**
 * The run of an EDA-Probe (TR-ED-04, FR-ED-06, DEC-ED-26): eda asks it with the Access Token of the User who runs it,
 * who holds `eda.use` and sees the Resource. Its SQL reads only the table of that Resource, only reads, and runs within
 * the ranges of the User: up to the first it runs, up to the second only approved, and above them not at all. It runs
 * as a job with a maximum on the bytes billed and the labels of the User and of an EDA run, kept in the Query Log as a
 * run of the kind `eda`, apart from the queries of the panel of the User, as a Preview is.
 */
export async function edaRoutes(app: FastifyInstance, context: EdaContext): Promise<void> {
  const { queries, bigquery, viewer, resourceOf, check, ownCase, unavailable, label } = context;
  const named = (resource: QueryResource): NamedResource => ({ id: resource.id, key: resource.key, displayName: resource.displayName });

  app.post<{ Params: { id: string }; Body: unknown }>('/resources/:id/eda/runs', async (request, reply) => {
    const permissions = permissionsOf(request);
    if (!can(permissions, 'eda.use')) return forbidden(reply, 'eda.use', 'Only who may explore Resources runs an EDA-Probe.');
    const body = parseProbeRun(request.body);
    if (typeof body === 'string') return reply.code(400).send({ error: 'invalid_request', message: body });
    const resource = await resourceOf(request, reply);
    if (!resource) return reply;
    const read: ResourceOfQuery[] = [{ named: named(resource), resource }];

    // The ranges of the User (runs.ranges), without a Request above them: an EDA-Probe that reads more does not run.
    const ranges: Required<Thresholds> = { ...rangesOf(permissions), above: 'refuse' };
    let checked: Preflight;
    try {
      checked = await check(body.sql, [], read, ranges);
    } catch (error) {
      return unavailable(error, reply, request);
    }
    if (!checked.runnable) {
      const answer: ProbeRunAnswer = { state: 'refused', bytes: checked.bytes, reason: reasonOf(checked.problems[0]) };
      return reply.code(200).send(answer);
    }
    if (checked.range !== 'free' && !body.approve) {
      const answer: ProbeRunAnswer = { state: 'approve', bytes: checked.bytes ?? 0 };
      return reply.code(200).send(answer);
    }

    const who = viewer(request);
    const estimated = checked.bytes ?? 0;
    try {
      const query = await queries.edaFor(who, named(resource), `EDA · ${resource.displayName}`);
      const run = await queries.startRun({ query, user: who, sql: body.sql, parameters: [], estimatedBytes: estimated, approved: checked.range !== 'free' });
      try {
        const finished = await bigquery.run(ownCase(body.sql, read, checked.tables), {
          // Never more than the second range of the User (runs.ranges).
          maximumBytesBilled: ranges.request,
          labels: { 'datahub-user': label(who.id), 'datahub-query': run.queryRef, 'datahub-purpose': 'eda', 'datahub-eda-probe': label(body.probe) },
          requestId: randomUUID(),
          pageSize: PROBE_ROWS,
        });
        // Its first rows, read on from the same job where BigQuery gave fewer, at most 10,000.
        const rows = finished.rows.slice(0, PROBE_ROWS);
        while (rows.length < Math.min(PROBE_ROWS, finished.totalRows)) {
          const page = await bigquery.page(finished, rows.length, PROBE_ROWS - rows.length);
          if (page.rows.length === 0) break;
          rows.push(...page.rows.slice(0, PROBE_ROWS - rows.length));
        }
        const done = await queries.finishRun(run.id, {
          jobId: finished.jobId,
          jobLocation: finished.location,
          processedBytes: finished.processedBytes,
          billedBytes: finished.billedBytes,
          partitions: finished.partitions,
          rowCount: finished.totalRows,
          columns: finished.columns,
        });
        const answer: ProbeRunAnswer = { state: 'ran', rows: recordsOf({ columns: finished.columns, rows }), bytes: finished.processedBytes, runId: done.queryRef };
        return reply.code(201).send(answer);
      } catch (error) {
        await queries.failRun(run.id, error instanceof Error ? error.message : String(error));
        if (error instanceof BigQueryRefused) {
          // BigQuery refused the run itself, as its Pre-flight did not: it is in the Query Log as failed.
          const answer: ProbeRunAnswer = { state: 'refused', bytes: checked.bytes, reason: `BigQuery refused it: ${error.message}` };
          return reply.code(200).send(answer);
        }
        throw error;
      }
    } catch (error) {
      return unavailable(error, reply, request);
    }
  });
}
