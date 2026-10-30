import { type Kysely, type Selectable, sql, type Transaction } from 'kysely';
import type { Viewer } from './collections.js';
import type { CatalogueDatabase, MappingKind, MappingOrigin, ModelType, Origins, PartitionFilter, PartitionUnit, SchemaChange } from './database.js';
import { type Column, fingerprint, type LeftOut, levelAtRegistration, splitColumns } from './fields.js';
import { logText, type ResourceLogId } from './log.js';

/** A table under an exposure tagged `datahub`, as registry tells it (TR-AR-08). */
export interface ExposedTable {
  key: string;
  /** The full name in its own case, for BigQuery; a registry that does not send it yet leaves the Key. */
  fullName?: string;
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
  /** The full name of its table in its own case, as BigQuery knows it: what queries, shows and copies it. */
  fullName: string;
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
  /** Published: everyone who sees its Collection sees it (FR-SR-31). */
  published: boolean;
  /** Its use is discouraged (FR-SR-50). */
  deprecated: boolean;
}

/** The mapping of a field (DEC-RC-05, DEC-RC-06, DEC-RC-14). */
export interface Mapping {
  field: string;
  kind: MappingKind;
  /** The relation type, for a relation. */
  relationType: string | null;
  /** `entity.identifier`, or `entity.action` for the ID of an event. */
  identity: string;
  /** The field mapped as `is` that a relation starts from, when there is more than one (DEC-RC-08). */
  subject: string | null;
  origin: MappingOrigin;
  /** False for an Entity the Domain Model does not have yet, kept as written (DEC-CO-21). */
  inDomainModel: boolean;
}

/**
 * What the Data Admin records when adding a Resource (FR-CO-33, FR-CO-34): how it is stored, what one
 * row is, its model type and the mapping of its fields, with where each came from and the release of the
 * Domain Model the mappings were made with (FR-AR-17).
 */
export interface Details {
  partition: { field: string; unit: PartitionUnit | null } | null;
  clusterBy: string[];
  partitionFilter: PartitionFilter;
  grain: string[];
  grainSentence: string;
  modelType: ModelType | null;
  origins: Origins;
  release: string | null;
  mappings: Mapping[];
}

/** What the Owner and the Data Team keep about a Resource in Data Hub, next to what comes from dbt (FR-RC-15). */
export interface Card {
  /** Next to the description from dbt, never over it (DEC-RC-01); empty when there is none. */
  businessDescription: string;
  /** The Known Behaviour (DEC-DH-18): intended use and pitfalls, and the Known Gaps (DEC-RC-12). */
  intendedUse: string;
  pitfalls: string;
  knownGaps: string[];
  /** Since when its data is reliable (FR-RC-13): a day, `YYYY-MM-DD`, or null. */
  reliableSince: string | null;
  /** Fields of the Resource, by name, in the order chosen. */
  keyFields: string[];
  parameters: string[];
}

export const CARD_KEYS = ['businessDescription', 'intendedUse', 'pitfalls', 'knownGaps', 'reliableSince', 'keyFields', 'parameters'] as const;

/** A field with its Business Description next to its description from dbt (FR-RC-16). */
export interface Field extends Column {
  businessDescription: string;
}

/** A Resource with its fields, and the columns of its table left out of it (FR-SR-06, DEC-SR-33). */
export interface ResourceDetail extends Resource {
  fields: Field[];
  leftOut: LeftOut[];
  /** Empty until it is added to a Collection with them. */
  details: Details;
  card: Card;
  /** Who published it and when, and who confirmed it last and when (FR-RC-12); null until it is published. */
  publication: { publishedAt: Date; publishedBy: string; confirmedAt: Date; confirmedBy: string } | null;
  /** Who deprecated it, when, why and what to use instead (DEC-UX-101); null when it is not. */
  deprecation: { at: Date; by: string; reason: string; insteadOf: { id: string; displayName: string } | null } | null;
  /** The fields that changed since its last Confirmation and were not marked seen yet: its warning (FR-MR-12). */
  changes: { field: string; change: SchemaChange; old: string | null; new: string | null; at: Date }[];
  /** The descriptions from dbt that changed in the last 30 days, with the text before: no field for the table (FR-RC-17). */
  descriptionChanges: { field: string | null; before: string; at: Date }[];
}

/** What publishing a Resource came to (FR-SR-49). */
export type PublishOutcome = 'published' | 'not_found' | 'no_collection' | 'not_described' | 'already_published';

/** What deprecating a Resource, or taking it away, came to (FR-SR-50). */
export type DeprecateOutcome = 'done' | 'not_found' | 'not_published' | 'not_deprecated' | 'invalid';

/** A mapping of a Resource with the other Resources that carry the same identity (FR-RC-08, FR-RC-09). */
export interface Related extends Pick<Mapping, 'field' | 'kind' | 'relationType' | 'identity' | 'inDomainModel'> {
  /** The Resources the viewer sees that carry the identity too, with the field that carries it. */
  resources: { id: string; displayName: string; level: number; field: string }[];
}

/** A Resource on a Node of the lineage, as the viewer may see it (FR-SR-54). */
export interface ResourceAtNode {
  nodeId: string;
  id: string;
  displayName: string;
  level: number;
}

/** What changing a Resource came to: done, or why not. */
export type EditOutcome =
  | { outcome: 'edited'; changed: string[] }
  | { outcome: 'not_found' }
  /** A Business Description is written from Described on (DEC-MR-10). */
  | { outcome: 'not_described' }
  | { outcome: 'invalid'; message: string };

/** A Resource to add, with what the Data Admin recorded for it, if anything. */
export interface AddItem {
  id: string;
  details?: Details;
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
  | { outcome: 'in_another_collection'; ids: string[] }
  /** What was recorded names a field the Resource does not have, or a subject that is no `is` field. */
  | { outcome: 'invalid'; id: string; message: string };

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
  add(items: readonly AddItem[], collection: { id: string; name: string }, viewer: Viewer): Promise<AddOutcome>;
  /** Takes a Resource out of its Collection; false when it was in none. */
  remove(id: string, viewer: Viewer): Promise<boolean>;
  log(id: string, limit: number): Promise<LogEntry[]>;
  /** Changes what Data Hub keeps about a Resource, each change in its Log (FR-RC-15, FR-SR-28). */
  edit(id: string, changes: Partial<Card>, viewer: Viewer): Promise<EditOutcome>;
  /** Writes, changes or removes the Business Descriptions of fields; an empty text removes one (FR-RC-16). */
  describeFields(id: string, descriptions: readonly { field: string; text: string }[], viewer: Viewer): Promise<EditOutcome>;
  /** Records the grain, storage and mappings of a Resource again, from Edit relations (DEC-UX-107). */
  relate(id: string, details: Details, viewer: Viewer): Promise<EditOutcome>;
  /** Each mapping of a Resource with the other Resources the viewer sees that carry its identity. */
  related(id: string, viewer: Viewer): Promise<Related[]>;
  /** The Resources the viewer sees on the given Nodes. */
  atNodes(nodeIds: readonly string[], viewer: Viewer): Promise<ResourceAtNode[]>;
  /** Publishes a Resource, from Described, and keeps that first Confirmation with its Fingerprint (FR-SR-17, FR-MR-08). */
  publish(id: string, viewer: Viewer): Promise<PublishOutcome>;
  /** Marks the changes since the last Confirmation seen; how many there were (FR-MR-12). */
  markSeen(id: string, viewer: Viewer): Promise<number>;
  /** Marks a published Resource deprecated, with why and what to use instead (FR-SR-50). */
  deprecate(id: string, reason: string, insteadOf: string | null, viewer: Viewer): Promise<DeprecateOutcome>;
  /** Takes the mark away again. */
  undeprecate(id: string, viewer: Viewer): Promise<DeprecateOutcome>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Selectable<CatalogueDatabase['resources']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

function present(row: Row): Resource {
  return {
    id: row.id,
    key: row.key,
    fullName: row.fullName ?? row.key,
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
    published: row.publishedAt !== null,
    deprecated: row.deprecatedAt !== null,
  };
}

/** What Data Hub keeps about a Resource, from its row, with its reliable day read as text. */
function cardOf(row: Row, reliableSince: string | null): Card {
  return {
    businessDescription: row.businessDescription,
    intendedUse: row.intendedUse,
    pitfalls: row.pitfalls,
    knownGaps: row.knownGaps,
    reliableSince,
    keyFields: row.keyFields,
    parameters: row.parameters,
  };
}

/** A Business Description is written from 2 · Described on (DEC-MR-10). */
const DESCRIBED = 2;
/** Publishing confirms it: 3 · Confirmed (FR-SR-17). */
const CONFIRMED = 3;

export function createResources(db: Kysely<CatalogueDatabase>): Resources {
  async function write(trx: Database, resourceId: string, logId: ResourceLogId, params: Record<string, string>, actorId: string | null = null) {
    await trx.insertInto('resourceLog').values({ resourceId, logId, params, actorId }).execute();
  }

  /** The fields of a Resource and the columns left out of it, as its table has them now (FR-SR-06). */
  /**
   * Which Resources the viewer sees (FR-SR-31), or null for every one: the Data Team sees all; others
   * see every Resource in a Collection of their Owner Unit, and the published ones in every Collection
   * they see, a public one or one of their Owner Unit.
   */
  async function seenScope(viewer: Viewer): Promise<{ managed: string[]; visible: string[] } | null> {
    if (viewer.dataTeam) {
      return null;
    }
    const rows = await db.selectFrom('collections').select(['id', 'ownerUnitId', 'visibility']).where('dissolvedAt', 'is', null).execute();
    const managed = rows.filter((row) => viewer.groups.includes(row.ownerUnitId));
    return { managed: managed.map((row) => row.id), visible: rows.filter((row) => row.visibility === 'public' || managed.includes(row)).map((row) => row.id) };
  }

  /** A condition on `resources` (as `r`) that keeps those in a scope. */
  function inScope(scope: { managed: string[]; visible: string[] }) {
    // An empty list is a list of one ID no Collection has, as `in ()` is no SQL.
    const ids = (list: string[]) => (list.length > 0 ? list : ['00000000-0000-0000-0000-000000000000']);
    return sql<boolean>`(r.collection_id in (${sql.join(ids(scope.managed))}) or (r.collection_id in (${sql.join(ids(scope.visible))}) and r.published_at is not null))`;
  }

  /**
   * What a new Current Version means for a Resource Data Hub knows already (FR-MR-15, FR-MR-12, FR-RC-17):
   * every field added, removed or retyped goes into its Log and, after a Confirmation, into its warning;
   * every description that changed goes into its Log with the text before; its Level follows the
   * descriptions in dbt; and once it has an Owner, the Owner is told.
   */
  async function follow(trx: Database, row: Row, before: readonly Column[], table: ExposedTable, fields: readonly Column[], run: string, runDay: string) {
    const sourceNode = table.name;
    const was = new Map(before.map((field) => [field.name, field]));
    const now = new Map(fields.map((field) => [field.name, field]));
    const changes: { field: string; change: SchemaChange; old: string | null; new: string | null }[] = [
      ...fields.filter((field) => !was.has(field.name)).map((field) => ({ field: field.name, change: 'added' as const, old: null, new: field.dataType })),
      ...before.filter((field) => !now.has(field.name)).map((field) => ({ field: field.name, change: 'removed' as const, old: field.dataType, new: null })),
      ...fields
        .filter((field) => was.has(field.name) && (was.get(field.name)!.dataType ?? '') !== (field.dataType ?? ''))
        .map((field) => ({ field: field.name, change: 'retyped' as const, old: was.get(field.name)!.dataType, new: field.dataType })),
    ];
    for (const change of changes) {
      if (change.change === 'retyped') {
        await write(trx, row.id, 'ART-012', { field: change.field, old: change.old ?? '', new: change.new ?? '', sourceNode, distance: '0' });
      } else {
        await write(trx, row.id, 'ART-010', { field: change.field, direction: change.change, sourceNode, distance: '0' });
      }
    }

    // Its Level follows dbt: Described with the table and a field described, Confirmed again once it was (DEC-MR-08).
    const confirmation = await trx.selectFrom('resourceConfirmations').select('confirmedAt').where('resourceId', '=', row.id).orderBy('id', 'desc').limit(1).executeTakeFirst();
    const { level: described, reason } = levelAtRegistration(table.description, [...fields]);
    const level = described === 2 && confirmation ? 3 : described;

    if (confirmation && changes.length > 0) {
      await trx.insertInto('resourceChanges').values(changes.map((change) => ({ resourceId: row.id, ...change, runId: run }))).execute();
      if (row.collectionId) {
        await tell(trx, row.id, 'MSG-RES-03', {
          confirmed: confirmation.confirmedAt.toISOString().slice(0, 10),
          level: String(level),
          count: String(changes.length),
          changes: JSON.stringify(changes.map(({ field, change, old, new: after }) => ({ field, change, ...(old ? { old } : {}), ...(after ? { new: after } : {}) }))),
        });
      }
    }

    const descriptions = [
      ...(row.description !== table.description ? [{ field: null, before: row.description, after: table.description }] : []),
      ...fields.flatMap((field) => {
        const earlier = was.get(field.name);
        return earlier && earlier.description !== field.description ? [{ field: field.name, before: earlier.description, after: field.description }] : [];
      }),
    ];
    if (descriptions.length > 0) {
      await trx.insertInto('descriptionChanges').values(descriptions.map((change) => ({ resourceId: row.id, ...change, runId: run }))).execute();
      await write(trx, row.id, 'ART-013', { sourceNode, distance: '0' });
      if (row.collectionId) {
        const business = new Map(
          (await trx.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', row.id).execute()).map((entry) => [entry.field, entry.text]),
        );
        await tell(trx, row.id, 'MSG-RES-02', {
          run: runDay,
          count: String(descriptions.length),
          changes: JSON.stringify(
            descriptions.map(({ field, before: earlier, after }) => {
              const text = field === null ? row.businessDescription : (business.get(field) ?? '');
              return { on: field === null ? 'table' : 'field', ...(field ? { field } : {}), before: earlier, after, hasBusiness: text ? 'yes' : 'no', ...(text ? { business: text } : {}) };
            }),
          ),
        });
      }
    }

    if (level !== row.level) {
      await trx.updateTable('resources').set({ level }).where('id', '=', row.id).execute();
      if (level > row.level) {
        await write(trx, row.id, 'RES-002', { level: String(level), reason });
      } else {
        // A drop gives the Owner an alert (FR-MR-09); it stays published (FR-SR-19).
        await write(trx, row.id, 'MAT-021', { level: String(level), reason });
        if (row.collectionId) {
          await tell(trx, row.id, 'MSG-RES-05', { from: String(row.level), to: String(level), cause: 'description', published: row.publishedAt ? 'yes' : 'no' });
        }
      }
    }
  }

  /** A Message from Data Hub on a Resource, for its Owner; lists are kept as JSON in its parameters. */
  async function tell(trx: Database, resourceId: string, type: string, params: Record<string, string>) {
    await trx.insertInto('messages').values({ type, subjectKind: 'resource', subjectId: resourceId, writerId: null, params, state: null }).execute();
  }

  async function fieldNames(trx: Database, resourceId: string): Promise<string[]> {
    return (await trx.selectFrom('resourceFields').select('name').where('resourceId', '=', resourceId).orderBy(sql`position nulls last`).orderBy('name').execute()).map(
      (field) => field.name,
    );
  }

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
   * Records how a Resource is stored, its grain, model type and mappings, and logs it with the addition
   * (FR-CO-33): a mapping in the same transaction as the Log Entry that tells it.
   */
  async function record(trx: Database, resourceId: string, details: Details, fieldCount: number, viewer: Viewer) {
    await trx
      .updateTable('resources')
      .set({
        grain: details.grain,
        grainSentence: details.grainSentence,
        modelType: details.modelType,
        partitionField: details.partition?.field ?? null,
        partitionUnit: details.partition?.unit ?? null,
        clusterBy: details.clusterBy,
        partitionFilter: details.partition ? details.partitionFilter : 'none',
        origins: details.origins,
        domainModelRelease: details.release,
      })
      .where('id', '=', resourceId)
      .execute();
    await trx.deleteFrom('resourceMappings').where('resourceId', '=', resourceId).execute();
    if (details.mappings.length > 0) {
      await trx
        .insertInto('resourceMappings')
        .values(details.mappings.map((mapping) => ({ resourceId, ...mapping, release: details.release })))
        .execute();
    }
    await write(
      trx,
      resourceId,
      'RES-009',
      {
        mapped: String(details.mappings.length),
        fields: String(fieldCount),
        grain: details.grain.join(', '),
        modelType: details.modelType ?? '',
        release: details.release ?? '',
        actor: viewer.name,
      },
      viewer.id,
    );
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
            fullName: table.fullName ?? table.key,
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
          const before = await trx.selectFrom('resourceFields').select(['name', 'position', 'dataType', 'description']).where('resourceId', '=', row.id).execute();
          // A Resource that comes back, or asks for another name, gets its Display Name again.
          const displayName = back || wanted !== row.requestedName ? await freeName(trx, wanted, update, table.key, row.id) : row.displayName;
          await trx
            .updateTable('resources')
            .set({ ...facts, requestedName: wanted, displayName, withdrawnAt: null, updatedAt: new Date() })
            .where('id', '=', row.id)
            .execute();
          await keepColumns(trx, row.id, columns);
          await follow(trx, row, before, table, columns.fields, run, runDay);
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
      const row = await db
        .selectFrom('resources')
        .selectAll()
        .select(sql<string | null>`reliable_since::text`.as('reliableDay'))
        .where('id', '=', id)
        .executeTakeFirst();
      if (!row) {
        return undefined;
      }
      const written = new Map(
        (await db.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', id).execute()).map((entry) => [entry.field, entry.text]),
      );
      const fields = (
        await db
          .selectFrom('resourceFields')
          .select(['name', 'position', 'dataType', 'description'])
          .where('resourceId', '=', id)
          .orderBy(sql`position nulls last`)
          .orderBy('name')
          .execute()
      ).map((field) => ({ ...field, businessDescription: written.get(field.name) ?? '' }));
      const leftOut = await db.selectFrom('resourceLeftOut').select(['name', 'dataType', 'reason']).where('resourceId', '=', id).orderBy('name').execute();
      const mappings = await db
        .selectFrom('resourceMappings')
        .select(['field', 'kind', 'relationType', 'identity', 'subject', 'origin', 'inDomainModel'])
        .where('resourceId', '=', id)
        .execute();
      const order = new Map(fields.map((field, index) => [field.name, index]));
      const details: Details = {
        partition: row.partitionField ? { field: row.partitionField, unit: row.partitionUnit } : null,
        clusterBy: row.clusterBy,
        partitionFilter: row.partitionFilter,
        grain: row.grain,
        grainSentence: row.grainSentence,
        modelType: row.modelType,
        origins: row.origins,
        release: row.domainModelRelease,
        mappings: mappings.sort((a, b) => (order.get(a.field) ?? 0) - (order.get(b.field) ?? 0)),
      };
      const confirmation = await db
        .selectFrom('resourceConfirmations')
        .select(['ownerName', 'confirmedAt'])
        .where('resourceId', '=', id)
        .orderBy('id', 'desc')
        .limit(1)
        .executeTakeFirst();
      const instead = row.insteadOf ? await db.selectFrom('resources').select(['id', 'displayName']).where('id', '=', row.insteadOf).executeTakeFirst() : undefined;
      const changes = await db
        .selectFrom('resourceChanges')
        .select(['field', 'change', 'old', 'new', 'at'])
        .where('resourceId', '=', id)
        .where('seenAt', 'is', null)
        .orderBy('id')
        .execute();
      // The latest change of each description in the last 30 days, with the text before it.
      const descriptionChanges = await db
        .selectFrom('descriptionChanges')
        .select(['field', 'before', 'at'])
        .distinctOn(sql`coalesce(field, '')`)
        .where('resourceId', '=', id)
        .where('at', '>', sql<Date>`now() - interval '30 days'`)
        .orderBy(sql`coalesce(field, '')`)
        .orderBy('id', 'desc')
        .execute();
      return {
        ...present(row),
        fields,
        leftOut,
        details,
        card: cardOf(row, row.reliableDay),
        publication:
          row.publishedAt && confirmation
            ? { publishedAt: row.publishedAt, publishedBy: row.publishedBy ?? '', confirmedAt: confirmation.confirmedAt, confirmedBy: confirmation.ownerName }
            : null,
        deprecation: row.deprecatedAt
          ? { at: row.deprecatedAt, by: row.deprecatedBy ?? '', reason: row.deprecationReason ?? '', insteadOf: instead ? { id: instead.id, displayName: instead.displayName } : null }
          : null,
        changes,
        descriptionChanges,
      };
    },

    async add(items, collection, viewer) {
      const wanted = [...new Map(items.map((item) => [item.id, item])).values()];
      const unknown = wanted.filter((item) => !UUID.test(item.id)).map((item) => item.id);
      if (unknown.length > 0) {
        return { outcome: 'not_found', ids: unknown };
      }
      return db.transaction().execute(async (trx): Promise<AddOutcome> => {
        // Holds the Collection, so that it is not dissolved meanwhile (FR-CO-10).
        const live = await trx.selectFrom('collections').select('id').where('id', '=', collection.id).where('dissolvedAt', 'is', null).forShare().executeTakeFirst();
        if (!live) {
          return { outcome: 'collection_gone' };
        }
        const ids = wanted.map((item) => item.id);
        const rows = ids.length === 0 ? [] : await trx.selectFrom('resources').selectAll().where('id', 'in', ids).orderBy('id').forUpdate().execute();
        const missing = ids.filter((id) => !rows.some((row) => row.id === id));
        if (missing.length > 0) {
          return { outcome: 'not_found', ids: missing };
        }
        const elsewhere = rows.filter((row) => row.collectionId !== null && row.collectionId !== collection.id);
        if (elsewhere.length > 0) {
          return { outcome: 'in_another_collection', ids: elsewhere.map((row) => row.id) };
        }
        const adding = rows.filter((row) => row.collectionId === null).sort((a, b) => a.displayName.localeCompare(b.displayName));
        const fieldsOf = new Map<string, string[]>();
        if (adding.length > 0) {
          for (const field of await trx.selectFrom('resourceFields').select(['resourceId', 'name']).where('resourceId', 'in', adding.map((row) => row.id)).execute()) {
            fieldsOf.set(field.resourceId, [...(fieldsOf.get(field.resourceId) ?? []), field.name]);
          }
        }
        for (const row of adding) {
          const details = wanted.find((item) => item.id === row.id)?.details;
          const problem = details && checkDetails(details, fieldsOf.get(row.id) ?? []);
          if (problem) {
            return { outcome: 'invalid', id: row.id, message: `${row.displayName}: ${problem}` };
          }
        }
        for (const row of adding) {
          const details = wanted.find((item) => item.id === row.id)?.details;
          await trx.updateTable('resources').set({ collectionId: collection.id, updatedAt: new Date() }).where('id', '=', row.id).execute();
          await registrationMessage(trx, row.id, 'inCollection');
          await write(trx, row.id, 'COL-030', { collection: collection.name, actor: viewer.name }, viewer.id);
          if (details) {
            await record(trx, row.id, details, (fieldsOf.get(row.id) ?? []).length, viewer);
          }
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

    async edit(id, changes, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx
          .selectFrom('resources')
          .selectAll()
          .select(sql<string | null>`reliable_since::text`.as('reliableDay'))
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const current = cardOf(row, row.reliableDay);
        const changed = CARD_KEYS.filter((key) => changes[key] !== undefined && JSON.stringify(changes[key]) !== JSON.stringify(current[key]));
        if (changed.includes('businessDescription') && changes.businessDescription && row.level < DESCRIBED) {
          return { outcome: 'not_described' };
        }
        const fields = new Set(await fieldNames(trx, id));
        const stranger = [...(changes.keyFields ?? []), ...(changes.parameters ?? [])].find((name) => !fields.has(name));
        if (stranger !== undefined) {
          return { outcome: 'invalid', message: `${row.displayName} has no field ${stranger}.` };
        }
        if (changed.length === 0) {
          return { outcome: 'edited', changed };
        }
        await trx
          .updateTable('resources')
          .set({ ...Object.fromEntries(changed.map((key) => [key, changes[key]])), updatedAt: new Date() })
          .where('id', '=', id)
          .execute();
        for (const key of changed) {
          await write(trx, id, 'RES-005', { field: key, actor: viewer.name }, viewer.id);
        }
        return { outcome: 'edited', changed };
      });
    },

    async describeFields(id, descriptions, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx.selectFrom('resources').select(['displayName', 'level']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const fields = new Set(await fieldNames(trx, id));
        const stranger = descriptions.find((entry) => !fields.has(entry.field));
        if (stranger) {
          return { outcome: 'invalid', message: `${row.displayName} has no field ${stranger.field}.` };
        }
        const written = new Map(
          (await trx.selectFrom('fieldDescriptions').select(['field', 'text']).where('resourceId', '=', id).execute()).map((entry) => [entry.field, entry.text]),
        );
        const changed = descriptions.filter((entry) => entry.text !== (written.get(entry.field) ?? ''));
        if (changed.some((entry) => entry.text !== '') && row.level < DESCRIBED) {
          return { outcome: 'not_described' };
        }
        for (const { field, text } of changed) {
          if (text === '') {
            await trx.deleteFrom('fieldDescriptions').where('resourceId', '=', id).where('field', '=', field).execute();
          } else {
            await trx
              .insertInto('fieldDescriptions')
              .values({ resourceId: id, field, text, updatedBy: viewer.id })
              .onConflict((conflict) => conflict.columns(['resourceId', 'field']).doUpdateSet({ text, updatedAt: new Date(), updatedBy: viewer.id }))
              .execute();
          }
          await write(trx, id, 'RES-010', { field, actor: viewer.name }, viewer.id);
        }
        return { outcome: 'edited', changed: changed.map((entry) => entry.field) };
      });
    },

    async relate(id, details, viewer) {
      if (!UUID.test(id)) {
        return { outcome: 'not_found' };
      }
      return db.transaction().execute(async (trx): Promise<EditOutcome> => {
        const row = await trx.selectFrom('resources').select(['displayName']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return { outcome: 'not_found' };
        }
        const fields = await fieldNames(trx, id);
        const problem = checkDetails(details, fields);
        if (problem) {
          return { outcome: 'invalid', message: `${row.displayName}: ${problem}` };
        }
        await record(trx, id, details, fields.length, viewer);
        return { outcome: 'edited', changed: ['details'] };
      });
    },

    async related(id, viewer) {
      if (!UUID.test(id)) {
        return [];
      }
      const order = new Map((await fieldNames(db, id)).map((name, index) => [name, index]));
      const mappings = (
        await db
          .selectFrom('resourceMappings')
          .select(['field', 'kind', 'relationType', 'identity', 'inDomainModel'])
          .where('resourceId', '=', id)
          .execute()
      ).sort((a, b) => (order.get(a.field) ?? 0) - (order.get(b.field) ?? 0));
      const scope = await seenScope(viewer);
      const identities = [...new Set(mappings.map((mapping) => mapping.identity))];
      const carriers =
        identities.length === 0
          ? []
          : await db
              .selectFrom('resourceMappings as m')
              .innerJoin('resources as r', 'r.id', 'm.resourceId')
              .select(['m.identity', 'm.field', 'r.id', 'r.displayName', 'r.level'])
              .where('m.identity', 'in', identities)
              .where('r.id', '<>', id)
              .where('r.withdrawnAt', 'is', null)
              .$if(scope !== null, (query) => query.where(inScope(scope!)))
              .orderBy(sql`lower(r.display_name)`)
              .execute();
      return mappings.map((mapping) => ({
        ...mapping,
        resources: carriers
          .filter((carrier) => carrier.identity === mapping.identity)
          .map((carrier) => ({ id: carrier.id, displayName: carrier.displayName, level: carrier.level, field: carrier.field })),
      }));
    },

    async atNodes(nodeIds, viewer) {
      if (nodeIds.length === 0) {
        return [];
      }
      const scope = await seenScope(viewer);
      return db
        .selectFrom('resources as r')
        .select(['r.nodeId', 'r.id', 'r.displayName', 'r.level'])
        .where('r.nodeId', 'in', [...nodeIds])
        .where('r.withdrawnAt', 'is', null)
        .$if(scope !== null, (query) => query.where(inScope(scope!)))
        .execute();
    },

    async publish(id, viewer) {
      if (!UUID.test(id)) {
        return 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<PublishOutcome> => {
        const row = await trx.selectFrom('resources').selectAll().where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.collectionId === null) {
          return 'no_collection';
        }
        if (row.publishedAt !== null) {
          return 'already_published';
        }
        if (row.level < DESCRIBED) {
          return 'not_described';
        }
        // The first Publication is the first Confirmation, kept with the Fingerprint of this moment (FR-MR-08).
        const fields = await trx.selectFrom('resourceFields').select(['name', 'position', 'dataType', 'description']).where('resourceId', '=', id).orderBy(sql`position nulls last`).execute();
        const code = (await trx.selectFrom('resourceFingerprints').select('code').where('resourceId', '=', id).orderBy('id', 'desc').limit(1).executeTakeFirst())?.code ?? null;
        const print = fingerprint(row.description, fields, code);
        await trx
          .insertInto('resourceConfirmations')
          .values({ resourceId: id, ownerId: viewer.id, ownerName: viewer.name, ...print, fields: JSON.stringify(fields.map(({ name, dataType }) => ({ name, dataType }))) })
          .execute();
        await trx.updateTable('resources').set({ publishedAt: new Date(), publishedBy: viewer.name, level: CONFIRMED, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'PUB-040', { owner: viewer.name, level: String(CONFIRMED) }, viewer.id);
        await write(trx, id, 'MAT-020', { owner: viewer.name, fingerprint: print.structure.slice(0, 12) }, viewer.id);
        return 'published';
      });
    },

    async markSeen(id, viewer) {
      if (!UUID.test(id)) {
        return 0;
      }
      return db.transaction().execute(async (trx) => {
        const seen = await trx
          .updateTable('resourceChanges')
          .set({ seenAt: new Date(), seenBy: viewer.name })
          .where('resourceId', '=', id)
          .where('seenAt', 'is', null)
          .returning('id')
          .execute();
        if (seen.length > 0) {
          await write(trx, id, 'MAT-022', { actor: viewer.name, changes: String(seen.length) }, viewer.id);
        }
        return seen.length;
      });
    },

    async deprecate(id, reason, insteadOf, viewer) {
      if (!UUID.test(id) || (insteadOf !== null && !UUID.test(insteadOf))) {
        return UUID.test(id) ? 'invalid' : 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<DeprecateOutcome> => {
        const row = await trx.selectFrom('resources').select(['publishedAt']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.publishedAt === null) {
          return 'not_published';
        }
        if (insteadOf !== null) {
          const other = await trx.selectFrom('resources').select('id').where('id', '=', insteadOf).where('withdrawnAt', 'is', null).executeTakeFirst();
          if (!other || insteadOf === id) {
            return 'invalid';
          }
        }
        await trx.updateTable('resources').set({ deprecatedAt: new Date(), deprecatedBy: viewer.name, deprecationReason: reason, insteadOf, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-007', { actor: viewer.name, reason }, viewer.id);
        return 'done';
      });
    },

    async undeprecate(id, viewer) {
      if (!UUID.test(id)) {
        return 'not_found';
      }
      return db.transaction().execute(async (trx): Promise<DeprecateOutcome> => {
        const row = await trx.selectFrom('resources').select(['deprecatedAt']).where('id', '=', id).forUpdate().executeTakeFirst();
        if (!row) {
          return 'not_found';
        }
        if (row.deprecatedAt === null) {
          return 'not_deprecated';
        }
        await trx.updateTable('resources').set({ deprecatedAt: null, deprecatedBy: null, deprecationReason: null, insteadOf: null, updatedAt: new Date() }).where('id', '=', id).execute();
        await write(trx, id, 'RES-008', { actor: viewer.name }, viewer.id);
        return 'done';
      });
    },
  };
}

/**
 * What the Data Admin recorded fits the Resource: every field it names is a field of it, a field maps
 * once, and a relation starts from a field mapped as `is` (DEC-RC-08). Returns the problem, if any.
 */
export function checkDetails(details: Details, fields: readonly string[]): string | undefined {
  const known = new Set(fields);
  const named = [
    ...details.grain,
    ...details.clusterBy,
    ...(details.partition ? [details.partition.field] : []),
    ...details.mappings.flatMap((mapping) => [mapping.field, ...(mapping.subject ? [mapping.subject] : [])]),
  ];
  const stranger = named.find((field) => !known.has(field));
  if (stranger !== undefined) {
    return `it has no field ${stranger}.`;
  }
  const mapped = details.mappings.map((mapping) => mapping.field);
  const twice = mapped.find((field, index) => mapped.indexOf(field) !== index);
  if (twice !== undefined) {
    return `the field ${twice} maps twice.`;
  }
  const subjects = new Set(details.mappings.filter((mapping) => mapping.kind === 'is').map((mapping) => mapping.field));
  const loose = details.mappings.find((mapping) => mapping.subject !== null && !subjects.has(mapping.subject));
  if (loose) {
    return `the relation of ${loose.field} starts from ${loose.subject}, which is not mapped as is.`;
  }
  return undefined;
}
