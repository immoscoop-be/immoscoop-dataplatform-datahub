/**
 * The colours of a Collection: the "muted" palette by Paul Tol, easy to tell apart, also with a
 * colour vision deficiency (DEC-CO-07, FR-CO-04). catalogue keeps the name; the web app shows the hex.
 */
export const COLLECTION_COLOURS = {
  rose: '#CC6677',
  indigo: '#332288',
  sand: '#DDCC77',
  green: '#117733',
  cyan: '#88CCEE',
  wine: '#882255',
  teal: '#44AA99',
  olive: '#999933',
  purple: '#AA4499',
} as const;

export type CollectionColour = keyof typeof COLLECTION_COLOURS;

export function isCollectionColour(value: unknown): value is CollectionColour {
  return typeof value === 'string' && Object.hasOwn(COLLECTION_COLOURS, value);
}

/** Private: its Owner Unit and the Data Team see it. Public: every User does (DEC-CO-10). */
export type CollectionVisibility = 'private' | 'public';

/**
 * The icons a Collection can carry: Tabler Icons, outline, by their name there (DEC-CO-13,
 * FR-CO-05). A list chosen for the functional domains of Immoscoop rather than all ~5,000, so that
 * the choice stays short and the web app only bundles these.
 */
export const COLLECTION_ICONS = [
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
] as const;

export type CollectionIcon = (typeof COLLECTION_ICONS)[number];

export function isCollectionIcon(value: unknown): value is CollectionIcon {
  return typeof value === 'string' && (COLLECTION_ICONS as readonly string[]).includes(value);
}
