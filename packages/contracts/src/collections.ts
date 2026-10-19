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
