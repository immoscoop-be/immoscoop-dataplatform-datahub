import { type Kysely, sql } from 'kysely';

/**
 * The marks a User puts on a conversation for themselves (FR-CV-19, DEC-UX-360): Follow up, Important and Starred, any of
 * them, on its first Message. Personal: nobody else reads them. A conversation deleted takes its marks with it.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('message_marks')
    .addColumn('message_id', 'uuid', (column) => column.notNull().references('messages.id').onDelete('cascade'))
    .addColumn('user_id', 'text', (column) => column.notNull())
    .addColumn('mark', 'text', (column) => column.notNull().check(sql`mark in ('followUp', 'important', 'starred')`))
    .addColumn('marked_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('message_marks_pkey', ['message_id', 'user_id', 'mark'])
    .execute();
  // The panel counts the marks of one User, and a view lists one of them.
  await db.schema.createIndex('message_marks_by_user').on('message_marks').columns(['user_id', 'mark']).execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('message_marks').execute();
}
