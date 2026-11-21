import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import { categoriesResults, categoriesSql, distributionOfCategories, weighedByOf } from './categories.js';
import type { ProbeContext } from './probe.js';
import { AnswerMismatch } from './sql.js';

const weekly: ProbeContext = { source: WEEKLY, fields: ['lead_source', 'lead_channel'], params: {}, today: '2026-11-21' };

describe('Distribution of categories (FR-ED-17, DEC-ED-33, TR-ED-03)', () => {
  it('weighs each value by the sum of what adds up, every field in one scan, and returns its 10 heaviest values only', () => {
    expect(categoriesSql(weekly)).toBe(`-- EDA-Probe distributionOfCategories on Weekly lead volume: aggregates only (TR-ED-03)
with weighed as (
  select eda_value.field_index, eda_value.v, coalesce(sum(\`lead_count\`), 0) as weight
  from \`immoscoop-dataplatform.dbt_prod_stacks.Weekly_Lead_Volume\`
  cross join unnest([
    struct(0 as field_index, \`lead_source\` as v),
    struct(1 as field_index, \`lead_channel\` as v)
  ]) as eda_value
  where (\`week_start\` is null or \`week_start\` >= date '0001-01-01')
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
  countif(place > 10) as others_count,
  coalesce(sum(if(place > 10, weight, null)), 0) as others_weight,
  countif(v is not null and weight < 0.001 * total_weight) as small_count,
  to_json_string(array_agg(if(place <= 10, struct(v as value, weight), null) ignore nulls order by place)) as top
from ranked
group by field_index
order by field_index`);
  });

  it('weighs by rows when rows were chosen, or the model type has no number that adds up, without a filter where none is required', () => {
    const rows = categoriesSql({ ...weekly, params: { weighedBy: null } });
    expect(rows).toContain('select eda_value.field_index, eda_value.v, count(*) as weight');
    expect(rows).not.toContain('`lead_count`');
    const leads = categoriesSql({ source: LEADS, fields: ['channel'], params: {}, today: '2026-11-21' });
    expect(leads).toContain('count(*) as weight');
    expect(leads).toContain('struct(0 as field_index, `channel` as v)');
    expect(leads).not.toContain('where');
    // The table once: what follows reads what the scan weighed.
    expect(categoriesSql(weekly).match(/from `immoscoop/g)).toHaveLength(1);
  });

  it('starts an aggregate or a fact from the number that adds up, never a unique count, and other model types from rows', () => {
    expect(weighedByOf(WEEKLY, {})).toBe('lead_count');
    expect(weighedByOf(WEEKLY, { weighedBy: null })).toBeNull();
    expect(weighedByOf(LEADS, {})).toBeNull();
    const params = (given: Record<string, unknown>, source = WEEKLY) => distributionOfCategories.params(given, source, ['lead_source']);
    expect(params({})).toEqual({});
    expect(params({ weighedBy: 'lead_count' })).toEqual({ weighedBy: 'lead_count' });
    expect(params({ weighedBy: null })).toEqual({ weighedBy: null });
    expect(params({ weighedBy: 'unique_applicants' })).toMatch(/role addsUp.*a unique count never adds up/);
    expect(params({ weighedBy: 'lead_channel' })).toMatch(/role addsUp/);
    expect(params({ weighedBy: 'nope' })).toMatch(/role addsUp/);
    expect(params({ weighedBy: 'price' }, LEADS)).toBe('Only an aggregate or a fact has a number that adds up: weighedBy is null, to weigh by rows.');
    expect(params({ weighedBy: null }, LEADS)).toEqual({ weighedBy: null });
    expect(params({ top: 20 })).toBe('Distribution of categories has no parameter top.');
  });

  it('gives per field its heaviest values with their share, the others, the empty values and the small ones, read as for you to judge', () => {
    const sources = [41_000, 22_000, 9000, 7000, 5000, 4000, 3000, 2000, 900, 600].map((weight, index) => ({
      value: ['website', 'app', 'partner', 'immoweb', 'mailing', 'kbc-app', 'social', 'referral', 'source 9', 'source 10'][index],
      weight: String(weight),
    }));
    const channels = [
      { value: 'web', weight: 38_000 },
      { value: 'mobile', weight: '31000' },
      { value: 'email', weight: 10_000 },
      { value: 'phone', weight: 6000 },
      { value: 'Web', weight: 2000 },
      { value: 'e-mail', weight: 1000 },
      { value: 'fax', weight: 50 },
    ];
    const rows = [
      { field_index: '1', total_weight: '100000', value_count: '7', empty_weight: '11950', others_count: '0', others_weight: '0', small_count: '1', top: JSON.stringify(channels) },
      { field_index: '0', total_weight: '100000', value_count: '54', empty_weight: '100', others_count: '44', others_weight: '5400', small_count: '31', top: JSON.stringify(sources) },
    ];
    const [source, channel, ...others] = categoriesResults(rows, weekly);
    expect(others).toHaveLength(0);
    expect(source).toMatchObject({ subject: 'lead_source', reading: 'judge' });
    expect(source?.data).toEqual({
      weighedBy: 'lead_count',
      total: 100_000,
      values: 54,
      top: sources.map((entry) => ({ value: entry.value, weight: Number(entry.weight), share: Number(entry.weight) / 100_000 })),
      others: { values: 44, weight: 5400, share: 0.054 },
      empty: { weight: 100, share: 0.001 },
      small: 31,
    });
    expect(channel).toMatchObject({ subject: 'lead_channel', reading: 'judge' });
    expect(channel?.data).toMatchObject({
      values: 7,
      top: [{ value: 'web', weight: 38_000, share: 0.38 }, { value: 'mobile', weight: 31_000, share: 0.31 }, {}, {}, {}, {}, { value: 'fax', weight: 50, share: 0.0005 }],
      others: { values: 0, weight: 0, share: 0 },
      empty: { weight: 11_950, share: 0.1195 },
      small: 1,
    });
  });

  it('gives a field the answer has no row for as without values, weighed by rows when chosen', () => {
    const [empty] = categoriesResults([], { ...weekly, fields: ['lead_origin'], params: { weighedBy: null } });
    expect(empty).toEqual({
      subject: 'lead_origin',
      reading: 'judge',
      data: { weighedBy: null, total: 0, values: 0, top: [], others: { values: 0, weight: 0, share: 0 }, empty: { weight: 0, share: 0 }, small: 0 },
    });
    const only = [{ field_index: '0', total_weight: '12', value_count: '0', empty_weight: '12', others_count: '0', others_weight: '0', small_count: '0', top: 'null' }];
    expect(categoriesResults(only, { ...weekly, fields: ['lead_origin'] })[0]?.data).toMatchObject({ total: 12, values: 0, top: [], empty: { weight: 12, share: 1 } });
  });

  it('refuses an answer whose values are no list of texts', () => {
    const row = (top: string) => [{ field_index: '0', total_weight: '1', value_count: '1', empty_weight: '0', others_count: '0', others_weight: '0', small_count: '0', top }];
    expect(() => categoriesResults(row('{"value":"web"}'), weekly)).toThrow(AnswerMismatch);
    expect(() => categoriesResults(row('[{"value":7,"weight":1}]'), weekly)).toThrow(AnswerMismatch);
    expect(() => categoriesResults(row('[{"value":"web","weight":"many"}]'), weekly)).toThrow(AnswerMismatch);
  });
});
