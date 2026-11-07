import { type Kysely, sql } from 'kysely';

/**
 * Folders in a Collection (FR-CO-38 to FR-CO-40, DEC-CO-26): a folder sits at the top of its Collection or
 * in one folder of it, as deep as needed; a Resource or a Lens of the Collection sits in at most one folder,
 * and in none at its top. A Lens is kept by query, so its place is kept here by its ID, as a Resource's is.
 * The intro of a Collection, in Markdown (FR-CO-41).
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('folders')
    .addColumn('id', 'uuid', (column) => column.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('collection_id', 'uuid', (column) => column.notNull().references('collections.id'))
    // Null at the top of the Collection; a folder with folders in it is not deleted (FR-CO-39).
    .addColumn('parent_id', 'uuid', (column) => column.references('folders.id'))
    .addColumn('name', 'text', (column) => column.notNull().check(sql`char_length(name) between 1 and 80`))
    .addColumn('created_by', 'text', (column) => column.notNull())
    .addColumn('created_by_name', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex('folders_collection').on('folders').columns(['collection_id', 'parent_id']).execute();

  // Where a Resource or a Lens sits, when it is in a folder; without a row it is at the top.
  await db.schema
    .createTable('folder_places')
    .addColumn('kind', 'text', (column) => column.notNull().check(sql`kind in ('resource', 'lens')`))
    .addColumn('item_id', 'uuid', (column) => column.notNull())
    .addColumn('folder_id', 'uuid', (column) => column.notNull().references('folders.id'))
    .addPrimaryKeyConstraint('folder_places_pkey', ['kind', 'item_id'])
    .execute();
  await db.schema.createIndex('folder_places_folder').on('folder_places').column('folder_id').execute();

  await db.schema
    .alterTable('collections')
    .addColumn('intro', 'text', (column) => column.notNull().defaultTo(''))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('collections').dropColumn('intro').execute();
  await db.schema.dropTable('folder_places').execute();
  await db.schema.dropTable('folders').execute();
}
