import { MESSAGE_CATALOGUE } from '@datahub/contracts/message-catalogue';
import type { MessageKind, MessageType, SubjectKind } from '@datahub/contracts/messages';
import { topicOf } from '@datahub/learning';
import { type Kysely, type RawBuilder, type Selectable, sql, type SqlBool, type Transaction } from 'kysely';
import type { Collection, Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';

/**
 * Conversations (FR-CV-01 to FR-CV-09): every Message is placed on its object and kept once, by its
 * Subject (DEC-CV-02); the Message Centre, the Messages on an object and a Message opened in context all
 * read from here. Who sees a Message follows who sees its object (FR-CV-05); a Message keeps its Message
 * ID and parameters, and the words of whoever wrote it (DEC-CV-07).
 */

const TYPES = new Map<string, MessageType>(MESSAGE_CATALOGUE.map((type) => [type.id, type]));
const idsWhere = (test: (type: MessageType) => boolean) => MESSAGE_CATALOGUE.filter(test).map((type) => type.id);

/** What a User writes on an object, by its Message ID (MSG-CNV-01 to MSG-CNV-03). */
export const WRITTEN = { question: 'MSG-CNV-01', remark: 'MSG-CNV-02', signal: 'MSG-CNV-03' } as const;
export type WrittenKind = keyof typeof WRITTEN;

/**
 * The objects a User writes on from their page, and what each takes: a Signal is about data (FR-CV-07). A
 * Learning Card takes a Question or a Remark, for the Data Team, which writes the cards (FR-LR-06).
 */
export const WRITTEN_ON = {
  collection: ['question', 'remark'],
  resource: ['question', 'remark', 'signal'],
  lens: ['question', 'remark', 'signal'],
  learningCard: ['question', 'remark'],
} as const satisfies Partial<Record<SubjectKind, readonly WrittenKind[]>>;
export type WrittenOn = keyof typeof WRITTEN_ON;

const REPLY = 'MSG-CNV-04';
const DECISION = 'MSG-CNV-05';

/** The Message Centre filters on these kinds and kinds of object (FR-CV-06). */
export const FILTER_KINDS = ['question', 'remark', 'signal', 'request', 'dataHub'] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];
export const FILTER_ON = ['collection', 'resource', 'lens', 'query'] as const;
export type FilterOn = (typeof FILTER_ON)[number];
export const VIEWS = ['forYou', 'unread', 'written', 'everything'] as const;
export type View = (typeof VIEWS)[number];

const KIND_TYPES: Record<FilterKind, string[]> = {
  question: [WRITTEN.question],
  remark: [WRITTEN.remark],
  signal: [WRITTEN.signal],
  request: idsWhere((type) => type.kind === 'request'),
  dataHub: idsWhere((type) => type.kind === 'dataHub'),
};

/** Who a first Message notifies, by the recipients of its type in the Message Catalogue (FR-CV-03). */
const TO_OWNER = idsWhere((type) => type.to.includes('owner'));
const TO_DATA_TEAM = idsWhere((type) => type.to.includes('dataTeam'));
const TO_AUTHOR = idsWhere((type) => type.to.includes('author'));

/** How a writer stands to the object of their Message, shown next to their name. */
export type Standing = 'owner' | 'dataTeam' | null;

export interface MessageSubject {
  kind: SubjectKind;
  id: string;
  /** Its current name (FR-CV-02), or the name it had once it no longer exists (EC-CV-01). */
  name: string;
  /** The Collection a Resource or a Lens is in. */
  collection: { id: string; name: string } | null;
  exists: boolean;
}

export interface MessageView {
  id: string;
  /** Its Message ID in the Message Catalogue. */
  type: string;
  kind: MessageKind;
  subject: MessageSubject;
  /** Whoever wrote it, or null for Data Hub itself. */
  writer: { id: string; name: string; as: Standing } | null;
  /** The values of its parameters, the words of its writer among them as `text`. */
  params: Record<string, string>;
  /** Open or answered, waiting, accepted or refused; null for a Message that asks nothing. */
  state: string | null;
  createdAt: Date;
  /** When its conversation last moved. */
  lastAt: Date;
  replyCount: number;
  unread: boolean;
  mine: boolean;
}

/** A reply, or the decision on a Request, under the Message it answers. */
export interface ReplyView {
  id: string;
  type: string;
  kind: MessageKind;
  writer: { id: string; name: string; as: Standing } | null;
  params: Record<string, string>;
  createdAt: Date;
  mine: boolean;
}

export interface Conversation extends MessageView {
  replies: ReplyView[];
}

export interface Counts {
  forYou: number;
  unread: number;
  written: number;
  /** Within the view asked for. */
  kinds: Record<FilterKind, number>;
  on: Record<FilterOn, number>;
}

/** What a User may see and what their Owner Units own, worked out once per request (FR-CV-05, FR-CV-06). */
export interface Sight {
  viewer: Viewer;
  collections: Set<string>;
  resources: Set<string>;
  lenses: Set<string>;
  ownedCollections: Set<string>;
  ownedResources: Set<string>;
  ownedLenses: Set<string>;
  authoredLenses: Set<string>;
}

/** What query tells about a Lens (DEC-PF-30). */
export interface LensFacts {
  name: string;
  collectionId: string;
  resourceIds: string[];
  state: 'published' | 'waiting' | 'stopped' | 'refused';
  authorId: string;
  authorName: string;
}

export interface Decider {
  id: string;
  name: string;
}

export type Decided = { outcome: 'decided'; conversation: Conversation } | { outcome: 'not_found' } | { outcome: 'not_waiting' } | { outcome: 'not_a_request' };

export interface Messages {
  /** What the viewer may see and owns, from the Collections they see and the Lenses query told about. */
  sight(viewer: Viewer, seen: Collection[]): Promise<Sight>;
  /** The conversations of a view, newest first, at most 200, with the counts of the Message Centre. */
  list(sight: Sight, filter: { view: View; kind?: FilterKind; on?: FilterOn; search?: string }): Promise<{ messages: MessageView[]; counts: Counts }>;
  /** How many conversations for the viewer moved since they last read them (FR-CV-06). */
  unread(sight: Sight): Promise<number>;
  /** One conversation with its replies, if the viewer sees its object; a reply gives its conversation. */
  conversation(id: string, sight: Sight): Promise<Conversation | undefined>;
  /** The conversations on one object, newest first, with their replies (FR-CV-04, FR-CV-07). */
  on(kind: SubjectKind, id: string, sight: Sight): Promise<Conversation[]>;
  /** Whether the viewer sees the object: a Collection, a Resource or a Lens (FR-CV-05). */
  sees(sight: Sight, kind: SubjectKind, id: string): boolean;
  /** A Question, Remark or Signal on an object the viewer sees; a Signal on a Resource enters its Log (CNV-050). */
  write(sight: Sight, subject: { kind: WrittenOn; id: string }, kind: WrittenKind, text: string): Promise<Conversation>;
  /** A reply in a conversation of a Question, Remark or Signal; undefined when that is not one. */
  reply(id: string, sight: Sight, text: string): Promise<Conversation | 'not_found' | 'no_replies'>;
  read(id: string, sight: Sight): Promise<boolean>;
  /** The decision of the Data Team on a waiting Request: its reply, which ends it (FR-CV-08, MSG-CNV-05). */
  decide(id: string, outcome: 'accepted' | 'refused', text: string, decider: Decider, sight?: Sight): Promise<Decided>;
  /** The Request Data Hub sends when a Lens grew into very large; one that waits is given back (MSG-LEN-03). */
  grew(lensId: string, fields: { reads: number; threshold: number; partitions?: number }): Promise<{ id: string; sent: boolean }>;
  /** What Data Hub tells the author of a Lens that grew into large, past 100 MB a run; it keeps running (MSG-LEN-02). */
  grewLarge(lensId: string, fields: { reads: number; threshold: number }): Promise<{ id: string }>;
  /**
   * What Data Hub tells when a query or a Lens became Broken (MSG-QRY-02, MSG-LEN-05): who made the query, or the
   * Owner Unit of the Lens, with what no longer exists (FR-SR-52). A query's Message is for its owner only.
   */
  broken(subject: { kind: 'query'; id: string; name: string; ownerId: string } | { kind: 'lens'; id: string }, fields: BrokenFields): Promise<{ id: string }>;
  /** The query or Lens works again: its Message on being Broken says so, and is new again for whom it is for. */
  worksAgain(subject: { kind: 'query' | 'lens'; id: string }): Promise<{ id: string } | null>;
  /** Keeps what query tells about a Lens. */
  keepLens(id: string, facts: LensFacts): Promise<void>;
}

type Row = Selectable<CatalogueDatabase['messages']>;
type Database = Kysely<CatalogueDatabase> | Transaction<CatalogueDatabase>;

const kindOf = (type: string): MessageKind => TYPES.get(type)?.kind ?? 'dataHub';
const LIMIT = 200;
const list = (values: Iterable<string>) => sql`${[...values]}::text[]`;

/** What no longer exists, in a Message about a Broken query or Lens (MSG-QRY-02, MSG-LEN-05). */
export interface BrokenFields {
  /** The day it was found, `YYYY-MM-DD`. */
  since: string;
  missing: { kind: 'resource' | 'column'; resource: string; column?: string }[];
}

export function createMessages(db: Kysely<CatalogueDatabase>): Messages {
  /** Whether the viewer sees the object of a Message: a query only by whoever wrote on it, and the Data Team. */
  function seesRow(sight: Sight, row: Pick<Row, 'subjectKind' | 'subjectId' | 'writerId'> & { params?: Row['params'] }): boolean {
    if (sight.viewer.dataTeam) return true;
    // A query: who wrote on it, and who made it, to whom Data Hub writes about it (MSG-QRY-02).
    if (row.subjectKind === 'query') return row.writerId === sight.viewer.id || row.params?.owner === sight.viewer.id;
    return sees(sight, row.subjectKind, row.subjectId);
  }

  function sees(sight: Sight, kind: SubjectKind, id: string): boolean {
    // Every User may open every Learning Card, and so sees the Messages on it (DEC-LR-03, FR-LR-06).
    if (kind === 'learningCard') return topicOf(id) !== undefined;
    if (sight.viewer.dataTeam) return true;
    if (kind === 'collection') return sight.collections.has(id);
    if (kind === 'resource') return sight.resources.has(id);
    if (kind === 'lens') return sight.lenses.has(id);
    return false;
  }

  /** The first Messages of conversations on objects the viewer sees (FR-CV-05). */
  function visible(sight: Sight): RawBuilder<SqlBool> {
    if (sight.viewer.dataTeam) return sql<SqlBool>`true`;
    return sql<SqlBool>`(
      (m.subject_kind = 'collection' and m.subject_id = any(${list(sight.collections)}))
      or (m.subject_kind = 'resource' and m.subject_id = any(${list(sight.resources)}))
      or (m.subject_kind = 'lens' and m.subject_id = any(${list(sight.lenses)}))
      or (m.subject_kind = 'query' and (m.writer_id = ${sight.viewer.id} or m.params->>'owner' = ${sight.viewer.id}))
      or m.subject_kind = 'learningCard'
    )`;
  }

  /**
   * The conversations for the viewer (FR-CV-06): those they started or replied in, those whose first
   * Message notifies them, as Owner, as the Data Team or as the author of its Lens.
   */
  function forYou(sight: Sight): RawBuilder<SqlBool> {
    const me = sight.viewer.id;
    return sql<SqlBool>`(
      m.writer_id = ${me}
      or exists (select 1 from messages r where r.parent_id = m.id and r.writer_id = ${me})
      or (m.type = any(${list(TO_OWNER)}) and (
        (m.subject_kind = 'collection' and m.subject_id = any(${list(sight.ownedCollections)}))
        or (m.subject_kind = 'resource' and m.subject_id = any(${list(sight.ownedResources)}))
        or (m.subject_kind = 'lens' and m.subject_id = any(${list(sight.ownedLenses)}))))
      or (${sight.viewer.dataTeam} and m.type = any(${list(TO_DATA_TEAM)}))
      or (${sight.viewer.dataTeam} and m.type = any(${list(TO_OWNER)}) and m.subject_kind = 'learningCard')
      or (m.type = any(${list(TO_AUTHOR)}) and m.subject_kind = 'lens' and m.subject_id = any(${list(sight.authoredLenses)}))
      or (m.type = any(${list(TO_OWNER)}) and m.subject_kind = 'query' and m.params->>'owner' = ${me})
    )`;
  }

  /** A conversation moved by someone else since the viewer last read it. */
  function unreadBy(sight: Sight): RawBuilder<SqlBool> {
    return sql<SqlBool>`(m.last_writer_id is distinct from ${sight.viewer.id}
      and not exists (select 1 from message_reads mr where mr.message_id = m.id and mr.user_id = ${sight.viewer.id} and mr.read_at >= m.last_at))`;
  }

  function inView(sight: Sight, view: View): RawBuilder<SqlBool> {
    if (view === 'forYou') return forYou(sight);
    if (view === 'unread') return sql<SqlBool>`(${forYou(sight)} and ${unreadBy(sight)})`;
    if (view === 'written') return sql<SqlBool>`m.writer_id = ${sight.viewer.id}`;
    return sql<SqlBool>`true`;
  }

  /** The words of a search in the words of a conversation, the names in it and the name of its object. */
  function matching(search: string): RawBuilder<SqlBool> {
    const like = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    return sql<SqlBool>`(
      m.params::text ilike ${like}
      or exists (select 1 from messages r where r.parent_id = m.id and r.params::text ilike ${like})
      or (m.subject_kind = 'collection' and exists (select 1 from collections c where c.id::text = m.subject_id and c.name ilike ${like}))
      or (m.subject_kind = 'resource' and exists (select 1 from resources s where s.id::text = m.subject_id and s.display_name ilike ${like}))
      or (m.subject_kind = 'lens' and exists (select 1 from lenses l where l.id::text = m.subject_id and l.name ilike ${like}))
    )`;
  }

  /** The objects of Messages, by their current names and Collections, in a few queries (FR-CV-02, EC-CV-01). */
  async function subjects(rows: Pick<Row, 'subjectKind' | 'subjectId' | 'params'>[], from: Database = db): Promise<(row: Pick<Row, 'subjectKind' | 'subjectId' | 'params'>) => MessageSubject> {
    const ids = (kind: SubjectKind) => [...new Set(rows.filter((row) => row.subjectKind === kind).map((row) => row.subjectId))];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resourceIds = ids('resource').filter((id) => uuid.test(id));
    const lensIds = ids('lens').filter((id) => uuid.test(id));
    const [resources, lenses] = await Promise.all([
      resourceIds.length ? from.selectFrom('resources').select(['id', 'displayName', 'collectionId']).where('id', 'in', resourceIds).execute() : [],
      lensIds.length ? from.selectFrom('lenses').select(['id', 'name', 'collectionId']).where('id', 'in', lensIds).execute() : [],
    ]);
    const collectionIds = [
      ...new Set([...ids('collection').filter((id) => uuid.test(id)), ...resources.flatMap((row) => (row.collectionId ? [row.collectionId] : [])), ...lenses.map((row) => row.collectionId)]),
    ];
    const collections = new Map(
      (collectionIds.length ? await from.selectFrom('collections').select(['id', 'name', 'dissolvedAt']).where('id', 'in', collectionIds).execute() : []).map((row) => [row.id, row]),
    );
    const resourceMap = new Map(resources.map((row) => [row.id, row]));
    const lensMap = new Map(lenses.map((row) => [row.id, row]));
    const inCollection = (id: string | null) => {
      const collection = id ? collections.get(id) : undefined;
      return collection ? { id: collection.id, name: collection.name } : null;
    };
    return (row) => {
      const fallback = row.params.subject ?? '';
      switch (row.subjectKind) {
        case 'collection': {
          const collection = collections.get(row.subjectId);
          return { kind: 'collection', id: row.subjectId, name: collection?.name ?? fallback, collection: null, exists: !!collection && collection.dissolvedAt === null };
        }
        case 'resource': {
          const resource = resourceMap.get(row.subjectId);
          return { kind: 'resource', id: row.subjectId, name: resource?.displayName ?? fallback, collection: inCollection(resource?.collectionId ?? null), exists: !!resource };
        }
        case 'lens': {
          const lens = lensMap.get(row.subjectId);
          return { kind: 'lens', id: row.subjectId, name: lens?.name ?? fallback, collection: inCollection(lens?.collectionId ?? null), exists: !!lens };
        }
        case 'learningCard': {
          // Named by its number and its title, as the plan has them; the Data Team writes it (FR-LR-06).
          const topic = topicOf(row.subjectId);
          return { kind: 'learningCard', id: row.subjectId, name: topic ? `${topic.number} ${topic.title.en}` : fallback, collection: null, exists: !!topic };
        }
        default:
          return { kind: row.subjectKind, id: row.subjectId, name: fallback, collection: null, exists: true };
      }
    };
  }

  const writerOf = (row: Pick<Row, 'writerId' | 'params'>) =>
    row.writerId === null ? null : { id: row.writerId, name: row.params.writer ?? '', as: (row.params.as || null) as Standing };

  function viewOf(row: Row & { replyCount?: number | string; unread?: boolean }, subject: MessageSubject, sight: Sight): MessageView {
    return {
      id: row.id,
      type: row.type,
      kind: kindOf(row.type),
      subject,
      writer: writerOf(row),
      params: row.params,
      state: row.state,
      createdAt: row.createdAt,
      lastAt: row.lastAt,
      replyCount: Number(row.replyCount ?? 0),
      unread: row.unread ?? false,
      mine: row.writerId === sight.viewer.id,
    };
  }

  const replyOf = (row: Row, sight: Sight): ReplyView => ({
    id: row.id,
    type: row.type,
    kind: kindOf(row.type),
    writer: writerOf(row),
    params: row.params,
    createdAt: row.createdAt,
    mine: row.writerId === sight.viewer.id,
  });

  /** Conversations with their replies, oldest reply first, and whether each is unread for the viewer. */
  async function conversations(rows: Row[], sight: Sight, from: Database = db): Promise<Conversation[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [replies, reads, named] = await Promise.all([
      from.selectFrom('messages').selectAll().where('parentId', 'in', ids).orderBy('createdAt').orderBy('id').execute(),
      from.selectFrom('messageReads').select(['messageId', 'readAt']).where('messageId', 'in', ids).where('userId', '=', sight.viewer.id).execute(),
      subjects(rows, from),
    ]);
    const readAt = new Map(reads.map((read) => [read.messageId, read.readAt]));
    return rows.map((row) => {
      const own = replies.filter((reply) => reply.parentId === row.id);
      const read = readAt.get(row.id);
      const unread = row.lastWriterId !== sight.viewer.id && (!read || read < row.lastAt);
      return { ...viewOf({ ...row, replyCount: own.length, unread }, named(row), sight), replies: own.map((reply) => replyOf(reply, sight)) };
    });
  }

  /** How the viewer stands to an object: in its Owner Unit, the Data Team, or neither. */
  function standing(sight: Sight, kind: SubjectKind, id: string): Standing {
    const owned = kind === 'collection' ? sight.ownedCollections : kind === 'resource' ? sight.ownedResources : kind === 'lens' ? sight.ownedLenses : new Set<string>();
    if (owned.has(id)) return 'owner';
    return sight.viewer.dataTeam ? 'dataTeam' : null;
  }

  async function markRead(from: Database, messageId: string, userId: string) {
    await from
      .insertInto('messageReads')
      .values({ messageId, userId, readAt: new Date() })
      .onConflict((conflict) => conflict.columns(['messageId', 'userId']).doUpdateSet({ readAt: new Date() }))
      .execute();
  }

  async function first(id: string, from: Database = db): Promise<Row | undefined> {
    const row = await from.selectFrom('messages').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row || row.parentId === null) return row;
    return from.selectFrom('messages').selectAll().where('id', '=', row.parentId).executeTakeFirst();
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return {
    sees,

    async sight(viewer, seen) {
      const collections = new Set(seen.map((collection) => collection.id));
      const resources = new Set(seen.flatMap((collection) => collection.resources.map((resource) => resource.id)));
      const owned = seen.filter((collection) => viewer.groups.includes(collection.ownerUnit.id));
      const ownedCollections = new Set(owned.map((collection) => collection.id));
      const lenses = await db.selectFrom('lenses').select(['id', 'collectionId', 'resourceIds', 'state', 'authorId']).execute();
      // A Lens as query shows it (DEC-CO-16): in a Collection the viewer sees, on Resources they may all use;
      // while it waits for the Data Team or was refused, only its author and the Data Team (FR-LE-09, DEC-UX-128).
      const visibleLenses = lenses.filter(
        (lens) =>
          viewer.dataTeam ||
          (collections.has(lens.collectionId) &&
            ((lens.state !== 'waiting' && lens.state !== 'refused') || lens.authorId === viewer.id) &&
            lens.resourceIds.every((id) => resources.has(id))),
      );
      return {
        viewer,
        collections,
        resources,
        lenses: new Set(visibleLenses.map((lens) => lens.id)),
        ownedCollections,
        ownedResources: new Set(owned.flatMap((collection) => collection.resources.map((resource) => resource.id))),
        ownedLenses: new Set(lenses.filter((lens) => ownedCollections.has(lens.collectionId)).map((lens) => lens.id)),
        authoredLenses: new Set(lenses.filter((lens) => lens.authorId === viewer.id).map((lens) => lens.id)),
      };
    },

    async list(sight, { view, kind, on, search }) {
      const base = sql<SqlBool>`m.parent_id is null and ${visible(sight)}`;
      const chosen = sql<SqlBool>`${base} and ${inView(sight, view)}`;
      const [totals, breakdown, rows] = await Promise.all([
        sql<{ forYou: string; unread: string; written: string }>`
          select count(*) filter (where ${forYou(sight)}) as for_you,
            count(*) filter (where ${forYou(sight)} and ${unreadBy(sight)}) as unread,
            count(*) filter (where m.writer_id = ${sight.viewer.id}) as written
          from messages m where ${base}`.execute(db),
        sql<{ type: string; subjectKind: string; count: string }>`
          select m.type, m.subject_kind, count(*) as count from messages m where ${chosen} group by m.type, m.subject_kind`.execute(db),
        sql<Row & { replyCount: string; unread: boolean }>`
          select m.*, (select count(*) from messages r where r.parent_id = m.id) as reply_count, ${unreadBy(sight)} as unread
          from messages m
          where ${chosen}
            and ${kind ? sql`m.type = any(${list(KIND_TYPES[kind])})` : sql`true`}
            and ${on ? sql`m.subject_kind = ${on}` : sql`true`}
            and ${search ? matching(search) : sql`true`}
          order by m.last_at desc, m.id desc
          limit ${LIMIT}`.execute(db),
      ]);
      const kinds = Object.fromEntries(FILTER_KINDS.map((name) => [name, 0])) as Record<FilterKind, number>;
      const objects = Object.fromEntries(FILTER_ON.map((name) => [name, 0])) as Record<FilterOn, number>;
      for (const row of breakdown.rows) {
        const filter = FILTER_KINDS.find((name) => KIND_TYPES[name].includes(row.type));
        if (filter) kinds[filter] += Number(row.count);
        if ((FILTER_ON as readonly string[]).includes(row.subjectKind)) objects[row.subjectKind as FilterOn] += Number(row.count);
      }
      const total = totals.rows[0];
      const named = await subjects(rows.rows);
      return {
        messages: rows.rows.map((row) => viewOf(row, named(row), sight)),
        counts: { forYou: Number(total?.forYou ?? 0), unread: Number(total?.unread ?? 0), written: Number(total?.written ?? 0), kinds, on: objects },
      };
    },

    async unread(sight) {
      const { rows } = await sql<{ count: string }>`
        select count(*) as count from messages m where m.parent_id is null and ${visible(sight)} and ${forYou(sight)} and ${unreadBy(sight)}`.execute(db);
      return Number(rows[0]?.count ?? 0);
    },

    async conversation(id, sight) {
      if (!UUID.test(id)) return undefined;
      const row = await first(id);
      if (!row || !seesRow(sight, row)) return undefined;
      return (await conversations([row], sight))[0];
    },

    async on(kind, id, sight) {
      if (!sees(sight, kind, id)) return [];
      const rows = await db
        .selectFrom('messages')
        .selectAll()
        .where('subjectKind', '=', kind)
        .where('subjectId', '=', id)
        .where('parentId', 'is', null)
        .orderBy('lastAt', 'desc')
        .orderBy('id', 'desc')
        .limit(LIMIT)
        .execute();
      return conversations(rows, sight);
    },

    async write(sight, subject, kind, text) {
      const viewer = sight.viewer;
      return db.transaction().execute(async (trx) => {
        const as = standing(sight, subject.kind, subject.id);
        const row = await trx
          .insertInto('messages')
          .values({
            type: WRITTEN[kind],
            subjectKind: subject.kind,
            subjectId: subject.id,
            writerId: viewer.id,
            params: { text, writer: viewer.name, ...(as ? { as } : {}) },
            // A Question or a Signal is open until someone answers it (MSG-CNV-01, MSG-CNV-03).
            state: kind === 'remark' ? null : 'open',
            lastWriterId: viewer.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await markRead(trx, row.id, viewer.id);
        // A Signal on a Resource enters its Log (FR-SR-30).
        if (kind === 'signal' && subject.kind === 'resource') {
          await trx.insertInto('resourceLog').values({ resourceId: subject.id, logId: 'CNV-050', params: { actor: viewer.name, conversation: row.id }, actorId: viewer.id }).execute();
        }
        return (await conversations([row], sight, trx))[0]!;
      });
    },

    async reply(id, sight, text) {
      const viewer = sight.viewer;
      return db.transaction().execute(async (trx) => {
        const row = await first(id, trx);
        if (!row || !seesRow(sight, row)) return 'not_found' as const;
        // A Request is answered by its decision, and what Data Hub writes takes no reply (FR-CV-08).
        if (!(Object.values(WRITTEN) as string[]).includes(row.type)) return 'no_replies' as const;
        const parent = await trx.selectFrom('messages').selectAll().where('id', '=', row.id).forUpdate().executeTakeFirstOrThrow();
        const as = standing(sight, parent.subjectKind, parent.subjectId);
        const now = new Date();
        await trx
          .insertInto('messages')
          .values({
            type: REPLY,
            subjectKind: parent.subjectKind,
            subjectId: parent.subjectId,
            writerId: viewer.id,
            params: { text, writer: viewer.name, ...(as ? { as } : {}) },
            state: null,
            parentId: parent.id,
            lastWriterId: viewer.id,
          })
          .execute();
        // The first reply of someone else makes a Question or a Signal answered (MSG-CNV-01, MSG-CNV-03).
        const answered = parent.state === 'open' && parent.writerId !== viewer.id;
        const updated = await trx
          .updateTable('messages')
          .set({ lastAt: now, lastWriterId: viewer.id, updatedAt: now, ...(answered ? { state: 'answered' } : {}) })
          .where('id', '=', parent.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        await markRead(trx, parent.id, viewer.id);
        return (await conversations([updated], sight, trx))[0]!;
      });
    },

    async read(id, sight) {
      if (!UUID.test(id)) return false;
      const row = await first(id);
      if (!row || !seesRow(sight, row)) return false;
      await markRead(db, row.id, sight.viewer.id);
      return true;
    },

    async decide(id, outcome, text, decider, sight) {
      if (!UUID.test(id)) return { outcome: 'not_found' };
      return db.transaction().execute(async (trx): Promise<Decided> => {
        const row = await trx.selectFrom('messages').selectAll().where('id', '=', id).where('parentId', 'is', null).forUpdate().executeTakeFirst();
        if (!row || (sight && !seesRow(sight, row))) return { outcome: 'not_found' };
        if (kindOf(row.type) !== 'request') return { outcome: 'not_a_request' };
        if (row.state !== 'waiting') return { outcome: 'not_waiting' };
        const now = new Date();
        await trx
          .insertInto('messages')
          .values({
            type: DECISION,
            subjectKind: row.subjectKind,
            subjectId: row.subjectId,
            writerId: decider.id,
            params: { outcome, writer: decider.name, as: 'dataTeam', ...(text ? { text } : {}) },
            state: null,
            parentId: row.id,
            lastWriterId: decider.id,
          })
          .execute();
        const updated = await trx
          .updateTable('messages')
          .set({ state: outcome, lastAt: now, lastWriterId: decider.id, updatedAt: now })
          .where('id', '=', row.id)
          .returningAll()
          .executeTakeFirstOrThrow();
        await markRead(trx, row.id, decider.id);
        const who: Sight = sight ?? {
          viewer: { id: decider.id, name: decider.name, groups: [], dataTeam: true },
          collections: new Set(),
          resources: new Set(),
          lenses: new Set(),
          ownedCollections: new Set(),
          ownedResources: new Set(),
          ownedLenses: new Set(),
          authoredLenses: new Set(),
        };
        return { outcome: 'decided', conversation: (await conversations([updated], who, trx))[0]! };
      });
    },

    async grew(lensId, { reads, threshold, partitions }) {
      const params: Record<string, string> = { reads: String(reads), threshold: String(threshold), ...(partitions === undefined ? {} : { partitions: String(partitions) }) };
      const row = await db
        .insertInto('messages')
        .values({ type: 'MSG-LEN-03', subjectKind: 'lens', subjectId: lensId, writerId: null, params, state: 'waiting' })
        .onConflict((conflict) => conflict.column('subjectId').where('type', '=', 'MSG-LEN-03').where('state', '=', 'waiting').doNothing())
        .returning('id')
        .executeTakeFirst();
      if (row) return { id: row.id, sent: true };
      const waiting = await db
        .selectFrom('messages')
        .select('id')
        .where('type', '=', 'MSG-LEN-03')
        .where('subjectId', '=', lensId)
        .where('state', '=', 'waiting')
        .executeTakeFirstOrThrow();
      return { id: waiting.id, sent: false };
    },

    async broken(subject, { since, missing }) {
      const params: Record<string, string> = { since, count: String(missing.length), missing: JSON.stringify(missing) };
      const row =
        subject.kind === 'query'
          ? { type: 'MSG-QRY-02', subjectKind: 'query' as const, subjectId: subject.id, params: { ...params, subject: subject.name, owner: subject.ownerId } }
          : { type: 'MSG-LEN-05', subjectKind: 'lens' as const, subjectId: subject.id, params };
      return db.insertInto('messages').values({ ...row, writerId: null, state: 'broken' }).returning('id').executeTakeFirstOrThrow();
    },

    async worksAgain({ kind, id }) {
      const now = new Date();
      const row = await db
        .updateTable('messages')
        .set({ state: 'worksAgain', lastAt: now, updatedAt: now })
        .where('id', '=', (eb) =>
          eb
            .selectFrom('messages')
            .select('id')
            .where('type', '=', kind === 'query' ? 'MSG-QRY-02' : 'MSG-LEN-05')
            .where('subjectKind', '=', kind)
            .where('subjectId', '=', id)
            .where('state', '=', 'broken')
            .orderBy('createdAt', 'desc')
            .limit(1),
        )
        .returning('id')
        .executeTakeFirst();
      return row ?? null;
    },

    async grewLarge(lensId, { reads, threshold }) {
      return db
        .insertInto('messages')
        .values({ type: 'MSG-LEN-02', subjectKind: 'lens', subjectId: lensId, writerId: null, params: { reads: String(reads), threshold: String(threshold) }, state: null })
        .returning('id')
        .executeTakeFirstOrThrow();
    },

    async keepLens(id, facts) {
      await db
        .insertInto('lenses')
        .values({ id, ...facts, updatedAt: new Date() })
        .onConflict((conflict) => conflict.column('id').doUpdateSet({ ...facts, updatedAt: new Date() }))
        .execute();
    },
  };
}
