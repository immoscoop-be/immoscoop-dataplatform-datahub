import type { FastifyBaseLogger } from 'fastify';
import { type BigQuery, BigQueryRefused } from './bigquery.js';
import { missingOf } from './broken.js';
import type { BrokenMessage, Catalogue } from './catalogue.js';
import type { Missing, NamedResource } from './database.js';
import { valuesFor } from './lens-api.js';
import type { Lens, Lenses } from './lenses.js';
import { bind, type Parameter } from './parameters.js';
import type { Queries, Query } from './queries.js';

/** What no longer exists, before Data Hub dates it. */
export type Lost = Omit<Missing, 'since'>;

/** What a dry run of SQL that ran before says now: it works, or it misses a table or a column; null for any other refusal. */
export type DryOutcome = { works: true } | { works: false; missing: Lost | null };

/** How many dry runs go to BigQuery at once: enough to check every query in a few minutes, few enough not to crowd it. */
const AT_ONCE = 8;
/** A Resource whose table a User's query did not find is checked at most once in this time, however often they try. */
const QUIET = 10 * 60_000;

/** How many queries and Lenses a check found Broken, and how many work again. */
export interface CheckOutcome {
  checked: number;
  broken: number;
  works: number;
}

/**
 * What a Message on a Broken query or Lens names (MSG-QRY-02, MSG-LEN-05): the day it was found, and the Resource
 * that no longer exists, or the column. BigQuery does not say of which Resource a column was, so a column names
 * the Resources it reads.
 */
export function messageOf(missing: Missing, resources: readonly Pick<NamedResource, 'key' | 'displayName'>[]): BrokenMessage {
  const since = missing.since.slice(0, 10);
  if (missing.kind === 'table') {
    const named = resources.find((resource) => resource.key === missing.name.toLowerCase());
    return { since, missing: [{ kind: 'resource', resource: named?.displayName ?? missing.name }] };
  }
  return { since, missing: [{ kind: 'column', column: missing.name, resource: resources.map((resource) => resource.displayName).join(' / ') || missing.name }] };
}

/** Runs the work on every item, a few at a time. */
async function eachAtOnce<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++] as T);
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
}

/**
 * Keeps queries and Lenses Broken while what they read no longer exists, and working again once it is back
 * (FR-SR-52, FR-SR-53, FR-LE-17): each change of state in their Log, and a Message to who made the query or to
 * the Owner Unit of the Lens (MSG-QRY-02, MSG-LEN-05), sent once per time it breaks.
 */
export function createUpkeep(deps: { queries: Queries; lenses: Lenses; catalogue: Catalogue; bigquery: BigQuery; now?: () => number }) {
  const { queries, lenses, catalogue, bigquery, now = Date.now } = deps;
  /** When each Resource was last checked because a User's query did not find what it reads. */
  const lately = new Map<string, number>();

  /** A Message to catalogue, best effort: the state and the Log are what count, and they are kept already. */
  async function tell(send: () => Promise<void>, log: FastifyBaseLogger, about: Record<string, string>): Promise<void> {
    try {
      await send();
    } catch (error) {
      log.error({ err: error, ...about }, 'catalogue could not be told that something became Broken or works again');
    }
  }

  /** A dry run of SQL as BigQuery read it before: it reads nothing and costs nothing. */
  async function dryRun(sql: string, parameters: Parameter[]): Promise<DryOutcome> {
    const bound = bind(sql, parameters);
    try {
      await bigquery.dryRun(bound.sql, bound.parameters);
      return { works: true };
    } catch (error) {
      if (error instanceof BigQueryRefused) return { works: false, missing: missingOf(error.message) };
      throw error;
    }
  }

  /** The query misses what it reads, or works again (FR-SR-53). */
  async function query(found: Query, missing: Lost | null, log: FastifyBaseLogger): Promise<Query> {
    if (missing) {
      const { query: kept, changed } = await queries.breaks(found.id, missing);
      if (changed && kept.broken) {
        const broken = kept.broken;
        await tell(() => catalogue.broken({ kind: 'query', id: kept.id, name: kept.name, ownerId: kept.ownerId }, messageOf(broken, kept.resources)), log, { query: kept.id });
      }
      return kept;
    }
    const { query: kept, changed } = await queries.works(found.id);
    if (changed) await tell(() => catalogue.worksAgain({ kind: 'query', id: kept.id }), log, { query: kept.id });
    return kept;
  }

  /** The Lens misses what it reads, or works again (FR-LE-17). */
  async function lens(found: Lens, missing: Lost | null, log: FastifyBaseLogger): Promise<Lens> {
    if (missing) {
      const kept = await lenses.breaks(found.id, missing);
      if (!found.broken && kept.broken) {
        const broken = kept.broken;
        await tell(() => catalogue.broken({ kind: 'lens', id: kept.id }, messageOf(broken, kept.resources)), log, { lens: kept.id });
      }
      return kept;
    }
    if (!found.broken) return found;
    const kept = await lenses.works(found.id);
    await tell(() => catalogue.worksAgain({ kind: 'lens', id: kept.id }), log, { lens: kept.id });
    return kept;
  }

  /** Dry-runs the SQL each query kept at its last Pre-flight that passed: what it misses now makes it Broken. */
  async function checkQueries(resourceIds: readonly string[] | undefined, log: FastifyBaseLogger): Promise<CheckOutcome> {
    const outcome: CheckOutcome = { checked: 0, broken: 0, works: 0 };
    await eachAtOnce(await queries.toCheck(resourceIds), async (found) => {
      if (!found.checkSql) return;
      outcome.checked += 1;
      try {
        const dry = await dryRun(found.checkSql, found.checkParameters);
        if (dry.works && found.broken) {
          await query(found, null, log);
          outcome.works += 1;
        } else if (!dry.works && dry.missing) {
          if (!found.broken) outcome.broken += 1;
          await query(found, dry.missing, log);
        } else if (!dry.works) {
          log.warn({ query: found.id }, 'A query could not be checked: BigQuery refused it for another reason than something missing');
        }
      } catch (error) {
        log.warn({ err: error, query: found.id }, 'A query could not be checked');
      }
    });
    return outcome;
  }

  /** Dry-runs every Lens that runs and reads one of these Resources, with its defaults. */
  async function checkLenses(resourceIds: readonly string[], log: FastifyBaseLogger): Promise<CheckOutcome> {
    const outcome: CheckOutcome = { checked: 0, broken: 0, works: 0 };
    const ids = new Set(resourceIds);
    const reading = (await lenses.list()).filter((found) => found.state !== 'waiting' && found.state !== 'refused' && found.resources.some((resource) => ids.has(resource.id)));
    await eachAtOnce(reading, async (found) => {
      outcome.checked += 1;
      try {
        const dry = await dryRun(found.sql, valuesFor(found, undefined) as Parameter[]);
        if (dry.works && found.broken) {
          await lens(found, null, log);
          outcome.works += 1;
        } else if (!dry.works && dry.missing) {
          if (!found.broken) outcome.broken += 1;
          await lens(found, dry.missing, log);
        }
      } catch (error) {
        log.warn({ err: error, lens: found.id }, 'A Lens could not be checked');
      }
    });
    return outcome;
  }

  /** Checks what reads these Resources (FR-SR-52): every Lens that runs, and every query with its SQL kept. */
  async function checkReading(resourceIds: readonly string[], log: FastifyBaseLogger): Promise<{ queries: CheckOutcome; lenses: CheckOutcome }> {
    if (resourceIds.length === 0) return { queries: { checked: 0, broken: 0, works: 0 }, lenses: { checked: 0, broken: 0, works: 0 } };
    const [lensOutcome, queryOutcome] = await Promise.all([checkLenses(resourceIds, log), checkQueries(resourceIds, log)]);
    return { queries: queryOutcome, lenses: lensOutcome };
  }

  return {
    dryRun,
    query,
    lens,
    checkQueries,
    /** After a new Current Version, what reads the Resources that changed (FR-SR-52, the first moment). */
    checkReading,
    /**
     * A run, a Pre-flight or a Preview did not find the table of a Resource (FR-SR-52, the third moment): what
     * reads it is checked, at most once in ten minutes per Resource, as a User may try again and again.
     */
    async lost(resourceIds: readonly string[], log: FastifyBaseLogger): Promise<void> {
      const due = resourceIds.filter((id) => (lately.get(id) ?? -Infinity) <= now() - QUIET);
      for (const id of due) lately.set(id, now());
      if (due.length === 0) return;
      try {
        await checkReading(due, log);
      } catch (error) {
        log.warn({ err: error, resources: due }, 'What reads a Resource whose table was not found could not be checked');
      }
    },
  };
}

export type Upkeep = ReturnType<typeof createUpkeep>;
