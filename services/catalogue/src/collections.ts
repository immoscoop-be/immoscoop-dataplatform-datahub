import type { CollectionIcon, CollectionVisibility } from '@datahub/contracts';
import { isCollectionIcon } from '@datahub/contracts/collection-icons';
import { askedWords, HEADLINE, type Marked, marked } from '@datahub/db';
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

/** A Resource as a Collection lists it, in the panel and on its page. */
export interface CollectionItem {
  id: string;
  /** Its full name in BigQuery, by which a query names it (DEC-UX-73). */
  key: string;
  displayName: string;
  level: number;
  /** Not published, only its Owner Unit and the Data Team see it (FR-SR-31). */
  published: boolean;
  /** Its use is discouraged (FR-SR-50). */
  deprecated: boolean;
  withdrawn: boolean;
  /** The folder it sits in, or null at the top of the Collection (FR-CO-38). */
  folderId: string | null;
}

/** A folder of a Collection (FR-CO-38): everyone who sees the Collection sees its folders (DEC-CO-26). */
export interface Folder {
  id: string;
  name: string;
  /** The folder it sits in, or null at the top of the Collection. */
  parentId: string | null;
  /** The name of whoever made it, and when. */
  createdBy: string;
  createdAt: Date;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  /** What its Owner Unit tells about it, in Markdown; empty when there is none (FR-CO-41). */
  intro: string;
  /** Null only for an icon a later version of Phosphor no longer has. */
  icon: CollectionIcon | null;
  ownerUnit: Group;
  visibility: CollectionVisibility;
  createdAt: Date;
  /** The name of whoever created it. */
  createdBy: string;
  /** Whether the viewer may change and dissolve it: its Owner Unit and the Data Team (FR-CO-13). */
  canManage: boolean;
  /** The Resources in it that the viewer sees, by name (FR-CO-18, FR-SR-31). */
  resources: CollectionItem[];
  /** Its folders, by name (FR-CO-38). */
  folders: Folder[];
  /** The folder each of its Lenses in a folder sits in, by the ID of the Lens; a Lens left out sits at the top. */
  lensFolders: Record<string, string>;
  /** The latest entry of its Log since it was created that the viewer sees, if any. */
  lastChange: LogEntry | null;
}

export interface NewCollection {
  name: string;
  description: string;
  icon: CollectionIcon;
  ownerUnit: Group;
  visibility: CollectionVisibility;
  /** In Markdown; empty when left out (FR-CO-41). */
  intro?: string;
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

/** What can be moved between the folders of a Collection (FR-CO-40). */
export type Movable = { kind: 'resource' | 'lens' | 'folder'; id: string };

/** Why a folder was not made, renamed, deleted or moved; `done` when it was. */
export type FolderOutcome<T = undefined> =
  | { outcome: 'done'; value: T }
  /** The Collection is gone, or the folder or the item is not in it. */
  | { outcome: 'not_found' }
  /** The folder to put it in is not in the Collection. */
  | { outcome: 'no_folder' }
  /** A folder would go into itself or into a folder inside it (FR-CO-40). */
  | { outcome: 'into_itself' }
  /** Only an empty folder is deleted (FR-CO-39): how many folders, Resources and Lenses it holds. */
  | { outcome: 'not_empty'; holds: number };

/** Collections in Postgres (TR-CO-01, TR-CO-04). Who may do what is decided by the routes. */
/** A Collection that shares words with a question, its name and description with them marked (DEC-UX-127). */
export interface FoundCollection {
  id: string;
  name: Marked[];
  description: Marked[];
  icon: CollectionIcon | null;
  /** How many of its Resources the viewer sees. */
  resources: number;
  shared: number;
}

/** A Resource that shares words with a question: its name and its description, the Business Description first. */
export interface FoundResource {
  id: string;
  displayName: Marked[];
  description: Marked[];
  collectionId: string;
  collectionName: string;
  level: number;
  shared: number;
}

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
  /** Makes a folder at the top of a Collection, or in the folder `parentId` of it (FR-CO-39). */
  makeFolder(collectionId: string, name: string, parentId: string | null, viewer: Viewer): Promise<FolderOutcome<Folder>>;
  renameFolder(collectionId: string, folderId: string, name: string, viewer: Viewer): Promise<FolderOutcome<Folder>>;
  /** Deletes a folder that holds nothing, else says how much it holds (FR-CO-39). */
  deleteFolder(collectionId: string, folderId: string, viewer: Viewer): Promise<FolderOutcome>;
  /** Puts a Resource, Lens or folder of a Collection in one of its folders, or at its top with null (FR-CO-40). */
  move(collectionId: string, item: Movable, to: string | null, viewer: Viewer): Promise<FolderOutcome>;
  /** The Log of a Collection that the viewer sees, newest first. */
  log(collection: Pick<Collection, 'id' | 'canManage'>, limit: number): Promise<LogEntry[]>;
  /**
   * The Collections and Resources the viewer sees that share words with a question, those that share
   * most first, in the full-text search of Postgres in English without accents (FR-CO-37, DEC-UX-127).
   */
  search(question: string, viewer: Viewer): Promise<{ collections: FoundCollection[]; resources: FoundResource[] }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fields whose change is logged as COL-002, in the order they are logged. */
const FIELDS = ['name', 'description', 'icon'] as const;

/**
 * The entries about a Resource in the Log of a Collection. Only who sees the Resource sees them: while
 * no Resource is published, its Owner Unit and the Data Team (DEC-CO-12).
 */
const ABOUT_RESOURCES: readonly CollectionLogId[] = ['COL-006', 'COL-007', 'COL-011'];

type Row = Selectable<CatalogueDatabase['collections']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

export function createCollections(db: Kysely<CatalogueDatabase>): Collections {
  const canManage = (row: Row, viewer: Viewer) => viewer.dataTeam || viewer.groups.includes(row.ownerUnitId);

  /** The Collections as the viewer sees them, with their Resources and their last change, in a few queries. */
  async function present(rows: Row[], viewer: Viewer, from: Database = db): Promise<Collection[]> {
    const managed = rows.filter((row) => canManage(row, viewer)).map((row) => row.id);
    const items = new Map<string, CollectionItem[]>();
    const folders = new Map<string, Folder[]>();
    const places = new Map<string, string>();
    const lensPlaces = new Map<string, string>();
    if (rows.length > 0) {
      // Its Owner Unit and the Data Team see every Resource in it; others only the published ones (FR-SR-31).
      const resources = await from
        .selectFrom('resources')
        .select(['id', 'key', 'collectionId', 'displayName', 'level', 'withdrawnAt', 'publishedAt', 'deprecatedAt'])
        .where('collectionId', 'in', rows.map((row) => row.id))
        .orderBy(sql`lower(display_name)`)
        .execute();
      const placed = await from
        .selectFrom('folderPlaces')
        .innerJoin('folders', 'folders.id', 'folderPlaces.folderId')
        .select(['folderPlaces.kind', 'folderPlaces.itemId', 'folderPlaces.folderId'])
        .where('folders.collectionId', 'in', rows.map((row) => row.id))
        .execute();
      for (const place of placed) {
        (place.kind === 'resource' ? places : lensPlaces).set(place.itemId, place.folderId);
      }
      for (const folder of await from
        .selectFrom('folders')
        .select(['id', 'collectionId', 'parentId', 'name', 'createdByName', 'createdAt'])
        .where('collectionId', 'in', rows.map((row) => row.id))
        .orderBy(sql`lower(name)`)
        .orderBy('id')
        .execute()) {
        const shown = { id: folder.id, name: folder.name, parentId: folder.parentId, createdBy: folder.createdByName, createdAt: folder.createdAt };
        folders.set(folder.collectionId, [...(folders.get(folder.collectionId) ?? []), shown]);
      }
      for (const resource of resources) {
        if (!managed.includes(resource.collectionId!) && (resource.publishedAt === null || resource.withdrawnAt !== null)) {
          continue;
        }
        const list = items.get(resource.collectionId!) ?? [];
        list.push({
          id: resource.id,
          key: resource.key,
          displayName: resource.displayName,
          level: resource.level,
          published: resource.publishedAt !== null,
          deprecated: resource.deprecatedAt !== null,
          withdrawn: resource.withdrawnAt !== null,
          folderId: places.get(resource.id) ?? null,
        });
        items.set(resource.collectionId!, list);
      }
    }
    const changes = new Map<string, LogEntry>();
    if (rows.length > 0) {
      const latest = await from
        .selectFrom('collectionLog')
        .select(['collectionId', 'logId', 'params', 'at'])
        .distinctOn('collectionId')
        .where('collectionId', 'in', rows.map((row) => row.id))
        .where('logId', '<>', 'COL-001')
        .where((eb) => eb.or([eb('logId', 'not in', ABOUT_RESOURCES), ...(managed.length > 0 ? [eb('collectionId', 'in', managed)] : [])]))
        .orderBy('collectionId')
        .orderBy('id', 'desc')
        .execute();
      for (const entry of latest) {
        changes.set(entry.collectionId, { logId: entry.logId, text: logText(entry.logId, entry.params), params: entry.params, at: entry.at });
      }
    }
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      intro: row.intro,
      // An icon a later version of Phosphor no longer has is none, so the web app never asks for a drawing that is gone.
      icon: isCollectionIcon(row.icon) ? row.icon : null,
      ownerUnit: { id: row.ownerUnitId, email: row.ownerUnitEmail, name: row.ownerUnitName },
      visibility: row.visibility,
      createdAt: row.createdAt,
      createdBy: row.createdByName,
      canManage: canManage(row, viewer),
      resources: items.get(row.id) ?? [],
      folders: folders.get(row.id) ?? [],
      lensFolders: Object.fromEntries(
        [...lensPlaces].filter(([, folderId]) => (folders.get(row.id) ?? []).some((folder) => folder.id === folderId)),
      ),
      lastChange: changes.get(row.id) ?? null,
    }));
  }

  async function presentOne(row: Row, viewer: Viewer, from: Database = db): Promise<Collection> {
    const [collection] = await present([row], viewer, from);
    return collection!;
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

  /**
   * Work on the folders of a Collection that is not dissolved, with the Collection locked: one change to
   * its folders at a time, so that no folder ends up inside itself and no folder is deleted while something
   * moves into it.
   */
  async function inCollection<T>(collectionId: string, work: (trx: Transaction<CatalogueDatabase>, collection: Row) => Promise<FolderOutcome<T>>): Promise<FolderOutcome<T>> {
    if (!UUID.test(collectionId)) {
      return { outcome: 'not_found' };
    }
    return db.transaction().execute(async (trx) => {
      const collection = await trx.selectFrom('collections').selectAll().where('id', '=', collectionId).where('dissolvedAt', 'is', null).forUpdate().executeTakeFirst();
      return collection ? work(trx, collection) : { outcome: 'not_found' };
    });
  }

  /** A folder of the Collection, or undefined when there is none by that ID in it. */
  async function folderOf(trx: Database, collectionId: string, folderId: string) {
    if (!UUID.test(folderId)) {
      return undefined;
    }
    return trx
      .selectFrom('folders')
      .select(['id', 'name', 'parentId', 'createdByName as createdBy', 'createdAt'])
      .where('id', '=', folderId)
      .where('collectionId', '=', collectionId)
      .executeTakeFirst();
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

  /** At most this many of each kind. */
  const FOUND = 20;

  return {
    async search(question, viewer) {
      const seen = await present(await visible(viewer).execute(), viewer);
      const collectionIds = seen.map((collection) => collection.id);
      const items = seen.flatMap((collection) => collection.resources.filter((item) => !item.withdrawn).map((item) => ({ ...item, collection })));
      if (collectionIds.length === 0) return { collections: [], resources: [] };
      const { rows: collections } = await sql<{ id: string; shared: string; name: string; description: string }>`
        with query as ${askedWords('search_words', question)}
        select c.id,
          (select count(*) from unnest(query.words) as word
            where word = any(tsvector_to_array(to_tsvector('search_words', concat_ws(' ', c.name, c.description))))) as shared,
          ts_headline('search_words', c.name, query.q, ${HEADLINE}) as name,
          ts_headline('search_words', c.description, query.q, ${HEADLINE}) as description
        from collections c, query
        where query.q is not null and c.id = any(${collectionIds}::uuid[])
          and to_tsvector('search_words', concat_ws(' ', c.name, c.description)) @@ query.q
      `.execute(db);
      const resourceIds = items.map((item) => item.id);
      const { rows: resources } = resourceIds.length
        ? await sql<{ id: string; shared: string; name: string; description: string }>`
            with query as ${askedWords('search_words', question)}
            select r.id,
              (select count(*) from unnest(query.words) as word
                where word = any(tsvector_to_array(to_tsvector('search_words', concat_ws(' ', r.display_name, r.description, r.business_description))))) as shared,
              ts_headline('search_words', r.display_name, query.q, ${HEADLINE}) as name,
              ts_headline('search_words', coalesce(nullif(r.business_description, ''), r.description), query.q, ${HEADLINE}) as description
            from resources r, query
            where query.q is not null and r.id = any(${resourceIds}::uuid[])
              and to_tsvector('search_words', concat_ws(' ', r.display_name, r.description, r.business_description)) @@ query.q
          `.execute(db)
        : { rows: [] };
      const byName = (a: { shared: number; plain: string }, b: { shared: number; plain: string }) => b.shared - a.shared || a.plain.localeCompare(b.plain);
      return {
        collections: collections
          .map((row) => {
            const collection = seen.find((one) => one.id === row.id)!;
            return { id: row.id, name: marked(row.name), description: marked(row.description), icon: collection.icon, resources: collection.resources.filter((item) => !item.withdrawn).length, shared: Number(row.shared), plain: collection.name };
          })
          .sort(byName)
          .slice(0, FOUND)
          .map(({ plain: _plain, ...found }) => found),
        resources: resources
          .map((row) => {
            const item = items.find((one) => one.id === row.id)!;
            return {
              id: row.id,
              displayName: marked(row.name),
              description: marked(row.description),
              collectionId: item.collection.id,
              collectionName: item.collection.name,
              level: item.level,
              shared: Number(row.shared),
              plain: item.displayName,
            };
          })
          .sort(byName)
          .slice(0, FOUND)
          .map(({ plain: _plain, ...found }) => found),
      };
    },

    async list(viewer) {
      const rows = await visible(viewer).orderBy(sql`lower(name)`).orderBy('id').execute();
      return present(rows, viewer);
    },

    async get(id, viewer) {
      if (!UUID.test(id)) {
        return undefined;
      }
      const row = await visible(viewer).where('id', '=', id).executeTakeFirst();
      return row && presentOne(row, viewer);
    },

    async create(collection, viewer) {
      return guardName(collection.name, () =>
        db.transaction().execute(async (trx) => {
          const row = await trx
            .insertInto('collections')
            .values({
              name: collection.name,
              description: collection.description,
              intro: collection.intro ?? '',
              icon: collection.icon,
              ownerUnitId: collection.ownerUnit.id,
              ownerUnitEmail: collection.ownerUnit.email,
              ownerUnitName: collection.ownerUnit.name,
              visibility: collection.visibility,
              createdBy: viewer.id,
              createdByName: viewer.name,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
          await write(trx, row.id, 'COL-001', { name: row.name, ownerUnit: row.ownerUnitName, visibility: row.visibility }, viewer);
          return presentOne(row, viewer, trx);
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
          const unit = changes.ownerUnit;
          if (unit && unit.id !== before.ownerUnitId) {
            Object.assign(update, { ownerUnitId: unit.id, ownerUnitEmail: unit.email, ownerUnitName: unit.name });
            entries.push(['COL-003', { old: before.ownerUnitName, new: unit.name }]);
          }
          if (changes.visibility && changes.visibility !== before.visibility) {
            update.visibility = changes.visibility;
            entries.push(['COL-004', { visibility: changes.visibility }]);
          }
          // The intro itself is not logged, only that it changed (FR-CO-41).
          if (changes.intro !== undefined && changes.intro !== before.intro) {
            update.intro = changes.intro;
            entries.push(['COL-014', {}]);
          }
          if (entries.length === 0) {
            return presentOne(before, viewer, trx);
          }
          const after = await trx.updateTable('collections').set(update).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
          for (const [logId, params] of entries) {
            await write(trx, id, logId, params, viewer);
          }
          return presentOne(after, viewer, trx);
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

    async makeFolder(collectionId, name, parentId, viewer) {
      return inCollection<Folder>(collectionId, async (trx, collection) => {
        const parent = parentId === null ? null : await folderOf(trx, collectionId, parentId);
        if (parent === undefined) {
          return { outcome: 'no_folder' };
        }
        const row = await trx
          .insertInto('folders')
          .values({ collectionId, parentId, name, createdBy: viewer.id, createdByName: viewer.name })
          .returning(['id', 'name', 'parentId', 'createdByName as createdBy', 'createdAt'])
          .executeTakeFirstOrThrow();
        await write(trx, collectionId, 'COL-008', { folder: name, in: parent?.name ?? collection.name }, viewer);
        return { outcome: 'done', value: row };
      });
    },

    async renameFolder(collectionId, folderId, name, viewer) {
      return inCollection<Folder>(collectionId, async (trx) => {
        const folder = await folderOf(trx, collectionId, folderId);
        if (!folder) {
          return { outcome: 'not_found' };
        }
        if (folder.name !== name) {
          await trx.updateTable('folders').set({ name }).where('id', '=', folder.id).execute();
          await write(trx, collectionId, 'COL-009', { old: folder.name, new: name }, viewer);
        }
        return { outcome: 'done', value: { id: folder.id, name, parentId: folder.parentId, createdBy: folder.createdBy, createdAt: folder.createdAt } };
      });
    },

    async deleteFolder(collectionId, folderId, viewer) {
      return inCollection(collectionId, async (trx) => {
        const folder = await folderOf(trx, collectionId, folderId);
        if (!folder) {
          return { outcome: 'not_found' };
        }
        const [{ folders }, { items }] = await Promise.all([
          trx.selectFrom('folders').select((eb) => eb.fn.countAll<string>().as('folders')).where('parentId', '=', folder.id).executeTakeFirstOrThrow(),
          trx.selectFrom('folderPlaces').select((eb) => eb.fn.countAll<string>().as('items')).where('folderId', '=', folder.id).executeTakeFirstOrThrow(),
        ]);
        const holds = Number(folders) + Number(items);
        if (holds > 0) {
          return { outcome: 'not_empty', holds };
        }
        await trx.deleteFrom('folders').where('id', '=', folder.id).execute();
        await write(trx, collectionId, 'COL-010', { folder: folder.name }, viewer);
        return { outcome: 'done', value: undefined };
      });
    },

    async move(collectionId, item, to, viewer) {
      if (!UUID.test(item.id)) {
        return { outcome: 'not_found' };
      }
      return inCollection(collectionId, async (trx, collection) => {
        const target = to === null ? null : await folderOf(trx, collectionId, to);
        if (target === undefined) {
          return { outcome: 'no_folder' };
        }
        const where = target?.name ?? collection.name;
        if (item.kind === 'folder') {
          const folder = await folderOf(trx, collectionId, item.id);
          if (!folder) {
            return { outcome: 'not_found' };
          }
          // Up from where it goes to the top: it must not pass the folder itself (FR-CO-40).
          const all = await trx.selectFrom('folders').select(['id', 'parentId']).where('collectionId', '=', collectionId).execute();
          const parents = new Map(all.map((row) => [row.id, row.parentId]));
          for (let at = target?.id ?? null; at !== null; at = parents.get(at) ?? null) {
            if (at === folder.id) {
              return { outcome: 'into_itself' };
            }
          }
          if (folder.parentId !== (target?.id ?? null)) {
            await trx.updateTable('folders').set({ parentId: target?.id ?? null }).where('id', '=', folder.id).execute();
            await write(trx, collectionId, 'COL-013', { folder: folder.name, to: where }, viewer);
          }
          return { outcome: 'done', value: undefined };
        }
        // A Resource is locked, so that it does not leave the Collection while it moves; a Lens stays in its Collection.
        const found =
          item.kind === 'resource'
            ? await trx.selectFrom('resources').select('displayName as name').where('id', '=', item.id).where('collectionId', '=', collectionId).forUpdate().executeTakeFirst()
            : await trx.selectFrom('lenses').select('name').where('id', '=', item.id).where('collectionId', '=', collectionId).executeTakeFirst();
        if (!found) {
          return { outcome: 'not_found' };
        }
        const place = await trx.selectFrom('folderPlaces').select('folderId').where('kind', '=', item.kind).where('itemId', '=', item.id).executeTakeFirst();
        if ((place?.folderId ?? null) === (target?.id ?? null)) {
          return { outcome: 'done', value: undefined };
        }
        if (target === null) {
          await trx.deleteFrom('folderPlaces').where('kind', '=', item.kind).where('itemId', '=', item.id).execute();
        } else {
          await trx
            .insertInto('folderPlaces')
            .values({ kind: item.kind, itemId: item.id, folderId: target.id })
            .onConflict((conflict) => conflict.columns(['kind', 'itemId']).doUpdateSet({ folderId: target.id }))
            .execute();
        }
        if (item.kind === 'resource') {
          await write(trx, collectionId, 'COL-011', { resource: found.name, to: where }, viewer);
        } else {
          await write(trx, collectionId, 'COL-012', { lens: found.name, to: where }, viewer);
        }
        return { outcome: 'done', value: undefined };
      });
    },

    async log(collection, limit) {
      if (!UUID.test(collection.id)) {
        return [];
      }
      const rows = await db
        .selectFrom('collectionLog')
        .select(['logId', 'params', 'at'])
        .where('collectionId', '=', collection.id)
        .$if(!collection.canManage, (query) => query.where('logId', 'not in', ABOUT_RESOURCES))
        .orderBy('id', 'desc')
        .limit(limit)
        .execute();
      return rows.map((row) => ({ logId: row.logId, text: logText(row.logId, row.params), params: row.params, at: row.at }));
    },
  };
}
