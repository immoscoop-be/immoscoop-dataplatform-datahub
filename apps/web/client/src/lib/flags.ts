/**
 * Flagged queries (DEC-UX-236): the queries a User keeps in a row on top of every screen of Query, to work on several
 * side by side and jump between them with Cmd+1 to Cmd+0, Ctrl on Windows and Linux. At most ten, one for each key,
 * kept in their order with the settings of the User, so they follow them to every computer (OP-UX-84).
 */

/** At most ten: an eleventh would have no key (OP-UX-84). */
export const MOST_FLAGGED = 10;

/** The key of the query at a place in the row: 1 to 9, then 0 for the tenth. */
export const digitOf = (at: number): string => String((at + 1) % 10);

/** The place in the row a key opens: 1 the first, 0 the tenth. */
export const placeOf = (digit: string): number => (digit === '0' ? 9 : Number(digit) - 1);

/** The row with a query flagged at its end, unless it is there already or the row is full. */
export function flag(ids: readonly string[], id: string): string[] {
  return ids.includes(id) || ids.length >= MOST_FLAGGED ? [...ids] : [...ids, id];
}

/** The row without a query. */
export function unflag(ids: readonly string[], id: string): string[] {
  return ids.filter((one) => one !== id);
}

/** The row with the query at one place moved to another: the others shift, and their keys with them. */
export function moveFlag(ids: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= ids.length || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as string);
  return next;
}

/** What a flagged query tells about itself while the User is elsewhere, as its page reports it. */
export interface QueryStatus {
  /** A run is going. */
  running: boolean;
  /** Its last run failed. */
  failed: boolean;
  /** It reads what no longer exists (FR-SR-53). */
  broken: boolean;
}

/**
 * The mark on the tab of a flagged query: a run going, a result not seen yet, a run that failed while the User was
 * elsewhere, or Broken; nothing when there is nothing to tell.
 */
export type FlagMark = 'running' | 'new' | 'failed' | 'broken' | null;

export function markOf(status: QueryStatus | undefined, unseen: boolean): FlagMark {
  if (!status) return null;
  if (status.running) return 'running';
  if (status.broken) return 'broken';
  if (unseen) return status.failed ? 'failed' : 'new';
  return null;
}

/** Whether the keys are those of a Mac: Cmd there, Ctrl elsewhere. */
export function onMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad/i.test(platform || navigator.userAgent);
}

/** Whether a key was pressed with Cmd on a Mac, or with Ctrl elsewhere, and without the other. */
export function withMod(event: KeyboardEvent, mac: boolean): boolean {
  return mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

/** How the key that goes with the numbers is written: ⌘ on a Mac, Ctrl elsewhere. */
export const modLabel = (mac: boolean): string => (mac ? '⌘' : 'Ctrl+');
