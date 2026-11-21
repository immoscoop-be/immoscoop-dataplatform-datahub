import { type Kysely, sql } from 'kysely';

/**
 * A new Permission in every Permission group (DEC-PL-10, DEC-ED-25): `eda.use`, Explore Resources, the EDA. Only
 * Admin has it to start, so that the Data Admins try the EDA first; every other group has it off, until someone
 * switches it on in Admin.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const eda = (on: boolean) => JSON.stringify({ 'eda.use': { on, values: {} } });
  await sql`update permission_groups set permissions = permissions || ${eda(true)}::jsonb
    where starting = 'admin' and not permissions ? 'eda.use'`.execute(db);
  await sql`update permission_groups set permissions = permissions || ${eda(false)}::jsonb
    where not permissions ? 'eda.use'`.execute(db);
}
