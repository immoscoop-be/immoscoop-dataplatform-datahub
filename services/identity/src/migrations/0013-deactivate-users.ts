import { type Kysely, sql } from 'kysely';

/**
 * A User of Admin can switch another User off (FR-PL-17, DEC-PL-11): from then on they cannot sign in, in the web app,
 * through Claude or with an Excel key, until they are switched on again. Only signing in changes: what they made and
 * where they are stays. Who switched them off, and when, is kept with them.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table users
    add column deactivated_at timestamptz,
    add column deactivated_by_id text,
    add column deactivated_by_name text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table users drop column deactivated_at, drop column deactivated_by_id, drop column deactivated_by_name`.execute(db);
}
