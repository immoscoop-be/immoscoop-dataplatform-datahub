import { type Kysely, sql } from 'kysely';

/**
 * Two additions to every Permission group (DEC-PL-08, DEC-UX-213). Taking a Resource out of its Collection becomes a
 * Permission of its own, `resources.remove`: a group that adds Resources to Collections (`resources.assign`) gets it
 * for every Resource, as before; a group that only publishes them (`resources.publish`) gets it for those of their
 * Owner Units, while not published; any other group not. Admin gets the fifth tool of Admin, Withdrawn.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const remove = (on: boolean, reach: 'every' | 'theirs') => JSON.stringify({ 'resources.remove': { on, values: { reach } } });
  const isOn = (key: string) => sql`(permissions -> ${key} ->> 'on') = 'true'`;
  await sql`update permission_groups set permissions = permissions || ${remove(true, 'every')}::jsonb
    where not permissions ? 'resources.remove' and ${isOn('resources.assign')}`.execute(db);
  await sql`update permission_groups set permissions = permissions || ${remove(true, 'theirs')}::jsonb
    where not permissions ? 'resources.remove' and ${isOn('resources.publish')}`.execute(db);
  await sql`update permission_groups set permissions = permissions || ${remove(false, 'theirs')}::jsonb
    where not permissions ? 'resources.remove'`.execute(db);
  await sql`update permission_groups
    set permissions = jsonb_set(permissions, '{admin.open,values,tools}', (permissions #> '{admin.open,values,tools}') || '["withdrawn"]'::jsonb)
    where starting = 'admin' and not (permissions #> '{admin.open,values,tools}') ? 'withdrawn'`.execute(db);
}
