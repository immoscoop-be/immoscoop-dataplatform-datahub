import { describe, expect, it } from 'vitest';
import { asCsv, asJson, ROWS_COPIED } from './copyResult.js';

const columns = [
  { name: 'week', type: 'DATE' },
  { name: 'leads', type: 'INT64' },
  { name: 'share', type: 'FLOAT64' },
  { name: 'paid', type: 'BOOL' },
  { name: 'amount', type: 'NUMERIC' },
  { name: 'tags', type: 'ARRAY<STRING>' },
  { name: 'source', type: 'STRING' },
];

describe('Copy as JSON (DEC-UX-292)', () => {
  it('keeps numbers, true and false, lists and records, and null; a NUMERIC stays text', () => {
    const rows = [['2026-10-19', '42', '0.25', 'true', '12.30', '["a","b"]', 'website']];
    expect(JSON.parse(asJson(columns, rows))).toEqual([{ week: '2026-10-19', leads: 42, share: 0.25, paid: true, amount: '12.30', tags: ['a', 'b'], source: 'website' }]);
    expect(JSON.parse(asJson(columns, [[null, null, null, null, null, null, null]]))).toEqual([{ week: null, leads: null, share: null, paid: null, amount: null, tags: null, source: null }]);
  });

  it('keeps an integer beyond what a number holds exactly as text, so that no digit is lost', () => {
    const big = '9007199254740993';
    expect(JSON.parse(asJson([{ name: 'id', type: 'INT64' }], [[big]]))).toEqual([{ id: big }]);
  });

  it('copies the first 100 rows only', () => {
    const rows = Array.from({ length: 150 }, (_, at) => [String(at)]);
    const copied = JSON.parse(asJson([{ name: 'n', type: 'INT64' }], rows)) as unknown[];
    expect(copied).toHaveLength(ROWS_COPIED);
    expect(copied.at(-1)).toEqual({ n: 99 });
  });
});

describe('Copy as CSV (DEC-UX-292)', () => {
  it('has a header row, a comma between values and a Windows line break; null is empty', () => {
    const csv = asCsv(columns.slice(0, 3), [['2026-10-19', '42', null]]);
    expect(csv).toBe('week,leads,share\r\n2026-10-19,42,');
  });

  it('quotes a value with a comma, a quote, a line break or a space at its edge, a quote doubled', () => {
    const csv = asCsv([{ name: 'text', type: 'STRING' }], [['a,b'], ['say "hi"'], ['two\nlines'], [' padded'], ['plain']]);
    expect(csv.split('\r\n')).toEqual(['text', '"a,b"', '"say ""hi"""', '"two\nlines"', '" padded"', 'plain']);
  });

  it('writes a list or a record as its JSON, between quotes', () => {
    expect(asCsv([{ name: 'tags', type: 'ARRAY<STRING>' }], [['["a","b"]']])).toBe('tags\r\n"[""a"",""b""]"');
  });

  it('copies the first 100 rows only, under the header', () => {
    const rows = Array.from({ length: 101 }, (_, at) => [String(at)]);
    expect(asCsv([{ name: 'n', type: 'INT64' }], rows).split('\r\n')).toHaveLength(ROWS_COPIED + 1);
  });
});
