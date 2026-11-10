import { type Kysely, sql } from 'kysely';

/**
 * Groups kept in Data Hub (DEC-UM-10, TR-UM-01): a Group is a set of Users, managed by another Group or by
 * itself, no longer a Google group. A member is kept by address, so that a colleague who has not signed in
 * yet can be one (OP-UX-70). The Google groups identity last read for a User stay as `workspace_groups`, so
 * that the Owner Units of the Collections can move once, with their members of that day (TR-UM-04).
 * `active` replaces the empty list of Groups that marked a User whose account is no longer active.
 * The Permission groups to start with get the two Permissions of Groups (DEC-UX-201).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('groups')
    // A random UUID for a new Group; the Google ID for one moved from Google, so that its Collections keep it.
    .addColumn('id', 'text', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
    .addColumn('sentence', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(sentence) <= 200`))
    // The Group whose members change this one: another Group, or the Group itself.
    .addColumn('managed_by', 'text', (column) => column.notNull().references('groups.id'))
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('created_by_id', 'text')
    .addColumn('created_by_name', 'text')
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    // A deleted Group keeps its row: its identifier is never reused, and its history stays (FR-UM-16).
    .addColumn('deleted_at', 'timestamptz')
    .addColumn('deleted_by_id', 'text')
    .addColumn('deleted_by_name', 'text')
    .execute();
  await sql`create unique index groups_name on groups (lower(name)) where deleted_at is null`.execute(db);
  await sql`create index groups_managed_by on groups (managed_by) where deleted_at is null`.execute(db);

  await db.schema
    .createTable('group_members')
    .addColumn('group_id', 'text', (column) => column.notNull().references('groups.id').onDelete('cascade'))
    .addColumn('email', 'text', (column) => column.notNull().check(sql`email = lower(email)`))
    .addColumn('added_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('added_by_id', 'text')
    .addColumn('added_by_name', 'text')
    .addPrimaryKeyConstraint('group_members_pkey', ['group_id', 'email'])
    .execute();
  await sql`create index group_members_email on group_members (email)`.execute(db);

  await db.schema
    .createTable('group_log')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('group_id', 'text', (column) => column.notNull().references('groups.id').onDelete('cascade'))
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('by_id', 'text')
    .addColumn('by_name', 'text')
    .addColumn('detail', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .execute();
  await sql`create index group_log_group on group_log (group_id, at desc)`.execute(db);

  await db.schema
    .alterTable('users')
    .addColumn('active', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('workspace_groups', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .execute();
  // Inactive: a session ended because the account was no longer active, after their last sign-in.
  await sql`update users set workspace_groups = groups, active = not exists (
      select 1 from sessions where sessions.google_id = users.google_id
        and sessions.end_reason = 'account-inactive' and sessions.ended_at > users.last_login_at)`.execute(db);
  // The claim now holds the Groups of Data Hub: none until the Owner Units moved.
  await sql`update users set groups = '{}'`.execute(db);
  await sql`create index users_email on users (lower(email))`.execute(db);

  await sql`update permission_groups set permissions = permissions || ${JSON.stringify({
    'groups.manage': { on: true, values: {} },
    'groups.all.manage': { on: true, values: {} },
  })}::jsonb where starting = 'admin'`.execute(db);
  await sql`update permission_groups set permissions = permissions || ${JSON.stringify({
    'groups.manage': { on: true, values: {} },
    'groups.all.manage': { on: false, values: {} },
  })}::jsonb where starting = 'businessAnalyst' and not permissions ? 'groups.manage'`.execute(db);
}
