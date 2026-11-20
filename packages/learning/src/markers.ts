/**
 * Where a marker stands on system text, and the Learning Cards its pop-out lists, most fitting first
 * (FR-LR-35, FR-LR-36). Placing them is part of the release checks of every functionality (DEC-LR-22); a
 * pop-out lists only the cards that are written, and a place shows its marker once one of them is
 * (DEC-LR-28).
 */
export const MARKERS = {
  /** The Level of a Resource, in its status row (DEC-LR-30). */
  level: ['K5.2', '3.3.3'],
  /** The grain of a Resource. */
  grain: ['2.3.5', '1.2.2', '1.2.1'],
  /** The model type of a Resource, wherever it shows (FR-LR-39). */
  modelType: ['2.3.6'],
  /** "Mark as seen" on a change since the last Confirmation. */
  changesSeen: ['4.3.2', '4.3.1'],
  /** The terms of the dictionary on a Resource (DEC-UX-279): their marker shows their definition first (`terms.ts`). */
  businessDescription: ['K5.14'],
  keyField: ['K5.15'],
  knownGap: ['K5.3'],
  pitfall: ['K5.16'],
  knownBehaviour: ['3.3.3'],
  reliableSince: ['K5.17'],
  dateField: ['K5.17'],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type MarkerPlace = keyof typeof MARKERS;

/** Where each marker stands on a screen, in words, for whoever checks where a card is met (`scripts/learning-card.ts links`). */
export const MARKER_PLACES = {
  level: 'the Level of a Resource, in the status row of its page',
  grain: 'the grain of a Resource, on its overview',
  modelType: 'the model type of a Resource, on its overview',
  changesSeen: '"Mark as seen" on a change since the last Confirmation, on the page of a Resource',
  businessDescription: 'the Business Description of a Resource and of its fields, on its overview, in its Columns and in the Owner Journey in Claude',
  keyField: 'the Key Fields of a Resource, on its overview and in the Owner Journey in Claude',
  knownGap: 'the Known Gaps of a Resource, on its overview and in the Owner Journey in Claude',
  pitfall: 'the Pitfalls of a Resource, on its overview and in the Owner Journey in Claude',
  knownBehaviour: 'Known behaviour of a Resource, on its overview',
  reliableSince: 'Reliable since of a Resource, on top of its Known Gaps and in the Owner Journey in Claude',
  dateField: 'the Date Field of a Resource, where Reliable since is set and in the Owner Journey in Claude',
} as const satisfies Readonly<Record<MarkerPlace, string>>;
