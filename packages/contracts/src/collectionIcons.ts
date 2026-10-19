import type { CollectionIcon } from './collections.js';
import { TABLER_ICONS } from './tablerIcons.js';

/**
 * The icons a Collection can carry (DEC-CO-14), as an entry point of its own: the list is large,
 * so the web app loads it only when a Collection is created or edited, never with the page.
 */
export { TABLER_CATEGORIES, TABLER_ICONS, TABLER_ICONS_VERSION } from './tablerIcons.js';

let names: ReadonlySet<string> | undefined;

/** Whether this is the name of an outline icon of Tabler Icons that is not the logo of a brand. */
export function isCollectionIcon(value: unknown): value is CollectionIcon {
  names ??= new Set(TABLER_ICONS.map(([name]) => name));
  return typeof value === 'string' && names.has(value);
}
