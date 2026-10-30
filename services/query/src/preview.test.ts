import { describe, expect, it } from 'vitest';
import { type BigQuery, BigQueryRefused, type TableFacts } from './bigquery.js';
import type { QueryResource } from './catalogue.js';
import { choicesOf, chosenParameters, createStorage, partitionStart, previewSql, valuesSql, windowFilter } from './preview.js';

const WEEKLY: QueryResource = {
  id: '6f1c2b4e-8a1d-4c3e-9f20-1b2c3d4e5f60',
  key: 'immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume',
  fullName: 'immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume',
  displayName: 'Weekly lead volume',
  collectionId: 'c-credit',
  level: 3,
  deprecated: false,
  partition: { field: 'week_start', unit: 'day' },
  clusterBy: ['lead_source', 'lead_channel'],
  partitionFilter: 'none',
  fields: [
    { name: 'week_start', dataType: 'DATE', description: '', businessDescription: '' },
    { name: 'lead_source', dataType: 'STRING', description: '', businessDescription: '' },
    { name: 'lead_count', dataType: 'INT64', description: '', businessDescription: '' },
    { name: 'created_at', dataType: 'TIMESTAMP', description: '', businessDescription: '' },
    { name: 'is_partner', dataType: 'BOOL', description: '', businessDescription: '' },
  ],
  parameters: ['week_start', 'lead_count', 'created_at', 'is_partner', 'lead_source'],
};

describe('the window of a Preview (DEC-SR-39)', () => {
  it('starts at the first moment of a partition', () => {
    expect(partitionStart('20261019')).toBe('2026-10-19');
    expect(partitionStart('2026101908')).toBe('2026-10-19 08:00:00');
    expect(partitionStart('202610')).toBe('2026-10-01');
    expect(partitionStart('2026')).toBe('2026-01-01');
    expect(partitionStart('__NULL__')).toBeNull();
  });

  it('filters from its newest partitions that hold rows, or back from today where Data Hub cannot tell', () => {
    expect(windowFilter('week_start', 'DATE', 'day', '2026-09-28', 4)).toBe("`week_start` >= DATE '2026-09-28'");
    expect(windowFilter('created_at', 'TIMESTAMP', 'hour', '2026-10-19 08:00:00', 4)).toBe("`created_at` >= TIMESTAMP '2026-10-19 08:00:00 UTC'");
    expect(windowFilter('created_at', 'DATETIME', 'day', '2026-10-19', 1)).toBe("`created_at` >= DATETIME '2026-10-19 00:00:00'");
    expect(windowFilter('week_start', 'DATE', 'day', null, 12)).toBe('`week_start` >= date_sub(current_date(), interval 12 DAY)');
    expect(windowFilter('created_at', 'TIMESTAMP', 'month', null, 4)).toBe('`created_at` >= timestamp(date_sub(current_date(), interval 4 MONTH))');
    expect(windowFilter('bucket', 'INT64', null, null, 4)).toBeNull();
  });
});

describe('the choices of a Preview (FR-SR-38)', () => {
  it('are its first cluster column, then the Parameters of its Card, of types it can offer', () => {
    expect(choicesOf(WEEKLY).map(({ field, role, kind }) => [field, role, kind])).toEqual([
      ['lead_source', 'cluster', 'choice'],
      ['lead_count', 'parameter', 'number'],
      ['is_partner', 'parameter', 'yesno'],
    ]);
  });

  it('read their values from the partitions of the window, at most 100 each (DEC-SR-37)', () => {
    const sql = valuesSql(WEEKLY, "`week_start` >= DATE '2026-09-28'", choicesOf(WEEKLY).slice(0, 1));
    expect(sql).toBe(
      "select array_agg(distinct `lead_source` ignore nulls order by `lead_source` limit 100) as `lead_source`\nfrom `immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume`\nwhere `week_start` >= DATE '2026-09-28'",
    );
  });

  it('take a value of their column, never SQL', () => {
    const choices = choicesOf(WEEKLY);
    expect(chosenParameters(choices, { lead_source: 'app', lead_count: '12', is_partner: 'true' })).toEqual([
      { name: 'lead_source', kind: 'choice', value: 'app', list: ['app'] },
      { name: 'lead_count', kind: 'number', value: '12' },
      { name: 'is_partner', kind: 'yesno', value: true },
    ]);
    expect(chosenParameters(choices, { lead_source: null })).toEqual([]);
    expect(chosenParameters(choices, { lead_count: '1 or true' })).toBe('1 or true is not a value of lead_count.');
    expect(chosenParameters(choices, { week_start: '2026-10-19' })).toBe('A Preview of this Resource offers no choice by week_start.');
    expect(chosenParameters(choices, ['app'])).toMatch(/an object/);
  });
});

describe('the SQL of a Preview', () => {
  it('reads its fields within its window and choices, newest first, at most 1000 rows', () => {
    expect(previewSql(WEEKLY, "`week_start` >= DATE '2026-09-28'", ['lead_source'])).toBe(
      [
        'select `week_start`, `lead_source`, `lead_count`, `created_at`, `is_partner`',
        'from `immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume`',
        "where `week_start` >= DATE '2026-09-28'\n  and `lead_source` = @lead_source",
        'order by `week_start` desc',
        'limit 1000',
      ].join('\n'),
    );
    expect(previewSql({ ...WEEKLY, partition: null }, null, [])).not.toContain('where');
  });
});

describe('the size and partitions of a Resource (FR-SR-39)', () => {
  const facts = (extra: Partial<TableFacts>): TableFacts => ({ type: 'TABLE', bytes: 10, rows: 1, partitions: null, partitionField: null, modifiedAt: null, ...extra });
  function fake(tables: Record<string, TableFacts>, partitions: string[] | Error = []) {
    const asked: string[] = [];
    const bigquery = {
      async table(key: string) {
        asked.push(key);
        const found = tables[key];
        if (!found) throw new BigQueryRefused(`Not found: Table ${key}`);
        return found;
      },
      async partitions() {
        asked.push('partitions');
        if (partitions instanceof Error) throw partitions;
        return partitions;
      },
    } as unknown as BigQuery;
    return { bigquery, asked };
  }

  it('are those of its table, kept a few minutes', async () => {
    const { bigquery, asked } = fake({ [WEEKLY.key]: facts({ bytes: 4_200_000_000, partitions: 312, partitionField: 'week_start' }) }, ['20261019', '20261012', '20261005', '20260928']);
    const storage = createStorage(bigquery, async () => []);
    expect(await storage.of(WEEKLY)).toMatchObject({ key: WEEKLY.key, bytes: 4_200_000_000, partitions: 312 });
    expect(await storage.newest(WEEKLY, 4)).toBe('2026-09-28');
    // Fewer partitions than the window: all of them.
    expect(await storage.newest(WEEKLY, 12)).toBe('2026-09-28');
    expect(asked.filter((what) => what === WEEKLY.key)).toHaveLength(1);
  });

  it('are those of the table beneath a view, partitioned on the same column', async () => {
    const base = 'immoscoop-dataplatform.dbt_prod.leads';
    const { bigquery } = fake({ [WEEKLY.key]: facts({ type: 'VIEW', bytes: 0 }), [base]: facts({ bytes: 9, partitions: 40, partitionField: 'week_start' }), 'p.d.other': facts({}) });
    const storage = createStorage(bigquery, async () => [WEEKLY.key, 'p.d.other', base]);
    expect(await storage.of(WEEKLY)).toMatchObject({ key: base, partitions: 40 });
  });

  it('say nothing of the newest partitions where BigQuery does not tell them', async () => {
    const { bigquery } = fake({ [WEEKLY.key]: facts({ partitionField: 'week_start' }) }, new BigQueryRefused('Access Denied'));
    expect(await createStorage(bigquery, async () => []).newest(WEEKLY, 4)).toBeNull();
  });
});
