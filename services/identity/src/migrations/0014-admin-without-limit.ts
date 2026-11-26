import { type Kysely, sql } from 'kysely';

/**
 * Admin runs without a limit (DEC-PL-12): above the ranges of one run, a Data Admin approves it themselves, after its
 * warning, instead of sending a Request to the Data Team. Admin is locked, so its Permissions change only here.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`update permission_groups
    set permissions = jsonb_set(permissions, '{runs.ranges,values,above}', '"approve"'::jsonb)
    where starting = 'admin'`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`update permission_groups
    set permissions = jsonb_set(permissions, '{runs.ranges,values,above}', '"request"'::jsonb)
    where starting = 'admin'`.execute(db);
}
