import type { CategoriesResult, CategoryWeight } from '@datahub/contracts/eda';
import { kindOf } from '@datahub/contracts/model-types';
import type { EdaSource } from '../catalogue.js';
import type { Outcome, ProbeContext, RunnableProbe } from './probe.js';
import { AnswerMismatch, countOf, heading, jsonOf, numberOf, quote, whereOf } from './sql.js';
import { addingField, addingRole } from './volume.js';

/**
 * Distribution of categories (FR-ED-17, DEC-ED-33, TR-ED-03): set on the texts among the Key Fields, mapped ones too,
 * and any other text, each with its own result. One scan of the table weighs each value of each field, by the sum of
 * the number it is weighed by or by its rows, and gives per field the 10 values that weigh most, how many values it
 * holds, the weight and number of the others, the weight of the empty values, the weight of the whole field, and how
 * many values weigh less than 0.1% of it. The values are values of the data, as the examples of The grain holds.
 *
 * Its parameter: `weighedBy`, a number that adds up (`addsUp`, or `measure` for a fact; never a unique count), or null
 * to weigh by rows. Without it, an aggregate or a fact is weighed by the field that adds up, as Volume over time counts
 * it, as a row there is a period and a group; any other model type by rows.
 */

/** How many of the heaviest values a result names (DEC-ED-33). */
export const TOP = 10;
/** A value weighs little below this share of the whole field: 0.1% (DEC-ED-33). */
export const SMALL = 0.001;

/** The number each value is weighed by: the one chosen, else the field that adds up; null for rows. */
export function weighedByOf(source: EdaSource, params: Record<string, unknown>): string | null {
  return params.weighedBy !== undefined ? (params.weighedBy as string | null) : addingField(source);
}

function categoriesParams(given: Record<string, unknown>, source: EdaSource): Record<string, unknown> | string {
  const params: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(given)) {
    if (name !== 'weighedBy') return `Distribution of categories has no parameter ${name}.`;
    if (value === null) {
      params.weighedBy = null;
      continue;
    }
    const role = addingRole(source);
    const field = source.resource.fields.find((candidate) => candidate.name === value);
    if (!role || !field || field.role !== role || kindOf(field.dataType) !== 'number') {
      return role
        ? `weighedBy is a number that holds the role ${role}, or null to weigh by rows; a unique count never adds up.`
        : 'Only an aggregate or a fact has a number that adds up: weighedBy is null, to weigh by rows.';
    }
    params.weighedBy = field.name;
  }
  return params;
}

/**
 * One scan of the table, each field beside the others: the weight of each value, an empty one among them; then per
 * field, its values ranked by weight, the heaviest first, the weights summed up into what the result holds. Only the
 * 10 heaviest values leave BigQuery, never a row.
 */
export function categoriesSql({ source, fields, params }: ProbeContext): string {
  const weighedBy = weighedByOf(source, params);
  const values = fields.map((field, index) => `struct(${index} as field_index, ${quote(field)} as v)`);
  return `${heading('distributionOfCategories', source)}
with weighed as (
  select eda_value.field_index, eda_value.v, ${weighedBy ? `coalesce(sum(${quote(weighedBy)}), 0)` : 'count(*)'} as weight
  from ${quote(source.fullName)}
  cross join unnest([
    ${values.join(',\n    ')}
  ]) as eda_value${whereOf(source, [], '  ')}
  group by 1, 2
),
ranked as (
  select
    field_index, v, weight,
    sum(weight) over (partition by field_index) as total_weight,
    if(v is null, null, row_number() over (partition by field_index order by v is null, weight desc, v)) as place
  from weighed
)
select
  field_index,
  any_value(total_weight) as total_weight,
  countif(v is not null) as value_count,
  coalesce(sum(if(v is null, weight, null)), 0) as empty_weight,
  countif(place > ${TOP}) as others_count,
  coalesce(sum(if(place > ${TOP}, weight, null)), 0) as others_weight,
  countif(v is not null and weight < ${SMALL} * total_weight) as small_count,
  to_json_string(array_agg(if(place <= ${TOP}, struct(v as value, weight), null) ignore nulls order by place)) as top
from ranked
group by field_index
order by field_index`;
}

/** Its answer, a row per field with values, as a result per field: always for you to judge, as Distribution of numbers. */
export function categoriesResults(rows: readonly Record<string, unknown>[], { source, fields, params }: ProbeContext): Outcome[] {
  const weighedBy = weighedByOf(source, params);
  const byIndex = new Map(rows.map((row) => [countOf(row.field_index), row]));
  return fields.map((field, index) => {
    const row = byIndex.get(index) ?? {};
    const total = numberOf(row.total_weight) ?? 0;
    const share = (weight: number) => (total > 0 ? weight / total : 0);
    const listed = jsonOf(row.top) ?? [];
    if (!Array.isArray(listed)) throw new AnswerMismatch('the values of a distribution of categories are no list');
    const top = listed.slice(0, TOP).map((entry: { value?: unknown; weight?: unknown } | null): CategoryWeight => {
      if (typeof entry?.value !== 'string') throw new AnswerMismatch('a value of a distribution of categories is no text');
      const weight = countOf(entry.weight);
      return { value: entry.value, weight, share: share(weight) };
    });
    const others = countOf(row.others_weight);
    const empty = countOf(row.empty_weight);
    const data: CategoriesResult = {
      weighedBy,
      total,
      values: countOf(row.value_count),
      top,
      others: { values: countOf(row.others_count), weight: others, share: share(others) },
      empty: { weight: empty, share: share(empty) },
      small: countOf(row.small_count),
    };
    return { subject: field, data, reading: 'judge' };
  });
}

export const distributionOfCategories: RunnableProbe = {
  key: 'distributionOfCategories',
  params: categoriesParams,
  sql: categoriesSql,
  results: categoriesResults,
};
