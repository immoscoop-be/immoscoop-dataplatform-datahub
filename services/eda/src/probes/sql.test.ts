import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { AnswerMismatch, countOf, dayOf, everyPartition, jsonOf, numberOf, quote, whereOf } from './sql.js';

describe('what the SQL of every EDA-Probe shares (TR-ED-03)', () => {
  it('quotes a field, and the full name of a table as one name', () => {
    expect(quote('lead_count')).toBe('`lead_count`');
    expect(quote('immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume')).toBe('`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume`');
    expect(quote('odd`name')).toBe('`odd\\`name`');
  });

  it('keeps every partition of a table that requires a filter, naming its column, in the type of the column', () => {
    expect(everyPartition(WEEKLY)).toBe("(`week_start` is null or `week_start` >= date '0001-01-01')");
    // A table that requires none reads every partition without a filter.
    expect(everyPartition(LEADS)).toBeNull();
    const required = (field: string, dataType: string | null, unit = 'day') => ({
      ...LEADS,
      partition: { field, unit },
      partitionFilter: 'bigQuery' as const,
      resource: { ...LEADS.resource, fields: [...LEADS.resource.fields, { name: 'other', dataType, keyField: false, role: null, grain: false, mapped: false }] },
    });
    expect(everyPartition(required('created_at', null))).toBe("(`created_at` is null or `created_at` >= timestamp '0001-01-01 00:00:00+00')");
    expect(everyPartition(required('other', 'DATETIME'))).toContain(">= datetime '0001-01-01 00:00:00'");
    expect(everyPartition(required('other', 'INT64'))).toContain('>= -9223372036854775808');
    expect(everyPartition(required('_PARTITIONTIME', null))).toContain("`_PARTITIONTIME` >= timestamp '0001-01-01 00:00:00+00'");
    expect(everyPartition(required('_PARTITIONDATE', null))).toContain(">= date '0001-01-01'");
  });

  it('puts that filter and its own conditions in one where', () => {
    expect(whereOf(WEEKLY, ['x is not null'], '  ')).toBe("\n  where (`week_start` is null or `week_start` >= date '0001-01-01')\n    and x is not null");
    expect(whereOf(LEADS)).toBe('');
  });

  it('takes the day of a moment in Brussels', () => {
    expect(dayOf('created_at', 'TIMESTAMP')).toBe("date(`created_at`, 'Europe/Brussels')");
    expect(dayOf('seen_at', 'DATETIME')).toBe('date(`seen_at`)');
    expect(dayOf('week_start', 'DATE')).toBe('`week_start`');
  });

  it('reads numbers as BigQuery writes them, as text', () => {
    expect(numberOf('413')).toBe(413);
    expect(numberOf('35.25')).toBe(35.25);
    expect(numberOf(7)).toBe(7);
    expect(numberOf(null)).toBeNull();
    expect(countOf(null)).toBe(0);
    expect(() => numberOf('many')).toThrow(AnswerMismatch);
    expect(jsonOf('[{"bin":"1"}]')).toEqual([{ bin: '1' }]);
    expect(jsonOf([1])).toEqual([1]);
    expect(() => jsonOf('[')).toThrow(AnswerMismatch);
  });
});
