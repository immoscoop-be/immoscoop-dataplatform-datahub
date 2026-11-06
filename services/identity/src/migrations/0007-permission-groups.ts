import { STARTING_GROUPS, type StartingGroup } from '@datahub/contracts';
import { type Kysely, sql } from 'kysely';

/**
 * Permission groups (DEC-PL-01, TR-PL-04, TR-PL-08): what a User may do comes from their Permission group,
 * given in Data Hub, no longer from a Role Group. One group is the default for new Users; Admin is locked.
 * At the switch, the members of `datahub-datateam@`, as identity last read them, get Admin, every other
 * known User Business analyst, and Lens user becomes the default (DEC-PL-07). The Permissions of the
 * starting groups are those of the catalogue in contracts at the moment the migration runs.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('permission_groups')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 60`))
    .addColumn('sentence', 'text', (column) => column.notNull().defaultTo('').check(sql`char_length(sentence) <= 200`))
    .addColumn('permissions', 'jsonb', (column) => column.notNull())
    .addColumn('is_default', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('locked', 'boolean', (column) => column.notNull().defaultTo(false))
    // The starting group it was made as, so that the switch and EC-PL-03 find Admin whatever its name.
    .addColumn('starting', 'text', (column) => column.unique())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('updated_by_id', 'text')
    .addColumn('updated_by_name', 'text')
    .execute();
  await sql`create unique index permission_groups_name on permission_groups (lower(name))`.execute(db);
  await sql`create unique index permission_groups_one_default on permission_groups (is_default) where is_default`.execute(db);

  const order: StartingGroup[] = ['admin', 'businessAnalyst', 'lensUser'];
  for (const key of order) {
    const group = STARTING_GROUPS[key];
    await sql`insert into permission_groups (name, sentence, permissions, is_default, locked, starting)
      values (${group.name}, ${group.sentence}, ${JSON.stringify(group.permissions)}::jsonb, ${key === 'lensUser'}, ${key === 'admin'}, ${key})`.execute(db);
  }

  await db.schema.alterTable('users').addColumn('permission_group_id', 'uuid', (column) => column.references('permission_groups.id')).execute();
  await sql`update users set permission_group_id = (select id from permission_groups where starting = case when 'datateam' = any(users.roles) then 'admin' else 'businessAnalyst' end)`.execute(
    db,
  );
  await sql`alter table users alter column permission_group_id set not null`.execute(db);
  await db.schema.createIndex('users_permission_group').on('users').column('permission_group_id').execute();

  // Every move of a User and every change of a group: who, when, from what to what (FR-PL-07).
  await db.schema
    .createTable('permission_group_log')
    .addColumn('id', 'bigserial', (column) => column.primaryKey())
    .addColumn('at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('kind', 'text', (column) => column.notNull())
    .addColumn('google_id', 'text', (column) => column.references('users.google_id'))
    .addColumn('group_id', 'uuid')
    .addColumn('from_name', 'text')
    .addColumn('to_name', 'text')
    .addColumn('by_id', 'text')
    .addColumn('by_name', 'text')
    .addColumn('detail', 'jsonb', (column) => column.notNull().defaultTo(sql`'{}'::jsonb`))
    .execute();
  await db.schema.createIndex('permission_group_log_user').on('permission_group_log').columns(['google_id', 'at']).execute();
  await sql`insert into permission_group_log (kind, google_id, group_id, to_name, detail)
    select 'switch', u.google_id, g.id, g.name, jsonb_build_object('from', 'roles', 'roles', to_jsonb(u.roles))
    from users u join permission_groups g on g.id = u.permission_group_id`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('permission_group_log').execute();
  await db.schema.alterTable('users').dropColumn('permission_group_id').execute();
  await db.schema.dropTable('permission_groups').execute();
}
