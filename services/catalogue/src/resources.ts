import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';
import type { Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
import { type Column, fingerprint, type LeftOut, levelAtRegistration, splitColumns } from './fields.js';
import { logText, type ResourceLogId } from './log.js';

/** A table under an exposure tagged `datahub`, as registry tells it (TR-AR-08). */
export interface ExposedTable {
  key: string;
  nodeId: string;
  name: string;
  resourceType: string;
  description: string;
  exposures: string[];
  label: string | null;
  /** The checksum of its code, for the Fingerprint (FR-SR-08). */
  checksum: string | null;
  /** Its columns, in the order of the table. */
  columns: Column[];
}

/** Every exposed table of one dbt project, after a new Current Version. */
export interface ResourcesUpdate {
  projectId: string;
  projectName: string | null;
  runId: string;
  /** When dbt made the manifest of the run, as ISO 8601. */
  generatedAt: string | null;
  tables: ExposedTable[];
}

export interface Resource {
  id: string;
  key: string;
  displayName: string;
  name: string;
  resourceType: string;
  projectId: string;
  projectName: string | null;
  nodeId: string;
  description: string;
  exposures: string[];
  collectionId: string | null;
  /** From 0 · Beta to 5 · Monitored (FR-MR-10). */
  level: number;
  registeredAt: Date;
  /** No exposure tagged `datahub` depends on it any more; it is held (DEC-SR-26). */
  withdrawn: boolean;
}

/** A Resource with its fields, and the columns of its table left out of it (FR-SR-06, DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Column[];
  leftOut: LeftOut[];
}

export interface UpdateOutcome {
  /** False for a call about an older run than the last one applied. */
  applied: boolean;
  registered: number;
  renamed: number;
  withdrawn: number;
  back: number;
}

export interface LogEntry {
  logId: string;
  text: string;
  params: Record<string, string>;
  at: Date;
}

/** A Resource as the page of its Collection lists it, with the latest entry of its Log (FR-CO-27). */
export interface CollectionResource extends Resource {
  lastChange: LogEntry | null;
}

/** What adding Resources to a Collection came to: all of them added, or none and why (FR-CO-31). */
export type AddOutcome =
  | { outcome: 'added'; added: number }
  | { outcome: 'collection_gone' }
  | { outcome: 'not_found'; ids: string[] }
  | { outcome: 'in_another_collection'; ids: string[] };

/** Resources in Postgres (TR-SR-02 to TR-SR-04). Who may do what is decided by the routes. */
export interface Resources {
  /** Registers, renames, withdraws and brings back the Resources of one dbt project, in one go. */
  apply(update: ResourcesUpdate): Promise<UpdateOutcome>;
  /** The Resources without Collection, withdrawn ones included (FR-SR-35). */
  withoutCollection(): Promise<Resource[]>;
  /** The Resources of a Collection, withdrawn ones included, each with its last change. */
  inCollection(collectionId: string): Promise<CollectionResource[]>;
  get(id: string): Promise<Resource | undefined>;
  /** A Resource with its fields and the columns left out of it. */
  detail(id: string): Promise<ResourceDetail | undefined>;
  /**
   * Adds Resources to a Collection in one go, never from another one (FR-CO-08, FR-CO-31): all of
   * them, or none when one cannot be added. One already in the Collection stays as it is.
   */
  add(ids: readonly string[], collection: { id: string; name: string }, viewer: Viewer): Promise<AddOutcome>;
  /** Takes a Resource out of its Collection; false when it was in none. */
  remove(id: string, viewer: Viewer): Promise<boolean>;
  log(id: string, limit: number): Promise<LogEntry[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Selectable<CatalogueDatabase['resources']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

function present(row: Row): Resource {
  return {
    id: row.id,
    key: row.key,
    displayName: row.displayName,
    name: row.name,
    resourceType: row.resourceType,
    projectId: row.projectId,
    projectName: row.projectName,
    nodeId: row.nodeId,
    description: row.description,
    exposures: row.exposures,
    collectionId: row.collectionId,
    level: row.level,
    registeredAt: row.registeredAt,
    withdrawn: row.withdrawnAt !== null,
  };
}

export function createResources(db: Kysely<CatalogueDatabase>): Resources {
  async function write(trx: Database, resourceId: string, logId: ResourceLogId, params: Record<string, string>, actorId: string | null = null) {
    await trx.insertInto('resourceLog').values({ resourceId, logId, params, actorId }).execute();
  }

  /** The fields of a Resource and the columns left out of it, as its table has them now (FR-SR-06). */
  async function keepColumns(trx: Database, resourceId: string, columns: { fields: Column[]; leftOut: LeftOut[] }) {
    await trx.deleteFrom('resourceFields').where('resourceId', '=', resourceId).execute();
    await trx.deleteFrom('resourceLeftOut').where('resourceId', '=', resourceId).execute();
    if (columns.fields.length > 0) {
      await trx
        .insertInto('resourceFields')
        .values(columns.fields.map(({ name, position, dataType, description }) => ({ resourceId, name, position, dataType, description })))
        .execute();
    }
    if (columns.leftOut.length > 0) {
      await trx
        .insertInto('resourceLeftOut')
        .values(columns.leftOut.map(({ name, dataType, reason }) => ({ resourceId, name, dataType, reason })))
        .execute();
    }
  }

  /** The state of the Message that a Resource waits for a Collection (MSG-RES-01). */
  async function registrationMessage(trx: Database, resourceId: string, state: 'waiting' | 'inCollection') {
    await trx
      .updateTable('messages')
      .set({ state, updatedAt: new Date() })
      .where('type', '=', 'MSG-RES-01')
      .where('subjectKind', '=', 'resource')
      .where('subjectId', '=', resourceId)
      .execute();
  }

  /**
   * The Display Name a Resource gets (FR-SR-33): the name it asks for when no other Resource that is
   * not withdrawn has it, else with its dbt project in brackets, else with its Key.
   */
  async function freeName(trx: Database, wanted: string, update: ResourcesUpdate, key: string, self?: string): Promise<string> {
    for (const candidate of [wanted, `${wanted} (${update.projectName ?? `project ${update.projectId}`})`, `${wanted} (${key})`]) {
      const taken = await trx
        .selectFrom('resources')
        .select('id')
        .where(sql`lower(display_name)`, '=', candidate.toLowerCase())
        .where('withdrawnAt', 'is', null)
        .$if(self !== undefined, (query) => query.where('id', '<>', self!))
        .executeTakeFirst();
      if (!taken) {
        return candidate;
      }
    }
    return key;
  }

  return {
    async apply(update) {
      return db.transaction().execute(async (trx) => {
        const outcome: UpdateOutcome = { applied: true, registered: 0, renamed: 0, withdrawn: 0, back: 0 };
        // One call per dbt project at a time, and never one about an older run (TR-SR-02).
        await trx.insertInto('resourceSyncs').values({ projectId: update.projectId, runId: update.runId }).onConflict((conflict) => conflict.doNothing()).execute();
        const last = await trx.selectFrom('resourceSyncs').select('runId').where('projectId', '=', update.projectId).forUpdate().executeTakeFirstOrThrow();
        if (BigInt(update.runId) < BigInt(last.runId)) {
          return { ...outcome, applied: false };
        }
        const run = update.runId;
        // The day of the run, as the Message about a new Resource says it (MSG-RES-01).
        const runDay = (update.generatedAt ?? new Date().toISOString()).slice(0, 10);
        const keys = new Set(update.tables.map((table) => table.key));

        // First withdraw what is no longer exposed, so that its Display Name is free for others.
        const gone = await trx
          .updateTable('resources')
          .set({ withdrawnAt: new Date(), updatedAt: new Date() })
          .where('projectId', '=', update.projectId)
          .where('withdrawnAt', 'is', null)
          .$if(keys.size > 0, (query) => query.where('key', 'not in', [...keys]))
          .returning('id')
          .execute();
        for (const { id } of gone) {
          await write(trx, id, 'RES-004', { run });
        }
        outcome.withdrawn = gone.length;

        const known = new Map(
          keys.size === 0 ? [] : (await trx.selectFrom('resources').selectAll().where('key', 'in', [...keys]).forUpdate().execute()).map((row) => [row.key, row]),
        );
        for (const table of update.tables) {
          const wanted = table.label ?? table.name;
          const exposure = table.exposures[0] ?? '';
          const facts = {
            projectId: update.projectId,
            projectName: update.projectName,
            nodeId: table.nodeId,
            name: table.name,
            resourceType: table.resourceType,
            description: table.description,
            exposures: table.exposures,
          };
          const columns = splitColumns(table.columns);
          const row = known.get(table.key);
          if (!row) {
            // A Registration (the flow "registering a Resource"): the Resource with its Level, its
            // fields, its Fingerprint, the first entries of its Log, and the Message to the Data Team.
            const displayName = await freeName(trx, wanted, update, table.key);
            const { level, reason } = levelAtRegistration(table.description, columns.fields);
            const { id } = await trx
              .insertInto('resources')
              .values({ key: table.key, ...facts, requestedName: wanted, displayName, level })
              .returning('id')
              .executeTakeFirstOrThrow();
            await keepColumns(trx, id, columns);
            await trx
              .insertInto('resourceFingerprints')
              .values({ resourceId: id, runId: run, ...fingerprint(table.description, columns.fields, table.checksum) })
              .execute();
            await write(trx, id, 'RES-001', { exposure, key: table.key, run });
            await write(trx, id, 'RES-002', { level: String(level), reason });
            await trx
              .insertInto('messages')
              .values({
                type: 'MSG-RES-01',
                subjectKind: 'resource',
                subjectId: id,
                writerId: null,
                params: { exposure, project: update.projectName ?? `project ${update.projectId}`, run: runDay },
                state: 'waiting',
              })
              .onConflict((conflict) => conflict.doNothing())
              .execute();
            outcome.registered++;
            continue;
          }
          const back = row.withdrawnAt !== null;
          // A Resource that comes back, or asks for another name, gets its Display Name again.
          const displayName = back || wanted !== row.requestedName ? await freeName(trx, wanted, update, table.key, row.id) : row.displayName;
          await trx
            .updateTable('resources')
            .set({ ...facts, requestedName: wanted, displayName, withdrawnAt: null, updatedAt: new Date() })
            .where('id', '=', row.id)
            .execute();
          await keepColumns(trx, row.id, columns);
          if (back) {
            await write(trx, row.id, 'RES-006', { exposure, run });
            outcome.back++;
          }
          if (displayName !== row.displayName) {
            await write(trx, row.id, 'RES-003', { old: row.displayName, new: displayName, run });
            outcome.renamed++;
          }
        }
        await trx.updateTable('resourceSyncs').set({ runId: update.runId, syncedAt: new Date() }).where('projectId', '=', update.projectId).execute();
        return outcome;
      });
    },

    async withoutCollection() {
      const rows = await db.selectFrom('resources').selectAll().where('collectionId', 'is', null).orderBy(sql`lower(display_name)`).execute();
      return rows.map(present);
    },

    async inCollection(collectionId) {
      if (!UUID.test(collectionId)) {
        return [];
      }
      const rows = await db.selectFrom('resources').selectAll().where('collectionId', '=', collectionId).orderBy(sql`lower(display_name)`).execute();
      const latest =
        rows.length === 0
          ? []
          : await db
              .selectFrom('resourceLog')
              .select(['resourceId', 'logId', 'params', 'at'])
              .distinctOn('resourceId')
              .where('resourceId', 'in', rows.map((row) => row.id))
              .orderBy('resourceId')
              .orderBy('id', 'desc')
              .execute();
      const changes = new Map(latest.map((entry) => [entry.resourceId, { logId: entry.logId, text: logText(entry.logId, entry.params), params: entry.params, at: entry.at }]));
      return rows.map((row) => ({ ...present(row), lastChange: changes.get(row.id) ?? null }));
    },

    async get(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db.selectFrom('resources').selectAll().where('id', '=', id).executeTakeFirst();
      return row && present(row);
    },

    async detail(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db.selectFrom('resources').selectAll().where('id', '=', id).executeTakeFirst();
      if (!row) {
        return undefined;
      }
      const fields = await db
        .selectFrom('resourceFields')
        .select(['name', 'position', 'dataType', 'description'])
        .where('resourceId', '=', id)
        .orderBy(sql`position nulls last`)
        .orderBy('name')
        .execute();
      const leftOut = await db.selectFrom('resourceLeftOut').select(['name', 'dataType', 'reason']).where('resourceId', '=', id).orderBy('name').execute();
      return { ...present(row), fields, leftOut };
    },

    async add(ids, collection, viewer) {
      const wanted = [...new Set(ids)];
      const unknown = wanted.filter((id) => !UUID.test(id));
      if (unknown.length > 0) {
        return { outcome: 'not_found', ids: unknown };
      }
      return db.transaction().execute(async (trx): Promise<AddOutcome> => {
        // Holds the Collection, so that it is not dissolved meanwhile (FR-CO-10).
        const live = await trx.selectFrom('collections').select('id').where('id', '=', collection.id).where('dissolvedAt', 'is', null).forShare().executeTakeFirst();
        if (!live) {
          return { outcome: 'collection_gone' };
        }
        const rows = wanted.length === 0 ? [] : await trx.selectFrom('resources').selectAll().where('id', 'in', wanted).orderBy('id').forUpdate().execute();
        const missing = wanted.filter((id) => !rows.some((row) => row.id === id));
        if (missing.length > 0) {
          return { outcome: 'not_found', ids: missing };
        }
        const elsewhere = rows.filter((row) => row.collectionId !== null && row.collectionId !== collection.id);
        if (elsewhere.length > 0) {
          return { outcome: 'in_another_collection', ids: elsewhere.map((row) => row.id) };
        }
        const adding = rows.filter((row) => row.collectionId === null).sort((a, b) => a.displayName.localeCompare(b.displayName));
        for (const row of adding) {
          await trx.updateTable('resources').set({ collectionId: collection.id, updatedAt: new Date() }).where('id', '=', row.id).execute();
          await registrationMessage(trx, row.id, 'inCollection');
          await write(trx, row.id, 'COL-030', { collection: collection.name, actor: viewer.name }, viewer.id);
          await trx
            .insertInto('collectionLog')
            .values({ collectionId: collection.id, logId: 'COL-006', params: { resource: row.displayName, actor: viewer.name }, actorId: viewer.id })
            .execute();
          // Its Owner is told that it arrived (DEC-CV-11), with its Level as a number, as a Message keeps it.
          await trx
            .insertInto('messages')
            .values({
              type: 'MSG-RES-08',
              subjectKind: 'resource',
              subjectId: row.id,
              writerId: null,
              params: { collection: collection.name, actor: viewer.name, level: String(row.level) },
              state: null,
            })
            .execute();
        }
        return { outcome: 'added', added: adding.length };
      });
    },

    async remove(id, viewer) {
      return db.transaction().execute(async (trx) => {
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        if (row.collectionId === null) {
          return false;
        }
        const collection = await trx.selectFrom('collections').select('name').where('id', '=', row.collectionId).executeTakeFirstOrThrow();
        await trx.updateTable('resources').set({ collectionId: null, updatedAt: new Date() }).where('id', '=', id).execute();
        // Without a Collection, it waits for one again.
        await registrationMessage(trx, id, 'waiting');
        await write(trx, id, 'COL-031', { collection: collection.name, actor: viewer.name }, viewer.id);
        await trx
          .insertInto('collectionLog')
          .values({ collectionId: row.collectionId, logId: 'COL-007', params: { resource: row.displayName, actor: viewer.name }, actorId: viewer.id })
          .execute();
        return true;
      });
    },

    async log(id, limit) {
      if (!UUID.test(id)) {
        return [];
      }
      const rows = await db.selectFrom('resourceLog').select(['logId', 'params', 'at']).where('resourceId', '=', id).orderBy('id', 'desc').limit(limit).execute();
      return rows.map((row) => ({ logId: row.logId, text: logText(row.logId, row.params), params: row.params, at: row.at }));
    },
  };
}
