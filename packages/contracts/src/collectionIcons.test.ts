import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLLECTION_ICON_SUGGESTIONS, findCollectionIcons, isCollectionIcon, PHOSPHOR_ICONS, PHOSPHOR_ICONS_VERSION } from './collectionIcons.js';

// The Phosphor the web app installs, whose drawings it shows.
const phosphor = new URL('../node_modules/@phosphor-icons/core/', import.meta.url);

describe('the icons of a Collection (DEC-CO-19)', () => {
  it('are every icon of the installed Phosphor but the logos of brands; after an upgrade, run `pnpm icons:build`', async () => {
    const installed = JSON.parse(readFileSync(new URL('package.json', phosphor), 'utf8')) as { version: string };
    const { icons } = (await import(new URL('dist/index.mjs', phosphor).href)) as { icons: { name: string; categories: string[] }[] };
    expect(PHOSPHOR_ICONS_VERSION).toBe(installed.version);
    const expected = icons
      .filter((icon) => !icon.categories.includes('brands'))
      .map((icon) => icon.name)
      .sort();
    expect(PHOSPHOR_ICONS.map(([name]) => name)).toEqual(expected);
    // Each is drawn in the light weight (DEC-CO-19).
    expect(PHOSPHOR_ICONS.filter(([name]) => !existsSync(new URL(`assets/light/${name}-light.svg`, phosphor)))).toEqual([]);
  });

  it('accepts only the exact name of one of them', () => {
    expect(isCollectionIcon('house-line')).toBe(true);
    expect(isCollectionIcon('rocket')).toBe(true);
    expect(isCollectionIcon('google-logo')).toBe(false);
    expect(isCollectionIcon('House-Line')).toBe(false);
    expect(isCollectionIcon('../house-line')).toBe(false);
    expect(isCollectionIcon(null)).toBe(false);
    expect(isCollectionIcon(42)).toBe(false);
  });

  it('suggests icons for the functional domains of Immoscoop, all of them in the list', () => {
    expect(COLLECTION_ICON_SUGGESTIONS.every(isCollectionIcon)).toBe(true);
    expect(findCollectionIcons('  ')).toEqual(COLLECTION_ICON_SUGGESTIONS);
  });

  it('are found by the words of their name first, then by the words Phosphor gives them', () => {
    expect(findCollectionIcons('house').slice(0, 3)).toEqual(['house', 'house-line', 'house-simple']);
    expect(findCollectionIcons('home')).toContain('house-line');
    const money = findCollectionIcons('money');
    expect(money.indexOf('money-wavy')).toBeLessThan(money.indexOf('coins'));
    expect(findCollectionIcons('chart line')).toContain('chart-line-up');
    expect(findCollectionIcons('google')).not.toContain('google-logo');
    expect(findCollectionIcons('a', 5)).toHaveLength(5);
  });
});
