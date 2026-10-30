import { type Kysely, sql } from 'kysely';

/**
 * The Groups and roles of a User as identity last read them from Workspace, at their sign-in or at the
 * renewal of their Access Token (DEC-LN-07): catalogue asks which members of an Owner Unit, or of the
 * Data Team, Data Hub knows, to notify each of them in Slack. A User whose account is no longer active
 * keeps none.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('groups', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .addColumn('roles', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`))
    .execute();
  await sql`create index users_groups on users using gin (groups)`.execute(db);
}
