import { type Kysely, sql } from 'kysely';

/**
 * Every Known Gap of a Resource becomes an item of its own, with who added it and when (FR-RC-21, DEC-UX-170), so
 * that the Owner and the Data Team add, change or remove one at a time. The gaps of before move over in their order,
 * without anyone who added them.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('known_gaps')
    .addColumn('id', 'bigint', (column) => column.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('resource_id', 'uuid', (column) => column.notNull().references('resources.id').onDelete('cascade'))
    .addColumn('text', 'text', (column) => column.notNull().check(sql`char_length(text) between 1 and 1000`))
    // The fixed Google ID and the name of whoever added it, and when; null for a gap of before.
    .addColumn('added_by', 'text')
    .addColumn('added_by_name', 'text')
    .addColumn('added_at', 'timestamptz')
    .execute();
  await db.schema.createIndex('known_gaps_of_resource').on('known_gaps').columns(['resource_id', 'id']).execute();
  await sql`
    insert into known_gaps (resource_id, text)
    select resource.id, btrim(gap.text)
    from resources resource cross join lateral unnest(resource.known_gaps) with ordinality as gap(text, place)
    where btrim(gap.text) <> ''
    order by resource.id, gap.place`.execute(db);
  await db.schema.alterTable('resources').dropColumn('known_gaps').execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('resources').addColumn('known_gaps', sql`text[]`, (column) => column.notNull().defaultTo(sql`'{}'`)).execute();
  await sql`
    update resources resource set known_gaps = gaps.texts
    from (select resource_id, array_agg(text order by id) as texts from known_gaps group by resource_id) gaps
    where gaps.resource_id = resource.id`.execute(db);
  await db.schema.dropTable('known_gaps').execute();
}
