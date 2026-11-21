import type { GrainResult } from '@datahub/contracts/eda';
import { noParams, type Outcome, type ProbeContext, type RunnableProbe } from './probe.js';
import { AnswerMismatch, countOf, heading, jsonOf, onlyRow, quote, whereOf } from './sql.js';

/**
 * The grain holds (FR-ED-07, TR-ED-03): set on the fields of the grain, without parameters. One scan of the table
 * groups it by its grain values, a row with an empty grain field among them, and counts how many grain values are on
 * 1, 2, 3, or 4 rows and more, the rows with an empty grain field, and the 5 grain values on the most rows, above one.
 */
export function grainSql({ source, fields }: ProbeContext): string {
  const names = fields.map((_, index) => `g${index}`);
  const filled = names.map((name) => `${name} is not null`).join(' and ');
  const empty = names.map((name) => `${name} is null`).join(' or ');
  const twice = `${filled} and row_count > 1`;
  return `${heading('grainHolds', source)}
with grain as (
  select
    ${fields.map((field, index) => `${quote(field)} as g${index}`).join(',\n    ')},
    count(*) as row_count
  from ${quote(source.fullName)}${whereOf(source, [], '  ')}
  group by ${names.map((_, index) => index + 1).join(', ')}
)
select
  sum(row_count) as row_count,
  sum(if(${empty}, row_count, 0)) as empty_grain,
  countif(${filled}) as grain_values,
  countif(${filled} and row_count = 1) as on_one,
  countif(${filled} and row_count = 2) as on_two,
  countif(${filled} and row_count = 3) as on_three,
  countif(${filled} and row_count >= 4) as on_four_or_more,
  sum(if(${twice}, row_count, 0)) as rows_covered,
  to_json_string(array_agg(
    if(${twice}, struct([${names.map((name) => `cast(${name} as string)`).join(', ')}] as grain_value, row_count), null)
    ignore nulls order by if(${twice}, row_count, null) desc limit 5
  )) as examples
from grain`;
}

/** Its answer, one row, as the result of the table as a whole: expected when no grain value is on more than one row and none is empty. */
export function grainResults(rows: readonly Record<string, unknown>[], { fields }: ProbeContext): Outcome[] {
  const row = onlyRow(rows);
  const examples = jsonOf(row.examples) ?? [];
  if (!Array.isArray(examples)) throw new AnswerMismatch('the examples of the grain are no list');
  const data: GrainResult = {
    rows: countOf(row.row_count),
    values: countOf(row.grain_values),
    onMoreThanOne: countOf(row.on_two) + countOf(row.on_three) + countOf(row.on_four_or_more),
    rowsCovered: countOf(row.rows_covered),
    emptyGrain: countOf(row.empty_grain),
    buckets: [countOf(row.on_one), countOf(row.on_two), countOf(row.on_three), countOf(row.on_four_or_more)],
    examples: examples.slice(0, 5).map((example: { grain_value?: unknown[]; row_count?: unknown }) => ({
      values: Object.fromEntries(fields.map((field, index) => [field, (example.grain_value?.[index] as string | null | undefined) ?? null])),
      rows: countOf(example.row_count),
    })),
  };
  return [{ subject: '', data, reading: data.onMoreThanOne === 0 && data.emptyGrain === 0 ? 'expected' : 'look' }];
}

export const grainHolds: RunnableProbe = { key: 'grainHolds', params: noParams, sql: grainSql, results: grainResults };
