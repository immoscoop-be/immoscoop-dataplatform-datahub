import type { CollectionColour, CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';
import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';
import type { CatalogueDatabase } from './database.js';
import type { Group } from './identity.js';
import { type CollectionLogId, logText } from './log.js';

/** Who asks, as their Access Token says. */
export interface Viewer {
  /** The fixed Google ID of the User. */
  id: string;
  name: string;
  /** The fixed IDs of every group the User is in (TR-PF-02). */
  groups: readonly string[];
  /** Whether the User has the role of the Data Team. */
  dataTeam: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  colour: CollectionColour;
  icon: CollectionIcon | null;
  ownerUnit: Group;
  visibility: CollectionVisibility;
  createdAt: Date;
  /** Whether the viewer may change and dissolve it: its Owner Unit and the Data Team (FR-CO-13). */
  canManage: boolean;
}

export interface NewCollection {
  name: string;
  description: string;
  colour: CollectionColour;
  /** Optional; null takes it away when changing. */
  icon?: CollectionIcon | null;
  ownerUnit: Group;
  visibility: CollectionVisibility;
}

export type CollectionChanges = Partial<NewCollection>;

export interface LogEntry {
  logId: string;
  text: string;
  params: Record<string, string>;
  at: Date;
}

/** Another Collection that is not dissolved already has this name, whatever its case (FR-CO-02). */
export class NameTaken extends Error {
  constructor(name: string) {
    super(`A Collection called “${name}” already exists.`);
  }
}

/** A Collection that still holds Resources, withdrawn ones included, cannot be dissolved (FR-CO-10). */
export class NotEmpty extends Error {
  constructor(count: number) {
    super(`The Collection still holds ${count === 1 ? '1 Resource' : `${count} Resources`}; the Data Team removes them first.`);
  }
}

/** Collections in Postgres (TR-CO-01, TR-CO-04). Who may do what is decided by the routes. */
export interface Collections {
  /** The Collections the viewer sees, by name (FR-CO-17). */
  list(viewer: Viewer): Promise<Collection[]>;
  /** One Collection, or undefined when it does not exist, is dissolved, or the viewer does not see it. */
  get(id: string, viewer: Viewer): Promise<Collection | undefined>;
  create(collection: NewCollection, viewer: Viewer): Promise<Collection>;
  /** Changes what differs, with a Log Entry per change; undefined when the Collection is gone. */
  change(id: string, changes: CollectionChanges, viewer: Viewer): Promise<Collection | undefined>;
  /** Dissolves an empty Collection (else NotEmpty); false when it was already gone. */
  dissolve(id: string, viewer: Viewer): Promise<boolean>;
  /** The Log of a Collection, newest first. */
  log(id: string, limit: number): Promise<LogEntry[]>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fields whose change is logged as COL-002, in the order they are logged. */
const FIELDS = ['name', 'description', 'colour'] as const;

type Row = Selectable<CatalogueDatabase['collections']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

export function createCollections(db: Kysely<CatalogueDatabase>): Collections {
  function present(row: Row, viewer: Viewer): Collection {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      colour: row.colour,
      // An icon a later version of Tabler no longer has is none, so the web app never asks for a drawing that is gone.
      icon: isCollectionIcon(row.icon) ? row.icon : null,
      ownerUnit: { id: row.ownerUnitId, email: row.ownerUnitEmail, name: row.ownerUnitName },
      visibility: row.visibility,
      createdAt: row.createdAt,
      canManage: viewer.dataTeam || viewer.groups.includes(row.ownerUnitId),
    };
  }

  /** The Collections that are not dissolved and that the viewer sees (FR-CO-17, DEC-CO-11). */
  function visible(viewer: Viewer, from: Database = db) {
    return from
      .selectFrom('collections')
      .selectAll()
      .where('dissolvedAt', 'is', null)
      .$if(!viewer.dataTeam, (query) =>
        query.where((eb) =>
          eb.or([eb('visibility', '=', 'public'), ...(viewer.groups.length > 0 ? [eb('ownerUnitId', 'in', viewer.groups)] : [])]),
        ),
      );
  }

  async function write(trx: Database, collectionId: string, logId: CollectionLogId, params: Record<string, string>, viewer: Viewer) {
    await trx
      .insertInto('collectionLog')
      .values({ collectionId, logId, params: { ...params, actor: viewer.name }, actorId: viewer.id })
      .execute();
  }

  /** Turns the unique index on the name into NameTaken. */
  async function guardName<T>(name: string | undefined, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (name !== undefined && (error as { code?: string }).code === '23505') {
        throw new NameTaken(name);
      }
      throw error;
    }
  }

  return {
    async list(viewer) {
      const rows = await visible(viewer).orderBy(sql`lower(name)`).orderBy('id').execute();
      return rows.map((row) => present(row, viewer));
    },

    async get(id, viewer) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await visible(viewer).where('id', '=', id).executeTakeFirst();
      return row && present(row, viewer);
    },

    async create(collection, viewer) {
      return guardName(collection.name, () =>
        db.transaction().execute(async (trx) => {
          const row = await trx
            .insertInto('collections')
            .values({
              name: collection.name,
              description: collection.description,
              colour: collection.colour,
              icon: collection.icon ?? null,
              ownerUnitId: collection.ownerUnit.id,
              ownerUnitEmail: collection.ownerUnit.email,
              ownerUnitName: collection.ownerUnit.name,
              visibility: collection.visibility,
              createdBy: viewer.id,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          await write(trx, row.id, 'COL-001', { name: row.name, ownerUnit: row.ownerUnitName, visibility: row.visibility }, viewer);
          return present(row, viewer);
        }),
      );
    },

    async change(id, changes, viewer) {
      if (!UUID.test(id)) {
        return undefined;
      }
      return guardName(changes.name, () =>
        db.transaction().execute(async (trx) => {
          const before = await trx.selectFrom('collections').selectAll().where('id', '=', id).where('dissolvedAt', 'is', null).forUpdate().executeTakeFirst();
          if (!before) {
            return undefined;
          }
          const entries: [CollectionLogId, Record<string, string>][] = [];
          const update: Partial<Row> = {};
          for (const field of FIELDS) {
            const value = changes[field];
            if (value !== undefined && value !== before[field]) {
              Object.assign(update, { [field]: value });
              entries.push(['COL-002', { field, old: before[field], new: value }]);
            }
          }
          if (changes.icon !== undefined && changes.icon !== before.icon) {
            update.icon = changes.icon;
            entries.push(['COL-002', { field: 'icon', old: before.icon ?? 'none', new: changes.icon ?? 'none' }]);
          }
          const unit = changes.ownerUnit;
          if (unit && unit.id !== before.ownerUnitId) {
            Object.assign(update, { ownerUnitId: unit.id, ownerUnitEmail: unit.email, ownerUnitName: unit.name });
            entries.push(['COL-003', { old: before.ownerUnitName, new: unit.name }]);
          }
          if (changes.visibility && changes.visibility !== before.visibility) {
            update.visibility = changes.visibility;
            entries.push(['COL-004', { visibility: changes.visibility }]);
          }
          if (entries.length === 0) {
            return present(before, viewer);
          }
          const after = await trx.updateTable('collections').set(update).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
          for (const [logId, params] of entries) {
            await write(trx, id, logId, params, viewer);
          }
          return present(after, viewer);
        }),
      );
    },

    async dissolve(id, viewer) {
      if (!UUID.test(id)) {
        return false;
      }
      return db.transaction().execute(async (trx) => {
        // Locks the Collection, so that no Resource is added while it is being dissolved.
        const live = await trx.selectFrom('collections').select('id').where('id', '=', id).where('dissolvedAt', 'is', null).forUpdate().executeTakeFirst();
        if (!live) {
          return false;
        }
        const { count } = await trx
          .selectFrom('resources')
          .select((eb) => eb.fn.countAll<string>().as('count'))
          .where('collectionId', '=', id)
          .executeTakeFirstOrThrow();
        if (Number(count) > 0) {
          throw new NotEmpty(Number(count));
        }
        const dissolved = await trx
          .updateTable('collections')
          .set({ dissolvedAt: new Date() })
          .where('id', '=', id)
          .where('dissolvedAt', 'is', null)
          .returning('id')
          .executeTakeFirst();
        if (dissolved) {
          await write(trx, id, 'COL-005', {}, viewer);
        }
        return dissolved !== undefined;
      });
    },

    async log(id, limit) {
      if (!UUID.test(id)) {
        return [];
      }
      const rows = await db
        .selectFrom('collectionLog')
        .select(['logId', 'params', 'at'])
        .where('collectionId', '=', id)
        .orderBy('id', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => ({ logId: row.logId, text: logText(row.logId, row.params), params: row.params, at: row.at }));
    },
  };
}
