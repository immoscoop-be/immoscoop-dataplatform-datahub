import type { Kysely, Selectable } from 'kysely';
import type { Viewer } from './collections.js';
import type { CatalogueDatabase } from './database.js';

/** The types of Request a User sends: a query above 1 GB, and a very large Lens (MSG-QRY-01, MSG-LEN-01). */
export const REQUEST_TYPES = ['MSG-QRY-01', 'MSG-LEN-01'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

/** Every type of Request catalogue keeps, with the one Data Hub sends when a Lens grew into very large (MSG-LEN-03). */
const ALL_REQUEST_TYPES = [...REQUEST_TYPES, 'MSG-LEN-03'] as const;
type AnyRequestType = (typeof ALL_REQUEST_TYPES)[number];

/** The kind of object a Request is on. */
export type RequestSubject = 'query' | 'lens';

/** Each type of Request is on one kind of object. */
export const SUBJECT_OF: Record<AnyRequestType, RequestSubject> = { 'MSG-QRY-01': 'query', 'MSG-LEN-01': 'lens', 'MSG-LEN-03': 'lens' };

/** A Request waits until the Data Team answers it, without a timeout (DEC-SR-36). */
export type RequestState = 'waiting' | 'accepted' | 'refused';

/** A Request on a query or a Lens (FR-CV-08), as a Message of the Message Catalogue keeps it. */
export interface Request {
  id: string;
  type: AnyRequestType;
  subjectKind: RequestSubject;
  subjectId: string;
  /** Who sent it; empty for Data Hub itself (MSG-LEN-03). */
  writerId: string;
  writerName: string;
  /** The name of the query or the Lens when it was sent. */
  subject: string;
  /** What one run reads, and the threshold it is above, in bytes (DEC-SR-29). */
  reads: number;
  threshold: number;
  /** The word of its writer for the Data Team, or empty. */
  text: string;
  /** How many partitions one run reads, where BigQuery tells (MSG-LEN-01). */
  partitions: number | null;
  state: RequestState;
  /** The decision of the Data Team, its reply (MSG-CNV-05): who decided, when, and the reason. */
  decision: { outcome: 'accepted' | 'refused'; text: string; writerName: string; at: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestFields {
  type: RequestType;
  subjectId: string;
  subject: string;
  reads: number;
  threshold: number;
  text: string;
  partitions?: number;
}

export interface Requests {
  /** Sends a Request; while one of the same writer waits on the same object, that one is given back as it is. */
  send(fields: RequestFields, writer: Viewer): Promise<{ request: Request; sent: boolean }>;
  /** The Requests on queries or on Lenses, newest first: on one or all, of one writer or everyone. */
  list(filter: { subjectKind: RequestSubject; subjectId?: string; writerId?: string }): Promise<Request[]>;
}

type MessageRow = Selectable<CatalogueDatabase['messages']>;

const requestOf = (row: MessageRow, decision?: MessageRow): Request => ({
  id: row.id,
  type: row.type as AnyRequestType,
  subjectKind: SUBJECT_OF[row.type as AnyRequestType] ?? 'query',
  subjectId: row.subjectId,
  writerId: row.writerId ?? '',
  writerName: row.params.writer ?? '',
  subject: row.params.subject ?? '',
  reads: Number(row.params.reads ?? 0),
  threshold: Number(row.params.threshold ?? 0),
  text: row.params.text ?? '',
  partitions: row.params.partitions === undefined ? null : Number(row.params.partitions),
  state: (row.state ?? 'waiting') as RequestState,
  decision: decision
    ? { outcome: decision.params.outcome === 'accepted' ? 'accepted' : 'refused', text: decision.params.text ?? '', writerName: decision.params.writer ?? '', at: decision.createdAt }
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export function createRequests(db: Kysely<CatalogueDatabase>): Requests {
  const waiting = (fields: RequestFields, writer: Viewer) =>
    db
      .selectFrom('messages')
      .selectAll()
      .where('type', '=', fields.type)
      .where('subjectKind', '=', SUBJECT_OF[fields.type])
      .where('subjectId', '=', fields.subjectId)
      .where('writerId', '=', writer.id)
      .where('state', '=', 'waiting')
      .executeTakeFirst();

  return {
    async send(fields, writer) {
      // A Message keeps the values of its parameters as texts, sizes in bytes (DEC-CV-07).
      const params: Record<string, string> = { subject: fields.subject, writer: writer.name, reads: String(fields.reads), threshold: String(fields.threshold), text: fields.text };
      if (fields.partitions !== undefined) params.partitions = String(fields.partitions);
      const row = await db
        .insertInto('messages')
        .values({ type: fields.type, subjectKind: SUBJECT_OF[fields.type], subjectId: fields.subjectId, writerId: writer.id, params, state: 'waiting', lastWriterId: writer.id })
        .onConflict((conflict) => conflict.columns(['type', 'subjectKind', 'subjectId', 'writerId']).where('state', '=', 'waiting').where('writerId', 'is not', null).doNothing())
        .returningAll()
        .executeTakeFirst();
      if (row) {
        // Its writer has read what they sent: it is unread for them only once the Data Team decides.
        await db.insertInto('messageReads').values({ messageId: row.id, userId: writer.id }).onConflict((conflict) => conflict.columns(['messageId', 'userId']).doNothing()).execute();
        return { request: requestOf(row), sent: true };
      }
      const already = await waiting(fields, writer);
      if (!already) throw new Error('A waiting Request was neither written nor found.');
      return { request: requestOf(already), sent: false };
    },

    async list({ subjectKind, subjectId, writerId }) {
      const rows = await db
        .selectFrom('messages')
        .selectAll()
        .where('type', 'in', ALL_REQUEST_TYPES)
        .where('subjectKind', '=', subjectKind)
        .$if(subjectId !== undefined, (query) => query.where('subjectId', '=', subjectId as string))
        .$if(writerId !== undefined, (query) => query.where('writerId', '=', writerId as string))
        .orderBy('createdAt', 'desc')
        .limit(500)
        .execute();
      const decisions =
        rows.length === 0
          ? []
          : await db.selectFrom('messages').selectAll().where('parentId', 'in', rows.map((row) => row.id)).where('type', '=', 'MSG-CNV-05').execute();
      return rows.map((row) => requestOf(row, decisions.find((decision) => decision.parentId === row.id)));
    },
  };
}
