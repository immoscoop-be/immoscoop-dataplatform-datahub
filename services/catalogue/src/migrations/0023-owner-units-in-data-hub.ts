import { type Kysely, sql } from 'kysely';

/**
 * An Owner Unit is a Group kept in Data Hub (DEC-UM-10), which has no address: a Collection keeps the address of
 * the Google group it once was, if any, and none for a Group of Data Hub. Its notifications go to each member
 * (FR-UM-21).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table collections alter column owner_unit_email drop not null`.execute(db);
}
