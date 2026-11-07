import { describe, expect, it } from 'vitest';
import { missingIn, missingOf } from './broken.js';
import type { Preflight } from './preflight.js';

describe('what a Lens misses, in the words of BigQuery (FR-LE-17)', () => {
  it('is a table, a view or a dataset that is not found, named as a table is', () => {
    expect(missingOf('Not found: Table immoscoop-dataplatform:dbt_prod_stacks.weekly_lead_volume was not found in location europe-west1')).toEqual({
      kind: 'table',
      name: 'immoscoop-dataplatform.dbt_prod_stacks.weekly_lead_volume',
    });
    expect(missingOf('Not found: View immoscoop-dataplatform:dbt_prod_stacks.leads was not found in location EU')).toMatchObject({ kind: 'table' });
    expect(missingOf('Not found: Dataset immoscoop-dataplatform:dbt_old was not found in location EU')).toEqual({ kind: 'table', name: 'immoscoop-dataplatform.dbt_old' });
  });

  it('is a column that is not found', () => {
    expect(missingOf('Unrecognized name: lead_source at [1:93]')).toEqual({ kind: 'column', name: 'lead_source' });
    expect(missingOf('Name channel not found inside l at [3:12]')).toEqual({ kind: 'column', name: 'channel' });
    expect(missingOf('Field name lead_type does not exist in STRUCT<a INT64>')).toEqual({ kind: 'column', name: 'lead_type' });
  });

  it('is nothing for any other refusal, which is no reason to call a Lens Broken', () => {
    expect(missingOf('Syntax error: Unexpected keyword FROM at [1:8]')).toBeNull();
    expect(missingOf('Access Denied: Table x:y.z: User does not have permission')).toBeNull();
  });

  it('is read from the Pre-flight, when BigQuery refused it', () => {
    const preflight = (message: string) => ({ problems: [{ kind: 'invalid', message }] }) as unknown as Preflight;
    expect(missingIn(preflight('Unrecognized name: week_start at [1:8]'))).toEqual({ kind: 'column', name: 'week_start' });
    expect(missingIn(preflight('Syntax error'))).toBeNull();
    expect(missingIn({ problems: [{ kind: 'empty' }] } as unknown as Preflight)).toBeNull();
  });
});
