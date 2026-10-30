import { type Kysely, sql } from 'kysely';

/**
 * Notifications (DEC-LN-02): every Message notifies at once, outside Data Hub by e-mail and in Slack.
 * `notifications` is the outbox: a trigger puts every Message in it as it is written, in the same
 * transaction, so that no way of writing one is missed; catalogue sends it right after, and again until it
 * went out or was tried often enough. `notification_deliveries` keeps what went out, an e-mail to an
 * address or a direct message to a User, so that trying again never sends anything twice. The Messages
 * written before are not notified.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('notifications')
    .addColumn('message_id', 'uuid', (column) => column.primaryKey().references('messages.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('attempts', 'integer', (column) => column.notNull().defaultTo(0))
    // When it is due: at once, and later again after a failure.
    .addColumn('next_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('done_at', 'timestamptz')
    // What went wrong the last time, for whoever reads the rows.
    .addColumn('failure', 'text')
    .execute();
  await sql`create index notifications_due on notifications (next_at) where done_at is null`.execute(db);

  await db.schema
    .createTable('notification_deliveries')
    .addColumn('message_id', 'uuid', (column) => column.notNull().references('notifications.message_id').onDelete('cascade'))
    .addColumn('channel', 'text', (column) => column.notNull().check(sql`channel in ('email', 'slack')`))
    // An e-mail address, or the fixed Google ID of a User for a direct message in Slack.
    .addColumn('address', 'text', (column) => column.notNull())
    .addColumn('sent_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('notification_deliveries_pkey', ['message_id', 'channel', 'address'])
    .execute();

  await sql`
    create function notify_message() returns trigger language plpgsql as $$
    begin
      insert into notifications (message_id) values (new.id);
      return new;
    end
    $$`.execute(db);
  await sql`create trigger messages_notify after insert on messages for each row execute function notify_message()`.execute(db);
}
