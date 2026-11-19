import { digitOf } from './flags.js';
import type { ProjectQuery } from './projects.js';

/**
 * What the page of a Project works out from its queries (DEC-UX-285): the key of a place in its one order, what a
 * query reads in a few words, its last run of all, and the order with a query put back where it was (OP-UX-106).
 */

/** The digit of a place in the order: 1 to 9, then 0 for the tenth; none further on (DEC-UX-283). */
export function keyAt(at: number): string | null {
  return at < 10 ? digitOf(at) : null;
}

/** What a query reads, as its row says it: the first Resource and how many more, such as "Weekly lead volume +1". */
export function readsOf(resources: readonly { displayName: string }[] | undefined): { first: string; more: number } | null {
  const [first] = resources ?? [];
  return first ? { first: first.displayName, more: (resources?.length ?? 1) - 1 } : null;
}

/** The last run of any query of the Project, for its line of facts. */
export function lastRunOf(queries: readonly ProjectQuery[]): NonNullable<ProjectQuery['lastRun']> | null {
  let last: NonNullable<ProjectQuery['lastRun']> | null = null;
  for (const query of queries) {
    if (query.lastRun && (!last || Date.parse(query.lastRun.startedAt) > Date.parse(last.startedAt))) last = query.lastRun;
  }
  return last;
}

/** The order with a query put back at the place it had, as Undo does after it was taken out (OP-UX-106). */
export function putBack(ids: readonly string[], id: string, at: number): string[] {
  const without = ids.filter((one) => one !== id);
  const place = Math.max(0, Math.min(at, without.length));
  return [...without.slice(0, place), id, ...without.slice(place)];
}
