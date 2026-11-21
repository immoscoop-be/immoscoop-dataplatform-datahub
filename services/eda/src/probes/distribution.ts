import type { DistributionResult } from '@datahub/contracts/eda';
import type { Outcome, ProbeContext, RunnableProbe } from './probe.js';
import { AnswerMismatch, countOf, heading, jsonOf, numberOf, quote, ResultRefused, whereOf } from './sql.js';

/**
 * Distribution of numbers (FR-ED-10, DEC-ED-24, TR-ED-03): set on the numbers among the Key Fields and any other
 * number, each with its own result. Per field the rows with a value, the lowest, P25, the median, P75, P95, the
 * highest and the mean, by `APPROX_QUANTILES`; bins of a round width, about twelve of them up to P95, and everything
 * from there in one open bin, the tail.
 *
 * Its parameters: `width` and `tailFrom`, the width of a bin and where the tail starts, which the User may give
 * instead of Data Hub's: one number for every field, or one per field, `{ [field]: number }`.
 */

/** The round widths of a bin, times a power of ten (TR-ED-03): 1, 2, 5, 10, 20, 25, 50 or 100. */
export const ROUND = [1, 2, 2.5, 5, 10] as const;
/** About this many bins reach P95 (DEC-ED-24). */
export const BINS = 12;
/** More bins than this are no picture of a distribution. */
export const MAX_BINS = 1000;

type Given = number | Record<string, number>;

function given(value: Given | undefined, field: string): number | null {
  if (value === undefined) return null;
  return typeof value === 'number' ? value : (value[field] ?? null);
}

function distributionParams(params: Record<string, unknown>, _source: unknown, fields: string[]): Record<string, unknown> | string {
  const kept: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(params)) {
    if (name !== 'width' && name !== 'tailFrom') return `Distribution of numbers has no parameter ${name}.`;
    const values = typeof value === 'number' ? [value] : typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.values(value) : null;
    if (!values || !values.every((one) => typeof one === 'number' && Number.isFinite(one))) {
      return `${name} is a number, or a number per field: { "field": number }.`;
    }
    if (name === 'width' && values.some((one) => (one as number) <= 0)) return 'The width of a bin is above 0.';
    if (typeof value === 'object') {
      const stranger = Object.keys(value as object).find((field) => !fields.includes(field));
      if (stranger) return `${name} is given for ${stranger}, which this EDA-Probe is not set on.`;
    }
    kept[name] = value;
  }
  return kept;
}

/** A number written for BigQuery, as FLOAT64. */
const float = (value: number | null) => (value === null ? 'cast(null as float64)' : `cast(${String(value)} as float64)`);

/**
 * Two passes over its fields, beside each other: the first gives the quantiles, from which the width of a bin and
 * the start of the tail follow, unless given; the second counts the rows per bin and in the tail. The bins start at
 * 0, or at a round number at or below the lowest when it is below 0.
 */
export function distributionSql({ source, fields, params }: ProbeContext): string {
  const values = fields.map((field, index) => `struct(${index} as field_index, cast(${quote(field)} as float64) as v)`);
  const choices = fields.map(
    (field, index) => `struct(${index} as field_index, ${float(given(params.width as Given | undefined, field))} as width, ${float(given(params.tailFrom as Given | undefined, field))} as tail_from)`,
  );
  return `${heading('distributionOfNumbers', source)}
with base as (
  select eda_value.field_index, eda_value.v
  from ${quote(source.fullName)}
  cross join unnest([
    ${values.join(',\n    ')}
  ]) as eda_value${whereOf(source, [], '  ')}
),
chosen as (
  select * from unnest([
    ${choices.join(',\n    ')}
  ])
),
stats as (
  select field_index, count(v) as value_count, min(v) as low, max(v) as high, avg(v) as mean, approx_quantiles(v, 100) as q
  from base
  group by field_index
),
reach as (
  select
    field_index, value_count, low, high, mean,
    q[safe_offset(25)] as p25, q[safe_offset(50)] as median, q[safe_offset(75)] as p75, q[safe_offset(95)] as p95,
    chosen.width as chosen_width, chosen.tail_from as chosen_tail,
    coalesce(chosen.tail_from, q[safe_offset(95)]) - least(0, low) as span
  from stats
  join chosen using (field_index)
),
sized as (
  select
    *,
    coalesce(chosen_width, if(span > 0, (
      select candidate
      from unnest([${ROUND.map((step) => step.toFixed(1)).join(', ')}]) as step
      cross join unnest([step * pow(10, floor(log10(span / ${BINS})))]) as candidate
      order by abs(ceil(span / candidate) - ${BINS}), candidate desc
      limit 1
    ), 1)) as width
  from reach
),
bounded as (
  select
    *,
    coalesce(chosen_tail, start + greatest(1, ceil((p95 - start) / width - 1e-9)) * width) as tail_from
  from (select *, if(low < 0, floor(low / width) * width, 0) as start from sized) as placed
),
binned as (
  select
    field_index,
    if(v >= tail_from, -1, cast(floor((v - start) / width + 1e-9) as int64)) as bin,
    count(*) as bin_rows
  from base
  join bounded using (field_index)
  where v is not null
  group by 1, 2
),
per_field as (
  select field_index, to_json_string(array_agg(struct(bin, bin_rows) order by bin)) as bins
  from binned
  group by 1
)
select
  field_index, value_count, low, p25, median, p75, p95, high, mean, width, tail_from, start, per_field.bins
from bounded
left join per_field using (field_index)
order by field_index`;
}

/** Its answer, a row per field, as a result per field: always for you to judge, as a shape is neither right nor wrong. */
export function distributionResults(rows: readonly Record<string, unknown>[], { fields }: ProbeContext): Outcome[] {
  const byIndex = new Map(rows.map((row) => [countOf(row.field_index), row]));
  return fields.map((field, index) => {
    const row = byIndex.get(index) ?? {};
    const width = numberOf(row.width) ?? 1;
    const start = numberOf(row.start) ?? 0;
    const tailFrom = numberOf(row.tail_from) ?? start;
    const count = width > 0 && tailFrom > start ? Math.ceil((tailFrom - start) / width - 1e-9) : 0;
    if (count > MAX_BINS) throw new ResultRefused(`The width of a bin gives ${count} bins for ${field}; choose a wider one, at most ${MAX_BINS} bins.`);
    const bins = new Array<number>(count).fill(0);
    let tail = 0;
    const counted = jsonOf(row.bins) ?? [];
    if (!Array.isArray(counted)) throw new AnswerMismatch('the bins of a distribution are no list');
    for (const entry of counted as { bin?: unknown; bin_rows?: unknown }[]) {
      const bin = countOf(entry.bin);
      const binRows = countOf(entry.bin_rows);
      if (bin < 0) tail += binRows;
      else if (count > 0) bins[Math.min(bin, count - 1)] = (bins[Math.min(bin, count - 1)] ?? 0) + binRows;
      else tail += binRows;
    }
    const data: DistributionResult = {
      rows: countOf(row.value_count),
      low: numberOf(row.low) ?? 0,
      p25: numberOf(row.p25) ?? 0,
      median: numberOf(row.median) ?? 0,
      p75: numberOf(row.p75) ?? 0,
      p95: numberOf(row.p95) ?? 0,
      high: numberOf(row.high) ?? 0,
      mean: numberOf(row.mean) ?? 0,
      width,
      tailFrom,
      start,
      bins,
      tail,
    };
    return { subject: field, data, reading: 'judge' };
  });
}

export const distributionOfNumbers: RunnableProbe = {
  key: 'distributionOfNumbers',
  params: distributionParams,
  sql: distributionSql,
  results: distributionResults,
};
