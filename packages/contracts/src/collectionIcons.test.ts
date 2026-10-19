import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isCollectionIcon, TABLER_CATEGORIES, TABLER_ICONS, TABLER_ICONS_VERSION } from './collectionIcons.js';

// The Tabler Icons the web app installs, whose drawings it serves.
const tabler = new URL('../../../apps/web/node_modules/@tabler/icons/', import.meta.url);

describe('the icons of a Collection (DEC-CO-14)', () => {
  it('are every outline icon of the installed Tabler Icons but the logos of brands; after an upgrade, run `pnpm icons:build`', () => {
    const installed = JSON.parse(readFileSync(new URL('package.json', tabler), 'utf8')) as { version: string };
    const index = JSON.parse(readFileSync(new URL('icons.json', tabler), 'utf8')) as Record<string, { name: string; category: string }>;
    expect(TABLER_ICONS_VERSION).toBe(installed.version);
    const expected = Object.values(index)
      .filter((icon) => icon.category !== 'Brand')
      .map((icon) => icon.name)
      .sort();
    expect(TABLER_ICONS.map(([name]) => name)).toEqual(expected);
    expect(TABLER_ICONS.filter(([name]) => !existsSync(new URL(`icons/outline/${name}.svg`, tabler)))).toEqual([]);
    expect(TABLER_ICONS.every(([, category]) => TABLER_CATEGORIES[category] !== undefined)).toBe(true);
  });

  it('accepts only the exact name of one of them', () => {
    expect(isCollectionIcon('building-estate')).toBe(true);
    expect(isCollectionIcon('rocket')).toBe(true);
    expect(isCollectionIcon('brand-google')).toBe(false);
    expect(isCollectionIcon('Building-Estate')).toBe(false);
    expect(isCollectionIcon('../building-estate')).toBe(false);
    expect(isCollectionIcon(null)).toBe(false);
    expect(isCollectionIcon(42)).toBe(false);
  });
});
