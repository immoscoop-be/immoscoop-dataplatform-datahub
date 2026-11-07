import { type Kysely, sql } from 'kysely';
import type { DeliveryOutcome, DeliveryReason, RegistryDatabase, SetStatus } from './database.js';

/** What a delivery of the webhook said, as far as Data Hub read it. */
export interface DeliveryFacts {
  eventType?: string | null;
  webhookName?: string | null;
  accountId?: string | null;
  projectId?: string | null;
  jobId?: string | null;
  jobName?: string | null;
  environmentName?: string | null;
  runId?: string | null;
  runStatus?: string | null;
  runStartedAt?: string | null;
  runFinishedAt?: string | null;
}

export interface NewDelivery extends DeliveryFacts {
  outcome: DeliveryOutcome;
  reason?: DeliveryReason | null;
}

/** A delivery as the page Webhooks shows it (FR-AR-19), with its Artifact Set when it was recorded. */
export interface Delivery extends Required<DeliveryFacts> {
  id: string;
  receivedAt: Date;
  outcome: DeliveryOutcome;
  reason: DeliveryReason | null;
  /** The Artifact Set of a recorded delivery as it stands now: pending, processed, or failed and why. */
  set: { status: SetStatus; error: string | null; processedAt: Date | null; current: boolean } | null;
}

export interface Deliveries {
  record(delivery: NewDelivery): Promise<void>;
  /** The deliveries of the last 30 days, the newest first. */
  list(): Promise<Delivery[]>;
  /** How many of them call for a look: refused, or recorded and failed. */
  toLookAt(): Promise<number>;
}

/** How long deliveries are kept, as the page shows them. */
export const KEPT_DAYS = 30;
/** At most this many refused deliveries are kept an hour, so that nobody fills the table by trying the address. */
export const REFUSED_PER_HOUR = 100;

const FACTS = ['eventType', 'webhookName', 'accountId', 'projectId', 'jobId', 'jobName', 'environmentName', 'runId', 'runStatus', 'runStartedAt', 'runFinishedAt'] as const;

/** The deliveries of the webhook of dbt Cloud, and what Data Hub did with each (FR-AR-19). */
export function createDeliveries(db: Kysely<RegistryDatabase>, now: () => Date = () => new Date()): Deliveries {
  const since = () => new Date(now().getTime() - KEPT_DAYS * 24 * 3600 * 1000);

  return {
    async record(delivery) {
      if (delivery.outcome === 'refused') {
        const hourAgo = new Date(now().getTime() - 3600 * 1000);
        const { count } = await db
          .selectFrom('deliveries')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('outcome', '=', 'refused')
          .where('receivedAt', '>', hourAgo)
          .executeTakeFirstOrThrow();
        if (Number(count) >= REFUSED_PER_HOUR) return;
      }
      const facts = Object.fromEntries(FACTS.map((key) => [key, delivery[key] ?? null]));
      await db
        .insertInto('deliveries')
        .values({ ...facts, receivedAt: now(), outcome: delivery.outcome, reason: delivery.reason ?? null })
        .execute();
      await db.deleteFrom('deliveries').where('receivedAt', '<', since()).execute();
    },

    async list() {
      const rows = await db
        .selectFrom('deliveries as d')
        .leftJoin('artifactSets as s', (join) => join.on(sql`s.run_id::text`, '=', sql.ref('d.runId')).on('d.outcome', '=', 'recorded'))
        .leftJoin('projects as p', 'p.currentSetId', 's.id')
        .selectAll('d')
        .select(['s.status as setStatus', 's.error as setError', 's.processedAt as setProcessedAt', 'p.projectId as currentOf'])
        .where('d.receivedAt', '>=', since())
        .orderBy('d.receivedAt', 'desc')
        .orderBy('d.id', 'desc')
        .execute();
      return rows.map((row) => ({
        id: String(row.id),
        receivedAt: row.receivedAt,
        outcome: row.outcome,
        reason: row.reason,
        ...Object.fromEntries(FACTS.map((key) => [key, row[key]])),
        set: row.setStatus ? { status: row.setStatus, error: row.setError ?? null, processedAt: row.setProcessedAt ?? null, current: row.currentOf !== null } : null,
      })) as Delivery[];
    },

    async toLookAt() {
      const { count } = await db
        .selectFrom('deliveries as d')
        .leftJoin('artifactSets as s', (join) => join.on(sql`s.run_id::text`, '=', sql.ref('d.runId')).on('d.outcome', '=', 'recorded'))
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .where('d.receivedAt', '>=', since())
        .where((eb) => eb.or([eb('d.outcome', '=', 'refused'), eb('s.status', '=', 'failed')]))
        .executeTakeFirstOrThrow();
      return Number(count);
    },
  };
}
