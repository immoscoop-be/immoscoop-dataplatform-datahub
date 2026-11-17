import { describe, expect, it } from 'vitest';
import { columnsOf, createTableSchemas, SchemasUnavailable, typeOf } from './table-schemas.js';

describe('the columns of a table from BigQuery (EC-AR-06, TR-AR-15)', () => {
  it('names the types as GoogleSQL and the catalog of dbt do', () => {
    expect(typeOf({ name: 'id', type: 'INTEGER' })).toBe('INT64');
    expect(typeOf({ name: 'rate', type: 'FLOAT' })).toBe('FLOAT64');
    expect(typeOf({ name: 'active', type: 'BOOLEAN' })).toBe('BOOL');
    expect(typeOf({ name: 'day', type: 'DATE' })).toBe('DATE');
    expect(typeOf({ name: 'code', type: 'STRING', maxLength: '10' })).toBe('STRING(10)');
    expect(typeOf({ name: 'amount', type: 'NUMERIC', precision: '10', scale: '2' })).toBe('NUMERIC(10, 2)');
    expect(typeOf({ name: 'tags', type: 'STRING', mode: 'REPEATED' })).toBe('ARRAY<STRING>');
    expect(typeOf({ name: 'address', type: 'RECORD', fields: [{ name: 'city', type: 'STRING' }, { name: 'zip', type: 'INTEGER' }] })).toBe('STRUCT<city STRING, zip INT64>');
  });

  it('lists the columns in their order, the fields of a record right after it as parent.child', () => {
    expect(
      columnsOf([
        { name: 'companyId', type: 'STRING', description: 'The company.' },
        { name: 'address', type: 'RECORD', fields: [{ name: 'city', type: 'STRING' }] },
        { name: 'scoopStartDate', type: 'DATE' },
      ]),
    ).toEqual([
      { name: 'companyId', position: 1, dataType: 'STRING', description: 'The company.' },
      { name: 'address', position: 2, dataType: 'STRUCT<city STRING>', description: '' },
      { name: 'address.city', position: 3, dataType: 'STRING', description: '' },
      { name: 'scoopStartDate', position: 4, dataType: 'DATE', description: '' },
    ]);
  });

  it('reads only the schema of the table, with an access token', async () => {
    const asked: { url: string; authorization: string | null }[] = [];
    const schemas = createTableSchemas(
      async () => 'token',
      async (url, init) => {
        asked.push({ url: String(url), authorization: new Headers(init?.headers).get('authorization') });
        return Response.json({ schema: { fields: [{ name: 'scoopStartDate', type: 'DATE' }] } });
      },
    );
    expect(await schemas.columns({ project: 'p', dataset: 'dbt_prod_DIGICOMM', table: 'mrt_reports_digicomm_io__companies' })).toEqual([
      { name: 'scoopStartDate', position: 1, dataType: 'DATE', description: '' },
    ]);
    expect(asked).toEqual([
      { url: 'https://bigquery.googleapis.com/bigquery/v2/projects/p/datasets/dbt_prod_DIGICOMM/tables/mrt_reports_digicomm_io__companies?fields=schema', authorization: 'Bearer token' },
    ]);
  });

  it('knows no columns of a table BigQuery does not have or may not show', async () => {
    for (const status of [404, 403]) {
      const schemas = createTableSchemas(async () => 'token', async () => Response.json({ error: { message: 'Not found' } }, { status }));
      expect(await schemas.columns({ project: 'p', dataset: 'd', table: 't' })).toBeUndefined();
    }
  });

  it('says so when BigQuery does not answer', async () => {
    const failing = createTableSchemas(async () => 'token', async () => Response.json({ error: { message: 'Backend error' } }, { status: 503 }));
    await expect(failing.columns({ project: 'p', dataset: 'd', table: 't' })).rejects.toThrow(SchemasUnavailable);
    await expect(failing.columns({ project: 'p', dataset: 'd', table: 't' })).rejects.toThrow('BigQuery answered 503 for p.d.t: Backend error');
    const silent = createTableSchemas(async () => 'token', async () => {
      throw new TypeError('fetch failed');
    });
    await expect(silent.columns({ project: 'p', dataset: 'd', table: 't' })).rejects.toThrow('BigQuery did not answer for p.d.t');
  });
});
