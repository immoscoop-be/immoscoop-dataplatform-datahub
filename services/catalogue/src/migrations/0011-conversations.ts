import { type Kysely, sql } from 'kysely';

/**
 * Conversations (FR-CV-01 to FR-CV-09): a reply is a Message on the same object, under the Message it
 * answers; a Message keeps when its conversation last moved and by whom, for the Message Centre; each
 * User marks a conversation read; and what query tells about its Lenses, so that catalogue knows who may
 * see the Messages on a Lens (FR-CV-05, DEC-CO-16) without asking query back.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('messages')
    // A reply, or the decision on a Request, under the Message it answers; null for a conversation's first Message.
    .addColumn('parent_id', 'uuid', (column) => column.references('messages.id'))
    // When the conversation last moved, and who moved it: null for Data Hub itself.
    .addColumn('last_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('last_writer_id', 'text')
    .execute();
  await sql`update messages set last_at = created_at, last_writer_id = writer_id`.execute(db);
  await db.schema.createIndex('messages_parent').on('messages').columns(['parent_id', 'created_at']).execute();
  await db.schema.createIndex('messages_last').on('messages').column('last_at').execute();
  // Data Hub sends one Request at a time on a Lens that grew into very large (MSG-LEN-03).
  await sql`create unique index messages_one_waiting_growth on messages (subject_id) where type = 'MSG-LEN-03' and state = 'waiting'`.execute(db);

  // Until when a User read a conversation: it is unread again when someone else moves it later.
  await db.schema
    .createTable('message_reads')
    .addColumn('message_id', 'uuid', (column) => column.notNull().references('messages.id'))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('read_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('message_reads_pkey', ['message_id', 'user_id'])
    .execute();

  // What query tells about each Lens it keeps (DEC-PF-30): enough to decide who sees it, and its current name.
  await db.schema
    .createTable('lenses')
    .addColumn('id', 'uuid', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull())
    .addColumn('collection_id', 'uuid', (column) => column.notNull())
    .addColumn('resource_ids', sql`text[]`, (column) => column.notNull())
    .addColumn('state', 'text', (column) => column.notNull().check(sql`state in ('published', 'waiting', 'stopped', 'refused')`))
    .addColumn('author_id', 'text', (column) => column.notNull())
    .addColumn('author_name', 'text', (column) => column.notNull())
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('lenses').execute();
  await db.schema.dropTable('message_reads').execute();
  await db.schema.dropIndex('messages_one_waiting_growth').execute();
  await db.schema.dropIndex('messages_last').execute();
  await db.schema.dropIndex('messages_parent').execute();
  await db.schema.alterTable('messages').dropColumn('last_writer_id').dropColumn('last_at').dropColumn('parent_id').execute();
}
