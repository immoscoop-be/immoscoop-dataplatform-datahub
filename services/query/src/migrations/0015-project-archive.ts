import { type Kysely, sql } from 'kysely';

/**
 * A User archives a Project they no longer work on (DEC-UX-354): it leaves their panel, and only theirs (DEC-UX-355),
 * so when is kept with them in it, on their row of `project_members`; null while it is in their panel. Opening it
 * again leaves it archived (DEC-UX-356).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table project_members add column archived_at timestamptz`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table project_members drop column archived_at`.execute(db);
}
