import type { CollectionIcon as IconName } from '@datahub/contracts/collections';
import type { ComboboxItem, ComboboxParsedItemGroup } from '@mantine/core';

/**
 * Suggestions for the functional domains of Immoscoop, offered before anything is typed. Every other
 * outline icon of Tabler Icons is found by searching (DEC-CO-14).
 */
export const SUGGESTED_ICONS: readonly IconName[] = [
  'home', 'building', 'building-estate', 'building-community', 'building-store', 'building-bank', 'buildings', 'building-cottage', 'home-search',
  'map-pin', 'map', 'world', 'world-www', 'route', 'compass',
  'users', 'user', 'user-check', 'users-group', 'id-badge', 'briefcase',
  'currency-euro', 'cash', 'credit-card', 'receipt', 'report-money', 'pig-money', 'coins',
  'chart-bar', 'chart-line', 'chart-pie', 'chart-dots', 'trending-up', 'target', 'presentation-analytics',
  'mail', 'mail-opened', 'send', 'message-circle', 'phone', 'bell', 'speakerphone', 'ad',
  'calendar', 'clock', 'search', 'eye', 'click', 'pointer', 'device-mobile', 'device-desktop', 'browser',
  'tag', 'star', 'heart', 'key', 'lock', 'shield-check',
  'file-text', 'files', 'database', 'server', 'cloud', 'plug', 'bolt',
  'leaf', 'tree', 'car', 'train', 'school', 'tool', 'settings', 'checklist', 'clipboard-list', 'list-details', 'filter',
];

/** The icons to search, as `@datahub/contracts/collection-icons` holds them. */
export interface IconIndex {
  categories: readonly string[];
  /** Name, the place of its category, and the words Tabler gives it beyond those of its name. */
  icons: readonly (readonly [name: string, category: number, words: string])[];
}

/** `building-estate` → `Building estate`. */
export function iconLabel(name: IconName): string {
  const words = name.replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function iconItem(name: IconName): ComboboxItem {
  return { value: name, label: iconLabel(name) };
}

/** 0 when the word typed begins a word of the name, 1 + where it begins one of Tabler's words, or nothing. */
function placeOf(word: string, own: readonly string[], tabler: readonly string[]): number | undefined {
  if (own.some((part) => part.startsWith(word))) {
    return 0;
  }
  const at = tabler.findIndex((candidate) => candidate.startsWith(word));
  return at < 0 ? undefined : 1 + at;
}

/**
 * The icons a search finds, best first, grouped by Tabler's category in the order of their best
 * icon. Every word typed must begin a word of the icon's name or one of Tabler's words for it, so
 * "house" finds `home`, "money" finds `coins` and "build est" finds `building-estate`. An icon whose
 * name is what was typed comes first, then names that begin with it, then names that hold every
 * word, then the icons found only through Tabler's words. Tabler lists its most fitting words first,
 * so among those the icon whose word comes earliest goes first: "house" is the first word of `home`,
 * the third of `door`. Shorter names go first after that.
 */
export function searchIcons(index: IconIndex, search: string, limit: number): ComboboxParsedItemGroup[] {
  const typed = search.toLowerCase().split(/[\s-]+/).filter(Boolean);
  if (typed.length === 0) {
    return [];
  }
  const joined = typed.join('-');
  const found: { name: string; category: number; rank: number; place: number }[] = [];
  for (const [name, category, words] of index.icons) {
    const own = name.split('-');
    const tabler = words ? words.split(' ') : [];
    const places = typed.map((word) => placeOf(word, own, tabler));
    if (places.some((place) => place === undefined)) {
      continue;
    }
    const rank = name === joined ? 0 : name.startsWith(joined) ? 1 : places.every((place) => place === 0) ? 2 : 3;
    found.push({ name, category, rank, place: Math.max(...(places as number[])) });
  }
  found.sort((a, b) => a.rank - b.rank || a.place - b.place || a.name.length - b.name.length || (a.name < b.name ? -1 : 1));

  const groups = new Map<number, ComboboxItem[]>();
  for (const { name, category } of found.slice(0, limit)) {
    const items = groups.get(category) ?? [];
    items.push(iconItem(name));
    groups.set(category, items);
  }
  return [...groups].map(([category, items]) => ({ group: index.categories[category] ?? 'Other', items }));
}

/**
 * The icon of a Collection, in the colour of the text around it. Its drawing is the file
 * `icons/<name>.svg`, which the browser fetches only now, laid as a mask over that colour (DEC-CO-14).
 */
export function CollectionIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  const mask = `url("/icons/${encodeURIComponent(name)}.svg") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      data-icon={name}
      style={{ display: 'inline-block', flex: 'none', width: size, height: size, backgroundColor: 'currentColor', mask, WebkitMask: mask }}
    />
  );
}
