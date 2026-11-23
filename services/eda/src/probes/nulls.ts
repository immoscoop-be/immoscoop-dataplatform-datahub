import type { DataHubReading, NullsResult } from '@datahub/contracts/eda';
import { noParams, type Outcome, type ProbeContext, type RunnableProbe } from './probe.js';
import { countOf, heading, onlyRow, quote, whereOf } from './sql.js';

/**
 * Nulls per Key Field (FR-ED-08, DEC-ED-22, TR-ED-03): set on every Key Field, without parameters. One scan of the
 * table counts its rows, and per field the rows where it is empty.
 */
export function nullsSql(context: ProbeContext): string {
  const { source, fields } = context;
  return `${heading('nullsPerKeyField', source)}
select
  count(*) as row_count,
  ${fields.map((field, index) => `countif(${quote(field)} is null) as empty_${index}`).join(',\n  ')}
from ${quote(source.fullName)}${whereOf(context)}`;
}

/**
 * Its answer, one row, as a result per field: expected without empty values; for you to judge with some, as Data Hub
 * invents no share that is too much; look at this with some in a field that holds a role of its model type, which
 * cannot be empty (DEC-ED-22).
 */
export function nullsResults(rows: readonly Record<string, unknown>[], { source, fields }: ProbeContext): Outcome[] {
  const row = onlyRow(rows);
  return fields.map((field, index) => {
    const role = source.resource.fields.find((candidate) => candidate.name === field)?.role ?? null;
    const data: NullsResult = { rows: countOf(row.row_count), empty: countOf(row[`empty_${index}`]), role };
    const reading: DataHubReading = data.empty === 0 ? 'expected' : role ? 'look' : 'judge';
    return { subject: field, data, reading };
  });
}

export const nullsPerKeyField: RunnableProbe = { key: 'nullsPerKeyField', params: noParams, sql: nullsSql, results: nullsResults };
