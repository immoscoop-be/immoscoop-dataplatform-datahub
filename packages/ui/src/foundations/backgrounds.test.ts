import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, backgroundsOf, chooseBackground, RANDOM } from './backgrounds.js';

describe('the backgrounds, a set per theme (DEC-UX-108, DEC-UX-109, DEC-UX-173)', () => {
  it('holds by day the clouds, the flowing gradient, five lights and Concrete; by night the gradient, the flow and four lights', () => {
    expect(backgroundsOf('light').map((b) => b.id)).toEqual(['gradient', 'flow', 'periwinkle', 'sunrise', 'apricot', 'blush', 'sky', 'concrete']);
    expect(backgroundsOf('dark').map((b) => b.id)).toEqual(['gradient', 'flow', 'aurora', 'ember', 'dusk', 'horizon']);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(BACKGROUNDS.length);
  });

  it('shows the photo of Concrete as it is, covering the window (DEC-UX-113)', () => {
    expect(BACKGROUNDS.filter((b) => b.kind === 'picture').map((b) => [b.id, b.cover])).toEqual([['concrete', true]]);
  });

  it('takes the background the User chose for the theme', () => {
    expect(chooseBackground('dark', 'aurora').id).toBe('aurora');
    expect(chooseBackground('light', 'gradient').id).toBe('gradient');
  });

  it('picks one of the set of the theme at random for Random, nothing, or a choice that is not in the set (any more)', () => {
    expect(chooseBackground('light', RANDOM, () => 0).id).toBe('gradient');
    expect(chooseBackground('light', undefined, () => 0.999).id).toBe('concrete');
    // A background that left the set, such as Fresh piste, gives way to one at random.
    expect(chooseBackground('light', 'piste', () => 0).id).toBe('gradient');
    expect(chooseBackground('dark', 'concrete', () => 0.999).id).toBe('horizon');
  });
});
