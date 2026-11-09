import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, backgroundsOf, chooseBackground, RANDOM } from './backgrounds.js';

describe('the backgrounds, a set per theme (DEC-UX-108, DEC-UX-109, DEC-UX-173)', () => {
  it('holds by day the clouds, the flowing gradient, five lights, six painted scenes and Concrete; by night the gradient, the flow, four lights and four painted scenes', () => {
    expect(backgroundsOf('light').map((b) => b.id)).toEqual(['gradient', 'flow', 'periwinkle', 'sunrise', 'apricot', 'blush', 'sky', 'prism', 'cinnamon', 'evening', 'citrus', 'orchid', 'tide', 'concrete']);
    expect(backgroundsOf('dark').map((b) => b.id)).toEqual(['gradient', 'flow', 'borealis', 'ember', 'dusk', 'horizon', 'afterglow', 'lumen', 'cobalt', 'midnight']);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(BACKGROUNDS.length);
  });

  it('paints Prism and five scenes of two sides by day, and four scenes by night (DEC-UX-198, DEC-UX-199)', () => {
    expect(BACKGROUNDS.filter((b) => b.kind === 'painted').map((b) => [b.id, b.themes[0]])).toEqual([
      ['prism', 'light'], ['cinnamon', 'light'], ['evening', 'light'], ['citrus', 'light'], ['orchid', 'light'], ['tide', 'light'],
      ['afterglow', 'dark'], ['lumen', 'dark'], ['cobalt', 'dark'], ['midnight', 'dark'],
    ]);
  });

  it('shows the photo of Concrete as it is, covering the window (DEC-UX-113)', () => {
    expect(BACKGROUNDS.filter((b) => b.kind === 'picture').map((b) => [b.id, b.cover])).toEqual([['concrete', true]]);
  });

  it('takes the background the User chose for the theme', () => {
    expect(chooseBackground('dark', 'borealis').id).toBe('borealis');
    expect(chooseBackground('light', 'gradient').id).toBe('gradient');
  });

  it('picks one of the set of the theme at random for Random, nothing, or a choice that is not in the set (any more)', () => {
    expect(chooseBackground('light', RANDOM, () => 0).id).toBe('gradient');
    expect(chooseBackground('light', undefined, () => 0.999).id).toBe('concrete');
    // A background that left the set, such as Fresh piste, gives way to one at random.
    expect(chooseBackground('light', 'piste', () => 0).id).toBe('gradient');
    expect(chooseBackground('dark', 'concrete', () => 0.999).id).toBe('midnight');
  });

  it('shows a still of every moving background on My page: a token for it, painted by the picker', () => {
    const root = path.resolve(import.meta.dirname, '../../../..');
    const tokens = readFileSync(path.join(root, 'docs/design/tokens.css'), 'utf8');
    const picker = readFileSync(path.join(root, 'packages/ui/src/components/BackgroundPicker.svelte'), 'utf8');
    const painted = picker.match(/^\s*([.\w, ]+)\{ background: var\(--preview\); \}/m)?.[1] ?? '';
    for (const background of BACKGROUNDS.filter((b) => b.kind === 'flow' || b.kind === 'lights' || b.kind === 'painted')) {
      expect(tokens, background.id).toContain(`--bg-prev-${background.id}:`);
      expect(painted.split(',').map((kind) => kind.trim()), background.kind).toContain(`.${background.kind}`);
    }
  });
});
