import type { CollectionIcon } from './collections.js';
import { PHOSPHOR_ICONS } from './phosphorIcons.js';

/**
 * The icons a Collection can carry (DEC-CO-19), as an entry point of its own: the list is large,
 * so the web app loads it only when a Collection is created or edited, never with the page.
 */
export { PHOSPHOR_ICONS, PHOSPHOR_ICONS_VERSION } from './phosphorIcons.js';

/** What the choice of an icon shows before anything is typed: the functional domains of Immoscoop. */
export const COLLECTION_ICON_SUGGESTIONS: readonly CollectionIcon[] = [
  'coins',
  'wallet',
  'bank',
  'house-line',
  'buildings',
  'briefcase',
  'handshake',
  'megaphone',
  'binoculars',
  'key',
  'chart-line-up',
  'users',
];

let names: ReadonlySet<string> | undefined;

/** Whether this is the name of an icon of Phosphor that is not the logo of a brand. */
export function isCollectionIcon(value: unknown): value is CollectionIcon {
  names ??= new Set(PHOSPHOR_ICONS.map(([name]) => name));
  return typeof value === 'string' && names.has(value);
}

/**
 * The icons that fit what was typed, best first: every word typed starts a word of the name of the
 * icon, or of the words Phosphor gives it, so that "money" finds the coins and "house" the home. An
 * icon whose own name fits comes before one that fits by its words only.
 */
export function findCollectionIcons(query: string, limit = 60): CollectionIcon[] {
  const typed = query.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (typed.length === 0) {
    return [...COLLECTION_ICON_SUGGESTIONS];
  }
  const byName: CollectionIcon[] = [];
  const byWords: CollectionIcon[] = [];
  for (const [name, words] of PHOSPHOR_ICONS) {
    const own = name.split('-');
    const all = [...own, ...words.split(' ')];
    if (typed.every((word) => own.some((part) => part.startsWith(word)))) {
      byName.push(name);
    } else if (typed.every((word) => all.some((part) => part.startsWith(word)))) {
      byWords.push(name);
    }
  }
  return [...byName, ...byWords].slice(0, limit);
}
