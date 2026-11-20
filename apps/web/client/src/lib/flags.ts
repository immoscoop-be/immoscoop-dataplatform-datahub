/**
 * The row on top of every screen of Query (DEC-UX-317, DEC-UX-319): while a Project is active, a tab for its details
 * and then its queries, to work on several side by side and jump between them with Cmd+1 to Cmd+0, Ctrl on Windows and
 * Linux. A Project holds any number of queries (DEC-SR-49): the first ten keep a key, any further one has none
 * (DEC-UX-283, OP-UX-96). There are no flagged queries (DEC-UX-316).
 */

/** How many in the row have a key: Cmd+1 to Cmd+9, then Cmd+0 (DEC-UX-283). */
export const KEYED = 10;

/** Whether the query at a place in the row has a key. */
export const keyed = (at: number): boolean => at >= 0 && at < KEYED;

/** The key of the query at a place in the row: 1 to 9, then 0 for the tenth. */
export const digitOf = (at: number): string => String((at + 1) % 10);

/** The place in the row a key opens: 1 the first, 0 the tenth. */
export const placeOf = (digit: string): number => (digit === '0' ? 9 : Number(digit) - 1);

/** What a query of the row tells about itself while the User is elsewhere, as its page reports it. */
export interface QueryStatus {
  /** A run is going. */
  running: boolean;
  /** Its last run failed. */
  failed: boolean;
  /** It reads what no longer exists (FR-SR-53). */
  broken: boolean;
}

/**
 * The mark on the tab of a query of the row: a run going, a result not seen yet, a run that failed while the User was
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
