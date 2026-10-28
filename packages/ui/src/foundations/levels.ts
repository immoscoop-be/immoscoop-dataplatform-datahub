/**
 * The Levels of maturity, from 0 · Beta to 5 · Monitored (Maturity). Their names are Defined Terms,
 * English in every language, never translated (NFR-LOC-01).
 */
export const LEVELS = ['Beta', 'Available', 'Described', 'Confirmed', 'Explored', 'Monitored'] as const;

export type Level = 0 | 1 | 2 | 3 | 4 | 5;

/** A Level as the interface writes it, such as "1 · Available". */
export function levelName(level: number): string {
  return `${level} · ${LEVELS[level] ?? '?'}`;
}
