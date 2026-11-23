import type { EdaField } from '@datahub/contracts/eda';
import { describe, expect, it } from 'vitest';
import { LEADS, WEEKLY } from '../testing.js';
import {
  AnswerMismatch,
  booleanLiteral,
  conditionOf,
  countOf,
  dayLiteral,
  dayOf,
  everyPartition,
  isDay,
  jsonOf,
  numberLiteral,
  numberOf,
  quote,
  saysNothingOf,
  textLiteral,
  UnsafeValue,
  whereOf,
} from './sql.js';

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
    expect(whereOf({ source: WEEKLY }, ['x is not null'], '  ')).toBe("\n  where (`week_start` is null or `week_start` >= date '0001-01-01')\n    and x is not null");
    expect(whereOf({ source: LEADS })).toBe('');
  });

  it('puts the conditions of a selection between that filter and its own; the whole table adds none (OP-ED-12)', () => {
    const selection = { where: [{ kind: 'equals' as const, field: 'lead_source', value: 'website' }, { kind: 'range' as const, field: 'lead_count', from: 10 }] };
    expect(whereOf({ source: WEEKLY, selection }, ['x is not null'], '  ')).toBe(
      "\n  where (`week_start` is null or `week_start` >= date '0001-01-01')\n    and `lead_source` = 'website'\n    and `lead_count` >= 10\n    and x is not null",
    );
    expect(whereOf({ source: LEADS, selection: { where: [{ kind: 'saysNothing', field: 'lead_id' }] } })).toBe(
      "\nwhere (`lead_id` is null or lower(trim(`lead_id`)) in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd'))",
    );
    expect(whereOf({ source: LEADS, selection: { where: [] } })).toBe('');
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

/** A field of a kind the tests need, beside those of the Resources. */
const fieldOf = (name: string, dataType: string | null): EdaField => ({ name, dataType, keyField: false, role: null, grain: false, mapped: false });
const field = (name: string) => WEEKLY.resource.fields.find((one) => one.name === name) ?? fieldOf(name, null);
/** Weekly lead volume with a field of true or false, one of a moment without a zone, and one of JSON. */
const WIDER = {
  ...WEEKLY,
  resource: { ...WEEKLY.resource, fields: [...WEEKLY.resource.fields, fieldOf('is_test', 'BOOL'), fieldOf('seen_at', 'DATETIME'), fieldOf('payload', 'JSON')] },
};

/**
 * A quoted string of BigQuery read as BigQuery reads it: from its first quote, an escape takes the character after the
 * backslash, and the string ends at the first quote that is not escaped. What it holds, and where it ends.
 */
function readLiteral(sql: string): { value: string; end: number } {
  if (sql[0] !== "'") throw new Error('no quoted string');
  let value = '';
  for (let at = 1; at < sql.length; at += 1) {
    const character = sql[at] ?? '';
    if (character === "'") return { value, end: at };
    if (character === '\n' || character === '\r') throw new Error('a line break in a quoted string');
    if (character !== '\\') {
      value += character;
      continue;
    }
    const next = sql[at + 1] ?? '';
    if (next === 'u') {
      value += String.fromCharCode(Number.parseInt(sql.slice(at + 2, at + 6), 16));
      at += 5;
    } else {
      value += ({ n: '\n', r: '\r', t: '\t' } as Record<string, string>)[next] ?? next;
      at += 1;
    }
  }
  throw new Error('the quoted string does not end');
}

describe('the selection of rows an EDA-Probe runs on, as SQL (OP-ED-12)', () => {
  it('writes a text as one quoted string that holds exactly that text, whatever it holds', () => {
    expect(textLiteral('website')).toBe("'website'");
    expect(textLiteral("it's")).toBe(String.raw`'it\'s'`);
    expect(textLiteral(String.raw`C:\temp`)).toBe(String.raw`'C:\\temp'`);
    expect(textLiteral('a\nb')).toBe(String.raw`'a\nb'`);
    expect(textLiteral('\u0001\u2028')).toBe(String.raw`'\u0001\u2028'`);
    expect(textLiteral('')).toBe("''");
    // Every attempt to end the literal early stays inside it: it ends at its last quote, and holds the text as given.
    for (const attempt of [
      "x' or 1=1 --",
      String.raw`x\' or 1=1 --`,
      '\\',
      String.raw`web\\`,
      "'; delete from t where true; --",
      "' union all select * from `other.dataset.table` --",
      'a\r\n-- b',
      'a\u2028) or (true',
      '"double" `back` /* comment */ # hash',
      "'''triple'''",
      "r'raw' b'bytes'",
      '\u0000nul\u007f\u0085',
      'é ü 中文 🙂',
      `${'\\'.repeat(7)}'`,
    ]) {
      const literal = textLiteral(attempt);
      expect(literal).not.toMatch(/[\n\r\u2028\u2029]/);
      expect(readLiteral(literal), JSON.stringify(attempt)).toEqual({ value: attempt, end: literal.length - 1 });
    }
  });

  it('refuses what is no text, a text too long, or one that is not well formed', () => {
    expect(() => textLiteral('\ud800')).toThrow(UnsafeValue);
    expect(() => textLiteral('x'.repeat(1001))).toThrow(UnsafeValue);
    expect(() => textLiteral(7 as unknown as string)).toThrow(UnsafeValue);
  });

  it('writes a number only as digits, a point and an exponent, and refuses anything else', () => {
    expect(numberLiteral(42)).toBe('42');
    expect(numberLiteral(-1)).toBe('-1');
    expect(numberLiteral(-0)).toBe('0');
    expect(numberLiteral(3.5)).toBe('3.5');
    expect(numberLiteral(1e-7)).toBe('1e-7');
    expect(numberLiteral(1e21)).toBe('1e+21');
    // An integer beyond what an INT64 literal holds exactly is written as a FLOAT64.
    expect(numberLiteral(2 ** 64)).toBe('1.8446744073709552e+19');
    for (const attempt of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '1 or 1=1', '1', null, true]) {
      expect(() => numberLiteral(attempt as number), String(attempt)).toThrow(UnsafeValue);
    }
  });

  it('writes a day that exists as a DATE, and true or false as such', () => {
    expect(dayLiteral('2024-02-29')).toBe("date '2024-02-29'");
    expect(dayLiteral('0001-01-01')).toBe("date '0001-01-01'");
    expect(isDay('9999-12-31')).toBe(true);
    for (const attempt of ['2023-02-29', '2026-13-01', '2026-04-31', '0000-01-01', '2026-1-01', "2026-01-01' or '1'='1", '2026-01-01T00:00:00Z', '']) {
      expect(() => dayLiteral(attempt), attempt).toThrow(UnsafeValue);
    }
    expect(booleanLiteral(true)).toBe('true');
    expect(booleanLiteral(false)).toBe('false');
    expect(() => booleanLiteral('true or 1=1' as unknown as boolean)).toThrow(UnsafeValue);
  });

  it('says where a text says nothing: no value, empty, only spaces or a text of the list, trimmed and in lower case (DEC-ED-35)', () => {
    expect(saysNothingOf(field('lead_channel'))).toBe(
      "(`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'n/a', 'na', 'null', 'none', 'unknown', 'onbekend', '-', '?', 'tbd'))",
    );
    // The lists of the EDA, compared trimmed and in lower case, the empty text always among them.
    const lists = { text: [' N/A ', 'Leeg', "it's", 'leeg'], date: [], number: [], ninesOnly: false };
    expect(saysNothingOf(field('lead_channel'), lists)).toBe("(`lead_channel` is null or lower(trim(`lead_channel`)) in ('', 'n/a', 'leeg', 'it\\'s'))");
  });

  it('says where a date says nothing: no value, or its day in Brussels one of the days of the list (DEC-ED-35)', () => {
    const days = "(date '1900-01-01', date '1970-01-01', date '0001-01-01', date '9999-12-31')";
    expect(saysNothingOf(field('week_start'))).toBe(`(\`week_start\` is null or \`week_start\` in ${days})`);
    expect(saysNothingOf(field('loaded_at'))).toBe(`(\`loaded_at\` is null or date(\`loaded_at\`, 'Europe/Brussels') in ${days})`);
    expect(saysNothingOf(fieldOf('seen_at', 'DATETIME'))).toBe(`(\`seen_at\` is null or date(\`seen_at\`) in ${days})`);
    expect(saysNothingOf(field('week_start'), { text: [], date: [], number: [], ninesOnly: true })).toBe('`week_start` is null');
  });

  it('says where a number says nothing: no value, a number of the list or of nines only, never zero (DEC-ED-35)', () => {
    expect(saysNothingOf(field('lead_count'))).toBe("(`lead_count` is null or `lead_count` in (-1) or regexp_contains(cast(`lead_count` as string), r'^-?9{3,}(\\.0+)?$'))");
    expect(saysNothingOf(fieldOf('price', 'NUMERIC(12, 2)'), { text: [], date: [], number: [0, -1, 9999.5, -1], ninesOnly: false })).toBe('(`price` is null or `price` in (-1, 9999.5))');
    expect(saysNothingOf(fieldOf('price', 'NUMERIC(12, 2)'), { text: [], date: [], number: [0], ninesOnly: false })).toBe('`price` is null');
  });

  it('says where a field of any other kind says nothing: only without a value', () => {
    expect(saysNothingOf(fieldOf('is_test', 'BOOL'))).toBe('`is_test` is null');
    expect(saysNothingOf(fieldOf('payload', 'JSON'))).toBe('`payload` is null');
    expect(saysNothingOf(fieldOf('odd`name', null))).toBe('`odd\\`name` is null');
  });

  it('writes equals and a range by the kind of the field, a date on its day in Brussels', () => {
    expect(conditionOf({ kind: 'equals', field: 'lead_channel', value: 'web' }, WIDER)).toBe("`lead_channel` = 'web'");
    expect(conditionOf({ kind: 'equals', field: 'lead_count', value: -1.5 }, WIDER)).toBe('`lead_count` = -1.5');
    expect(conditionOf({ kind: 'equals', field: 'loaded_at', value: '2026-11-16' }, WIDER)).toBe("date(`loaded_at`, 'Europe/Brussels') = date '2026-11-16'");
    expect(conditionOf({ kind: 'equals', field: 'seen_at', value: '2026-11-16' }, WIDER)).toBe("date(`seen_at`) = date '2026-11-16'");
    expect(conditionOf({ kind: 'equals', field: 'is_test', value: false }, WIDER)).toBe('`is_test` = false');
    expect(conditionOf({ kind: 'range', field: 'lead_count', from: 10 }, WIDER)).toBe('`lead_count` >= 10');
    expect(conditionOf({ kind: 'range', field: 'lead_count', before: 100 }, WIDER)).toBe('`lead_count` < 100');
    expect(conditionOf({ kind: 'range', field: 'week_start', from: '2026-01-05', before: '2026-02-02' }, WIDER)).toBe(
      "(`week_start` >= date '2026-01-05' and `week_start` < date '2026-02-02')",
    );
    expect(conditionOf({ kind: 'saysNothing', field: 'payload' }, WIDER)).toBe('`payload` is null');
  });

  it('writes empty as the field without a value, whatever its kind, its name quoted', () => {
    expect(conditionOf({ kind: 'empty', field: 'lead_channel' }, WIDER)).toBe('`lead_channel` is null');
    expect(conditionOf({ kind: 'empty', field: 'lead_count' }, WIDER)).toBe('`lead_count` is null');
    expect(conditionOf({ kind: 'empty', field: 'loaded_at' }, WIDER)).toBe('`loaded_at` is null');
    expect(conditionOf({ kind: 'empty', field: 'is_test' }, WIDER)).toBe('`is_test` is null');
    expect(conditionOf({ kind: 'empty', field: 'payload' }, WIDER)).toBe('`payload` is null');
    // Not the lists of Disguised nulls: only no value at all.
    expect(conditionOf({ kind: 'empty', field: 'lead_channel' }, WIDER, { text: ['leeg'], date: [], number: [-1], ninesOnly: true })).toBe('`lead_channel` is null');
    // A field of the Resource with a backtick in its name stays one name.
    const odd = { ...WIDER, resource: { ...WIDER.resource, fields: [...WIDER.resource.fields, fieldOf('odd` is null or true or `x', 'STRING')] } };
    expect(conditionOf({ kind: 'empty', field: 'odd` is null or true or `x' }, odd)).toBe('`odd\\` is null or true or \\`x` is null');
  });

  it('refuses a field that is none of the Resource, and a value that does not fit the kind of its field, rather than write it', () => {
    for (const condition of [
      { kind: 'saysNothing', field: 'lead_channel` is null or true or `x' },
      { kind: 'empty', field: 'lead_channel` is null or true or `x' },
      { kind: 'empty', field: 'no_such_field' },
      { kind: 'equals', field: 'lead_count', value: '1 or 1=1' },
      { kind: 'equals', field: 'lead_count', value: Number.NaN },
      { kind: 'equals', field: 'lead_channel', value: 1 },
      { kind: 'equals', field: 'week_start', value: "2026-01-01' or '1'='1" },
      { kind: 'equals', field: 'is_test', value: 'true' },
      { kind: 'equals', field: 'payload', value: '{}' },
      { kind: 'range', field: 'lead_channel', from: 'a' },
      { kind: 'range', field: 'lead_count' },
      { kind: 'range', field: 'lead_count', from: '0) or (1=1' },
      { kind: 'where', field: 'lead_count', sql: 'true' },
    ]) {
      expect(() => conditionOf(condition as never, WIDER), JSON.stringify(condition)).toThrow(UnsafeValue);
    }
  });
});
