import type { DataHubReading, EdaStatus, OwnerReading, ProbeKey, ProbeResult, Selection, Who } from '@datahub/contracts/eda';
import { type Kysely, type Selectable, sql } from 'kysely';
import type { EdaDatabase } from './database.js';

/** An EDA of a Resource (DEC-ED-20). */
export interface Eda {
  id: string;
  resourceId: string;
  status: EdaStatus;
  startedBy: Who;
  startedAt: Date;
  exploredAt: Date | null;
  /** When catalogue heard that it is Explored; null until it did (TR-ED-05). */
  toldAt: Date | null;
  /** The needed EDA-Probes and how many are complete, as last computed, for the panel (FR-ED-03). */
  needed: { total: number; complete: number };
}

/** An EDA-Probe added to an EDA, with the fields and parameters it is set on (DEC-ED-17). */
export interface AddedProbe {
  probe: ProbeKey;
  fields: string[];
  params: Record<string, unknown>;
  addedBy: Who;
  addedAt: Date;
}

/** A run of an EDA-Probe, with its result per subject (FR-ED-06, TR-ED-03). */
export interface Run {
  id: string;
  probe: ProbeKey;
  fields: string[];
  params: Record<string, unknown>;
  /** The rows it ran on: the whole table, without conditions, or a selection of its rows (OP-ED-12). */
  selection: Selection;
  ranBy: Who;
  ranAt: Date;
  bytes: number;
  queryRunId: string;
  results: { subject: string; data: ProbeResult; reading: DataHubReading }[];
}

/** The reading of who works on the EDA of a result, per EDA-Probe and subject (FR-ED-11). */
export interface Reading {
  probe: ProbeKey;
  subject: string;
  reading: OwnerReading;
  by: Who;
  at: Date;
}

/**
 * What an EDA holds: its EDA-Probes, the last run of each on the whole table, and the readings of who works on it. A
 * run on a selection of rows is never the last run of its EDA-Probe (OP-ED-12).
 */
export interface EdaState {
  probes: AddedProbe[];
  lastRuns: Run[];
  readings: Reading[];
}

export interface Edas {
  /** The EDA of a Resource, if it has one. */
  ofResource(resourceId: string): Promise<Eda | undefined>;
  /** The EDAs of these Resources. */
  ofResources(resourceIds: readonly string[]): Promise<Eda[]>;
  /** Starts the EDA of a Resource, In progress; 'exists' when it has one (FR-ED-02). */
  start(resourceId: string, by: Who): Promise<Eda | 'exists'>;
  state(edaId: string): Promise<EdaState>;
  /**
   * Keeps a run and its results. A run on the whole table adds its EDA-Probe if it is not yet; an EDA-Probe added keeps
   * who added it and when, and is set on what it last ran with (FR-ED-06, DEC-ED-17). A run on a selection of rows
   * changes nothing of its EDA-Probe, which it neither adds nor sets (OP-ED-12).
   */
  keepRun(edaId: string, run: Omit<Run, 'id' | 'ranAt'>): Promise<Run>;
  /** Keeps the reading of a result by who works on the EDA, in place of an earlier one (FR-ED-11). */
  read(edaId: string, reading: Omit<Reading, 'at'>): Promise<Reading>;
  /** Makes an EDA in progress Explored, now; the EDA as it is after (FR-ED-12). */
  explore(edaId: string): Promise<Eda>;
  /** catalogue heard that it is Explored (TR-ED-05). */
  told(edaId: string): Promise<void>;
  /** Keeps how many needed EDA-Probes it has and how many are complete, for the panel. */
  count(edaId: string, needed: { total: number; complete: number }): Promise<void>;
}

const UNIQUE_VIOLATION = '23505';

type EdaRow = Selectable<EdaDatabase['edas']>;
const edaOf = (row: EdaRow): Eda => ({
  id: row.id,
  resourceId: row.resourceId,
  status: row.status,
  startedBy: { id: row.startedById, name: row.startedByName },
  startedAt: row.startedAt,
  exploredAt: row.exploredAt,
  toldAt: row.toldAt,
  needed: { total: row.neededTotal, complete: row.neededComplete },
});

/** The EDAs in the schema `eda` (TR-ED-01). Who may do what is decided by the routes. */
export function createEdas(db: Kysely<EdaDatabase>): Edas {
  return {
    async ofResource(resourceId) {
      const row = await db.selectFrom('edas').selectAll().where('resourceId', '=', resourceId).executeTakeFirst();
      return row && edaOf(row);
    },

    async ofResources(resourceIds) {
      if (resourceIds.length === 0) return [];
      return (await db.selectFrom('edas').selectAll().where('resourceId', 'in', [...resourceIds]).execute()).map(edaOf);
    },

    async start(resourceId, by) {
      try {
        const row = await db.insertInto('edas').values({ resourceId, startedById: by.id, startedByName: by.name }).returningAll().executeTakeFirstOrThrow();
        return edaOf(row);
      } catch (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) return 'exists';
        throw error;
      }
    },

    async state(edaId) {
      const probes = (await db.selectFrom('edaProbes').selectAll().where('edaId', '=', edaId).execute()).map(
        (row): AddedProbe => ({ probe: row.probe, fields: row.fields, params: row.params, addedBy: { id: row.addedById, name: row.addedByName }, addedAt: row.addedAt }),
      );
      // The last run of each EDA-Probe on the whole table (OP-ED-12).
      const runs = await db
        .selectFrom('edaRuns')
        .selectAll()
        .distinctOn('probe')
        .where('edaId', '=', edaId)
        .where(sql<boolean>`selection -> 'where' = '[]'::jsonb`)
        .orderBy('probe')
        .orderBy('ranAt', 'desc')
        .orderBy('id')
        .execute();
      const results = runs.length
        ? await db
            .selectFrom('edaResults')
            .select(['runId', 'subject', 'data', 'reading'])
            .where(
              'runId',
              'in',
              runs.map((run) => run.id),
            )
            .orderBy('runId')
            .orderBy('position')
            .execute()
        : [];
      const lastRuns = runs.map(
        (row): Run => ({
          id: row.id,
          probe: row.probe,
          fields: row.fields,
          params: row.params,
          selection: row.selection,
          ranBy: { id: row.ranById, name: row.ranByName },
          ranAt: row.ranAt,
          bytes: Number(row.bytes),
          queryRunId: row.queryRunId,
          results: results.filter((result) => result.runId === row.id).map(({ subject, data, reading }) => ({ subject, data, reading })),
        }),
      );
      const readings = (await db.selectFrom('edaReadings').selectAll().where('edaId', '=', edaId).execute()).map(
        (row): Reading => ({ probe: row.probe, subject: row.subject, reading: row.reading, by: { id: row.byId, name: row.byName }, at: row.at }),
      );
      return { probes, lastRuns, readings };
    },

    async keepRun(edaId, run) {
      return db.transaction().execute(async (trx) => {
        const fields = JSON.stringify(run.fields);
        const params = JSON.stringify(run.params);
        if (run.selection.where.length === 0) {
          await trx
            .insertInto('edaProbes')
            .values({ edaId, probe: run.probe, fields, params, addedById: run.ranBy.id, addedByName: run.ranBy.name })
            .onConflict((conflict) => conflict.columns(['edaId', 'probe']).doUpdateSet({ fields, params }))
            .execute();
        }
        const row = await trx
          .insertInto('edaRuns')
          .values({
            edaId,
            probe: run.probe,
            fields,
            params,
            selection: JSON.stringify(run.selection),
            ranById: run.ranBy.id,
            ranByName: run.ranBy.name,
            bytes: run.bytes,
            queryRunId: run.queryRunId,
          })
          .returning(['id', 'ranAt'])
          .executeTakeFirstOrThrow();
        if (run.results.length) {
          await trx
            .insertInto('edaResults')
            .values(run.results.map((result, position) => ({ runId: row.id, subject: result.subject, position, data: JSON.stringify(result.data), reading: result.reading })))
            .execute();
        }
        return { ...run, id: row.id, ranAt: row.ranAt };
      });
    },

    async read(edaId, { probe, subject, reading, by }) {
      const row = await db
        .insertInto('edaReadings')
        .values({ edaId, probe, subject, reading, byId: by.id, byName: by.name })
        .onConflict((conflict) => conflict.columns(['edaId', 'probe', 'subject']).doUpdateSet({ reading, byId: by.id, byName: by.name, at: new Date() }))
        .returningAll()
        .executeTakeFirstOrThrow();
      return { probe: row.probe, subject: row.subject, reading: row.reading, by: { id: row.byId, name: row.byName }, at: row.at };
    },

    async explore(edaId) {
      await db.updateTable('edas').set({ status: 'explored', exploredAt: new Date() }).where('id', '=', edaId).where('status', '=', 'inProgress').execute();
      return edaOf(await db.selectFrom('edas').selectAll().where('id', '=', edaId).executeTakeFirstOrThrow());
    },

    async told(edaId) {
      await db.updateTable('edas').set({ toldAt: new Date() }).where('id', '=', edaId).execute();
    },

    async count(edaId, needed) {
      await db.updateTable('edas').set({ neededTotal: needed.total, neededComplete: needed.complete }).where('id', '=', edaId).execute();
    },
  };
}
