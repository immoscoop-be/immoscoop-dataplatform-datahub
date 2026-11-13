import type { IconName } from '@datahub/ui/foundations/icons.js';

/**
 * The quick window (DEC-UX-237): Cmd+Shift+P or Cmd+K (Ctrl on Windows and Linux) anywhere in Data Hub. A row is a
 * command of the screen or of Data Hub, or a place to go to: a section, a flagged query, or something the User may see.
 */
export interface QuickRow {
  /** Unique among the rows. */
  key: string;
  /** The group it shows under, such as This query, Resources or Go to. */
  group: QuickGroup;
  icon: IconName;
  title: string;
  /** What tells it apart, such as its Collection and Level, or what a command does. */
  meta?: string;
  /** Its key, if it has one, such as ⌘1 or ⇧⌥F. */
  keys?: string;
  /** What it is, on the right: Command, Resource, Section… */
  kind: string;
  /** Other words it is found by, such as "copy" for New query from this one. */
  words?: string;
  /** It cannot be done right now: greyed, with why under it (DEC-UX-207). */
  why?: string;
  /** What Enter does with it: a command is done, a place opened or gone to. */
  does: 'do' | 'open' | 'go';
  run: () => void;
}

/** The groups, in the order the window shows them when something is typed (OP-UX-88). */
export const QUICK_GROUPS = ['screen', 'commands', 'flagged', 'resources', 'collections', 'lenses', 'queries', 'cards', 'goTo'] as const;
export type QuickGroup = (typeof QUICK_GROUPS)[number];

/** How many rows of a group show when something is typed: four, the commands of the screen all (OP-UX-88). */
export const PER_GROUP = 4;

/** How well a row matches what was typed: its name starting with it, a word starting with it, or it inside; 0 is not at all. */
export function scoreOf(row: Pick<QuickRow, 'title' | 'words' | 'meta'>, typed: string): number {
  const words = typed.trim().toLowerCase();
  if (!words) return 1;
  const title = row.title.toLowerCase();
  const all = `${title} ${(row.words ?? '').toLowerCase()} ${(row.meta ?? '').toLowerCase()}`;
  if (title.startsWith(words)) return 3;
  if (all.split(/[^\p{L}\p{N}]+/u).some((word) => word.startsWith(words))) return 2;
  return all.includes(words) ? 1 : 0;
}

/**
 * What the window lists. Nothing typed: the commands of the screen, the flagged queries, then Go to. Typed: every group
 * in its order, the rows that match best first, four at most a group.
 */
export function rowsFor(rows: readonly QuickRow[], typed: string): QuickRow[] {
  const words = typed.trim();
  if (!words) return ['screen', 'flagged', 'goTo'].flatMap((group) => rows.filter((row) => row.group === group));
  return QUICK_GROUPS.flatMap((group) =>
    rows
      .filter((row) => row.group === group)
      .map((row) => ({ row, score: scoreOf(row, words) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, group === 'screen' ? Number.POSITIVE_INFINITY : PER_GROUP)
      .map(({ row }) => row),
  );
}

/** The first row Enter can do: a greyed one never is. */
export function firstActive(rows: readonly QuickRow[]): number {
  return rows.findIndex((row) => !row.why);
}

/** The next row Enter can do, up or down, round the list; where it is when there is none. */
export function stepFrom(rows: readonly QuickRow[], at: number, by: 1 | -1): number {
  if (at < 0 || rows.length === 0) return at;
  let next = at;
  for (let tried = 0; tried < rows.length; tried += 1) {
    next = (next + by + rows.length) % rows.length;
    if (!rows[next]?.why) return next;
  }
  return at;
}
