import { type DigField, type DigMiddle, type DigPeriod, type DigResult, type DigValue, type DisguisedLists, roleDate, type Selection } from '@datahub/contracts/eda';
import { kindOf } from '@datahub/contracts/model-types';
import type { EdaSource } from './catalogue.js';
import { AnswerMismatch, conditionsOf, countOf, dayOf, jsonOf, numberOf, quote, whereOf } from './probes/sql.js';
import { unitOf } from './probes/volume.js';

/**
 * Dig into a selection against the rest (TR-ED-12, FR-ED-20, DEC-ED-36): one `SELECT` of aggregates only, run through
 * query as the User as an EDA-Probe is (`digInto`, TR-ED-04), that sets the rows of a selection against the other rows
 * of the table. Unlike an EDA-Probe on a selection (TR-ED-11), the selection is no filter here but a flag on every row,
 * so that both sides come from one scan: the rows selected and all rows; per period of the date the role of the model
 * type names, the same; per other Key Field that is a text, per value its rows selected and the rest; per other Key
 * Field that is a number, its median and mean among the selected rows and the rest. eda reads in TypeScript what
 * differs, whether it could be chance, and where the share of the selection breaks over time. Nothing of it is kept.
 */

/** What a dig needs to write its SQL and read its answer: the Resource, its selection, and the values that say nothing. */
export interface DigContext {
  source: EdaSource;
  /** At least one condition: the whole table has no rest to set it against. */
  selection: Selection;
  /** The lists of the Disguised nulls of the EDA, Data Hub's proposal when absent (DEC-ED-35). */
  disguised?: DisguisedLists;
}

/** Per text, the values with the most selected rows that leave BigQuery, never a row. */
export const DIG_VALUES = 50;
/** Per text, the values the result names: those that differ most. */
export const DIG_SHOWN = 5;
/** The z of a margin of 95% on both sides (DEC-ED-14). */
export const Z_95 = 1.96;
/**
 * How many times larger the mean share on one side of a break is than on the other, at least, as in the drawn example
 * (36% of the rows before, 2% after); the difference must also be beyond chance at a margin of 95% (DEC-ED-14).
 */
export const BREAK_FACTOR = 2;
/** A break leaves at least this many periods on each side. */
export const BREAK_SIDE = 2;

/** An other Key Field a dig sets against the selection, by its kind. */
interface OtherField {
  name: string;
  kind: 'text' | 'number';
}

/**
 * The other Key Fields of a dig, in the order of the Resource Card: the Key Fields no condition of the selection is on,
 * that are a text or a number. Other kinds are left out.
 */
export function otherFieldsOf({ source, selection }: Pick<DigContext, 'source' | 'selection'>): OtherField[] {
  const conditioned = new Set(selection.where.map((condition) => condition.field));
  return source.resource.fields.flatMap((field): OtherField[] => {
    if (!field.keyField || conditioned.has(field.name)) return [];
    const kind = kindOf(field.dataType);
    return kind === 'text' || kind === 'number' ? [{ name: field.name, kind }] : [];
  });
}

/** The date of a dig: the one the role of the model type names, in the unit Volume over time takes for it; null without one. */
export function digDateOf(source: EdaSource): { field: string; unit: 'day' | 'week'; period: string } | null {
  const field = roleDate(source.resource);
  if (!field) return null;
  const type = source.resource.fields.find((candidate) => candidate.name === field)?.dataType ?? null;
  const unit = unitOf(source, field);
  const day = dayOf(field, type);
  return { field, unit, period: unit === 'week' ? `date_trunc(${day}, week(monday))` : day };
}

/**
 * The SQL of a dig: one scan of the table, every partition kept, that flags each row once as selected or not, with
 * `coalesce(…, false)` so that a condition on a field without a value counts the row in the rest. Each row is then
 * counted once per part: the rows; its period; the value of each other text; the number of each other number. Then
 * one row per part and field: the counts, the middles, and the periods or the 50 values with the most selected rows
 * as JSON.
 */
export function digSql(context: DigContext): string {
  const { source } = context;
  const conditions = conditionsOf(context);
  if (conditions.length === 0) throw new RangeError('a dig takes a selection of at least one condition');
  const flag = conditions.length > 1 ? `(${conditions.join(' and ')})` : conditions.join('');
  const date = digDateOf(source);
  const others = otherFieldsOf(context);

  const facet = (part: string, index: number, text: string, number: string) =>
    `struct('${part}' as part, ${index} as field_index, ${text} as text_value, ${number} as number_value)`;
  const noText = 'cast(null as string)';
  const noNumber = 'cast(null as float64)';
  const facets = [
    facet('rows', 0, noText, noNumber),
    ...(date ? [facet('period', 0, `format_date('%F', ${date.period})`, noNumber)] : []),
    ...others.map((field, index) => (field.kind === 'text' ? facet('text', index, quote(field.name), noNumber) : facet('number', index, noText, `cast(${quote(field.name)} as float64)`))),
  ];

  return `-- Dig into a selection of ${source.resource.displayName.replace(/[\r\n]+/g, ' ')} against the rest: aggregates only (TR-ED-12)
with eda_flagged as (
  select
    coalesce(${flag}, false) as eda_selected,
    [
      ${facets.join(',\n      ')}
    ] as eda_facets
  from ${quote(source.fullName)}${whereOf({ source }, [], '  ')}
),
eda_counted as (
  select
    eda_facet.part,
    eda_facet.field_index,
    eda_facet.text_value,
    countif(eda_selected) as selected_rows,
    countif(not eda_selected) as rest_rows,
    approx_quantiles(if(eda_selected, eda_facet.number_value, null), 2)[safe_offset(1)] as selected_median,
    avg(if(eda_selected, eda_facet.number_value, null)) as selected_mean,
    approx_quantiles(if(eda_selected, null, eda_facet.number_value), 2)[safe_offset(1)] as rest_median,
    avg(if(eda_selected, null, eda_facet.number_value)) as rest_mean
  from eda_flagged
  cross join unnest(eda_facets) as eda_facet
  where eda_facet.part <> 'period' or eda_facet.text_value is not null
  group by 1, 2, 3
),
eda_ranked as (
  select *, row_number() over (partition by part, field_index order by selected_rows desc, rest_rows desc, text_value) as place
  from eda_counted
)
select
  part,
  field_index,
  sum(selected_rows) as selected_rows,
  sum(rest_rows) as rest_rows,
  any_value(selected_median) as selected_median,
  any_value(selected_mean) as selected_mean,
  any_value(rest_median) as rest_median,
  any_value(rest_mean) as rest_mean,
  to_json_string(array_agg(if(part in ('period', 'text'), struct(text_value as value, selected_rows, rest_rows), null) ignore nulls order by place)) as entries
from eda_ranked
where part <> 'text' or place <= ${DIG_VALUES}
group by 1, 2
order by 1, 2`;
}

// ----------------------------------------------------------------------------------------------------------------
// Reading the answer

/** Rows in the selection and in the rest. */
interface Split {
  selected: number;
  rest: number;
}

/**
 * Whether two shares differ beyond chance (DEC-ED-14): a test of two proportions at a margin of 95%, the share of
 * `selected` among the selected rows against that of `rest` among the other rows, with the pooled share for the
 * standard error. False when it cannot be computed: a side without rows, or no spread at all.
 */
export function isReal(of: Split, totals: Split): boolean {
  if (totals.selected <= 0 || totals.rest <= 0) return false;
  const pooled = (of.selected + of.rest) / (totals.selected + totals.rest);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totals.selected + 1 / totals.rest));
  if (!Number.isFinite(se) || se <= 0) return false;
  const z = (of.selected / totals.selected - of.rest / totals.rest) / se;
  return Math.abs(z) >= Z_95;
}

/** How many times more often a value is among the selected rows than among the rest, by share; null when the rest holds none. */
export function ratioOf(of: Split, totals: Split): number | null {
  const inRest = totals.rest > 0 ? of.rest / totals.rest : 0;
  if (inRest <= 0) return null;
  return (totals.selected > 0 ? of.selected / totals.selected : 0) / inRest;
}

/**
 * The values of a text that differ most: of those with at least one selected row, at most 5, the real ones first,
 * then by ratio, the highest first, a value only in the selection (no ratio) before all others; then by selected rows.
 */
export function differingValues(values: readonly (Split & { value: string | null })[], totals: Split): DigValue[] {
  return values
    .filter((one) => one.selected > 0)
    .map((one): DigValue => ({ value: one.value, selected: one.selected, rest: one.rest, ratio: ratioOf(one, totals), real: isReal(one, totals) }))
    .sort((a, b) => {
      if (a.real !== b.real) return a.real ? -1 : 1;
      const ratio = (one: DigValue) => one.ratio ?? Number.POSITIVE_INFINITY;
      if (ratio(a) !== ratio(b)) return ratio(b) - ratio(a);
      return b.selected - a.selected;
    })
    .slice(0, DIG_SHOWN);
}

/**
 * Where the share of the selection breaks over time: over the periods with rows, for every split with at least 2
 * periods on each side, the mean share of the selection before against after; the split where they differ most. Its
 * first period after is the break when the difference is 0.5 or more, the selection then being more or less of the
 * rows before it; otherwise there is none.
 */
export function breakOf(periods: readonly DigPeriod[]): { breakAt: string | null; before: 'more' | 'less' | null } {
  const none = { breakAt: null, before: null };
  const withRows = periods.filter((period) => period.total > 0);
  const shares = withRows.map((period) => period.selected / period.total);
  const sums = [0];
  for (const share of shares) sums.push((sums.at(-1) ?? 0) + share);
  const all = sums.at(-1) ?? 0;
  let best: { at: number; before: number; after: number } | null = null;
  for (let at = BREAK_SIDE; at <= shares.length - BREAK_SIDE; at += 1) {
    const before = (sums[at] ?? 0) / at;
    const after = (all - (sums[at] ?? 0)) / (shares.length - at);
    if (!best || Math.abs(before - after) > Math.abs(best.before - best.after)) best = { at, before, after };
  }
  if (!best) return none;
  // A break: one side holds at least twice the share of the other, and the rows say it is beyond chance.
  const high = Math.max(best.before, best.after);
  const low = Math.min(best.before, best.after);
  if (high <= 0 || high < BREAK_FACTOR * low) return none;
  const side = (list: readonly DigPeriod[]) => ({ selected: list.reduce((sum, one) => sum + one.selected, 0), total: list.reduce((sum, one) => sum + one.total, 0) });
  const before = side(withRows.slice(0, best.at));
  const after = side(withRows.slice(best.at));
  if (!isReal({ selected: before.selected, rest: after.selected }, { selected: before.total, rest: after.total })) return none;
  const start = withRows[best.at]?.start;
  return start ? { breakAt: start, before: best.before > best.after ? 'more' : 'less' } : none;
}

/** The entries of a part as JSON: a value, or a period, with its rows selected and the rest. */
function entriesOf(row: Record<string, unknown>): (Split & { value: string | null })[] {
  const listed = jsonOf(row.entries) ?? [];
  if (!Array.isArray(listed)) throw new AnswerMismatch('the entries of a dig are no list');
  return listed.map((entry: { value?: unknown; selected_rows?: unknown; rest_rows?: unknown } | null) => {
    if (entry === null || typeof entry !== 'object') throw new AnswerMismatch('an entry of a dig is no record');
    if (entry.value !== null && entry.value !== undefined && typeof entry.value !== 'string') throw new AnswerMismatch('a value of a dig is no text');
    return { value: entry.value ?? null, selected: countOf(entry.selected_rows), rest: countOf(entry.rest_rows) };
  });
}

/**
 * The answer of query as what the dig found: a row per part and field. An empty table answers no row at all, which is
 * no row selected of none.
 */
export function digResult(rows: readonly Record<string, unknown>[], context: DigContext): DigResult {
  const others = otherFieldsOf(context);
  const date = digDateOf(context.source);
  let totals: Split = { selected: 0, rest: 0 };
  let periods: DigPeriod[] = [];
  const texts = new Map<number, (Split & { value: string | null })[]>();
  const numbers = new Map<number, { selected: DigMiddle; rest: DigMiddle }>();
  for (const row of rows) {
    const index = countOf(row.field_index);
    switch (row.part) {
      case 'rows':
        totals = { selected: countOf(row.selected_rows), rest: countOf(row.rest_rows) };
        break;
      case 'period':
        if (!date) throw new AnswerMismatch('a dig without a date answered periods');
        periods = entriesOf(row).map((entry) => {
          const start = entry.value?.slice(0, 10) ?? '';
          if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new AnswerMismatch('a period of a dig has no day');
          return { start, selected: entry.selected, total: entry.selected + entry.rest };
        });
        break;
      case 'text':
        if (others[index]?.kind !== 'text') throw new AnswerMismatch('a dig answered a text for a field that is none');
        texts.set(index, entriesOf(row));
        break;
      case 'number':
        if (others[index]?.kind !== 'number') throw new AnswerMismatch('a dig answered a number for a field that is none');
        numbers.set(index, {
          selected: { median: numberOf(row.selected_median), mean: numberOf(row.selected_mean) },
          rest: { median: numberOf(row.rest_median), mean: numberOf(row.rest_mean) },
        });
        break;
      default:
        throw new AnswerMismatch(`a dig answered a part ${JSON.stringify(row.part)}`);
    }
  }
  periods.sort((a, b) => a.start.localeCompare(b.start));
  const none: DigMiddle = { median: null, mean: null };
  const fields = others.map((field, index): DigField =>
    field.kind === 'text'
      ? { field: field.name, kind: 'text', values: differingValues(texts.get(index) ?? [], totals) }
      : { field: field.name, kind: 'number', selected: numbers.get(index)?.selected ?? none, rest: numbers.get(index)?.rest ?? none },
  );
  return {
    rows: { selected: totals.selected, total: totals.selected + totals.rest },
    overTime: date ? { field: date.field, unit: date.unit, periods, ...breakOf(periods) } : null,
    fields,
  };
}
