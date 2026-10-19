import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';
import type { Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';
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
}

/** Every exposed table of one dbt project, after a new Current Version. */
export interface ResourcesUpdate {
  projectId: string;
  projectName: string | null;
  runId: string;
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
  registeredAt: Date;
  /** No exposure tagged `datahub` depends on it any more; it is held (DEC-SR-26). */
  withdrawn: boolean;
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

/** Resources in Postgres (TR-SR-02 to TR-SR-04). Who may do what is decided by the routes. */
export interface Resources {
  /** Registers, renames, withdraws and brings back the Resources of one dbt project, in one go. */
  apply(update: ResourcesUpdate): Promise<UpdateOutcome>;
  /** The Resources without Collection, withdrawn ones included (FR-SR-35). */
  withoutCollection(): Promise<Resource[]>;
  /** The Resources of a Collection, withdrawn ones included. */
  inCollection(collectionId: string): Promise<Resource[]>;
  get(id: string): Promise<Resource | undefined>;
  /** Adds a Resource to a Collection, never from another one (FR-CO-08). */
  add(id: string, collection: { id: string; name: string }, viewer: Viewer): Promise<'added' | 'already' | 'in_another_collection' | 'collection_gone'>;
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
    registeredAt: row.registeredAt,
    withdrawn: row.withdrawnAt !== null,
  };
}

export function createResources(db: Kysely<CatalogueDatabase>): Resources {
  async function write(trx: Database, resourceId: string, logId: ResourceLogId, params: Record<string, string>, actorId: string | null = null) {
    await trx.insertInto('resourceLog').values({ resourceId, logId, params, actorId }).execute();
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
          const row = known.get(table.key);
          if (!row) {
            const displayName = await freeName(trx, wanted, update, table.key);
            const { id } = await trx
              .insertInto('resources')
              .values({ key: table.key, ...facts, requestedName: wanted, displayName })
              .returning('id')
              .executeTakeFirstOrThrow();
            await write(trx, id, 'RES-001', { exposure, key: table.key, run });
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
      return rows.map(present);
    },

    async get(id) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await db.selectFrom('resources').selectAll().where('id', '=', id).executeTakeFirst();
      return row && present(row);
    },

    async add(id, collection, viewer) {
      return db.transaction().execute(async (trx) => {
        // Holds the Collection, so that it is not dissolved meanwhile (FR-CO-10).
        const live = await trx.selectFrom('collections').select('id').where('id', '=', collection.id).where('dissolvedAt', 'is', null).forShare().executeTakeFirst();
        if (!live) {
          return 'collection_gone';
        }
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
        if (row.collectionId === collection.id) {
          return 'already';
        }
        if (row.collectionId !== null) {
          return 'in_another_collection';
        }
        await trx.updateTable('resources').set({ collectionId: collection.id, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'COL-030', { collection: collection.name, actor: viewer.name }, viewer.id);
        await trx
          .insertInto('collectionLog')
          .values({ collectionId: collection.id, logId: 'COL-006', params: { resource: row.displayName, actor: viewer.name }, actorId: viewer.id })
          .execute();
        return 'added';
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
