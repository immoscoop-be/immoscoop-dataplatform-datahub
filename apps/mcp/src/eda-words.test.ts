import { DISGUISED_NINES, type DisguisedResult, type ResultView } from '@datahub/contracts/eda';
import { describe, expect, it } from 'vitest';
import { conclusionOf, foundName, resultTable } from './eda-words.js';

const result = (subject: string, data: DisguisedResult, reading: ResultView['reading']): ResultView => ({ subject, data, reading, yours: null });

describe('Disguised nulls in words (DEC-ED-35)', () => {
  const results = [
    result('week_start', { rows: 1000, saysNothing: 0, nulls: 0, found: [], role: 'period' }, 'expected'),
    result('lead_source', { rows: 1000, saysNothing: 40, nulls: 10, found: [{ value: 'n/a', rows: 25 }, { value: '', rows: 5 }], role: 'groupedBy' }, 'look'),
    result('lead_count', { rows: 1000, saysNothing: 30, nulls: 0, found: [{ value: DISGUISED_NINES, rows: 30 }], role: null }, 'judge'),
  ];

  it('names the values found: the empty text, nines only, else in quotes', () => {
    expect(foundName('')).toBe('the empty text');
    expect(foundName(DISGUISED_NINES)).toBe('nines only (999…9)');
    expect(foundName('n/a')).toBe('"n/a"');
  });

  it('says per field how many rows say nothing, and by what', () => {
    expect(conclusionOf('disguisedNulls', results, [])).toBe(
      '`lead_source` says nothing on 40 rows, though its role, grouped by, needs a value on every row: 10 without a value, "n/a" on 25, the empty text on 5. ' +
        '`lead_count` says nothing on 3% of rows: nines only (999…9) on 30. `week_start` never says nothing.',
    );
    expect(conclusionOf('disguisedNulls', [results[0] as ResultView], [])).toBe('No field it is set on says nothing: 1 field, 1,000 rows.');
  });

  it('gives a row per field, and asks no reading where nothing says nothing', () => {
    const table = resultTable('disguisedNulls', results, [], true);
    expect(table.columns).toEqual(['Field', 'Says nothing', 'Values found']);
    expect(table.rows.map((row) => [row.subject, row.cells, row.asks])).toEqual([
      ['week_start', ['0', '–'], false],
      ['lead_source', ['40 · 4%', '"n/a" 25 · the empty text 5'], true],
      ['lead_count', ['30 · 3%', 'nines only (999…9) 30'], true],
    ]);
  });
});
