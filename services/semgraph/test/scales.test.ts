import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { niceRange, niceTicks, ticksEvery, valueScale } from '../src/charts/scales.ts';

describe('scales', () => {
  it('chooses round value ticks from zero', () => {
    assert.deepEqual(niceTicks(57.3), [0, 20, 40, 60]);
    assert.deepEqual(niceTicks(9), [0, 2.5, 5, 7.5, 10]);
    assert.deepEqual(niceTicks(0), [0, 1]);
    assert.deepEqual(niceTicks(1840), [0, 500, 1000, 1500, 2000]);
  });

  it('zooms to round values around the data', () => {
    assert.deepEqual(niceRange(28.1, 57.6), [20, 30, 40, 50, 60]);
    assert.deepEqual(niceRange(1210, 1290), [1200, 1220, 1240, 1260, 1280, 1300]);
  });

  it('starts at zero unless zoom is asked, and only marks a real zoom', () => {
    assert.deepEqual(valueScale(28.1, 57.6, 'zero'), { ticks: [0, 20, 40, 60], min: 0, max: 60, zoomed: false });
    assert.deepEqual(valueScale(28.1, 57.6, 'zoom'), { ticks: [20, 30, 40, 50, 60], min: 20, max: 60, zoomed: true });
    // Close to zero, the round start is zero anyway: no zigzag.
    assert.equal(valueScale(3, 57.6, 'zoom').zoomed, false);
  });

  it('places time ticks back from the last slot', () => {
    assert.deepEqual(ticksEvery(7, 28), [-21, -14, -7, 0]);
    assert.deepEqual(ticksEvery(7, 7), [-6, 0]);
  });
});
