import { describe, expect, it, vi } from 'vitest';
import { Backgrounds } from './background.svelte.js';
import { Settings } from './settings.svelte.js';

/** Random numbers in turn, so that each pick is known. */
function sequence(...numbers: number[]): () => number {
  let next = 0;
  return () => numbers[next++ % numbers.length] as number;
}

describe('the background on screen (DEC-UX-108)', () => {
  it('is one at random by default, kept while the theme stays', () => {
    const backgrounds = new Backgrounds(new Settings({}, async () => {}), sequence(0, 0.99));
    expect(backgrounds.choiceOf('light')).toBe('random');
    expect(backgrounds.of('light').id).toBe('gradient');
    expect(backgrounds.of('light').id).toBe('gradient');
  });

  it('is picked again when the User switches between day and night (DEC-UX-94)', () => {
    const backgrounds = new Backgrounds(new Settings({}, async () => {}), sequence(0, 0.99, 0.99));
    expect(backgrounds.of('light').id).toBe('gradient');
    expect(backgrounds.of('dark').id).toBe('village');
    expect(backgrounds.of('light').id).toBe('peaks');
  });

  it('is the one the User chose for the theme, kept per theme', () => {
    const save = vi.fn(async () => {});
    const backgrounds = new Backgrounds(new Settings({ 'background.dark': 'aurora' }, save));
    expect(backgrounds.of('dark').id).toBe('aurora');
    backgrounds.choose('light', 'piste');
    expect(save).toHaveBeenCalledWith('background.light', 'piste');
    expect(backgrounds.of('light').id).toBe('piste');
    expect(backgrounds.of('dark').id).toBe('aurora');
  });

  it('picks again when the User chooses Random', () => {
    const backgrounds = new Backgrounds(new Settings({ 'background.light': 'piste' }, async () => {}), sequence(0, 0.99));
    backgrounds.choose('light', 'random');
    expect(backgrounds.of('light').id).toBe('gradient');
    backgrounds.choose('light', 'random');
    expect(backgrounds.of('light').id).toBe('peaks');
  });
});
