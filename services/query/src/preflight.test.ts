import { describe, expect, it } from 'vitest';
import { type BigQuery, BigQueryRefused, type DryRun } from './bigquery.js';
import type { QueryResource } from './catalogue.js';
import { createBeneath, preflight, rangeOf, type ResourceOfQuery } from './preflight.js';

const PROJECT = 'immoscoop-dataplatform';
const thresholds = { approve: 100_000_000, request: 1_000_000_000 };

const resource = (name: string, extra: Partial<QueryResource> = {}): QueryResource => ({
  id: `00000000-0000-4000-8000-00000000000${name.length}`,
  key: `${PROJECT}.dbt_prod_stacks.${name}`,
  displayName: name,
  collectionId: 'c1',
  level: 3,
  deprecated: false,
  partition: null,
  clusterBy: [],
  partitionFilter: 'none',
  fields: [],
  ...extra,
});

const weekly = resource('weekly_lead_volume', { partition: { field: 'week_start', unit: 'day' } });
const sources = resource('lead_sources');
const of = (...resources: QueryResource[]): ResourceOfQuery[] => resources.map((entry) => ({ named: { id: entry.id, key: entry.key, displayName: entry.displayName }, resource: entry }));

/** A BigQuery that answers dry runs from a table of answers, by the SQL, and remembers what it was asked. */
function fakeBigQuery(answer: (sql: string) => DryRun | Error): BigQuery & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async dryRun(sql) {
      asked.push(sql);
      const result = answer(sql);
      if (result instanceof Error) throw result;
      return result;
    },
    run: () => Promise.reject(new Error('not in this test')),
    page: () => Promise.reject(new Error('not in this test')),
  };
}

const dry = (bytes: number, referencedTables: string[], statementType = 'SELECT'): DryRun => ({ bytes, referencedTables, statementType, partitions: null });

async function check(sql: string, resources: ResourceOfQuery[], bigquery: BigQuery) {
  return preflight(sql, resources, { bigquery, beneath: createBeneath(bigquery), project: PROJECT, thresholds });
}

describe('the range of a query (DEC-SR-29)', () => {
  it('runs freely up to the first threshold, is approved up to the second, and goes to the Data Team above', () => {
    expect(rangeOf(100_000_000, thresholds)).toBe('free');
    expect(rangeOf(100_000_001, thresholds)).toBe('approve');
    expect(rangeOf(1_000_000_000, thresholds)).toBe('approve');
    expect(rangeOf(1_000_000_001, thresholds)).toBe('request');
  });
});

describe('the Pre-flight of a query', () => {
  it('reads its own Resources: what it reads, its range, and no problem', async () => {
    const bigquery = fakeBigQuery(() => dry(80_000_000, [weekly.key, sources.key]));
    const result = await check(
      `select * from \`${weekly.key}\` join dbt_prod_stacks.lead_sources using (lead_source) where week_start >= '2026-10-01'`,
      of(weekly, sources),
      bigquery,
    );
    expect(result).toMatchObject({ runnable: true, bytes: 80_000_000, range: 'free', problems: [], warnings: [] });
  });

  it('refuses a table that is not one of its Resources, where it stands, without asking BigQuery (DEC-UX-73)', async () => {
    const bigquery = fakeBigQuery(() => dry(1, []));
    const sql = `select * from \`${weekly.key}\` where week_start > '2026-01-01' and lead_source in (select x from \`${PROJECT}.dbt_prod_stacks.partner_contracts\`)`;
    const result = await check(sql, of(weekly), bigquery);
    expect(result.runnable).toBe(false);
    expect(result.problems).toEqual([{ kind: 'outside', name: `${PROJECT}.dbt_prod_stacks.partner_contracts`, start: sql.indexOf('`immoscoop-dataplatform.dbt_prod_stacks.partner'), end: sql.length - 1 }]);
    expect(bigquery.asked).toEqual([]);
  });

  it('refuses a table function and a table of another project written without one', async () => {
    const bigquery = fakeBigQuery(() => dry(1, []));
    const result = await check("select * from external_query('connection', 'select 1')", of(weekly), bigquery);
    expect(result.problems).toMatchObject([{ kind: 'outside', name: 'external_query' }]);
    const other = resource('leads', { key: 'other-project.dbt_prod_stacks.leads' });
    expect((await check('select * from dbt_prod_stacks.leads', of(other), bigquery)).problems).toMatchObject([{ kind: 'outside', name: 'dbt_prod_stacks.leads' }]);
  });

  it('refuses what BigQuery reads beyond its Resources and the tables beneath them, though the SQL names none', async () => {
    const view = resource('weekly_view');
    const bigquery = fakeBigQuery((sql) =>
      sql === `select * from \`${view.key}\`` ? dry(0, [`${PROJECT}.dbt_prod.leads`]) : dry(10, [`${PROJECT}.dbt_prod.leads`, `${PROJECT}.secret.salaries`]),
    );
    const result = await check(`select * from \`${view.key}\` as v`, of(view), bigquery);
    expect(result.problems).toEqual([{ kind: 'outside', name: `${PROJECT}.secret.salaries`, start: null, end: null }]);
    // A view reads the tables beneath it: they are allowed.
    const allowed = fakeBigQuery(() => dry(10, [`${PROJECT}.dbt_prod.leads`]));
    expect((await check(`select * from \`${view.key}\``, of(view), allowed)).runnable).toBe(true);
  });

  it('only reads: a change or a script is refused (TR-SR-15)', async () => {
    const bigquery = fakeBigQuery(() => dry(0, [], 'SCRIPT'));
    expect((await check(`select * from \`${sources.key}\`; select 1`, of(sources), bigquery)).problems).toEqual([{ kind: 'notSelect', statementType: 'SCRIPT' }]);
  });

  it('says what BigQuery refused, in its words', async () => {
    const bigquery = fakeBigQuery(() => new BigQueryRefused('Unrecognized name: lead_sorce at [1:8]'));
    expect((await check(`select lead_sorce from \`${sources.key}\``, of(sources), bigquery)).problems).toEqual([{ kind: 'invalid', message: 'Unrecognized name: lead_sorce at [1:8]' }]);
  });

  it('warns without a filter on the partition column, and refuses where the Resource requires one (FR-SR-40, DEC-SR-35)', async () => {
    const bigquery = fakeBigQuery(() => dry(500_000_000, [weekly.key]));
    const warned = await check(`select * from \`${weekly.key}\``, of(weekly), bigquery);
    expect(warned).toMatchObject({ runnable: true, range: 'approve', warnings: [{ kind: 'noPartitionFilter', column: 'week_start', resource: { displayName: 'weekly_lead_volume' } }] });
    // With the SQL that adds it, on its recent partitions, and what that reads.
    expect(warned.warnings[0]?.fix).toBe(`select * from \`${weekly.key}\`\nwhere week_start >= date_sub(current_date(), interval 28 day)`);
    expect(warned.warnings[0]?.bytesWithFilter).toBe(500_000_000);

    const required = { ...weekly, partitionFilter: 'dataHub' as const };
    const refused = await check(`select * from \`${weekly.key}\``, of(required), bigquery);
    expect(refused).toMatchObject({ runnable: false, problems: [{ kind: 'filterRequired', column: 'week_start' }], warnings: [] });
    // The numbers still show, next to why it cannot run.
    expect(refused.bytes).toBe(500_000_000);
  });

  it('turns the refusal of BigQuery for a missing partition filter into the same problem', async () => {
    const bigquery = fakeBigQuery(
      () => new BigQueryRefused(`Cannot query over table '${PROJECT}.dbt_prod_stacks.weekly_lead_volume' without a filter over column(s) 'week_start' that can be used for partition elimination`),
    );
    const result = await check(`select * from \`${weekly.key}\``, of({ ...weekly, partitionFilter: 'bigQuery' }), bigquery);
    expect(result.problems).toMatchObject([{ kind: 'filterRequired', column: 'week_start', resource: { id: weekly.id } }]);
  });

  it('cannot run with a Resource the User may no longer see, nor with nothing written', async () => {
    const bigquery = fakeBigQuery(() => dry(1, [sources.key]));
    const hidden: ResourceOfQuery[] = [{ named: { id: weekly.id, key: weekly.key, displayName: 'Weekly' }, resource: null }, ...of(sources)];
    const result = await check(`select * from \`${sources.key}\``, hidden, bigquery);
    expect(result.problems).toEqual([{ kind: 'notVisible', resource: { id: weekly.id, displayName: 'Weekly' } }]);
    expect((await check('  ', of(sources), bigquery)).problems).toEqual([{ kind: 'empty' }]);
  });
});

describe('the tables beneath a Resource', () => {
  it('are asked of BigQuery once in a while, and with a filter where the table requires one', async () => {
    let now = 0;
    const bigquery = fakeBigQuery((sql) =>
      sql.endsWith('`') ? new BigQueryRefused("Cannot query over table 't' without a filter over column(s) 'week_start'") : dry(0, [`${PROJECT}.dbt_prod.base`]),
    );
    const beneath = createBeneath(bigquery, 1000, () => now);
    expect(await beneath(weekly)).toEqual([weekly.key, `${PROJECT}.dbt_prod.base`]);
    expect(bigquery.asked).toEqual([`select * from \`${weekly.key}\``, `select * from \`${weekly.key}\` where week_start is null`]);
    await beneath(weekly);
    expect(bigquery.asked).toHaveLength(2);
    now = 2000;
    await beneath(weekly);
    expect(bigquery.asked).toHaveLength(4);
  });
});
