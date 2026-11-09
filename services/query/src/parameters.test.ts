import { describe, expect, it } from 'vitest';
import { bind, isFunction, kindFor, type Parameter, parseParameters } from './parameters.js';
import { comparedWith } from './sql.js';

describe('the Parameters of a query (DEC-UX-71)', () => {
  const all = [
    { name: 'dateFrom', kind: 'date', value: ' DATE_TRUNC(CURRENT_DATE(), YEAR) ' },
    { name: 'weeks', kind: 'period', value: '2026-01-01', to: 'CURRENT_DATE()' },
    { name: 'minLeads', kind: 'number', value: '10' },
    { name: 'share', kind: 'decimal', value: '0.25' },
    { name: 'office', kind: 'text', value: 'Gent (Zuid)' },
    { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', ' Phone '] },
    { name: 'channels', kind: 'several', value: [], list: ['Form', 'Phone'] },
    { name: 'partners', kind: 'yesno', value: false },
  ];

  it('takes each kind with its value, trimmed', () => {
    const parsed = parseParameters(all) as Parameter[];
    expect(parsed).toHaveLength(8);
    expect(parsed[0]).toEqual({ name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' });
    expect(parsed[5]).toEqual({ name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] });
  });

  it('refuses what does not fit', () => {
    expect(parseParameters('dateFrom')).toMatch(/a list of at most 30/);
    expect(parseParameters([{ name: '1st', kind: 'date', value: '2026-01-01' }])).toMatch(/SQL name/);
    expect(parseParameters([{ name: 'x', kind: 'month', value: '1' }])).toMatch(/one of date, period/);
    expect(parseParameters([{ name: 'x', kind: 'date', value: ' ' }])).toMatch(/1 to 1000 characters/);
    expect(parseParameters([{ name: 'x', kind: 'period', value: '2026-01-01' }])).toMatch(/to start and to end/);
    expect(parseParameters([{ name: 'x', kind: 'choice', value: 'Mail', list: ['Form'] }])).toBe('The value of @x is one of its list.');
    expect(parseParameters([{ name: 'x', kind: 'choice', value: 'Form', list: ['Form', 'Form'] }])).toBe('@x: A list names each value once.');
    expect(parseParameters([{ name: 'x', kind: 'several', value: ['Mail'], list: ['Form'] }])).toMatch(/some of its list/);
    expect(parseParameters([{ name: 'x', kind: 'yesno', value: 'yes' }])).toMatch(/true or false/);
    expect(parseParameters([{ name: 'x', kind: 'date', value: '2026-01-01', to: '2026-02-01' }])).toMatch(/Only a period has an end/);
    expect(parseParameters([{ name: 'x', kind: 'date', value: '2026-01-01', column: 'week_start' }])).toBe('A Parameter has no field column.');
    // A Period gives @weeks_from and @weeks_to, so neither can be a Parameter of its own.
    expect(parseParameters([all[1], { name: 'Weeks_From', kind: 'date', value: '2026-01-01' }])).toBe('@Weeks_From is named twice.');
  });

  it('tells a value from a function (DEC-LE-14)', () => {
    expect(isFunction('date', '2026-02-28')).toBe(false);
    expect(isFunction('date', '2026-02-30')).toBe(true);
    expect(isFunction('date', 'CURRENT_DATE()')).toBe(true);
    expect(isFunction('number', '-12')).toBe(false);
    expect(isFunction('number', '9223372036854775808')).toBe(true);
    expect(isFunction('decimal', '350000.50')).toBe(false);
    expect(isFunction('decimal', '350000,50')).toBe(true);
    expect(isFunction('text', 'Gent (Zuid)')).toBe(false);
    expect(isFunction('text', "CONCAT('Gent', ' Zuid')")).toBe(true);
  });
});

describe('the SQL of a run with its Parameters (DEC-UX-118)', () => {
  const parameters = parseParameters([
    { name: 'dateFrom', kind: 'date', value: 'DATE_TRUNC(CURRENT_DATE(), YEAR)' },
    { name: 'weeks', kind: 'period', value: '2026-01-01', to: 'CURRENT_DATE()' },
    { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone'] },
    { name: 'channels', kind: 'several', value: ['Form'], list: ['Form', 'Phone'] },
    { name: 'partners', kind: 'yesno', value: true },
    { name: 'unused', kind: 'number', value: '3' },
  ]) as Parameter[];

  it('sends a value apart and puts a function in place of its @name, leaving comments and strings alone', () => {
    const sql = "-- from @dateFrom\nselect '@dateFrom' from t where d >= @dateFrom and d between @weeks_from and @weeks_to and c = @leadChannel and c in unnest(@channels) and p = @partners and q = @leadChannel";
    const bound = bind(sql, parameters);
    expect(bound.sql).toBe(
      "-- from @dateFrom\nselect '@dateFrom' from t where d >= (DATE_TRUNC(CURRENT_DATE(), YEAR)) and d between @weeks_from and (CURRENT_DATE()) and c = @leadChannel and c in unnest(@channels) and p = @partners and q = @leadChannel",
    );
    expect(bound.parameters).toEqual([
      { name: 'weeks_from', parameterType: { type: 'DATE' }, parameterValue: { value: '2026-01-01' } },
      { name: 'leadChannel', parameterType: { type: 'STRING' }, parameterValue: { value: 'Form' } },
      { name: 'channels', parameterType: { type: 'ARRAY', arrayType: { type: 'STRING' } }, parameterValue: { arrayValues: [{ value: 'Form' }] } },
      { name: 'partners', parameterType: { type: 'BOOL' }, parameterValue: { value: 'true' } },
    ]);
    expect(bound.missing).toEqual([]);
    expect(bound.unused).toEqual(['unused']);
  });

  it('names the @names that are not a Parameter, where they stand', () => {
    const sql = 'select * from t where c = @leadChanel and d = @@datetime';
    expect(bind(sql, parameters).missing).toEqual([{ name: 'leadChanel', start: 26, end: 37 }]);
  });

  it('tells where a place in the bound SQL stands in the SQL as written', () => {
    const sql = 'select @dateFrom, x from t';
    const bound = bind(sql, parameters);
    expect(bound.sql).toBe('select (DATE_TRUNC(CURRENT_DATE(), YEAR)), x from t');
    const at = (text: string) => bound.sql.indexOf(text);
    expect(bound.original(at('x from'), 'start')).toBe(sql.indexOf('x from'));
    expect(bound.original(at('CURRENT_DATE'), 'start')).toBe(sql.indexOf('@dateFrom'));
    expect(bound.original(at('CURRENT_DATE') + 12, 'end')).toBe(sql.indexOf(', x'));
    expect(bound.original(3, 'start')).toBe(3);
  });
});

describe('the kind to suggest for an @name', () => {
  const at = (sql: string, name: string) => comparedWith(sql, sql.indexOf(name));

  it('is read from the column it is compared with', () => {
    expect(at('select * from t where v.lead_channel = @leadChannel', '@leadChannel')).toEqual({ column: 'lead_channel', list: false });
    expect(at('select * from t where week_start >= @dateFrom', '@dateFrom')).toEqual({ column: 'week_start', list: false });
    expect(at('select * from t where week_start between @a and @b', '@b')).toEqual({ column: 'week_start', list: false });
    expect(at('select * from t where lead_channel not in unnest(@channels)', '@channels')).toEqual({ column: 'lead_channel', list: true });
    expect(at('select * from t where @leadChannel = v.lead_channel', '@leadChannel')).toEqual({ column: 'lead_channel', list: false });
    expect(at('select @x', '@x')).toEqual({ column: null, list: false });
  });

  it('follows the type of that column', () => {
    expect(kindFor('STRING', false)).toBe('choice');
    expect(kindFor('STRING', true)).toBe('several');
    expect(kindFor('DATE', false)).toBe('date');
    expect(kindFor('INT64', false)).toBe('number');
    expect(kindFor('FLOAT64', false)).toBe('decimal');
    expect(kindFor('BOOL', false)).toBe('yesno');
    expect(kindFor('TIMESTAMP', false)).toBeNull();
    expect(kindFor(null, false)).toBeNull();
  });
});
