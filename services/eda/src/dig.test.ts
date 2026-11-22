import { type DigPeriod, DISGUISED_DEFAULTS, type Selection } from '@datahub/contracts/eda';
import { describe, expect, it } from 'vitest';
import { BREAK_FACTOR, breakOf, type DigContext, differingValues, digDateOf, digResult, digSql, isReal, otherFieldsOf, ratioOf } from './dig.js';
import { AnswerMismatch, UnsafeValue } from './probes/sql.js';
import { LEADS, WEEKLY } from './testing.js';

/** The rows where lead_channel says nothing, from Disguised nulls, as the screen draws it (DEC-ED-36). */
const SAYS_NOTHING: Selection = { where: [{ kind: 'saysNothing', field: 'lead_channel' }] };
const context: DigContext = { source: WEEKLY, selection: SAYS_NOTHING };
/** Weekly lead volume without the date its role names: no period of an aggregate. */
const NO_DATE = { ...WEEKLY, resource: { ...WEEKLY.resource, fields: WEEKLY.resource.fields.map((field) => (field.role === 'period' ? { ...field, role: null } : field)) } };

describe('the SQL of a dig into a selection against the rest (TR-ED-12)', () => {
  it('flags every row once, keeps every partition, and returns one row per part and field, aggregates only', () => {
    expect(digSql(context)).toBe(`-- Dig into a selection of Weekly lead volume against the rest: aggregates only (TR-ED-12)
with eda_flagged as (
  select
    coalesce((\`lead_channel\` is null or lower(trim(\`lead_channel\`)) in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd')), false) as eda_selected,
    [
      struct('rows' as part, 0 as field_index, cast(null as string) as text_value, cast(null as float64) as number_value),
      struct('period' as part, 0 as field_index, format_date('%F', date_trunc(\`week_start\`, week(monday))) as text_value, cast(null as float64) as number_value),
      struct('text' as part, 0 as field_index, \`lead_source\` as text_value, cast(null as float64) as number_value),
      struct('number' as part, 1 as field_index, cast(null as string) as text_value, cast(\`lead_count\` as float64) as number_value)
    ] as eda_facets
  from \`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume\`
  where (\`week_start\` is null or \`week_start\` >= date '0001-01-01')
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
where part <> 'text' or place <= 50
group by 1, 2
order by 1, 2`);
  });

  it('never filters on the selection: its conditions, all together, only flag a row, never a row without a value', () => {
    const selection: Selection = {
      where: [
        { kind: 'empty', field: 'lead_channel' },
        { kind: 'range', field: 'week_start', before: '2025-01-06' },
        { kind: 'equals', field: 'lead_source', value: "app' or true --" },
      ],
    };
    const sql = digSql({ source: WEEKLY, selection });
    expect(sql).toContain("coalesce((`lead_channel` is null and `week_start` < date '2025-01-06' and `lead_source` = 'app\\' or true --'), false) as eda_selected");
    // The only where on the table is the filter that keeps every partition.
    expect(sql).toContain("  from `immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume`\n  where (`week_start` is null or `week_start` >= date '0001-01-01')\n),");
    expect(sql.match(/\bwhere\b/g)).toHaveLength(3);
    // Every Key Field is in a condition but lead_count: it is the only one set against the selection.
    expect(sql).not.toContain("struct('text'");
    expect(sql).toContain("struct('number' as part, 0 as field_index, cast(null as string) as text_value, cast(`lead_count` as float64) as number_value)");
  });

  it('says nothing by the lists of the EDA when given', () => {
    expect(digSql({ ...context, disguised: { ...DISGUISED_DEFAULTS, text: ['Leeg'] } })).toContain("coalesce((`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'leeg')), false)");
  });

  it('takes a moment on its day in Brussels, per day for an event, and leaves the period out without the date of its role', () => {
    const sql = digSql({ source: LEADS, selection: { where: [{ kind: 'equals', field: 'channel', value: 'web' }] } });
    expect(sql).toContain("struct('period' as part, 0 as field_index, format_date('%F', date(`created_at`, 'Europe/Brussels')) as text_value, cast(null as float64) as number_value)");
    expect(sql).toContain("struct('text' as part, 0 as field_index, `lead_id` as text_value, cast(null as float64) as number_value)");
    expect(sql).toContain("struct('number' as part, 1 as field_index, cast(null as string) as text_value, cast(`price` as float64) as number_value)");
    // Leads requires no filter on its partitions: the table has no where.
    expect(sql).toContain('  from `immoscoop-dataplatform.dbt_prod_stacks.leads`\n),');
    expect(sql).toContain("coalesce(`channel` = 'web', false) as eda_selected");
    expect(digSql({ source: NO_DATE, selection: SAYS_NOTHING })).not.toContain("struct('period'");
  });

  it('refuses a condition that does not fit the Resource, and the whole table, rather than write it', () => {
    expect(() => digSql({ source: WEEKLY, selection: { where: [{ kind: 'empty', field: 'lead_channel` is null or true or `x' }] } })).toThrow(UnsafeValue);
    expect(() => digSql({ source: WEEKLY, selection: { where: [{ kind: 'equals', field: 'lead_count', value: '1 or 1=1' }] } })).toThrow(UnsafeValue);
    expect(() => digSql({ source: WEEKLY, selection: { where: [] } })).toThrow(RangeError);
  });
});

describe('what a dig sets against the selection (TR-ED-12)', () => {
  it('takes the other Key Fields that are a text or a number, in the order of the Resource Card', () => {
    // lead_count, week_start, lead_source and lead_channel are its Key Fields; week_start is a date, lead_channel in the selection.
    expect(otherFieldsOf(context)).toEqual([
      { name: 'lead_source', kind: 'text' },
      { name: 'lead_count', kind: 'number' },
    ]);
    expect(otherFieldsOf({ source: LEADS, selection: { where: [{ kind: 'saysNothing', field: 'lead_id' }] } })).toEqual([
      { name: 'price', kind: 'number' },
      { name: 'channel', kind: 'text' },
    ]);
  });

  it('takes the date the role of the model type names, in the unit Volume over time takes for it', () => {
    expect(digDateOf(WEEKLY)).toEqual({ field: 'week_start', unit: 'week', period: 'date_trunc(`week_start`, week(monday))' });
    expect(digDateOf(LEADS)).toEqual({ field: 'created_at', unit: 'day', period: "date(`created_at`, 'Europe/Brussels')" });
    expect(digDateOf(NO_DATE)).toBeNull();
  });
});

describe('how a value differs between the selection and the rest (DEC-ED-14)', () => {
  const totals = { selected: 100, rest: 900 };

  it('compares its shares in both as a ratio, none when the rest holds none of it', () => {
    expect(ratioOf({ selected: 50, rest: 90 }, totals)).toBeCloseTo(5);
    expect(ratioOf({ selected: 10, rest: 90 }, totals)).toBeCloseTo(1);
    expect(ratioOf({ selected: 5, rest: 0 }, totals)).toBeNull();
    expect(ratioOf({ selected: 5, rest: 0 }, { selected: 5, rest: 0 })).toBeNull();
  });

  it('is real when a test of two shares finds it beyond chance at 95%: |z| of 1.96 or more', () => {
    expect(isReal({ selected: 50, rest: 90 }, totals)).toBe(true);
    expect(isReal({ selected: 10, rest: 90 }, totals)).toBe(false);
    // Fewer as well as more: z of 1.98 and of 1.84, both ways.
    const even = { selected: 100, rest: 100 };
    expect(isReal({ selected: 60, rest: 46 }, even)).toBe(true);
    expect(isReal({ selected: 46, rest: 60 }, even)).toBe(true);
    expect(isReal({ selected: 60, rest: 47 }, even)).toBe(false);
    // Only in the selection, and far from chance.
    expect(isReal({ selected: 5, rest: 0 }, { selected: 10, rest: 90 })).toBe(true);
  });

  it('is not real when it cannot be computed: a side without rows, or every row of both', () => {
    expect(isReal({ selected: 5, rest: 0 }, { selected: 5, rest: 0 })).toBe(false);
    expect(isReal({ selected: 0, rest: 5 }, { selected: 0, rest: 5 })).toBe(false);
    expect(isReal({ selected: 10, rest: 90 }, { selected: 10, rest: 90 })).toBe(false);
  });

  it('keeps at most 5 values with a selected row: the real ones first, then by ratio, only in the selection before all', () => {
    const values = [
      { value: 'even', selected: 10, rest: 90 },
      { value: 'more', selected: 20, rest: 100 },
      { value: 'much more', selected: 50, rest: 90 },
      { value: 'few', selected: 2, rest: 10 },
      { value: 'only here', selected: 3, rest: 0 },
      { value: 'less', selected: 1, rest: 100 },
      { value: 'never here', selected: 0, rest: 500 },
    ];
    const kept = differingValues(values, totals);
    expect(kept.map((one) => [one.value, one.real])).toEqual([
      ['only here', true],
      ['much more', true],
      ['more', true],
      ['less', true],
      ['few', false],
    ]);
    expect(kept[0]).toEqual({ value: 'only here', selected: 3, rest: 0, ratio: null, real: true });
    expect(kept.at(-1)?.ratio).toBeCloseTo(1.8);
  });
});

describe('where the share of the selection breaks over time (TR-ED-12)', () => {
  const weeks = (shares: number[]): DigPeriod[] =>
    shares.map((share, index) => ({ start: new Date(Date.UTC(2024, 11, 2 + 7 * index)).toISOString().slice(0, 10), selected: Math.round(share * 100), total: 100 }));

  it('is the first period after the split where the mean shares differ most, one side twice the other and beyond chance', () => {
    expect(breakOf(weeks([0.8, 0.85, 0.75, 0.9, 0.02, 0.01, 0.03]))).toEqual({ breakAt: '2024-12-30', before: 'more' });
    expect(breakOf(weeks([0, 0.1, 0.05, 0.7, 0.8]))).toEqual({ breakAt: '2024-12-23', before: 'less' });
    // The drawn example: 36% of the rows before, 2% after, a difference of only 0.34 (eda-dig.html).
    expect(breakOf(weeks([0.36, 0.35, 0.37, 0.36, 0.02, 0.02, 0.01, 0.03]))).toEqual({ breakAt: '2024-12-30', before: 'more' });
    // Exactly twice counts.
    expect(BREAK_FACTOR).toBe(2);
    expect(breakOf(weeks([0.5, 0.5, 0.25, 0.25]))).toEqual({ breakAt: '2024-12-16', before: 'more' });
  });

  it('is none when one side is less than twice the other, the rows are too few to tell it from chance, or there are not 2 periods on each side', () => {
    expect(breakOf(weeks([0.4, 0.45, 0.3, 0.25]))).toEqual({ breakAt: null, before: null });
    const few = (shares: number[]): DigPeriod[] => weeks(shares).map((period) => ({ ...period, selected: Math.round((period.selected / 100) * 4), total: 4 }));
    expect(breakOf(few([0.5, 0.5, 0.25, 0.25]))).toEqual({ breakAt: null, before: null });
    expect(breakOf(weeks([0.9, 0.9, 0.0]))).toEqual({ breakAt: null, before: null });
    expect(breakOf(weeks([0, 0, 0, 0]))).toEqual({ breakAt: null, before: null });
    expect(breakOf([])).toEqual({ breakAt: null, before: null });
  });

  it('counts only the periods with rows', () => {
    const periods = weeks([0.9, 0.9, 0.1, 0.1]);
    periods.splice(2, 0, { start: '2024-12-15', selected: 0, total: 0 });
    expect(breakOf(periods)).toEqual({ breakAt: '2024-12-16', before: 'more' });
  });
});

describe('the answer of query as what a dig found (TR-ED-12)', () => {
  /** The rows of query as BigQuery writes them: numbers as text, the entries as JSON, one row per part and field. */
  const json = (entries: [string | null, number, number][]) => JSON.stringify(entries.map(([value, selected, rest]) => ({ value, selected_rows: selected, rest_rows: rest })));
  const answer = [
    { part: 'number', field_index: '1', selected_rows: '2608', rest_rows: '13616', selected_median: '18', selected_mean: '24.5', rest_median: '26', rest_mean: '38', entries: 'null' },
    {
      part: 'period',
      field_index: '0',
      selected_rows: '2608',
      rest_rows: '13616',
      selected_median: null,
      selected_mean: null,
      rest_median: null,
      rest_mean: null,
      // In the order of the most selected rows, as the SQL ranks them; read in the order of the days.
      entries: json([
        ['2024-12-16', 85, 15],
        ['2024-12-09', 80, 20],
        ['2024-12-23', 75, 25],
        ['2024-12-30', 90, 10],
        ['2025-01-13', 3, 97],
        ['2025-01-06', 2, 98],
        ['2025-01-20', 1, 99],
      ]),
    },
    { part: 'rows', field_index: '0', selected_rows: '2608', rest_rows: '13616', selected_median: null, selected_mean: null, rest_median: null, rest_mean: null, entries: 'null' },
    {
      part: 'text',
      field_index: '0',
      selected_rows: '2608',
      rest_rows: '13616',
      selected_median: null,
      selected_mean: null,
      rest_median: null,
      rest_mean: null,
      entries: json([
        ['app', 1852, 1068],
        ['kbc-app', 235, 414],
        ['partner', 156, 817],
        ['website', 156, 6496],
        [null, 120, 0],
        ['immoweb', 89, 4334],
        ['other', 0, 487],
      ]),
    },
  ];

  it('gives the rows, the share per period with its break, and per other Key Field what differs', () => {
    const result = digResult(answer, context);
    expect(result.rows).toEqual({ selected: 2608, total: 16224 });
    expect(result.overTime).toEqual({
      field: 'week_start',
      unit: 'week',
      periods: [
        { start: '2024-12-09', selected: 80, total: 100 },
        { start: '2024-12-16', selected: 85, total: 100 },
        { start: '2024-12-23', selected: 75, total: 100 },
        { start: '2024-12-30', selected: 90, total: 100 },
        { start: '2025-01-06', selected: 2, total: 100 },
        { start: '2025-01-13', selected: 3, total: 100 },
        { start: '2025-01-20', selected: 1, total: 100 },
      ],
      breakAt: '2025-01-06',
      before: 'more',
    });
    const [source, count] = result.fields;
    // The real ones first, no value only in the selection before them all; partner could be chance, and is the sixth.
    expect(source?.kind === 'text' && source.values.map((one) => [one.value, one.selected, one.rest, one.real])).toEqual([
      [null, 120, 0, true],
      ['app', 1852, 1068, true],
      ['kbc-app', 235, 414, true],
      ['website', 156, 6496, true],
      ['immoweb', 89, 4334, true],
    ]);
    expect(source?.kind === 'text' && source.values[1]?.ratio).toBeCloseTo((1852 / 2608) / (1068 / 13616));
    expect(count).toEqual({ field: 'lead_count', kind: 'number', selected: { median: 18, mean: 24.5 }, rest: { median: 26, mean: 38 } });
  });

  it('reads an empty table, which answers no row, as no row selected of none', () => {
    expect(digResult([], context)).toEqual({
      rows: { selected: 0, total: 0 },
      overTime: { field: 'week_start', unit: 'week', periods: [], breakAt: null, before: null },
      fields: [
        { field: 'lead_source', kind: 'text', values: [] },
        { field: 'lead_count', kind: 'number', selected: { median: null, mean: null }, rest: { median: null, mean: null } },
      ],
    });
    expect(digResult([], { source: NO_DATE, selection: SAYS_NOTHING }).overTime).toBeNull();
  });

  it('refuses an answer that does not have the shape of its SQL', () => {
    const row = (part: unknown, more: Record<string, unknown> = {}) => [{ part, field_index: '0', selected_rows: '1', rest_rows: '1', entries: 'null', ...more }];
    expect(() => digResult(row('everything'), context)).toThrow(AnswerMismatch);
    // field_index 0 is lead_source, a text; 1 is lead_count, a number.
    expect(() => digResult(row('number'), context)).toThrow(AnswerMismatch);
    expect(() => digResult(row('text', { field_index: '1' }), context)).toThrow(AnswerMismatch);
    expect(() => digResult(row('text', { entries: '{"value":"app"}' }), context)).toThrow(AnswerMismatch);
    expect(() => digResult(row('text', { entries: '[{"value":7,"selected_rows":1,"rest_rows":0}]' }), context)).toThrow(AnswerMismatch);
    expect(() => digResult(row('period', { entries: '[{"value":"last week","selected_rows":1,"rest_rows":0}]' }), context)).toThrow(AnswerMismatch);
    expect(() => digResult(row('period', { entries: '[]' }), { source: NO_DATE, selection: SAYS_NOTHING })).toThrow(AnswerMismatch);
    expect(() => digResult(row('rows', { selected_rows: 'many' }), context)).toThrow(AnswerMismatch);
  });
});
