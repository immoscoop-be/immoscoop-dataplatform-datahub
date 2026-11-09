import { type Kysely, sql } from 'kysely';

/**
 * The Source Jobs Terraform named per environment until the page Webhooks became the only place they are set
 * (DEC-AR-10): dbt project ID → job ID, the table of DEC-AR-09. They are written here once, as the configuration
 * held them on 2026-11-02, so that each environment keeps following what it followed.
 */
export const TAKEN_OVER: Readonly<Record<string, ReadonlyArray<readonly [project: string, job: string]>>> = {
  uat: [
    ['9367', '322951'],
    ['17121', '748279'],
  ],
  prod: [
    ['9367', '324502'],
    ['17121', '748278'],
  ],
};

/**
 * The table source_jobs becomes the only place where the dbt projects Data Hub follows and their Source Jobs are
 * kept (TR-AR-12). A Source Job taken over from the configuration names neither the job nor who set it, so those
 * may be empty; it is written for the environment the migration job runs in (DATAHUB_ENVIRONMENT), and a job a Data
 * Admin had already chosen on the page stays. Elsewhere, such as in a test, the table starts empty.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('source_jobs')
    .alterColumn('job_name', (column) => column.dropNotNull())
    .alterColumn('set_by', (column) => column.dropNotNull())
    .alterColumn('set_by_name', (column) => column.dropNotNull())
    .execute();

  const taken = TAKEN_OVER[process.env.DATAHUB_ENVIRONMENT ?? ''] ?? [];
  for (const [project, job] of taken) {
    await sql`insert into source_jobs (project_id, job_id) values (${project}, ${job}) on conflict (project_id) do nothing`.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Rows taken over have no name; they go, as the configuration named them before.
  await sql`delete from source_jobs where set_by is null`.execute(db);
  await db.schema
    .alterTable('source_jobs')
    .alterColumn('job_name', (column) => column.setNotNull())
    .alterColumn('set_by', (column) => column.setNotNull())
    .alterColumn('set_by_name', (column) => column.setNotNull())
    .execute();
}
