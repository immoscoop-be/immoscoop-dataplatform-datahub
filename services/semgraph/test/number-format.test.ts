import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { CompactFormat } from '../src/charts/number-format.ts';

describe('compact numbers, as Figma writes them on bar charts', () => {
  it('writes thousands and millions with k and M once the axis reaches them, one decimal below ten', () => {
    const counts = new CompactFormat('nl-BE', 2000);
    assert.deepEqual([1820, 610, 12000].map((value) => counts.value(value)), ['1,8k', '0,6k', '12k']);
    assert.equal(new CompactFormat('en', 2_500_000, { prefix: '€ ' }).value(1_250_000), '€ 1.3M');
    assert.equal(new CompactFormat('nl-BE', 80).value(45), '45');
  });

  it('puts the unit around the number, and keeps a currency in front off the spread', () => {
    const euro = new CompactFormat('nl-BE', 600000, { prefix: '€ ' });
    assert.equal(euro.value(390000), '€ 390k');
    assert.equal(euro.range(300000, 510000), '300–510k');
    assert.equal(euro.plusMinus(170000), '± 170k');
    const days = new CompactFormat('nl-BE', 150, { suffix: ' d' });
    assert.equal(days.value(45), '45 d');
    assert.equal(days.plusMinus(28), '± 28 d');
  });

  it('gives the axis the decimals of its step; zero keeps only the currency', () => {
    assert.deepEqual(Object.values(new CompactFormat('nl-BE', 2000).ticks([0, 500, 1000, 1500, 2000])), ['0', '0,5k', '1,0k', '1,5k', '2,0k']);
    assert.deepEqual(Object.values(new CompactFormat('nl-BE', 600000, { prefix: '€ ' }).ticks([0, 200000, 400000, 600000])), ['€ 0', '€ 200k', '€ 400k', '€ 600k']);
    assert.deepEqual(Object.values(new CompactFormat('nl-BE', 150, { suffix: ' d' }).ticks([0, 50, 100, 150])), ['0', '50 d', '100 d', '150 d']);
  });

  it('writes a difference with an arrow, in the precision of the axis, with the decimals its first digit needs', () => {
    const counts = new CompactFormat('nl-BE', 2000);
    assert.deepEqual([200, 80, -80, 50, 0].map((value) => counts.difference(value)), ['▲ 0,2k', '▲ 0,08k', '▼ 0,08k', '▲ 0,05k', '= 0']);
    const months = new CompactFormat('nl-BE', 60000);
    assert.deepEqual([3000, -1000, -16000, 400].map((value) => months.difference(value)), ['▲ 3k', '▼ 1k', '▼ 16k', '▲ 0,4k']);
    assert.equal(new CompactFormat('nl-BE', 600000, { prefix: '€ ' }).difference(-20000), '▼ 20k');
    assert.equal(new CompactFormat('nl-BE', 150, { suffix: ' d' }).difference(3), '▲ 3 d');
  });
});
