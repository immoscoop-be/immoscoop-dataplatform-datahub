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
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type MarkerPlace = keyof typeof MARKERS;
