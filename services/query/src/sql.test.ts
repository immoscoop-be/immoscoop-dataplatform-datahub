import { describe, expect, it } from 'vitest';
import { filtersOn, inOwnCase, parametersOf, tablesOf, template, tokenize, withFilter } from './sql.js';

const names = (sql: string) => tablesOf(sql).tables.map((table) => table.name);

describe('reading the SQL as words', () => {
  it('skips comments and strings, so that a keyword in them counts for nothing', () => {
    const words = tokenize(`
      -- from secret.table
      # from other.table
      /* from hidden.table */
      select 'from x.y', "from z", r'\\from', '''from
      multi''', b"from" from a.b`)
      .filter((token) => token.kind === 'word')
      .map((token) => token.text);
    expect(words).toEqual(['select', 'from', 'a', 'b']);
  });

  it('keeps a quoted name whole, with its dots, and an escaped backtick in it', () => {
    expect(tokenize('`p.d.t` `a\\`b`').map((token) => [token.kind, token.text])).toEqual([
      ['quoted', 'p.d.t'],
      ['quoted', 'a`b'],
    ]);
  });

  it('reads an unterminated comment, string or name to the end without failing', () => {
    expect(() => tokenize("select '")).not.toThrow();
    expect(() => tokenize('select `p.d')).not.toThrow();
    expect(() => tokenize('select /* ')).not.toThrow();
  });
});

describe('the tables a query names (DEC-UX-73)', () => {
  it('finds them after from and join, quoted or not, also in subqueries', () => {
    expect(
      names(`
        select * from \`immoscoop-dataplatform-398214.dbt_prod_stacks.weekly_lead_volume\` v
        left join dbt_prod_stacks.lead_sources s using (lead_source)
        where v.lead_source in (select lead_source from \`p\`.\`d\`.\`partners\`)`),
    ).toEqual(['immoscoop-dataplatform-398214.dbt_prod_stacks.weekly_lead_volume', 'dbt_prod_stacks.lead_sources', 'p.d.partners']);
  });

  it('reads an unquoted project with dashes as one name, as BigQuery allows', () => {
    expect(names('select 1 from immoscoop-dataplatform-398214.dbt_prod_stacks.leads')).toEqual(['immoscoop-dataplatform-398214.dbt_prod_stacks.leads']);
  });

  it('finds every table of a comma list, with or without an alias', () => {
    expect(names('select * from a.b as x, c.d y, e.f where 1 = 1')).toEqual(['a.b', 'c.d', 'e.f']);
  });

  it('leaves out its CTEs, unnest, and an array of a row named through its alias', () => {
    const sql = `
      with recursive weekly as (select * from p.d.weekly), sources as (select * from p.d.sources)
      select * from weekly w, unnest(w.items) item
      join sources using (lead_source)
      cross join w.tags`;
    expect(names(sql)).toEqual(['p.d.weekly', 'p.d.sources']);
  });

  it('is not misled by the from of extract and of is distinct from, nor by with offset', () => {
    const sql = `
      select extract(year from week_start) as year, a is distinct from b, x is not distinct from y
      from p.d.weekly, unnest([1, 2]) as n with offset as o`;
    expect(names(sql)).toEqual(['p.d.weekly']);
  });

  it('finds a table in a where, in a join of a CTE and after a set operation', () => {
    const sql = `
      with a as (select * from p.d.one join p.d.two on true)
      select * from a union all select * from p.d.three`;
    expect(names(sql)).toEqual(['p.d.one', 'p.d.two', 'p.d.three']);
  });

  it('names a table function apart, as it is never allowed', () => {
    const found = tablesOf("select * from ML.PREDICT(model m, table p.d.t) join external_query('c', 'select 1') on true");
    expect(found.functions.map((named) => named.name)).toEqual(['ML.PREDICT', 'external_query']);
    expect(found.tables.map((named) => named.name)).toEqual([]);
  });

  it('names a wildcard table and INFORMATION_SCHEMA as they are, so that they are no Resource', () => {
    expect(names('select * from `p.d.events_*` union all select * from p.d.INFORMATION_SCHEMA.TABLES')).toEqual(['p.d.events_*', 'p.d.INFORMATION_SCHEMA.TABLES']);
  });

  it('knows where each name stands in the SQL', () => {
    const sql = 'select * from `p.d.t`';
    const [table] = tablesOf(sql).tables;
    expect(sql.slice(table?.start, table?.end)).toBe('`p.d.t`');
  });
});

describe('the SQL as BigQuery gets it (DEC-SR-44)', () => {
  const state = { key: 'p.colleciones_dbt.mrt_immoscoop__leadsource__state', fullName: 'p.colleciones_dbt.mrt_immoscoop__leadSource__state' };
  const own = '`p.colleciones_dbt.mrt_immoscoop__leadSource__state`';

  it('names a Resource written in another case by its full name in its own case', () => {
    expect(inOwnCase('select * from `p.colleciones_dbt.mrt_immoscoop__leadsource__state`', [state], 'p')).toBe(`select * from ${own}`);
    expect(inOwnCase('select * from p.colleciones_dbt.MRT_IMMOSCOOP__LEADSOURCE__STATE s', [state], 'p')).toBe(`select * from ${own} s`);
  });

  it('names it in full when it is written without its project', () => {
    expect(inOwnCase('select * from colleciones_dbt.mrt_immoscoop__leadsource__state as s where s.x = 1', [state], 'p')).toBe(`select * from ${own} as s where s.x = 1`);
  });

  it('changes every place it is named and nothing else: other tables, CTEs, columns, strings', () => {
    const sql = [
      'with leadsource as (select * from `p.colleciones_dbt.mrt_immoscoop__leadsource__state`)',
      "select 'p.colleciones_dbt.mrt_immoscoop__leadsource__state' as name, l.x",
      'from leadsource l join p.other.table o on o.x = l.x',
      'join `p.colleciones_dbt.mrt_immoscoop__leadsource__state` again on again.x = l.x',
    ].join('\n');
    expect(inOwnCase(sql, [state], 'p')).toBe(
      [
        `with leadsource as (select * from ${own})`,
        "select 'p.colleciones_dbt.mrt_immoscoop__leadsource__state' as name, l.x",
        'from leadsource l join p.other.table o on o.x = l.x',
        `join ${own} again on again.x = l.x`,
      ].join('\n'),
    );
  });

  it('leaves a name that is already right as it was written', () => {
    const sql = 'select * from `p.colleciones_dbt.mrt_immoscoop__leadSource__state`';
    expect(inOwnCase(sql, [state], 'p')).toBe(sql);
    expect(inOwnCase('select * from `p.dbt.weekly`', [{ key: 'p.dbt.weekly', fullName: 'p.dbt.weekly' }], 'p')).toBe('select * from `p.dbt.weekly`');
  });
});

describe('a filter on the partition column (DEC-SR-35, FR-SR-40)', () => {
  it('is there when the column is named in a where', () => {
    expect(filtersOn('select * from t where week_start >= @from', 'week_start')).toBe(true);
    expect(filtersOn('select * from t v where v.`week_start` between "2026-01-01" and current_date()', 'week_start')).toBe(true);
    expect(filtersOn('with a as (select * from t where WEEK_START > "2026-01-01") select * from a', 'week_start')).toBe(true);
  });

  it('is not there when the column is only selected, grouped or ordered by', () => {
    expect(filtersOn('select week_start from t where lead_source = "app" group by week_start order by week_start', 'week_start')).toBe(false);
    expect(filtersOn('select week_start from t', 'week_start')).toBe(false);
    // Nor in a comment or a string.
    expect(filtersOn("select * from t where lead_source = 'week_start' -- week_start", 'week_start')).toBe(false);
  });

  it('ends a where at the parenthesis that holds it', () => {
    expect(filtersOn('select * from (select * from t where a = 1) where b = 2 and week_start > "x"', 'week_start')).toBe(true);
    expect(filtersOn('select * from (select * from t where a = 1) x join u on x.week_start = u.week_start', 'week_start')).toBe(false);
  });
});

describe('the Parameters a query uses', () => {
  it('are its @names, once each, without the system variables of BigQuery', () => {
    expect(parametersOf('select * from t where d between @dateFrom and @dateTo and c = @dateFrom and @@project_id is not null')).toEqual(['dateFrom', 'dateTo']);
  });
});

describe('the SQL a new query starts with (FR-SR-46)', () => {
  const weekly = {
    key: 'p.dbt_prod_stacks.weekly_lead_volume',
    fullName: 'p.dbt_prod_stacks.weekly_lead_volume',
    fields: [
      { name: 'week_start', dataType: 'DATE' },
      { name: 'lead_source', dataType: 'STRING' },
    ],
    partition: { field: 'week_start', unit: 'day' },
  };

  it('selects the fields of its Resource and filters on its partition column', () => {
    expect(template([weekly])).toBe(
      'select week_start,\n       lead_source\nfrom `p.dbt_prod_stacks.weekly_lead_volume`\nwhere week_start >= date_sub(current_date(), interval 28 day)\n',
    );
  });

  it('filters a timestamp as a timestamp, and leaves out a filter it cannot write', () => {
    const events = { key: 'p.d.events', fullName: 'p.d.events', fields: [{ name: 'at', dataType: 'TIMESTAMP' }], partition: { field: 'at', unit: 'month' } };
    expect(template([events])).toContain('where at >= timestamp_sub(current_timestamp(), interval 90 day)');
    const ranges = { key: 'p.d.ranges', fullName: 'p.d.ranges', fields: [{ name: 'bucket', dataType: 'INT64' }], partition: { field: 'bucket', unit: null } };
    expect(template([ranges])).not.toContain('where');
  });

  it('names the table in its own case, as BigQuery names are case-sensitive', () => {
    const state = { key: 'p.colleciones_dbt.mrt_immoscoop__leadsource__state', fullName: 'p.colleciones_dbt.mrt_immoscoop__leadSource__state', fields: [{ name: 'leadSourceId', dataType: 'STRING' }], partition: null };
    expect(template([state])).toBe('select leadSourceId\nfrom `p.colleciones_dbt.mrt_immoscoop__leadSource__state`\n');
  });

  it('gives each Resource a CTE when there are more', () => {
    const sources = { key: 'p.dbt_prod_stacks.lead_sources', fullName: 'p.dbt_prod_stacks.lead_sources', fields: [{ name: 'source_name', dataType: 'STRING' }], partition: null };
    const sql = template([weekly, sources]);
    expect(sql).toMatch(/^with weekly_lead_volume as \(\n {2}select week_start,/);
    expect(sql).toContain('lead_sources as (\n  select source_name\n  from `p.dbt_prod_stacks.lead_sources`\n)');
    expect(sql).toMatch(/select \*\nfrom weekly_lead_volume\n$/);
    // What it writes, it reads as its own tables.
    expect(names(sql)).toEqual(['p.dbt_prod_stacks.weekly_lead_volume', 'p.dbt_prod_stacks.lead_sources']);
  });
});

describe('adding the filter on the partition column (DEC-SR-35)', () => {
  const key = (name: string) => name === 'p.d.weekly';
  const filter = "week_start >= date_sub(current_date(), interval 28 day)";

  it('goes into the where that follows the table and its alias', () => {
    expect(withFilter('select * from `p.d.weekly` v where lead_source = "app"', key, filter)).toBe(`select * from \`p.d.weekly\` v where ${filter} and lead_source = "app"`);
    expect(withFilter('select * from p.d.weekly as v WHERE x = 1', key, filter)).toBe(`select * from p.d.weekly as v WHERE ${filter} and x = 1`);
  });

  it('is a new where after the table, its alias, or before what may follow a where', () => {
    expect(withFilter('select * from `p.d.weekly`', key, filter)).toBe(`select * from \`p.d.weekly\`\nwhere ${filter}`);
    expect(withFilter('select a, count(*) from `p.d.weekly` w group by a', key, filter)).toBe(`select a, count(*) from \`p.d.weekly\` w\nwhere ${filter} group by a`);
    expect(withFilter('with a as (select * from `p.d.weekly`) select * from a', key, filter)).toBe(`with a as (select * from \`p.d.weekly\`\nwhere ${filter}) select * from a`);
  });

  it('is not guessed before a join, nor for a table the SQL does not name', () => {
    expect(withFilter('select * from `p.d.weekly` w join `p.d.sources` s using (id)', key, filter)).toBeNull();
    expect(withFilter('select * from `p.d.other`', key, filter)).toBeNull();
  });
});
