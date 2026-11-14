import { getContext, setContext, untrack } from 'svelte';
import type { IconName } from '@datahub/ui/foundations/icons.js';
import { t } from '@datahub/ui/foundations/texts.svelte.js';
import type { QuickRow } from './quick.js';

/**
 * The commands of the screen that is open, for the quick window (DEC-UX-237, DEC-UX-240): every button of the screen
 * that does something to what it shows has its command. A screen, and a part of it that holds its own buttons, tells
 * them here while it is shown; the quick window lists them first, in the order the screen and its parts told them.
 */
export interface CommandSet {
  /** The name of the group they show under, such as This Resource. */
  group: string;
  /** Where the quick window opened, such as "Resource · Weekly lead volume"; null keeps the section. */
  where?: string | null;
  rows: QuickRow[];
}

/** What the screens that are shown tell, each its own set, in the order they came. */
export class ScreenCommands {
  /** Goes to another page of Data Hub. */
  readonly go: (path: string) => void;
  constructor(go: (path: string) => void) {
    this.go = go;
  }
  sets = $state.raw<(CommandSet & { id: number })[]>([]);
  /** Every command of the screen, those of the screen itself first. */
  get rows(): QuickRow[] {
    return this.sets.flatMap((set) => set.rows);
  }
  get group(): string | null {
    return this.sets.find((set) => set.rows.length > 0)?.group ?? null;
  }
  get where(): string | null {
    return this.sets.find((set) => set.where)?.where ?? null;
  }
}

const KEY = Symbol('screen commands');
let told = 0;

/** The App keeps the commands of the screen for its quick window. */
export function provideScreenCommands(go: (path: string) => void): ScreenCommands {
  const commands = new ScreenCommands(go);
  setContext(KEY, commands);
  return commands;
}

/**
 * A screen, or a part of it, tells what can be done on it now; called once, while the component starts. What `read`
 * returns is followed as it changes, and taken away when the component goes. `read` gets how to go to another page.
 */
export function useScreenCommands(read: (go: (path: string) => void) => CommandSet | null): void {
  const commands = getContext<ScreenCommands | undefined>(KEY);
  if (!commands) return;
  const id = ++told;
  $effect(() => {
    const set = read(commands.go);
    untrack(() => {
      const others = commands.sets.filter((one) => one.id !== id);
      commands.sets = set ? [...others, { ...set, id }].sort((a, b) => a.id - b.id) : others;
    });
  });
  $effect(() => () => untrack(() => (commands.sets = commands.sets.filter((one) => one.id !== id))));
}

/** A command of the screen: done by Enter, greyed with why when it cannot be done now (DEC-UX-207). */
export function command(key: string, icon: IconName, title: string, run: () => void, more: Partial<QuickRow> = {}): QuickRow {
  return { key: `screen:${key}`, group: 'screen', icon, title, kind: t('quick.kind.command'), does: 'do', run, ...more };
}

/** A place the screen leads to, such as its Owner Unit or the Resource to use instead: Enter goes there. */
export function place(key: string, icon: IconName, title: string, go: () => void, more: Partial<QuickRow> = {}): QuickRow {
  return command(key, icon, title, go, { does: 'go', ...more });
}

/** Another tab or part of the screen, such as the Columns of a Resource: Enter shows it. */
export function view(key: string, icon: IconName, name: string, show: () => void, more: Partial<QuickRow> = {}): QuickRow {
  return command(key, icon, t('quick.show', { name }), show, more);
}
