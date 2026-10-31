import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, backgroundsOf, chooseBackground, choosePhoto, PHOTOS, RANDOM } from './backgrounds.js';

describe('the backgrounds, a set per theme (DEC-UX-108, DEC-UX-109)', () => {
  it('holds by day the clouds, the flowing gradient, five lights and seven pictures; by night the gradient, the flow, four lights and the village', () => {
    expect(backgroundsOf('light').map((b) => b.id)).toEqual(['gradient', 'flow', 'periwinkle', 'sunrise', 'apricot', 'blush', 'sky', 'ski', 'alpenglow', 'spring', 'fusilli', 'piste', 'concrete', 'spindrift']);
    expect(backgroundsOf('dark').map((b) => b.id)).toEqual(['gradient', 'flow', 'aurora', 'ember', 'dusk', 'horizon', 'village']);
    expect(new Set(BACKGROUNDS.map((b) => b.id)).size).toBe(BACKGROUNDS.length);
  });

  it('shows the photos of Fusilli, Fresh piste, Concrete and Spindrift as they are, covering the window (DEC-UX-110, DEC-UX-112, DEC-UX-113, DEC-UX-153)', () => {
    expect(BACKGROUNDS.filter((b) => b.cover).map((b) => b.id)).toEqual(['fusilli', 'piste', 'concrete', 'spindrift']);
  });

  it('lets the wind play in Spindrift only: mist down to its sky, snow from its ground (DEC-UX-153)', () => {
    expect(BACKGROUNDS.filter((b) => b.wind).map((b) => b.id)).toEqual(['spindrift']);
    const wind = BACKGROUNDS.find((b) => b.id === 'spindrift')?.wind;
    expect(wind && wind.sky < wind.ground && wind.focus >= 0 && wind.focus <= 1).toBe(true);
  });

  it('takes the background the User chose for the theme', () => {
    expect(chooseBackground('dark', 'aurora').id).toBe('aurora');
    expect(chooseBackground('light', 'gradient').id).toBe('gradient');
  });

  it('picks one of the set of the theme at random for Random, nothing, or a choice that is not in the set', () => {
    expect(chooseBackground('light', RANDOM, () => 0).id).toBe('gradient');
    expect(chooseBackground('light', undefined, () => 0.999).id).toBe('spindrift');
    expect(chooseBackground('dark', 'alpenglow', () => 0.999).id).toBe('village');
  });

  it('picks the photo of the sign-in from the set of the theme', () => {
    expect(PHOTOS.filter((p) => p.theme === 'light').map((p) => p.id)).toEqual(['alpenglow', 'spring']);
    expect(choosePhoto('dark').id).toBe('village');
    expect(choosePhoto('light', () => 0.9).id).toBe('spring');
  });
});
