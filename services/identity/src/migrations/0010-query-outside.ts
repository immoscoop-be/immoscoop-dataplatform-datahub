import { type Kysely, sql } from 'kysely';

/**
 * A new Permission in every Permission group (DEC-PL-09): `queries.outside`, querying the tables Data Hub knows that
 * are no Resource, for power users (FR-SR-56). Only Admin has it to start; every other group has it off, until
 * someone switches it on in Admin.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const outside = (on: boolean) => JSON.stringify({ 'queries.outside': { on, values: {} } });
  await sql`update permission_groups set permissions = permissions || ${outside(true)}::jsonb
    where starting = 'admin' and not permissions ? 'queries.outside'`.execute(db);
  await sql`update permission_groups set permissions = permissions || ${outside(false)}::jsonb
    where not permissions ? 'queries.outside'`.execute(db);
}
